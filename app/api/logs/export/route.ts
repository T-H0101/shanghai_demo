/**
 * GET /api/logs/export
 * Sprint R.12 — 真实日志导出 (REQ-5.1.2 partial 推进)
 *
 * 复用 /api/logs 检索逻辑, 输出 CSV / JSON 附件。
 * R.11B 同步导出风格: 真实数据库读取, 含记录数 + SHA-256 内容摘要, 严格 fail-closed。
 *
 * Query params:
 *   - type:    sync_package | sync_table | sync_scheduler | sync_consistency | control | audit | all
 *   - siteCode / status / keyword / dateFrom / dateTo: 与 /api/logs 一致
 *   - format:  csv (default) | json
 *   - max:     上限, 默认 1000, 最大 5000
 *
 * 严格 R.1 §7: 不允许 mock, 不冒充"数字签名"为证书签名 (与 R.11B 一致)。
 */

import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

type LogType = "sync_package" | "sync_table" | "sync_scheduler" | "sync_consistency" | "control" | "audit"
const ALLOWED_TYPES: LogType[] = ["sync_package", "sync_table", "sync_scheduler", "sync_consistency", "control", "audit"]

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

// 复用 /api/logs 的查询逻辑 (复制以避免循环 import)
async function runQueryOneType(type: LogType, siteCode: string, status: string, dateFrom: string, dateTo: string, keyword: string, limit: number): Promise<UnifiedLogRow[]> {
  if (type === "sync_package") {
    return q("sync_package_log", "site_code", "status", "started_at", ["batch_id", "site_code"], siteCode, status, dateFrom, dateTo, keyword, limit, (row: any) => ({
      log_type: "sync_package",
      log_id: row.id,
      site_code: row.site_code,
      status: row.status,
      summary: `package ${row.batch_id} (${row.table_count} tables, ${row.total_record_count} records) ${row.status}${row.error_message ? ` — ${String(row.error_message).slice(0, 80)}` : ""}`,
      detail: { batch_id: row.batch_id, table_count: row.table_count, total_record_count: row.total_record_count, finished_at: row.finished_at, error_message: row.error_message },
      occurred_at: row.started_at,
      operator: null,
      ref_batch_id: row.batch_id,
      ref_table_name: null,
      error_code: null,
    }))
  }
  if (type === "sync_table") {
    return q("sync_table_log", "site_code", "status", "started_at", ["table_name", "batch_id"], siteCode, status, dateFrom, dateTo, keyword, limit, (row: any) => ({
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
  if (type === "sync_scheduler") {
    return q("sync_scheduler_log", "site_code", "status", "started_at", ["run_id", "site_code"], siteCode, status, dateFrom, dateTo, keyword, limit, (row: any) => ({
      log_type: "sync_scheduler",
      log_id: row.id,
      site_code: row.site_code,
      status: row.status,
      summary: `run ${row.run_id} export=${row.export_status} push=${row.push_status} consistency=${row.consistency_status} status=${row.status}`,
      detail: { run_id: row.run_id, export_status: row.export_status, push_status: row.push_status, consistency_status: row.consistency_status, finished_at: row.finished_at, error_message: row.error_message, package_batch_id: row.package_batch_id },
      occurred_at: row.started_at,
      operator: null,
      ref_batch_id: row.package_batch_id,
      ref_table_name: null,
      error_code: null,
    }))
  }
  if (type === "sync_consistency") {
    return q("sync_consistency_log", "site_code", "status", "checked_at", ["site_code"], siteCode, status, dateFrom, dateTo, keyword, limit, (row: any) => ({
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
  if (type === "control") {
    return q("control_command", "source_site_id", "status", "requested_at", ["command_no", "command_type", "source_site_id"], siteCode, status, dateFrom, dateTo, keyword, limit, (row: any) => ({
      log_type: "control",
      log_id: row.id,
      site_code: row.source_site_id,
      status: row.status,
      summary: `${row.command_type} target=${row.target_id} status=${row.status}${row.error_message ? ` — ${String(row.error_message).slice(0, 80)}` : ""}`,
      detail: { command_no: row.command_no, command_type: row.command_type, target_id: row.target_id, requested_by: row.requested_by, completed_at: row.completed_at, result: row.result, error_message: row.error_message },
      occurred_at: row.requested_at,
      operator: row.requested_by,
      ref_batch_id: null,
      ref_table_name: null,
      error_code: null,
    }))
  }
  // audit
  return q("audit_log", "site_code", "result", "created_at", ["command_no", "action", "target_table", "site_code", "actor"], siteCode, status, dateFrom, dateTo, keyword, limit, (row: any) => ({
    log_type: "audit",
    log_id: row.id,
    site_code: row.site_code,
    status: row.result,
    summary: `${row.action} ${row.target_table}/${row.target_id} → ${row.result}${row.error_message ? ` — ${String(row.error_message).slice(0, 80)}` : ""}`,
    detail: { command_no: row.command_no, action: row.action, target_table: row.target_table, target_id: row.target_id, error_message: row.error_message },
    occurred_at: row.created_at,
    operator: row.actor,
    ref_batch_id: null,
    ref_table_name: row.target_table,
    error_code: null,
  }))
}

async function q<R = any>(
  tableName: string,
  siteCol: string,
  statusCol: string,
  tsCol: string,
  keywordCols: string[],
  siteCode: string,
  status: string,
  dateFrom: string,
  dateTo: string,
  keyword: string,
  limit: number,
  map: (row: any) => UnifiedLogRow
): Promise<UnifiedLogRow[]> {
  const conds: string[] = []
  const params: unknown[] = []
  if (siteCode) { params.push(siteCode); conds.push(`${siteCol} = $${params.length}`) }
  if (status) { params.push(status); conds.push(`${statusCol} = $${params.length}`) }
  if (dateFrom) { params.push(dateFrom); conds.push(`${tsCol} >= $${params.length}`) }
  if (dateTo) { params.push(dateTo); conds.push(`${tsCol} <= $${params.length}`) }
  if (keyword.trim()) {
    params.push(`%${keyword.trim()}%`)
    const idx = params.length
    const orParts = keywordCols.map((c) => `COALESCE(${c}::text, '') ILIKE $${idx}`).join(" OR ")
    conds.push(`(${orParts})`)
  }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : ""
  params.push(limit)
  const r = await query<any>(
    `SELECT * FROM ${tableName} ${where} ORDER BY ${tsCol} DESC LIMIT $${params.length}`,
    params
  )
  return r.rows.map(map)
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ""
  const s = typeof v === "string" ? v : JSON.stringify(v)
  // CSV escape: 包含逗号/引号/换行时用双引号包裹, 内部双引号转义为 ""
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function buildCsv(rows: UnifiedLogRow[]): string {
  const header = "log_type,log_id,site_code,status,occurred_at,operator,ref_batch_id,ref_table_name,summary\n"
  const body = rows.map((r) =>
    [r.log_type, r.log_id, r.site_code ?? "", r.status ?? "", r.occurred_at, r.operator ?? "", r.ref_batch_id ?? "", r.ref_table_name ?? "", r.summary].map(csvEscape).join(",")
  ).join("\n")
  return header + body + (body ? "\n" : "")
}

export async function GET(request: NextRequest) {
  const traceId = `api-${Date.now()}`
  try {
    const sp = request.nextUrl.searchParams
    const typeParam = sp.get("type") ?? "all"
    const format = (sp.get("format") ?? "csv").toLowerCase()
    if (format !== "csv" && format !== "json") {
      return NextResponse.json(
        { code: 400, message: "format must be csv or json", dataSource: "error", traceId },
        { status: 400 }
      )
    }
    const siteCode = sp.get("siteCode") ?? ""
    const status = sp.get("status") ?? ""
    const keyword = sp.get("keyword") ?? ""
    const dateFrom = sp.get("dateFrom") ?? ""
    const dateTo = sp.get("dateTo") ?? ""
    const max = Math.min(parseInt(sp.get("max") ?? "1000", 10) || 1000, 5000)

    const types: LogType[] = (typeParam && typeParam !== "all")
      ? typeParam.split(",").map((t) => t.trim()).filter((t): t is LogType => ALLOWED_TYPES.includes(t as LogType))
      : ALLOWED_TYPES

    if (typeParam && typeParam !== "all" && types.length === 0) {
      return NextResponse.json(
        { code: 400, message: `invalid type, must be one or comma-list of ${ALLOWED_TYPES.join(",")}`, dataSource: "error", traceId },
        { status: 400 }
      )
    }

    const results = await Promise.all(types.map((t) => runQueryOneType(t, siteCode, status, dateFrom, dateTo, keyword, max)))
    const merged = results.flat().map((r) => ({
      ...r,
      occurred_at: r.occurred_at instanceof Date ? r.occurred_at.toISOString() : String(r.occurred_at),
    })).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, max)

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    if (format === "json") {
      const body = JSON.stringify({ items: merged, count: merged.length, types }, null, 2)
      const sha256 = createHash("sha256").update(body).digest("hex")
      return new NextResponse(body, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="logs-${timestamp}.json"`,
          "x-record-count": String(merged.length),
          "x-sha256": sha256,
          "x-data-source": "database",
          "x-trace-id": traceId,
        },
      })
    }

    // CSV (default)
    const csv = buildCsv(merged)
    const sha256 = createHash("sha256").update(csv).digest("hex")
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="logs-${timestamp}.csv"`,
        "x-record-count": String(merged.length),
        "x-sha256": sha256,
        "x-data-source": "database",
        "x-trace-id": traceId,
      },
    })
  } catch (error) {
    console.error("[API Error] /api/logs/export:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        dataSource: "error",
        error: error instanceof Error ? error.message : String(error),
        traceId,
      },
      { status: 500 }
    )
  }
}
