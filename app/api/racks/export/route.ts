import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

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
}

const COLUMNS: Array<keyof DeviceExportRow> = [
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

function csvCell(value: unknown): string {
  if (value == null) return ""
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export async function GET(request: NextRequest) {
  try {
    const siteCode = request.nextUrl.searchParams.get("siteCode")?.trim() ?? ""
    const status = request.nextUrl.searchParams.get("status")?.trim() ?? ""
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

    const csv = [
      COLUMNS.join(","),
      ...result.rows.map((row) => COLUMNS.map((column) => csvCell(row[column])).join(",")),
    ].join("\r\n")
    const digest = createHash("sha256").update(csv, "utf8").digest("hex")
    const scope = siteCode || "all-sites"
    const filename = `devices-${scope}-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Data-Source": "unified_devices",
        "X-Export-Record-Count": String(result.rows.length),
        "X-Content-SHA256": digest,
      },
    })
  } catch (error) {
    console.error("[API Error] /api/racks/export:", error)
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
