import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { buildExport } from "@/lib/export"
import { toNextResponse } from "@/lib/export/next-response"
import { recordExport } from "@/lib/export/audit"

export const dynamic = "force-dynamic"

interface DeviceExportRow {
  device_id: string
  device_name: string | null
  device_type: string
  status: string | null
  ip_address: string | null
  source_site_id: string
  site_code: string | null
  slot_count: number | null
  cage_count: number | null
  model: string | null
  manufacturer: string | null
  serial_no: string | null
  synced_at: string
  [key: string]: unknown
}

const COLUMNS: Array<keyof DeviceExportRow & string> = [
  "device_id",
  "device_name",
  "device_type",
  "status",
  "ip_address",
  "source_site_id",
  "site_code",
  "slot_count",
  "cage_count",
  "model",
  "manufacturer",
  "serial_no",
  "synced_at",
]

const ALLOWED_FORMATS = ["csv", "json", "xlsx"] as const
type AllowedFormat = (typeof ALLOWED_FORMATS)[number]

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const siteCode = sp.get("siteCode")?.trim() ?? ""
    const status = sp.get("status")?.trim() ?? ""
    const formatParam = (sp.get("format") ?? "csv").toLowerCase()
    if (!ALLOWED_FORMATS.includes(formatParam as AllowedFormat)) {
      return NextResponse.json(
        { code: 400, message: `format must be one of ${ALLOWED_FORMATS.join("/")}`, dataSource: "error" },
        { status: 400 }
      )
    }
    const format = formatParam as AllowedFormat

    const conditions: string[] = []
    const params: unknown[] = []
    if (siteCode) {
      params.push(siteCode)
      conditions.push(`source_site_id = $${params.length}`)
    }
    if (status) {
      params.push(status)
      conditions.push(`status = $${params.length}`)
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const result = await query<DeviceExportRow>(
      `SELECT device_id, device_name, device_type, status, ip_address,
              source_site_id, site_code, slot_count, cage_count,
              model, manufacturer, serial_no, synced_at::text
       FROM unified_devices
       ${whereClause}
       ORDER BY source_site_id, device_id`,
      params
    )

    const exportResult = buildExport<DeviceExportRow>({
      exportType: "devices",
      dataSource: "unified_devices",
      format,
      columns: COLUMNS,
      rows: result.rows,
      siteCode: siteCode || null,
      filters: { status: status || null },
      filenamePrefix: "devices",
    })

    // 审计写入 (失败不阻断)
    if (exportResult.code === "ok") {
      await recordExport(exportResult.manifest)
    }

    return toNextResponse(exportResult)
  } catch (error) {
    console.error("[API Error] /api/racks/export:", error)
    return NextResponse.json(
      { code: 500, message: "Internal server error", dataSource: "error", traceId: `api-${Date.now()}` },
      { status: 500 }
    )
  }
}
