/**
 * GET /api/logs
 * Sprint R.12 — 真实日志整合检索 (REQ-5.1.1, 5.1.3)
 *
 * 整合 6 类日志源 (统一查询入口):
 *   - sync_package_log   (R.11B 已能导出, 本接口提供检索)
 *   - sync_table_log     (按 batch_id 关联)
 *   - sync_scheduler_log (R.8 调度)
 *   - sync_consistency_log (R.7 一致性)
 *   - control_command    (R.4 任务控制 6 原子)
 *   - audit_log          (操作流水)
 *
 * Query params:
 *   - type:    sync_package | sync_table | sync_scheduler | sync_consistency | control | audit
 *              (缺省 = 全部 6 类 union)
 *   - siteCode / regionCode: 站点或区域过滤（区域由服务端展开为站点列表）
 *   - status: 状态过滤
 *   - keyword: 关键字 (logId / batchId / commandNo / 摘要)
 *   - errorCode: 错误码 / 错误文本匹配
 *   - deviceId: 设备 ID / targetId 匹配
 *   - taskType: 任务类型 (刻录/回迁/控制动作) 匹配
 *   - dateFrom: ISO 时间起点 (含)
 *   - dateTo:   ISO 时间终点 (含)
 *   - limit:    默认 50, 最大 500
 *   - offset:   默认 0
 *   - 单 type 时走 SQL LIMIT/OFFSET + COUNT；扩展筛选 (errorCode/deviceId/taskType) 时先取池再内存分页
 *
 * 严格 R.1 §7: 不允许 mock fallback, dataSource 显式 (database | empty | error)
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { resolveRequestScope } from "@/lib/auth/site-scope"

export const dynamic = "force-dynamic"

/** siteCodes 非 null 时优先（区域展开）；[] → 无数据 */
function applySiteCol(
  conds: string[],
  params: unknown[],
  column: string,
  siteCode: string,
  siteCodes: string[] | null,
) {
  if (siteCodes !== null) {
    if (siteCodes.length === 0) {
      conds.push("FALSE")
      return
    }
    params.push(siteCodes)
    conds.push(`${column} = ANY($${params.length})`)
    return
  }
  if (siteCode) {
    params.push(siteCode)
    conds.push(`${column} = $${params.length}`)
  }
}

type LogType = "sync_package" | "sync_table" | "sync_scheduler" | "sync_consistency" | "control" | "audit"
const ALLOWED_TYPES: LogType[] = [
  "sync_package",
  "sync_table",
  "sync_scheduler",
  "sync_consistency",
  "control",
  "audit",
]

interface UnifiedLogRow {
  log_type: LogType
  log_id: string
  site_code: string | null
  status: string | null
  summary: string
  detail: unknown
  occurred_at: string | Date
  operator: string | null
  ref_batch_id: string | null
  ref_table_name: string | null
  error_code: string | null
}

function detailText(detail: unknown): string {
  if (!detail) return ""
  if (typeof detail === "string" || typeof detail === "number" || typeof detail === "boolean") {
    return String(detail).toLowerCase()
  }
  if (Array.isArray(detail)) {
    return detail.map((item) => detailText(item)).filter(Boolean).join(" ")
  }
  if (typeof detail === "object") {
    return Object.values(detail as Record<string, unknown>).map((item) => detailText(item)).filter(Boolean).join(" ")
  }
  return ""
}

function jsonStringValue(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const direct = record[key]
  if (typeof direct === "string") return direct
  const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  const camelValue = record[camel]
  return typeof camelValue === "string" ? camelValue : null
}

function rowMatchesExtendedFilters(
  row: UnifiedLogRow,
  filters: { errorCode: string; deviceId: string; taskType: string },
): boolean {
  const detail = detailText(row.detail)
  const summary = row.summary.toLowerCase()

  if (filters.errorCode.trim()) {
    const needle = filters.errorCode.trim().toLowerCase()
    const code = (row.error_code ?? jsonStringValue(row.detail, "error_code") ?? "").toLowerCase()
    if (!code.includes(needle) && !detail.includes(needle) && !summary.includes(needle)) return false
  }

  if (filters.deviceId.trim()) {
    const needle = filters.deviceId.trim().toLowerCase()
    const deviceId = (jsonStringValue(row.detail, "device_id") ?? jsonStringValue(row.detail, "target_id") ?? "").toLowerCase()
    if (!deviceId.includes(needle) && !detail.includes(needle) && !summary.includes(needle)) return false
  }

  if (filters.taskType.trim()) {
    const needle = filters.taskType.trim().toLowerCase()
    const taskType = (
      jsonStringValue(row.detail, "task_type") ??
      jsonStringValue(row.detail, "command_type") ??
      jsonStringValue(row.detail, "action") ??
      ""
    ).toLowerCase()
    if (!taskType.includes(needle) && !detail.includes(needle) && !summary.includes(needle)) return false
  }

  return true
}

async function fetchSyncPackage(siteCode: string, status: string, dateFrom: string, dateTo: string, keyword: string, limit: number, offset: number, siteCodes: string[] | null = null): Promise<UnifiedLogRow[]> {
  const conds: string[] = []
  const params: unknown[] = []
  applySiteCol(conds, params, "site_code", siteCode, siteCodes)
  if (status) { params.push(status); conds.push(`status = $${params.length}`) }
  if (dateFrom) { params.push(dateFrom); conds.push(`started_at >= $${params.length}`) }
  if (dateTo) { params.push(dateTo); conds.push(`started_at <= $${params.length}`) }
  if (keyword.trim()) { params.push(`%${keyword.trim()}%`); conds.push(`(batch_id ILIKE $${params.length} OR COALESCE(site_code,'') ILIKE $${params.length})`) }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : ""
  params.push(limit, offset)
  const r = await query<{
    id: string; site_code: string; batch_id: string; status: string;
    started_at: string; finished_at: string | null; table_count: number;
    total_record_count: number; error_message: string | null;
  }>(
    `SELECT id, site_code, batch_id, status, started_at, finished_at, table_count, total_record_count, error_message
     FROM sync_package_log ${where}
     ORDER BY started_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return r.rows.map((row) => ({
    log_type: "sync_package",
    log_id: row.id,
    site_code: row.site_code,
    status: row.status,
    summary: `package ${row.batch_id} (${row.table_count} tables, ${row.total_record_count} records) ${row.status}${row.error_message ? ` — ${row.error_message.slice(0, 80)}` : ""}`,
    detail: { batch_id: row.batch_id, table_count: row.table_count, total_record_count: row.total_record_count, finished_at: row.finished_at, error_message: row.error_message },
    occurred_at: row.started_at,
    operator: null,
    ref_batch_id: row.batch_id,
    ref_table_name: null,
    error_code: null,
  }))
}

async function fetchSyncTable(siteCode: string, status: string, dateFrom: string, dateTo: string, keyword: string, limit: number, offset: number, siteCodes: string[] | null = null): Promise<UnifiedLogRow[]> {
  const conds: string[] = []
  const params: unknown[] = []
  applySiteCol(conds, params, "site_code", siteCode, siteCodes)
  if (status) { params.push(status); conds.push(`status = $${params.length}`) }
  if (dateFrom) { params.push(dateFrom); conds.push(`started_at >= $${params.length}`) }
  if (dateTo) { params.push(dateTo); conds.push(`started_at <= $${params.length}`) }
  if (keyword.trim()) { params.push(`%${keyword.trim()}%`); conds.push(`(table_name ILIKE $${params.length} OR batch_id ILIKE $${params.length})`) }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : ""
  params.push(limit, offset)
  const r = await query<{
    id: string; site_code: string; batch_id: string; table_name: string; status: string;
    processed_record_count: number; failed_count: number; error_message: string | null; started_at: string;
  }>(
    `SELECT id, site_code, batch_id, table_name, status, processed_record_count, failed_count, error_message, started_at
     FROM sync_table_log ${where}
     ORDER BY started_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return r.rows.map((row) => ({
    log_type: "sync_table",
    log_id: row.id,
    site_code: row.site_code,
    status: row.status,
    summary: `${row.table_name} (batch=${row.batch_id}) processed=${row.processed_record_count} failed=${row.failed_count} status=${row.status}`,
    detail: { batch_id: row.batch_id, table_name: row.table_name, processed_record_count: row.processed_record_count, failed_count: row.failed_count, error_message: row.error_message },
    occurred_at: row.started_at,
    operator: null,
    ref_batch_id: row.batch_id,
    ref_table_name: row.table_name,
    error_code: null,
  }))
}

async function fetchSyncScheduler(siteCode: string, status: string, dateFrom: string, dateTo: string, keyword: string, limit: number, offset: number, siteCodes: string[] | null = null): Promise<UnifiedLogRow[]> {
  const conds: string[] = []
  const params: unknown[] = []
  applySiteCol(conds, params, "site_code", siteCode, siteCodes)
  if (status) {
    // 立即同步旧数据写 completed，与 success 同义
    if (status === "success") {
      conds.push(`status IN ('success', 'completed')`)
    } else {
      params.push(status)
      conds.push(`status = $${params.length}`)
    }
  }
  if (dateFrom) { params.push(dateFrom); conds.push(`started_at >= $${params.length}`) }
  if (dateTo) { params.push(dateTo); conds.push(`started_at <= $${params.length}`) }
  if (keyword.trim()) { params.push(`%${keyword.trim()}%`); conds.push(`(run_id ILIKE $${params.length} OR COALESCE(site_code,'') ILIKE $${params.length})`) }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : ""
  params.push(limit, offset)
  const r = await query<{
    id: string; site_code: string; run_id: string; status: string; export_status: string;
    push_status: string; consistency_status: string; started_at: string; finished_at: string | null;
    error_message: string | null; package_batch_id: string | null; result_json: unknown;
  }>(
    `SELECT id, site_code, run_id, status, export_status, push_status, consistency_status, started_at, finished_at, error_message, package_batch_id, result_json
     FROM sync_scheduler_log ${where}
     ORDER BY started_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return r.rows.map((row) => {
    const requestedBy =
      jsonStringValue(row.result_json, "requestedBy") ??
      jsonStringValue(row.result_json, "requested_by")
    return {
      log_type: "sync_scheduler" as const,
      log_id: row.id,
      site_code: row.site_code,
      status: row.status,
      summary: `run ${row.run_id} export=${row.export_status} push=${row.push_status} consistency=${row.consistency_status} status=${row.status}`,
      detail: {
        run_id: row.run_id,
        export_status: row.export_status,
        push_status: row.push_status,
        consistency_status: row.consistency_status,
        finished_at: row.finished_at,
        error_message: row.error_message,
        package_batch_id: row.package_batch_id,
        requestedBy,
      },
      occurred_at: row.started_at,
      operator: requestedBy,
      ref_batch_id: row.package_batch_id,
      ref_table_name: null,
      error_code: null,
    }
  })
}

async function fetchSyncConsistency(siteCode: string, status: string, dateFrom: string, dateTo: string, keyword: string, limit: number, offset: number, siteCodes: string[] | null = null): Promise<UnifiedLogRow[]> {
  const conds: string[] = []
  const params: unknown[] = []
  applySiteCol(conds, params, "site_code", siteCode, siteCodes)
  if (status) { params.push(status); conds.push(`status = $${params.length}`) }
  if (dateFrom) { params.push(dateFrom); conds.push(`checked_at >= $${params.length}`) }
  if (dateTo) { params.push(dateTo); conds.push(`checked_at <= $${params.length}`) }
  if (keyword.trim()) { params.push(`%${keyword.trim()}%`); conds.push(`COALESCE(site_code,'') ILIKE $${params.length}`) }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : ""
  params.push(limit, offset)
  const r = await query<{
    id: string; site_code: string; status: string; table_count: number;
    matched_table_count: number; mismatched_table_count: number; checked_at: string;
  }>(
    `SELECT id, site_code, status, table_count, matched_table_count, mismatched_table_count, checked_at
     FROM sync_consistency_log ${where}
     ORDER BY checked_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return r.rows.map((row) => ({
    log_type: "sync_consistency",
    log_id: row.id,
    site_code: row.site_code,
    status: row.status,
    summary: `consistency ${row.status} (${row.matched_table_count}/${row.table_count} matched, ${row.mismatched_table_count} mismatched)`,
    detail: { table_count: row.table_count, matched_table_count: row.matched_table_count, mismatched_table_count: row.mismatched_table_count },
    occurred_at: row.checked_at,
    operator: null,
    ref_batch_id: null,
    ref_table_name: null,
    error_code: null,
  }))
}

async function fetchControl(siteCode: string, status: string, dateFrom: string, dateTo: string, keyword: string, limit: number, offset: number, siteCodes: string[] | null = null): Promise<UnifiedLogRow[]> {
  const conds: string[] = []
  const params: unknown[] = []
  applySiteCol(conds, params, "source_site_id", siteCode, siteCodes)
  if (status) { params.push(status); conds.push(`status = $${params.length}`) }
  if (dateFrom) { params.push(dateFrom); conds.push(`requested_at >= $${params.length}`) }
  if (dateTo) { params.push(dateTo); conds.push(`requested_at <= $${params.length}`) }
  if (keyword.trim()) { params.push(`%${keyword.trim()}%`); conds.push(`(command_no ILIKE $${params.length} OR command_type ILIKE $${params.length} OR COALESCE(source_site_id,'') ILIKE $${params.length})`) }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : ""
  params.push(limit, offset)
  const r = await query<{
    id: string; command_no: string; source_site_id: string; command_type: string;
    target_type: string; target_id: string; status: string; requested_at: string; completed_at: string | null;
    requested_by: string | null; result: unknown; error_message: string | null;
  }>(
    `SELECT id, command_no, source_site_id, command_type, target_type, target_id, status, requested_at, completed_at, requested_by, result, error_message
     FROM control_command ${where}
     ORDER BY requested_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return r.rows.map((row) => ({
    log_type: "control",
    log_id: row.id,
    site_code: row.source_site_id,
    status: row.status,
    summary: `${row.command_type} target=${row.target_id} status=${row.status}${row.error_message ? ` — ${row.error_message.slice(0, 80)}` : ""}`,
    detail: {
      command_no: row.command_no,
      command_type: row.command_type,
      target_type: row.target_type,
      target_id: row.target_id,
      device_id: row.target_type === "device" ? row.target_id : null,
      task_type: row.command_type,
      requested_by: row.requested_by,
      completed_at: row.completed_at,
      result: row.result,
      error_message: row.error_message,
    },
    occurred_at: row.requested_at,
    operator: row.requested_by,
    ref_batch_id: null,
    ref_table_name: null,
    error_code: jsonStringValue(row.result, "error_code"),
  }))
}

async function fetchAudit(siteCode: string, status: string, dateFrom: string, dateTo: string, keyword: string, limit: number, offset: number, siteCodes: string[] | null = null): Promise<UnifiedLogRow[]> {
  const conds: string[] = []
  const params: unknown[] = []
  applySiteCol(conds, params, "site_code", siteCode, siteCodes)
  if (status) { params.push(status); conds.push(`result = $${params.length}`) }
  if (dateFrom) { params.push(dateFrom); conds.push(`created_at >= $${params.length}`) }
  if (dateTo) { params.push(dateTo); conds.push(`created_at <= $${params.length}`) }
  if (keyword.trim()) { params.push(`%${keyword.trim()}%`); conds.push(`(command_no ILIKE $${params.length} OR action ILIKE $${params.length} OR target_table ILIKE $${params.length} OR COALESCE(site_code,'') ILIKE $${params.length} OR COALESCE(actor,'') ILIKE $${params.length})`) }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : ""
  params.push(limit, offset)
  const r = await query<{
    id: string; command_no: string; action: string; target_table: string; target_id: string;
    result: string; actor: string | null; site_code: string; created_at: string; error_message: string | null;
  }>(
    `SELECT id, command_no, action, target_table, target_id, result, actor, site_code, created_at, error_message
     FROM audit_log ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return r.rows.map((row) => ({
    log_type: "audit",
    log_id: row.id,
    site_code: row.site_code,
    status: row.result,
    summary: `${row.action} ${row.target_table}/${row.target_id} → ${row.result}${row.error_message ? ` — ${row.error_message.slice(0, 80)}` : ""}`,
    detail: {
      command_no: row.command_no,
      action: row.action,
      target_table: row.target_table,
      target_id: row.target_id,
      device_id: row.target_table?.includes("device") ? row.target_id : null,
      task_type: row.action,
      error_message: row.error_message,
    },
    occurred_at: row.created_at,
    operator: row.actor,
    ref_batch_id: null,
    ref_table_name: row.target_table,
    error_code: null,
  }))
}

export async function GET(request: NextRequest) {
  const traceId = `api-${Date.now()}`
  try {
    // Sprint R.29: 防越权
    const session = await requireSession(request)
    requirePermission(session, "audit:read")

    const sp = request.nextUrl.searchParams
    const typeParam = sp.get("type") ?? ""
    const types: LogType[] = (typeParam && typeParam !== "all")
      ? typeParam.split(",").map((t) => t.trim()).filter((t): t is LogType => ALLOWED_TYPES.includes(t as LogType))
      : ALLOWED_TYPES

    if (typeParam && typeParam !== "all" && types.length === 0) {
      return NextResponse.json(
        { code: 400, message: `invalid type, must be one or comma-list of ${ALLOWED_TYPES.join(",")}`, dataSource: "error", traceId },
        { status: 400 }
      )
    }

    let siteCode = sp.get("siteCode") ?? ""
    if (siteCode === "__all__") siteCode = ""
    let siteCodes: string[] | null = null
    const regionCode = sp.get("regionCode")
    if (regionCode?.trim() && !siteCode) {
      const scope = await resolveRequestScope(session, {
        siteCode: null,
        regionCode,
      })
      if (scope.kind === "listed") {
        siteCodes = scope.siteCodes
        if (siteCodes.length === 0) {
          return NextResponse.json({
            code: 0,
            message: "ok",
            data: { items: [], total: 0 },
            dataSource: "empty",
            traceId,
          })
        }
      }
    }
    const status = sp.get("status") ?? ""
    const keyword = sp.get("keyword") ?? ""
    const errorCode = sp.get("errorCode") ?? ""
    const deviceId = sp.get("deviceId") ?? ""
    const taskType = sp.get("taskType") ?? ""
    const dateFrom = sp.get("dateFrom") ?? ""
    const dateTo = sp.get("dateTo") ?? ""
    const limit = Math.min(parseInt(sp.get("limit") ?? "50", 10) || 50, 500)
    const offset = Math.max(parseInt(sp.get("offset") ?? "0", 10) || 0, 0)
    const hasExtended = Boolean(errorCode.trim() || deviceId.trim() || taskType.trim())

    const loadType = (t: LogType, lim: number, off: number) => {
      switch (t) {
        case "sync_package":
          return fetchSyncPackage(siteCode, status, dateFrom, dateTo, keyword, lim, off, siteCodes)
        case "sync_table":
          return fetchSyncTable(siteCode, status, dateFrom, dateTo, keyword, lim, off, siteCodes)
        case "sync_scheduler":
          return fetchSyncScheduler(siteCode, status, dateFrom, dateTo, keyword, lim, off, siteCodes)
        case "sync_consistency":
          return fetchSyncConsistency(siteCode, status, dateFrom, dateTo, keyword, lim, off, siteCodes)
        case "control":
          return fetchControl(siteCode, status, dateFrom, dateTo, keyword, lim, off, siteCodes)
        case "audit":
          return fetchAudit(siteCode, status, dateFrom, dateTo, keyword, lim, off, siteCodes)
        default:
          return Promise.resolve([] as UnifiedLogRow[])
      }
    }

    const countType = async (t: LogType): Promise<number> => {
      const conds: string[] = []
      const params: unknown[] = []
      const eq = (col: string, val: string) => {
        params.push(val)
        conds.push(`${col} = $${params.length}`)
      }
      const gte = (col: string, val: string) => {
        params.push(val)
        conds.push(`${col} >= $${params.length}`)
      }
      const lte = (col: string, val: string) => {
        params.push(val)
        conds.push(`${col} <= $${params.length}`)
      }
      const siteEq = (col: string) => applySiteCol(conds, params, col, siteCode, siteCodes)

      let table = ""
      if (t === "sync_package") {
        table = "sync_package_log"
        siteEq("site_code")
        if (status) eq("status", status)
        if (dateFrom) gte("started_at", dateFrom)
        if (dateTo) lte("started_at", dateTo)
        if (keyword.trim()) {
          params.push(`%${keyword.trim()}%`)
          conds.push(`(batch_id ILIKE $${params.length} OR COALESCE(site_code,'') ILIKE $${params.length})`)
        }
      } else if (t === "sync_table") {
        table = "sync_table_log"
        siteEq("site_code")
        if (status) eq("status", status)
        if (dateFrom) gte("started_at", dateFrom)
        if (dateTo) lte("started_at", dateTo)
        if (keyword.trim()) {
          params.push(`%${keyword.trim()}%`)
          conds.push(`(table_name ILIKE $${params.length} OR batch_id ILIKE $${params.length})`)
        }
      } else if (t === "sync_scheduler") {
        table = "sync_scheduler_log"
        siteEq("site_code")
        if (status) {
          if (status === "success") {
            conds.push(`status IN ('success', 'completed')`)
          } else {
            eq("status", status)
          }
        }
        if (dateFrom) gte("started_at", dateFrom)
        if (dateTo) lte("started_at", dateTo)
        if (keyword.trim()) {
          params.push(`%${keyword.trim()}%`)
          conds.push(`(run_id ILIKE $${params.length} OR COALESCE(site_code,'') ILIKE $${params.length})`)
        }
      } else if (t === "sync_consistency") {
        table = "sync_consistency_log"
        siteEq("site_code")
        if (status) eq("status", status)
        if (dateFrom) gte("checked_at", dateFrom)
        if (dateTo) lte("checked_at", dateTo)
        if (keyword.trim()) {
          params.push(`%${keyword.trim()}%`)
          conds.push(`(COALESCE(site_code,'') ILIKE $${params.length})`)
        }
      } else if (t === "control") {
        table = "control_command"
        siteEq("source_site_id")
        if (status) eq("status", status)
        if (dateFrom) gte("requested_at", dateFrom)
        if (dateTo) lte("requested_at", dateTo)
        if (keyword.trim()) {
          params.push(`%${keyword.trim()}%`)
          conds.push(`(command_no ILIKE $${params.length} OR command_type ILIKE $${params.length} OR COALESCE(source_site_id,'') ILIKE $${params.length})`)
        }
      } else if (t === "audit") {
        table = "audit_log"
        siteEq("site_code")
        if (status) eq("result", status)
        if (dateFrom) gte("created_at", dateFrom)
        if (dateTo) lte("created_at", dateTo)
        if (keyword.trim()) {
          params.push(`%${keyword.trim()}%`)
          conds.push(`(command_no ILIKE $${params.length} OR action ILIKE $${params.length} OR target_table ILIKE $${params.length} OR COALESCE(site_code,'') ILIKE $${params.length} OR COALESCE(actor,'') ILIKE $${params.length})`)
        }
      } else {
        return 0
      }

      const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : ""
      const r = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table} ${where}`, params)
      return Number(r.rows[0]?.count ?? 0)
    }

    const normalize = (rows: UnifiedLogRow[]) =>
      rows.map((r) => ({
        ...r,
        occurred_at: r.occurred_at instanceof Date ? r.occurred_at.toISOString() : String(r.occurred_at),
      }))

    let items: ReturnType<typeof normalize>
    let total: number

    if (types.length === 1) {
      const t = types[0]
      if (hasExtended) {
        const pool = normalize(await loadType(t, 500, 0)).sort((a, b) =>
          String(b.occurred_at).localeCompare(String(a.occurred_at)),
        )
        const filtered = pool.filter((row) =>
          rowMatchesExtendedFilters(row, { errorCode, deviceId, taskType }),
        )
        total = filtered.length
        items = filtered.slice(offset, offset + limit)
      } else {
        const [rows, cnt] = await Promise.all([loadType(t, limit, offset), countType(t)])
        items = normalize(rows)
        total = cnt
      }
    } else {
      const perTypeLimit = Math.min(500, Math.max(limit + offset, 50))
      const tasks: Promise<UnifiedLogRow[]>[] = []
      if (types.includes("sync_package")) tasks.push(loadType("sync_package", perTypeLimit, 0))
      if (types.includes("sync_table")) tasks.push(loadType("sync_table", perTypeLimit, 0))
      if (types.includes("sync_scheduler")) tasks.push(loadType("sync_scheduler", perTypeLimit, 0))
      if (types.includes("sync_consistency")) tasks.push(loadType("sync_consistency", perTypeLimit, 0))
      if (types.includes("control")) tasks.push(loadType("control", perTypeLimit, 0))
      if (types.includes("audit")) tasks.push(loadType("audit", perTypeLimit, 0))
      const results = await Promise.all(tasks)
      const merged = normalize(results.flat()).sort((a, b) =>
        String(b.occurred_at).localeCompare(String(a.occurred_at)),
      )
      const filtered = merged.filter((row) =>
        rowMatchesExtendedFilters(row, { errorCode, deviceId, taskType }),
      )
      total = filtered.length
      items = filtered.slice(offset, offset + limit)
    }

    return NextResponse.json({
      code: 0,
      message: "ok",
      data: {
        items,
        total,
        limit,
        offset,
        types,
      },
      dataSource: items.length === 0 ? "empty" : "database",
      sources: types.map((t) => `${t}_log`),
      meta: {
        requirement: {
          id: "REQ-5.1.3",
          text: "日志检索 (关键字/错误码/任务类型)",
          status: "complete",
        },
        filters: { keyword, errorCode, deviceId, taskType, siteCode, status, dateFrom, dateTo },
      },
      traceId,
    })
  } catch (error) {
    if (error instanceof NextResponse) return error
    console.error("[API Error] /api/logs:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "未知异常",
        data: null,
        dataSource: "error",
        error: error instanceof Error ? error.message : String(error),
        traceId,
      },
      { status: 500 }
    )
  }
}
