/**
 * GET /api/racks
 * 盘架列表 API
 *
 * API mode: 读取 unified_devices 真实中心表
 * Mock mode: 使用 mock 数据（通过 apiRackProvider fallback）
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { ApiResponse, RackDTO } from "@/lib/api/dto"

// unified_devices.device_type → 前端显示名
const DEVICE_TYPE_LABELS: Record<string, string> = {
  gen2_library: "Gen2 光盘库",
  gen2_offline: "Gen2 离线库",
  gen1_legacy: "Gen1 旧库",
  gen1_new: "Gen1 新库",
  gen1_offline: "Gen1 离线库",
  gen3_library: "Gen3 光盘库",
  publisher: "光盘打印机",
  hdd_library: "智能硬盘库",
  tape_library: "磁带库",
  tape_drive: "磁带机",
  sas_hdd_library: "SAS 硬盘库",
  film_library: "胶片库",
  nas: "NAS",
  alarm: "告警设备",
  gen4_library: "Gen4 光盘库",
}

// unified_devices.status → RackDTO.deviceStatus
const DEVICE_STATUS_MAP: Record<string, "online" | "offline"> = {
  online: "online",
  offline: "offline",
  deleted: "offline",
  warning: "offline",
  error: "offline",
}

// unified_devices.status → RackDTO.status
const RACK_STATUS_MAP: Record<string, RackDTO["status"]> = {
  online: "normal",
  offline: "fault",
  deleted: "fault",
  warning: "warning",
  error: "fault",
}

interface DeviceRow {
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
  synced_at: Date | string
  total_capacity: number | null
  used_capacity: number | null
  used_slots: number | null
}

function formatBytes(bytes: number | null | undefined): string | undefined {
  if (bytes == null || bytes <= 0) return undefined
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

function mapDeviceToRackDTO(row: DeviceRow): RackDTO {
  const deviceStatus = DEVICE_STATUS_MAP[row.status ?? ""] ?? "offline"
  const rackStatus = RACK_STATUS_MAP[row.status ?? ""] ?? "fault"

  const totalCapacity = row.total_capacity
  const usedCapacity = row.used_capacity
  const usagePercent = totalCapacity && totalCapacity > 0 && usedCapacity != null
    ? Math.round((usedCapacity / totalCapacity) * 100)
    : undefined

  return {
    id: row.device_id,
    rackId: row.device_id,
    rackName: row.device_name ?? `设备-${row.device_id}`,
    siteName: row.site_code ?? row.source_site_id,
    siteCode: row.source_site_id,
    datacenter: "",
    cages: [],
    totalSlots: row.slot_count ?? 0,
    usedSlots: row.used_slots ?? undefined,
    usagePercent: usagePercent ?? 0,
    status: rackStatus,
    lastSyncAt: typeof row.synced_at === "string"
      ? row.synced_at
      : row.synced_at.toISOString(),
    floor: undefined,
    room: undefined,
    ip: row.ip_address ?? undefined,
    deviceType: DEVICE_TYPE_LABELS[row.device_type] ?? row.device_type,
    deviceStatus,
    onlineStatus: deviceStatus,
    totalCapacity: formatBytes(totalCapacity),
    remainingCapacity: formatBytes(
      totalCapacity && usedCapacity != null ? totalCapacity - usedCapacity : undefined
    ),
    currentTaskCount: 0,
    mode: undefined,
    cageCount: row.cage_count ?? undefined,
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const siteCode = searchParams.get("siteCode")
    const status = searchParams.get("status")

    // 构建查询
    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (siteCode) {
      conditions.push(`source_site_id = $${paramIndex++}`)
      params.push(siteCode)
    }
    if (status) {
      conditions.push(`status = $${paramIndex++}`)
      params.push(status)
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : ""

    const sql = `SELECT device_id, device_name, device_type, status, ip_address,
                        source_site_id, site_code, slot_count, cage_count,
                        model, manufacturer, serial_no, synced_at,
                        total_capacity, used_capacity, used_slots
                 FROM unified_devices ${whereClause}
                 ORDER BY device_id`

    const { rows } = await query<DeviceRow>(sql, params)
    const data = rows.map(mapDeviceToRackDTO)

    const response: ApiResponse<RackDTO[]> = {
      code: 0,
      message: "ok",
      data,
      traceId: `api-${Date.now()}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API Error] /api/racks:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        data: null,
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
