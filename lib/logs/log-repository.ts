/**
 * lib/logs/log-repository.ts
 * Sprint R.57 — center-owned log read path
 *
 * Selection:
 *   1. ClickHouse configured  -> query ClickHouse (task_logs/system_logs)
 *   2. otherwise              -> center PG logs (sync_package_log,
 *      sync_table_log, sync_scheduler_log, sync_consistency_log,
 *      control_command, audit_log) via /api/logs union
 *   3. otherwise              -> return blocked_by_external_system
 *
 * Never returns mock log data.
 */

import { query } from "@/lib/db/postgres"
import {
  isClickHouseConfigured,
  queryClickHouseLogs,
  type ClickHouseLogRecord,
} from "@/lib/logs/clickhouse-client"

export type LogSource = "clickhouse" | "center_pg" | "blocked_by_external_system"

export interface LogRepositoryQuery {
  keyword?: string
  siteCode?: string
  limit?: number
  offset?: number
}

export interface LogRepositoryResult {
  source: LogSource
  items: Array<{
    logId: string
    siteCode: string | null
    level?: string
    message?: string
    taskId?: string | null
    operator?: string | null
    deviceId?: string | null
    discNo?: string | null
    errorCode?: string | null
    errorMessage?: string | null
    occurredAt: string
  }>
  total: number
  missingDimensions: string[]
  requirements: string[]
  blocker: string | null
}

export async function searchLogs(
  query_: LogRepositoryQuery
): Promise<LogRepositoryResult> {
  const limit = Math.min(query_.limit ?? 50, 500)
  const offset = query_.offset ?? 0

  if (isClickHouseConfigured()) {
    try {
      const ch = await queryClickHouseLogs({
        keyword: query_.keyword,
        siteCode: query_.siteCode,
        limit,
        offset,
      })
      if (ch.items.length > 0 || query_.keyword) {
        return {
          source: "clickhouse",
          items: ch.items.map(toRepoItem),
          total: ch.total,
          missingDimensions: [],
          requirements: ["REQ-5.1.1", "REQ-5.1.3"],
          blocker: null,
        }
      }
    } catch {
      // fall through to PG
    }
  }

  return await queryCenterPgLogs(query_.keyword, query_.siteCode, limit, offset)
}

function toRepoItem(r: ClickHouseLogRecord) {
  return {
    logId: r.logId,
    siteCode: r.siteCode,
    level: r.level,
    message: r.message,
    taskId: r.taskId ?? null,
    operator: r.operator ?? null,
    deviceId: r.deviceId ?? null,
    discNo: r.discNo ?? null,
    errorCode: r.errorCode ?? null,
    errorMessage: r.errorMessage ?? null,
    occurredAt: r.occurredAt,
  }
}

async function queryCenterPgLogs(
  keyword: string | undefined,
  siteCode: string | undefined,
  limit: number,
  offset: number
): Promise<LogRepositoryResult> {
  const conds: string[] = ["1=1"]
  const params: unknown[] = []
  if (keyword) {
    params.push(`%${keyword}%`)
    conds.push(`(action ILIKE $${params.length} OR target_id::text ILIKE $${params.length} OR command_no ILIKE $${params.length})`)
  }
  if (siteCode) {
    params.push(siteCode)
    conds.push(`site_code = $${params.length}`)
  }
  params.push(limit, offset)
  const r = await query<{
    id: string
    site_code: string | null
    action: string
    target_id: string | null
    actor: string | null
    result: string
    created_at: string
    error_message: string | null
  }>(
    `SELECT id, site_code, action, target_id, actor, result, created_at, error_message
     FROM audit_log
     WHERE ${conds.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return {
    source: "center_pg",
    items: r.rows.map((row) => ({
      logId: row.id,
      siteCode: row.site_code,
      message: `${row.action} ${row.target_id ?? ""} -> ${row.result}`,
      taskId: null,
      operator: row.actor,
      deviceId: null,
      discNo: null,
      errorCode: null,
      errorMessage: row.error_message,
      occurredAt: row.created_at,
    })),
    total: r.rows.length,
    missingDimensions: ["device_id", "disc_no", "file_list", "level"],
    requirements: ["REQ-5.1.1", "REQ-5.1.3"],
    blocker: isClickHouseConfigured()
      ? "clickhouse_query_failed"
      : "clickhouse_not_configured",
  }
}
