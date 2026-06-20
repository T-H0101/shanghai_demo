/**
 * Sync Request Log - 同步请求跟踪
 *
 * Sprint R.39 - REQ-2.3.2, REQ-1.2.1
 *
 * 跟踪手动同步请求的完整生命周期:
 *   pending → command_sent → agent_polled → sync_running → completed/failed
 *
 * 每个请求记录时间戳用于性能测量 (REQ-6.1.3)
 */

import { query, transaction } from "@/lib/db/postgres"
import { randomBytes } from "crypto"

export interface SyncRequestRow {
  id: string
  request_no: string
  source_site_id: string
  sync_type: "full" | "incremental"
  command_id: string | null
  status: string
  requested_by: string | null
  requested_ip: string | null
  requested_at: string
  agent_polled_at: string | null
  sync_started_at: string | null
  sync_completed_at: string | null
  package_log_id: string | null
  error_message: string | null
  timing_json: Record<string, unknown> | null
  created_at: string
}

export type SyncRequestStatus =
  | "pending"
  | "command_sent"
  | "agent_polled"
  | "sync_running"
  | "completed"
  | "failed"
  | "timeout"

function generateRequestNo(siteId: string): string {
  const ts = Date.now().toString(36)
  const rand = randomBytes(2).toString("hex")
  return `SYNC-${siteId}-${ts}-${rand}`
}

/**
 * 创建同步请求
 */
export async function createSyncRequest(input: {
  sourceSiteId: string
  syncType: "full" | "incremental"
  commandId?: string
  requestedBy?: string | null
  requestedIp?: string | null
}): Promise<SyncRequestRow> {
  const requestNo = generateRequestNo(input.sourceSiteId)
  const result = await query<SyncRequestRow>(
    `INSERT INTO sync_request_log
       (request_no, source_site_id, sync_type, command_id, status, requested_by, requested_ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id::text, request_no, source_site_id, sync_type, command_id::text,
               status, requested_by, requested_ip, requested_at::text,
               agent_polled_at::text, sync_started_at::text, sync_completed_at::text,
               package_log_id::text, error_message, timing_json, created_at::text`,
    [
      requestNo,
      input.sourceSiteId,
      input.syncType,
      input.commandId ?? null,
      input.commandId ? "command_sent" : "pending",
      input.requestedBy ?? null,
      input.requestedIp ?? null,
    ],
  )
  return result.rows[0]
}

/**
 * 更新同步请求状态
 */
export async function updateSyncRequestStatus(
  requestNo: string,
  status: SyncRequestStatus,
  extra?: { packageLogId?: string; errorMessage?: string; timing?: Record<string, unknown> },
): Promise<void> {
  const timestampField =
    status === "agent_polled" ? "agent_polled_at"
    : status === "sync_running" ? "sync_started_at"
    : status === "completed" || status === "failed" ? "sync_completed_at"
    : null

  const updates: string[] = ["status = $2"]
  const values: unknown[] = [requestNo, status]
  let idx = 3

  if (timestampField) {
    updates.push(`${timestampField} = NOW()`)
  }
  if (extra?.packageLogId) {
    updates.push(`package_log_id = $${idx}`)
    values.push(extra.packageLogId)
    idx++
  }
  if (extra?.errorMessage) {
    updates.push(`error_message = $${idx}`)
    values.push(extra.errorMessage)
    idx++
  }
  if (extra?.timing) {
    updates.push(`timing_json = $${idx}::jsonb`)
    values.push(JSON.stringify(extra.timing))
    idx++
  }

  await query(
    `UPDATE sync_request_log SET ${updates.join(", ")} WHERE request_no = $1`,
    values,
  )
}

/**
 * 查询同步请求列表
 */
export async function listSyncRequests(filter: {
  sourceSiteId?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<{ rows: SyncRequestRow[]; total: number }> {
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (filter.sourceSiteId) {
    conditions.push(`source_site_id = $${idx}`)
    params.push(filter.sourceSiteId)
    idx++
  }
  if (filter.status) {
    conditions.push(`status = $${idx}`)
    params.push(filter.status)
    idx++
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
  const limit = filter.limit ?? 50
  const offset = filter.offset ?? 0

  const [countRes, dataRes] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM sync_request_log ${where}`, params),
    query<SyncRequestRow>(
      `SELECT id::text, request_no, source_site_id, sync_type, command_id::text,
              status, requested_by, requested_ip, requested_at::text,
              agent_polled_at::text, sync_started_at::text, sync_completed_at::text,
              package_log_id::text, error_message, timing_json, created_at::text
       FROM sync_request_log ${where}
       ORDER BY requested_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    ),
  ])

  return {
    rows: dataRes.rows,
    total: Number.parseInt(countRes.rows[0]?.count ?? "0", 10),
  }
}

/**
 * 通过 command_id 关联更新同步请求
 * 当 Agent poll 到 sync command 时调用
 */
export async function linkCommandToSyncRequest(
  commandId: string,
  requestNo: string,
): Promise<void> {
  await query(
    `UPDATE sync_request_log SET command_id = $1::uuid, status = 'command_sent' WHERE request_no = $2`,
    [commandId, requestNo],
  )
}
