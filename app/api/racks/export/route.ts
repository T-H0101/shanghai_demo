import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { buildExport } from "@/lib/export"
import { toNextResponse } from "@/lib/export/next-response"
import { recordExport, resolveExportActor } from "@/lib/export/audit"
import { formatBeijingTime } from "@/lib/time/beijing"
import { DEVICE_TYPE_LABELS } from "@/lib/devices/device-display"

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

const EXPORT_COLUMNS = [
  { field: "device_id", label: "设备 ID" },
  { field: "device_name", label: "设备名称" },
  { field: "device_type", label: "设备类型" },
  { field: "status", label: "状态" },
  { field: "ip_address", label: "IP 地址" },
  { field: "source_site_id", label: "站点" },
  { field: "site_code", label: "站点代码" },
  { field: "slot_count", label: "盘位数" },
  { field: "cage_count", label: "盘笼数" },
  { field: "model", label: "型号" },
  { field: "manufacturer", label: "厂商" },
  { field: "serial_no", label: "序列号" },
  { field: "synced_at", label: "同步时间" },
] as const

const COLUMNS = EXPORT_COLUMNS.map((c) => c.field)
const COLUMN_LABELS = EXPORT_COLUMNS.map((c) => c.label)

const DEVICE_STATUS_LABELS: Record<string, string> = {
  online: "在线",
  offline: "离线",
  warning: "警告",
  error: "错误",
  deleted: "已删除",
}

const ALLOWED_FORMATS = ["csv", "json", "xlsx"] as const
type AllowedFormat = (typeof ALLOWED_FORMATS)[number]

function prepareCsvRows(rows: DeviceExportRow[]): DeviceExportRow[] {
  return rows.map((row) => ({
    ...row,
    device_type: DEVICE_TYPE_LABELS[row.device_type] ?? row.device_type,
    status: row.status ? (DEVICE_STATUS_LABELS[row.status] ?? row.status) : row.status,
    synced_at: formatBeijingTime(row.synced_at) || "",
  }))
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveExportActor(request)
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

    const conditions: string[] = [`(status IS NULL OR status <> 'deleted')`]
    const params: unknown[] = []
    if (siteCode) {
      params.push(siteCode)
      conditions.push(`source_site_id = $${params.length}`)
    }
    if (status) {
      params.push(status)
      conditions.push(`status = $${params.length}`)
    }
    const whereClause = `WHERE ${conditions.join(" AND ")}`
    const result = await query<DeviceExportRow>(
      `SELECT device_id, device_name, device_type, status, ip_address,
              source_site_id, site_code, slot_count, cage_count,
              model, manufacturer, serial_no, synced_at::text
       FROM unified_devices
       ${whereClause}
       ORDER BY source_site_id, device_id`,
      params
    )

    const displayRows = format === "json" ? result.rows : prepareCsvRows(result.rows)
    const exportResult = buildExport<DeviceExportRow>({
      exportType: "devices",
      dataSource: "unified_devices",
      format,
      columns: [...COLUMNS] as Array<keyof DeviceExportRow & string>,
      columnLabels: [...COLUMN_LABELS],
      rows: displayRows,
      siteCode: siteCode || null,
      filters: { status: status || null },
      filenamePrefix: "devices",
    })

    // 审计写入 (失败不阻断)
    if (exportResult.code === "ok") {
      await recordExport(exportResult.manifest, { actor })
    }

    return toNextResponse(exportResult)
  } catch (error) {
    console.error("[API Error] /api/racks/export:", error)
    return NextResponse.json(
      { code: 500, message: "未知异常", dataSource: "error", traceId: `api-${Date.now()}` },
      { status: 500 }
    )
  }
}
