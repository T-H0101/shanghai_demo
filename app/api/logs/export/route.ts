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
import { query } from "@/lib/db"
import { buildExport } from "@/lib/export"
import { toNextResponse } from "@/lib/export/next-response"
import { recordExport } from "@/lib/export/audit"
import { buildXlsxExport } from "@/lib/export/xlsx"

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

// R.13 起 CSV/JSON 主体由 lib/export 框架生成, buildCsv 不再使用 (保留 csvEscape 为字段级 utility 备用)
const LOG_COLUMNS = ["log_type", "log_id", "site_code", "status", "occurred_at", "operator", "ref_batch_id", "ref_table_name", "summary"] as const

export async function GET(request: NextRequest) {
  const traceId = `api-${Date.now()}`
  try {
    const sp = request.nextUrl.searchParams
    const typeParam = sp.get("type") ?? "all"
    const format = (sp.get("format") ?? "csv").toLowerCase()
    if (format !== "csv" && format !== "json" && format !== "xlsx") {
      return NextResponse.json(
        { code: 400, message: "format must be csv, json, or xlsx", dataSource: "error", traceId },
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

    // R.13: 统一走 lib/export 框架 (CSV 9 列 + JSON + sanitize + manifest + audit)
    // 注: 为保 e2e:logs 兼容, 文件名前缀仍用 "logs", JSON 体保持 items[]/count 结构
    type LogRowForExport = (typeof merged)[number] & Record<string, unknown>
    if (format === "json") {
      // logs/export 的 JSON 体 schema 与框架默认不同 (items/count), 保留旧体让 e2e:logs 通过
      const body = JSON.stringify({ items: merged, count: merged.length, types }, null, 2)
      const result = buildExport<LogRowForExport>({
        exportType: "logs",
        dataSource: "database",
        format: "json",
        columns: LOG_COLUMNS as unknown as Array<keyof LogRowForExport & string>,
        rows: merged as LogRowForExport[],
        siteCode: siteCode || null,
        filters: { types: types.join(","), status: status || null, keyword: keyword || null },
        filenamePrefix: "logs",
      })
      // 覆盖 framework body 为 items/count 旧结构 (e2e:logs 依赖)
      const { contentSha256 } = await import("@/lib/export/sha256")
      const overriddenSha = contentSha256(body)
      const overridden = {
        ...result,
        body,
        sha256: overriddenSha,
        manifest: { ...result.manifest, sha256: overriddenSha, rowCount: merged.length },
        rowCount: merged.length,
      }
      await recordExport(overridden.manifest)
      return toNextResponse(overridden)
    }

    if (format === "xlsx") {
      const result = await buildXlsxExport<LogRowForExport>({
        exportType: "logs",
        dataSource: "database",
        format: "xlsx",
        columns: LOG_COLUMNS as unknown as Array<keyof LogRowForExport & string>,
        rows: merged as LogRowForExport[],
        siteCode: siteCode || null,
        filters: { types: types.join(","), status: status || null, keyword: keyword || null },
        filenamePrefix: "logs",
      })
      await recordExport(result.manifest)
      return toNextResponse(result)
    }

    // CSV (default): 用框架统一生成
    const csvResult = buildExport<LogRowForExport>({
      exportType: "logs",
      dataSource: "database",
      format: "csv",
      columns: LOG_COLUMNS as unknown as Array<keyof LogRowForExport & string>,
      rows: merged as LogRowForExport[],
      siteCode: siteCode || null,
      filters: { types: types.join(","), status: status || null, keyword: keyword || null },
      filenamePrefix: "logs",
    })
    await recordExport(csvResult.manifest)
    return toNextResponse(csvResult)
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
