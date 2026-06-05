import { query } from '@/lib/db'

export type PackageLogStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'duplicated'
export type TableLogStatus = PackageLogStatus

export interface SyncPackageLog {
  id: string
  site_code: string
  batch_id: string
  snapshot_at: Date | null
  mode: string
  version: string | null
  package_checksum: string | null
  status: PackageLogStatus
  table_count: number
  total_record_count: number
  success_table_count: number
  failed_table_count: number
  error_message: string | null
  raw_metadata: Record<string, unknown>
  started_at: Date
  finished_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface SyncTableLog {
  id: string
  package_log_id: string | null
  site_code: string
  batch_id: string
  table_name: string
  sync_mode: string
  table_checksum: string | null
  expected_record_count: number | null
  processed_record_count: number
  inserted_count: number
  updated_count: number
  skipped_count: number
  failed_count: number
  status: TableLogStatus
  error_message: string | null
  started_at: Date
  finished_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface CreatePackageLogInput {
  siteCode: string
  batchId: string
  snapshotAt?: string | Date | null
  mode: string
  version?: string | null
  packageChecksum?: string | null
  status?: PackageLogStatus
  tableCount?: number
  totalRecordCount?: number
  rawMetadata?: Record<string, unknown>
}

export interface CreateTableLogInput {
  packageLogId: string
  siteCode: string
  batchId: string
  tableName: string
  syncMode: string
  tableChecksum?: string | null
  expectedRecordCount?: number | null
  status?: TableLogStatus
}

export interface PackageSummary {
  tableCount?: number
  totalRecordCount?: number
  successTableCount?: number
  failedTableCount?: number
}

export interface TableSummary {
  processedRecordCount?: number
  insertedCount?: number
  updatedCount?: number
  skippedCount?: number
  failedCount?: number
}

export interface PackageLogFilters {
  siteCode?: string
  status?: PackageLogStatus
  limit?: number
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function clampLimit(limit: number | undefined): number {
  if (!limit || Number.isNaN(limit)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(limit, MAX_LIMIT))
}

function packageRow(row: SyncPackageLog): SyncPackageLog {
  return row
}

function tableRow(row: SyncTableLog): SyncTableLog {
  return row
}

export async function createPackageLog(input: CreatePackageLogInput): Promise<SyncPackageLog> {
  const sql = `
    INSERT INTO sync_package_log (
      site_code, batch_id, snapshot_at, mode, version, package_checksum,
      status, table_count, total_record_count, raw_metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    ON CONFLICT (site_code, batch_id) DO UPDATE SET
      updated_at = NOW()
    RETURNING *
  `
  const result = await query<SyncPackageLog>(sql, [
    input.siteCode,
    input.batchId,
    input.snapshotAt ?? null,
    input.mode,
    input.version ?? null,
    input.packageChecksum ?? null,
    input.status ?? 'pending',
    input.tableCount ?? 0,
    input.totalRecordCount ?? 0,
    JSON.stringify(input.rawMetadata ?? {}),
  ])
  return packageRow(result.rows[0])
}

export async function markPackageRunning(id: string): Promise<void> {
  await query(
    `UPDATE sync_package_log
     SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
     WHERE id = $1`,
    [id]
  )
}

export async function markPackageSuccess(id: string, summary: PackageSummary = {}): Promise<void> {
  await query(
    `UPDATE sync_package_log
     SET status = 'success',
         finished_at = NOW(),
         table_count = COALESCE($2, table_count),
         total_record_count = COALESCE($3, total_record_count),
         success_table_count = COALESCE($4, success_table_count),
         failed_table_count = COALESCE($5, failed_table_count),
         error_message = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      summary.tableCount ?? null,
      summary.totalRecordCount ?? null,
      summary.successTableCount ?? null,
      summary.failedTableCount ?? null,
    ]
  )
}

export async function markPackageFailed(
  id: string,
  input: { errorMessage: string } & PackageSummary
): Promise<void> {
  await query(
    `UPDATE sync_package_log
     SET status = 'failed',
         finished_at = NOW(),
         table_count = COALESCE($2, table_count),
         total_record_count = COALESCE($3, total_record_count),
         success_table_count = COALESCE($4, success_table_count),
         failed_table_count = COALESCE($5, failed_table_count),
         error_message = $6,
         updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      input.tableCount ?? null,
      input.totalRecordCount ?? null,
      input.successTableCount ?? null,
      input.failedTableCount ?? null,
      input.errorMessage,
    ]
  )
}

export async function findPackageByBatch(siteCode: string, batchId: string): Promise<SyncPackageLog | null> {
  const result = await query<SyncPackageLog>(
    `SELECT * FROM sync_package_log WHERE site_code = $1 AND batch_id = $2 LIMIT 1`,
    [siteCode, batchId]
  )
  return result.rows[0] ? packageRow(result.rows[0]) : null
}

export async function createTableLog(input: CreateTableLogInput): Promise<SyncTableLog> {
  const sql = `
    INSERT INTO sync_table_log (
      package_log_id, site_code, batch_id, table_name, sync_mode,
      table_checksum, expected_record_count, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (site_code, batch_id, table_name) DO UPDATE SET
      updated_at = NOW()
    RETURNING *
  `
  const result = await query<SyncTableLog>(sql, [
    input.packageLogId,
    input.siteCode,
    input.batchId,
    input.tableName,
    input.syncMode,
    input.tableChecksum ?? null,
    input.expectedRecordCount ?? null,
    input.status ?? 'pending',
  ])
  return tableRow(result.rows[0])
}

export async function markTableSuccess(id: string, summary: TableSummary = {}): Promise<void> {
  await query(
    `UPDATE sync_table_log
     SET status = 'success',
         finished_at = NOW(),
         processed_record_count = COALESCE($2, processed_record_count),
         inserted_count = COALESCE($3, inserted_count),
         updated_count = COALESCE($4, updated_count),
         skipped_count = COALESCE($5, skipped_count),
         failed_count = COALESCE($6, failed_count),
         error_message = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      summary.processedRecordCount ?? null,
      summary.insertedCount ?? null,
      summary.updatedCount ?? null,
      summary.skippedCount ?? null,
      summary.failedCount ?? null,
    ]
  )
}

export async function markTableFailed(
  id: string,
  input: { errorMessage: string } & TableSummary
): Promise<void> {
  await query(
    `UPDATE sync_table_log
     SET status = 'failed',
         finished_at = NOW(),
         processed_record_count = COALESCE($2, processed_record_count),
         inserted_count = COALESCE($3, inserted_count),
         updated_count = COALESCE($4, updated_count),
         skipped_count = COALESCE($5, skipped_count),
         failed_count = COALESCE($6, failed_count),
         error_message = $7,
         updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      input.processedRecordCount ?? null,
      input.insertedCount ?? null,
      input.updatedCount ?? null,
      input.skippedCount ?? null,
      input.failedCount ?? null,
      input.errorMessage,
    ]
  )
}

export async function listPackageLogs(filters: PackageLogFilters = {}): Promise<SyncPackageLog[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (filters.siteCode) {
    conditions.push(`site_code = $${paramIndex++}`)
    params.push(filters.siteCode)
  }
  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`)
    params.push(filters.status)
  }

  params.push(clampLimit(filters.limit))
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await query<SyncPackageLog>(
    `SELECT * FROM sync_package_log ${where} ORDER BY created_at DESC LIMIT $${paramIndex}`,
    params
  )
  return result.rows.map(packageRow)
}

export async function listTableLogs(packageLogId: string): Promise<SyncTableLog[]> {
  const result = await query<SyncTableLog>(
    `SELECT * FROM sync_table_log WHERE package_log_id = $1 ORDER BY created_at ASC`,
    [packageLogId]
  )
  return result.rows.map(tableRow)
}
