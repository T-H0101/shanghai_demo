import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { buildExport } from "@/lib/export"
import { toNextResponse } from "@/lib/export/next-response"
import { recordExport, resolveExportActor } from "@/lib/export/audit"
import { formatBeijingTime } from "@/lib/time/beijing"

export const dynamic = "force-dynamic"

/** 与同步中心页面 formatSyncStatus 对齐 */
const SYNC_STATUS_LABELS: Record<string, string> = {
  success: "成功",
  failed: "失败",
  running: "运行中",
  receiving: "接收中",
  pending: "待处理",
  partial: "部分成功",
  duplicated: "重复",
  skipped: "已跳过",
  abandoned: "已放弃",
}

function formatSyncStatus(status: unknown): string {
  if (status == null) return ""
  const key = String(status)
  return SYNC_STATUS_LABELS[key] ?? key
}

type ExportColumnDef = {
  field: string
  label: string
}

const EXPORT_DEFINITIONS = {
  package: {
    source: "sync_package_log",
    orderBy: "created_at DESC",
    // 对齐同步中心「同步批次」列表，并保留模式/版本/错误便于排查
    columns: [
      { field: "site_code", label: "站点" },
      { field: "batch_id", label: "批次 ID" },
      { field: "status", label: "状态" },
      { field: "mode", label: "模式" },
      { field: "version", label: "版本" },
      { field: "table_count", label: "表数" },
      { field: "total_record_count", label: "记录数" },
      { field: "success_table_count", label: "成功表数" },
      { field: "failed_table_count", label: "失败表数" },
      { field: "error_message", label: "错误信息" },
      { field: "started_at", label: "开始时间" },
      { field: "finished_at", label: "结束时间" },
      { field: "created_at", label: "创建时间" },
    ] satisfies ExportColumnDef[],
  },
  table: {
    source: "sync_table_log",
    orderBy: "created_at DESC",
    // 对齐「批次明细」，并带站点/批次便于全量导出
    columns: [
      { field: "site_code", label: "站点" },
      { field: "batch_id", label: "批次 ID" },
      { field: "table_name", label: "表名" },
      { field: "sync_mode", label: "同步模式" },
      { field: "status", label: "状态" },
      { field: "expected_record_count", label: "预期记录数" },
      { field: "processed_record_count", label: "处理记录数" },
      { field: "inserted_count", label: "插入数" },
      { field: "updated_count", label: "更新数" },
      { field: "skipped_count", label: "跳过数" },
      { field: "failed_count", label: "失败数" },
      { field: "error_message", label: "错误信息" },
      { field: "started_at", label: "开始时间" },
      { field: "finished_at", label: "结束时间" },
    ] satisfies ExportColumnDef[],
  },
  scheduler: {
    source: "sync_scheduler_log",
    orderBy: "started_at DESC",
    columns: [
      { field: "site_code", label: "站点" },
      { field: "run_id", label: "运行 ID" },
      { field: "started_at", label: "开始时间" },
      { field: "finished_at", label: "结束时间" },
      { field: "status", label: "状态" },
      { field: "export_status", label: "导出状态" },
      { field: "push_status", label: "推送状态" },
      { field: "consistency_status", label: "一致性状态" },
      { field: "package_batch_id", label: "批次 ID" },
      { field: "error_message", label: "错误信息" },
      { field: "created_at", label: "创建时间" },
    ] satisfies ExportColumnDef[],
  },
  consistency: {
    source: "sync_consistency_log",
    orderBy: "checked_at DESC",
    columns: [
      { field: "site_code", label: "站点" },
      { field: "checked_at", label: "校验时间" },
      { field: "status", label: "状态" },
      { field: "table_count", label: "表数" },
      { field: "matched_table_count", label: "匹配表数" },
      { field: "mismatched_table_count", label: "不匹配表数" },
      { field: "result_json", label: "校验结果" },
      { field: "created_at", label: "创建时间" },
    ] satisfies ExportColumnDef[],
  },
} as const

type ExportKind = keyof typeof EXPORT_DEFINITIONS
const ALLOWED_FORMATS = ["csv", "json", "xlsx"] as const
type ExportFormat = (typeof ALLOWED_FORMATS)[number]

const STATUS_FIELDS = new Set([
  "status",
  "export_status",
  "push_status",
  "consistency_status",
])

const DATETIME_FIELDS = new Set([
  "started_at",
  "finished_at",
  "created_at",
  "checked_at",
  "snapshot_at",
])

function isExportKind(value: string): value is ExportKind {
  return value in EXPORT_DEFINITIONS
}

interface AnyRow extends Record<string, unknown> {}

function formatExportDateTime(value: unknown): string {
  if (value == null || value === "") return ""
  if (value instanceof Date || typeof value === "string") {
    return formatBeijingTime(value)
  }
  return formatBeijingTime(String(value))
}

/** CSV 给人看：状态中文 + 时间 yyyy-MM-dd HH:mm:ss（北京时间）；JSON 保持原值便于脚本 */
function prepareRows(
  rows: AnyRow[],
  format: ExportFormat,
  fields: readonly string[],
): AnyRow[] {
  if (format !== "csv") return rows
  return rows.map((row) => {
    const next: AnyRow = { ...row }
    for (const field of fields) {
      if (!(field in next)) continue
      if (STATUS_FIELDS.has(field)) {
        next[field] = formatSyncStatus(next[field])
      } else if (DATETIME_FIELDS.has(field)) {
        next[field] = formatExportDateTime(next[field])
      }
    }
    return next
  })
}

export async function GET(request: NextRequest) {
  const kindValue = request.nextUrl.searchParams.get("kind") ?? ""
  const formatValue = (request.nextUrl.searchParams.get("format") ?? "csv").toLowerCase()

  if (!isExportKind(kindValue) || !ALLOWED_FORMATS.includes(formatValue as ExportFormat)) {
    return NextResponse.json(
      {
        code: 400,
        message: "kind must be package/table/scheduler/consistency and format must be csv/json/xlsx",
        dataSource: "validation",
      },
      { status: 400 }
    )
  }

  const actor = await resolveExportActor(request)
  const kind = kindValue
  const format = formatValue as ExportFormat
  const definition = EXPORT_DEFINITIONS[kind]
  const fields = definition.columns.map((c) => c.field)
  const labels = definition.columns.map((c) => c.label)
  const siteCode = request.nextUrl.searchParams.get("siteCode")?.trim() ?? ""
  const params: unknown[] = []
  const whereClause = siteCode ? "WHERE site_code = $1" : ""
  if (siteCode) params.push(siteCode)

  try {
    const result = await query<AnyRow>(
      `SELECT ${fields.join(", ")}
       FROM ${definition.source}
       ${whereClause}
       ORDER BY ${definition.orderBy}
       LIMIT 5000`,
      params
    )

    const exportResult = buildExport<AnyRow>({
      exportType: `sync_${kind}`,
      dataSource: definition.source,
      format,
      columns: [...fields] as Array<keyof AnyRow & string>,
      columnLabels: labels,
      rows: prepareRows(result.rows, format, fields),
      siteCode: siteCode || null,
      filters: { kind },
      filenamePrefix: `sync-${kind}`,
    })

    if (exportResult.code === "ok") {
      await recordExport(exportResult.manifest, { actor })
    }

    // R.13 兼容: 旧 e2e (test-sync) 检查 x-export-kind=kind (短名: package/table/...)
    // 框架默认 x-export-kind = exportType = "sync_package", 这里改回短名
    const res = toNextResponse(exportResult)
    if (exportResult.code === "ok") {
      res.headers.set("x-export-kind", kind)
    }
    return res
  } catch (error) {
    console.error("[API Error] /api/sync/export:", error)
    return NextResponse.json(
      { code: 500, message: "Internal server error", dataSource: "error", traceId: `api-${Date.now()}` },
      { status: 500 }
    )
  }
}
