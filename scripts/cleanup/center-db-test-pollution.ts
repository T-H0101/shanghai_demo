/**
 * Center DB Test Pollution Cleanup (R.83.1)
 *
 * Idempotent deletion of TEST_* / PKG_TEST / R19C e2e rows from center tables.
 * - Default: --dry-run (no deletion, just scan + dump plan)
 * - With --apply: actually DELETE rows + dump to archive/cleanup-<YYYYMMDD>/
 * - Always dumps matched rows to archive before any DELETE
 *
 * Exit code:
 *   0 = success (including "0 matches")
 *   1 = unexpected error
 *   2 = invalid usage (no --dry-run or --apply flag)
 */

import { Pool } from "pg"
import { mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { loadEnv } from "../lib/load-env"

loadEnv()

const DRY_RUN = process.argv.includes("--dry-run")
const APPLY = process.argv.includes("--apply")
const archiveArg = process.argv.find((a) => a.startsWith("--archive-dir="))
const ARCHIVE_DIR_OVERRIDE = archiveArg ? archiveArg.split("=")[1] : null
const siteCodeArg = process.argv.find((a) => a.startsWith("--site-code="))
const EXACT_SITE_CODE = siteCodeArg ? siteCodeArg.split("=")[1] : null

if (!DRY_RUN && !APPLY) {
  console.error("MUST pass --dry-run or --apply")
  console.error("  Example: pnpm cleanup:test-pollution -- --dry-run")
  console.error("           pnpm cleanup:test-pollution -- --apply")
  process.exit(2)
}

const TEST_PATTERN = "^(TEST_|PKG_TEST$|R19C[0-9]+$)"
type Target = { table: string; cols: string[] }

function quoteIdent(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`
}

async function discoverTargets(pool: Pool): Promise<Target[]> {
  const unifiedColumns = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name LIKE 'unified_%'
       AND column_name IN ('source_site_id', 'site_code')
     ORDER BY table_name, column_name`
  )
  const byTable = new Map<string, string[]>()
  for (const row of unifiedColumns.rows) {
    const cols = byTable.get(row.table_name) ?? []
    cols.push(row.column_name)
    byTable.set(row.table_name, cols)
  }
  return [
    { table: "sync_package_log", cols: ["site_code"] },
    ...Array.from(byTable.entries()).map(([table, cols]) => ({ table, cols })),
  ]
}

function whereClause(cols: string[]) {
  const op = EXACT_SITE_CODE ? "=" : "~"
  return cols.map((col) => `${quoteIdent(col)} ${op} $1`).join(" OR ")
}

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error("DATABASE_URL not set")
  const pool = new Pool({ connectionString: dbUrl })

  const mode = DRY_RUN ? "DRY-RUN" : "APPLY"
  const matcher = EXACT_SITE_CODE ? `site_code=${EXACT_SITE_CODE}` : TEST_PATTERN
  console.log(`[${mode}] scanning center tables for ${matcher}`)

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const archiveDir = ARCHIVE_DIR_OVERRIDE ?? join("archive", `cleanup-${today}`)

  let totalAffected = 0
  const summary: Array<{ table: string; matched: number; action: string; archiveFile: string | null }> = []

  // R.94: legacy smoke fixture cleanup — hard_disks source_record_id='101' came from
  // a pre-R.83.1 smoke sync fixture that no longer exists in source. It is test pollution
  // because source_restore.tbl_hd_info has 0 rows with slot_id=101.
  if (!EXACT_SITE_CODE) {
    const legacyResult = await pool.query<{ source_record_id: string }>(
      `SELECT source_record_id FROM unified_hard_disks WHERE source_record_id = '101'`
    )
    const legacyCount = legacyResult.rowCount ?? 0
    if (legacyCount > 0) {
      mkdirSync(archiveDir, { recursive: true })
      const archivePath = join(archiveDir, `unified_hard_disks-legacy-fixture.jsonl`)
      writeFileSync(archivePath, legacyResult.rows.map((r) => JSON.stringify(r)).join("\n") + "\n")
      if (APPLY) {
        await pool.query(`DELETE FROM unified_hard_disks WHERE source_record_id = '101'`)
        summary.push({ table: "unified_hard_disks", matched: legacyCount, action: "deleted (legacy fixture)", archiveFile: archivePath })
        console.log(`[${mode}] unified_hard_disks: deleted ${legacyCount} legacy fixture rows (slot_id=101) -> ${archivePath}`)
      } else {
        summary.push({ table: "unified_hard_disks", matched: legacyCount, action: "would-delete (legacy fixture)", archiveFile: archivePath })
        console.log(`[${mode}] unified_hard_disks: would delete ${legacyCount} legacy fixture rows (slot_id=101)`)
      }
      totalAffected += legacyCount
    }
  }

  const targets = await discoverTargets(pool)

  for (const t of targets) {
    const predicate = whereClause(t.cols)
    const tableName = quoteIdent(t.table)
    const rows = await pool.query(`SELECT * FROM ${tableName} WHERE ${predicate}`, [
      EXACT_SITE_CODE ?? TEST_PATTERN,
    ])
    const n = rows.rowCount ?? 0
    totalAffected += n

    if (n > 0) {
      mkdirSync(archiveDir, { recursive: true })
      const archivePath = join(archiveDir, `${t.table}.jsonl`)
      writeFileSync(archivePath, rows.rows.map((r) => JSON.stringify(r)).join("\n") + "\n")

      if (APPLY) {
        await pool.query(`DELETE FROM ${tableName} WHERE ${predicate}`, [
          EXACT_SITE_CODE ?? TEST_PATTERN,
        ])
        summary.push({ table: t.table, matched: n, action: "deleted", archiveFile: archivePath })
        console.log(`[${mode}] ${t.table}: deleted ${n} rows (dumped to ${archivePath})`)
      } else {
        summary.push({ table: t.table, matched: n, action: "would-delete", archiveFile: archivePath })
        console.log(`[${mode}] ${t.table}: would delete ${n} rows (dumped to ${archivePath})`)
      }
    } else {
      summary.push({ table: t.table, matched: 0, action: "skipped", archiveFile: null })
      console.log(`[${mode}] ${t.table}: 0 matches`)
    }
  }

  console.log(`\n[${mode}] TOTAL affected: ${totalAffected} rows`)
  if (totalAffected > 0) {
    console.log(`[${mode}] archive dir: ${archiveDir}`)
  }

  await pool.end()
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
