import { randomUUID } from "node:crypto"
import {
  ALLOWED_PACKAGE_TABLES,
  FORBIDDEN_PACKAGE_TABLES,
  type AllowedPackageTable,
  type PackageMode,
  type SyncPackagePayload,
  type TableSyncMode,
} from "../../sync/package-schema"
import { sha256, stableStringify } from "./stable-json"

interface PackageTableInput {
  tableName: AllowedPackageTable
  syncMode: TableSyncMode
  records: Record<string, unknown>[]
}

export interface BuildPackageInput {
  siteCode: string
  version: string
  snapshotAt?: string
  batchId?: string
  tables: PackageTableInput[]
}

function packageMode(tables: PackageTableInput[]): PackageMode {
  const modes = new Set(tables.map((table) => table.syncMode))
  if (modes.size > 1 || modes.has("aggregate")) return "mixed"
  return modes.has("incremental") ? "incremental" : "full"
}

function newBatchId(siteCode: string, snapshotAt: string): string {
  return `${siteCode}-${snapshotAt.replace(/[:.]/g, "-")}-${randomUUID()}`
}

export function buildSyncPackage(
  input: BuildPackageInput
): SyncPackagePayload {
  if (!input.siteCode.trim()) throw new Error("siteCode is required")
  if (!input.version.trim()) throw new Error("version is required")
  if (input.tables.length === 0) throw new Error("package tables are required")

  for (const table of input.tables) {
    if (
      !ALLOWED_PACKAGE_TABLES.includes(table.tableName) ||
      FORBIDDEN_PACKAGE_TABLES.includes(table.tableName as never)
    ) {
      throw new Error(`package table is forbidden: ${table.tableName}`)
    }
  }

  const snapshotAt = input.snapshotAt ?? new Date().toISOString()
  const base: Omit<SyncPackagePayload, "checksum"> = {
    siteCode: input.siteCode,
    batchId: input.batchId ?? newBatchId(input.siteCode, snapshotAt),
    snapshotAt,
    mode: packageMode(input.tables),
    version: input.version,
    tables: input.tables.map((table) => ({
      tableName: table.tableName,
      syncMode: table.syncMode,
      recordCount: table.records.length,
      records: table.records,
    })),
  }
  return {
    ...base,
    checksum: sha256(stableStringify(base)),
  }
}
