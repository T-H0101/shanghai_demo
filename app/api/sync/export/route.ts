import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

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
type ExportFormat = "csv" | "json"

function isExportKind(value: string): value is ExportKind {
  return value in EXPORT_DEFINITIONS
}

function csvCell(value: unknown): string {
  if (value == null) return ""
  const text = typeof value === "object" ? JSON.stringify(value) : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export async function GET(request: NextRequest) {
  const kindValue = request.nextUrl.searchParams.get("kind") ?? ""
  const formatValue = request.nextUrl.searchParams.get("format") ?? "csv"

  if (!isExportKind(kindValue) || !["csv", "json"].includes(formatValue)) {
    return NextResponse.json(
      {
        code: 400,
        message: "kind must be package/table/scheduler/consistency and format must be csv/json",
        source: "validation",
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
    const result = await query<Record<string, unknown>>(
      `SELECT ${definition.columns.join(", ")}
       FROM ${definition.source}
       ${whereClause}
       ORDER BY ${definition.orderBy}
       LIMIT 5000`,
      params
    )

    const body = format === "json"
      ? JSON.stringify({
          kind,
          source: definition.source,
          siteCode: siteCode || null,
          data: result.rows,
        })
      : [
          definition.columns.join(","),
          ...result.rows.map((row) =>
            definition.columns.map((column) => csvCell(row[column])).join(",")
          ),
        ].join("\r\n")
    const digest = createHash("sha256").update(body, "utf8").digest("hex")
    const scope = siteCode || "all-sites"
    const filename = `sync-${kind}-${scope}-${new Date().toISOString().slice(0, 10)}.${format}`

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": format === "json"
          ? "application/json; charset=utf-8"
          : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Data-Source": definition.source,
        "X-Export-Kind": kind,
        "X-Export-Record-Count": String(result.rows.length),
        "X-Content-SHA256": digest,
      },
    })
  } catch (error) {
    console.error("[API Error] /api/sync/export:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        source: "error",
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
