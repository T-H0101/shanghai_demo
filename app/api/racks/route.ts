/**
 * GET /api/racks
 * 盘架列表 API
 *
 * API mode: 读取 unified_devices 真实中心表
 * 查询失败或空数据时由调用方显式处理，不允许 mock fallback。
 *
 * device_status 口径（tbl_disc_lib）:
 *   1 online / 0 offline / 2 deleted(不展示) / 3 warning / 4 error
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireSession, requirePermission, getVisibleSites } from "@/lib/auth/middleware"
import type { RackDTO } from "@/lib/api/dto"
import { DEVICE_TYPE_LABELS, pickDeviceIp, pickDevicePort } from "@/lib/devices/device-display"
import {
  isDeletedDeviceStatus,
  mapUnifiedStatusToDeviceRuntime,
  mapUnifiedStatusToOnline,
  mapUnifiedStatusToRackStatus,
} from "@/lib/devices/device-status"

interface DeviceRow {
  device_id: string
  device_name: string | null
  device_type: string
  status: string | null
  ip_address: string | null
  source_site_id: string
  site_code: string | null
  site_name: string | null
  slot_count: number | null
  cage_count: number | null
  model: string | null
  manufacturer: string | null
  serial_no: string | null
  synced_at: Date | string
  total_capacity: number | null
  used_capacity: number | null
  used_slots: number | null
  raw_data: Record<string, unknown> | null
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

/** 所属站点仅展示名称，不展示站点编码 */
function formatSiteDisplayName(siteName: string | null | undefined): string {
  const name = siteName?.trim()
  return name || "—"
}

function mapDeviceToRackDTO(row: DeviceRow): RackDTO {
  const deviceStatus = mapUnifiedStatusToDeviceRuntime(row.status)
  const rackStatus = mapUnifiedStatusToRackStatus(row.status)
  const onlineStatus = mapUnifiedStatusToOnline(row.status)

  const totalCapacity = row.total_capacity
  const isNas = row.device_type === "nas"
  const usedCapacity = row.used_capacity
  const hasCapacityData = !isNas && totalCapacity != null && totalCapacity > 0
  const usagePercent = hasCapacityData && usedCapacity != null
    ? Math.round((usedCapacity / totalCapacity!) * 100)
    : undefined

  const ip =
    (row.ip_address && row.ip_address.trim()) ||
    pickDeviceIp(row.raw_data) ||
    undefined
  const port = pickDevicePort(row.raw_data) ?? undefined

  return {
    id: row.device_id,
    rackId: row.device_id,
    rackName: row.device_name ?? `设备-${row.device_id}`,
    siteName: formatSiteDisplayName(row.site_name),
    siteCode: row.source_site_id,
    datacenter: "",
    cages: [],
    totalSlots: isNas ? 0 : (row.slot_count ?? 0),
    usedSlots: isNas ? 0 : (row.used_slots ?? undefined),
    usagePercent: usagePercent,
    status: rackStatus,
    lastSyncAt: typeof row.synced_at === "string"
      ? row.synced_at
      : row.synced_at.toISOString(),
    floor: undefined,
    room: undefined,
    ip,
    port,
    serialNo:
      (row.serial_no && row.serial_no.trim()) ||
      (typeof row.raw_data?.sn === "string" && row.raw_data.sn.trim()) ||
      (typeof row.raw_data?.SN === "string" && row.raw_data.SN.trim()) ||
      undefined,
    deviceType: DEVICE_TYPE_LABELS[row.device_type] ?? row.device_type,
    deviceStatus,
    onlineStatus,
    totalCapacity: isNas ? undefined : formatBytes(totalCapacity),
    remainingCapacity: isNas
      ? undefined
      : formatBytes(
          totalCapacity && usedCapacity != null ? totalCapacity - usedCapacity : undefined
        ),
    currentTaskCount: 0,
    mode: undefined,
    cageCount: isNas ? 0 : (row.cage_count ?? undefined),
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request)
    requirePermission(session, "platform:read")
    const visibleSites = getVisibleSites(session)

    const searchParams = request.nextUrl.searchParams
    const siteCode = searchParams.get("siteCode")
    const status = searchParams.get("status")

    // 默认排除 deleted
    const conditions: string[] = [`(d.status IS NULL OR d.status <> 'deleted')`]
    const params: unknown[] = []
    let paramIndex = 1

    if (siteCode) {
      conditions.push(`d.source_site_id = $${paramIndex++}`)
      params.push(siteCode)
    } else if (visibleSites) {
      conditions.push(`d.source_site_id = ANY($${paramIndex++})`)
      params.push(visibleSites)
    }
    if (status) {
      if (status === "deleted") {
        conditions[0] = `d.status = $${paramIndex++}`
        params.push("deleted")
      } else {
        conditions.push(`d.status = $${paramIndex++}`)
        params.push(status)
      }
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`

    const sql = `SELECT d.device_id, d.device_name, d.device_type, d.status, d.ip_address,
                        d.source_site_id, d.site_code, ss.site_name, d.slot_count, d.cage_count,
                        d.model, d.manufacturer, d.serial_no, d.synced_at,
                        d.total_capacity, d.used_capacity, d.used_slots, d.raw_data
                 FROM unified_devices d
                 LEFT JOIN sync_sites ss ON ss.site_code = d.source_site_id
                 ${whereClause}
                 ORDER BY d.device_id`

    const { rows } = await query<DeviceRow>(sql, params)
    const data = rows
      .filter((row) => !isDeletedDeviceStatus(row.status) || status === "deleted")
      .map(mapDeviceToRackDTO)

    return NextResponse.json({
      code: 0,
      message: "ok",
      data,
      source: "database" as const,
      sourceEvidence: {
        sourceTable: "unified_devices",
        rowCount: data.length,
        syncedAt: data[0]?.lastSyncAt ?? new Date().toISOString(),
        mapper: "Sprint 2H.2 inlineUpsert (R.17 复核)",
      },
      traceId: `api-${Date.now()}`,
    })
  } catch (error) {
    if (error instanceof NextResponse) return error
    console.error("[API Error] /api/racks:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        data: [],
        source: "error",
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
