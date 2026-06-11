import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { buildExport } from "@/lib/export"
import { toNextResponse } from "@/lib/export/next-response"
import { recordExport } from "@/lib/export/audit"

export const dynamic = "force-dynamic"

const EXPORT_DEFINITIONS = {
  package: {
    source: "sync_package_log",
    orderBy: "created_at DESC",
    columns: [
      "id",
      "site_code",
      "batch_id",
      "snapshot_at",
      "mode",
      "version",
      "package_checksum",
      "status",
      "table_count",
      "total_record_count",
      "success_table_count",
      "failed_table_count",
      "error_message",
      "started_at",
      "finished_at",
      "created_at",
    ],
  },
  table: {
    source: "sync_table_log",
    orderBy: "created_at DESC",
    columns: [
      "id",
      "package_log_id",
      "site_code",
      "batch_id",
      "table_name",
      "sync_mode",
      "table_checksum",
      "expected_record_count",
      "processed_record_count",
      "inserted_count",
      "updated_count",
      "skipped_count",
      "failed_count",
      "status",
      "error_message",
      "started_at",
      "finished_at",
      "created_at",
    ],
  },
  scheduler: {
    source: "sync_scheduler_log",
    orderBy: "started_at DESC",
    columns: [
      "id",
      "site_code",
      "run_id",
      "started_at",
      "finished_at",
      "status",
      "export_status",
      "push_status",
      "consistency_status",
      "package_batch_id",
      "error_message",
      "created_at",
    ],
  },
  consistency: {
    source: "sync_consistency_log",
    orderBy: "checked_at DESC",
    columns: [
      "id",
      "site_code",
      "checked_at",
      "status",
      "table_count",
      "matched_table_count",
      "mismatched_table_count",
      "result_json",
      "created_at",
    ],
  },
} as const

type ExportKind = keyof typeof EXPORT_DEFINITIONS
const ALLOWED_FORMATS = ["csv", "json", "xlsx"] as const
type ExportFormat = (typeof ALLOWED_FORMATS)[number]

function isExportKind(value: string): value is ExportKind {
  return value in EXPORT_DEFINITIONS
}

interface AnyRow extends Record<string, unknown> {}

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

  const kind = kindValue
  const format = formatValue as ExportFormat
  const definition = EXPORT_DEFINITIONS[kind]
  const siteCode = request.nextUrl.searchParams.get("siteCode")?.trim() ?? ""
  const params: unknown[] = []
  const whereClause = siteCode ? "WHERE site_code = $1" : ""
  if (siteCode) params.push(siteCode)

  try {
    const result = await query<AnyRow>(
      `SELECT ${definition.columns.join(", ")}
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
      columns: [...definition.columns] as Array<keyof AnyRow & string>,
      rows: result.rows,
      siteCode: siteCode || null,
      filters: { kind },
      filenamePrefix: `sync-${kind}`,
    })

    if (exportResult.code === "ok") {
      await recordExport(exportResult.manifest)
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
