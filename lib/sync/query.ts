/**
 * 同步查询 API
 * Sprint 2B.3 - sync status and log query APIs
 */

import { query } from '@/lib/db'
import type { SyncStatusDTO, SyncLogDTO } from './dto'

interface ProgressFilters {
  site?: string
  table?: string
}

interface LogsFilters {
  site?: string
  table?: string
}

/**
 * 查询同步进度
 * @param filters - 可选过滤条件：site（站点代码）、table（表名）
 * @returns 同步状态列表
 */
export async function queryProgress(
  filters: ProgressFilters = {}
): Promise<SyncStatusDTO[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (filters.site) {
    conditions.push(`source_site_id = $${paramIndex++}`)
    params.push(filters.site)
  }
  if (filters.table) {
    conditions.push(`source_table = $${paramIndex++}`)
    params.push(filters.table)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const sql = `
    SELECT source_site_id, source_table, last_source_id, last_sync_time,
           last_status, synced_rows, last_error
    FROM sync_progress
    ${whereClause}
    ORDER BY source_site_id, source_table
  `

  const result = await query(sql, params)
  return result.rows.map((row) => ({
    siteId: row.source_site_id as string,
    tableName: row.source_table as string,
    lastSourceId: Number(row.last_source_id),
    lastSyncTime: row.last_sync_time ? new Date(row.last_sync_time as Date).toISOString() : null,
    lastStatus: row.last_status as SyncStatusDTO['lastStatus'],
    syncedRows: Number(row.synced_rows),
    lastError: row.last_error as string | null,
  }))
}

/**
 * 查询同步日志
 * @param filters - 可选过滤条件：site（站点代码）、table（表名）
 * @param limit - 返回条数限制（1-100，默认 10）
 * @returns 同步日志列表
 */
export async function queryLogs(
  filters: LogsFilters = {},
  limit: number = 10
): Promise<SyncLogDTO[]> {
  const safeLimit = clampLimit(limit)

  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (filters.site) {
    conditions.push(`site_code = $${paramIndex++}`)
    params.push(filters.site)
  }
  if (filters.table) {
    conditions.push(`table_name = $${paramIndex++}`)
    params.push(filters.table)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // R.92.1: 改用 sync_table_log (R.83.9 dispatcher 实际写入, 不是 sync_job_log)
  const sql = `
    SELECT site_code, table_name, status,
           processed_record_count, skipped_count, failed_count,
           error_message, started_at, finished_at
    FROM sync_table_log
    ${whereClause}
    ORDER BY started_at DESC NULLS LAST
    LIMIT $${paramIndex}
  `

  params.push(safeLimit)

  const result = await query(sql, params)
  return result.rows.map((row) => ({
    siteId: row.source_site_id as string,
    tableName: row.source_table as string,
    jobId: row.job_id as string,
    status: row.status as SyncLogDTO['status'],
    rowsRead: Number(row.rows_read),
    rowsUpserted: Number(row.rows_upserted),
    rowsSkipped: Number(row.rows_skipped),
    error: row.error_message as string | null,
    startedAt: new Date(row.started_at as Date).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at as Date).toISOString() : null,
  }))
}

/**
 * limit 参数钳制（1-100）
 * @param limit - 原始 limit 值
 * @returns 钳制后的 limit 值
 */
export function clampLimit(limit: number): number {
  return Math.min(Math.max(1, limit), 100)
}