/**
 * lib/sync/dump/ingest.ts
 * Sprint R.55 — ingest a parsed pg_dump `table_backup.sql` into center
 * `unified_*` tables via the existing package dispatcher.
 *
 * Reuses the same logging/dispatching as the JSON package path so that
 * the center has one ingestion audit trail regardless of transport.
 */

import { parsePgDumpCopyTables } from "./parser"
import {
  DUMP_ALLOWED_TABLES,
  type DumpAllowedTable,
} from "./manifest"
import {
  createPackageLog,
  createTableLog,
  markPackageSuccess,
  markPackageFailed,
  markTableSuccess,
  markTableFailed,
} from "@/lib/sync/package-log"
import { dispatchTable } from "@/lib/sync/package-dispatcher"

export interface IngestPgDumpInput {
  siteCode: string
  sql: string
  batchId: string
  mode: "full" | "incremental"
}

export interface IngestPgDumpResult {
  batchId: string
  siteCode: string
  packageLogId: string
  accepted: { tableName: DumpAllowedTable; rows: number }[]
  rejected: { tableName: string; reason: string }[]
}

const TABLE_MAPPING: Record<DumpAllowedTable, string | null> = {
  tbl_task: "tbl_task",
  tbl_disc_lib: "tbl_disc_lib",
  tbl_magzines: "tbl_magzines",
  tbl_slots: "tbl_slots",
  tbl_hd_info: "tbl_hd_info",
  tbl_lib_task: "tbl_lib_task",
  tbl_disc: "tbl_disc",
  tbl_logical_volume: "tbl_logical_volume",
  tbl_volume_slot: "tbl_volume_slot",
  tbl_user_task: "tbl_user_task",
  tbl_user: "tbl_user",
  tbl_site: "tbl_site",
  tbl_platform: "tbl_platform",
}

export async function ingestPgDump(input: IngestPgDumpInput): Promise<IngestPgDumpResult> {
  const parsed = parsePgDumpCopyTables(input.sql)
  const accepted: IngestPgDumpResult["accepted"] = []
  const rejected: IngestPgDumpResult["rejected"] = []

  const pkg = await createPackageLog({
    siteCode: input.siteCode,
    batchId: input.batchId,
    mode: input.mode,
    rawMetadata: { source: "pg_dump", protocol: "table_backup.sql" },
  })

  let allOk = true
  for (const tbl of parsed) {
    const target = TABLE_MAPPING[tbl.tableName]
    if (!target) {
      rejected.push({ tableName: tbl.tableName, reason: "no_dispatch_target" })
      continue
    }
    const log = await createTableLog({
      packageLogId: pkg.id,
      siteCode: input.siteCode,
      batchId: input.batchId,
      tableName: target,
      syncMode: input.mode,
    })
    try {
      const records: Record<string, unknown>[] = tbl.rows.map((row) => {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(row)) out[k] = v
        return out
      })
      const result = await dispatchTable({
        tableName: target as never,
        siteCode: input.siteCode,
        records,
      })
      if (result.status === "success" || result.status === "partial" || result.status === "skipped") {
        await markTableSuccess(log.id, {
          processedRecordCount: result.received,
          insertedCount: result.inserted,
          updatedCount: result.updated,
          skippedCount: result.skipped,
        })
        accepted.push({ tableName: tbl.tableName, rows: tbl.rows.length })
      } else {
        await markTableFailed(log.id, { errorMessage: `dispatch ${result.status}` })
        rejected.push({ tableName: tbl.tableName, reason: `dispatch_${result.status}` })
        allOk = false
      }
    } catch (err) {
      await markTableFailed(log.id, {
        errorMessage: err instanceof Error ? err.message : "unknown",
      })
      rejected.push({ tableName: tbl.tableName, reason: "exception" })
      allOk = false
    }
  }

  if (allOk) {
    await markPackageSuccess(pkg.id, { successTableCount: accepted.length })
  } else {
    await markPackageFailed(pkg.id, {
      errorMessage: "one_or_more_tables_failed",
      failedTableCount: rejected.length,
    })
  }

  return {
    batchId: input.batchId,
    siteCode: input.siteCode,
    packageLogId: pkg.id,
    accepted,
    rejected,
  }
}

// Suppress unused warning
void DUMP_ALLOWED_TABLES
