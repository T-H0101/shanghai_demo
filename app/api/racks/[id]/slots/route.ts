/**
 * GET /api/racks/[id]/slots
 * 只读中心库 unified_slots，不直连 source_restore。
 * 若盘笼 RFID 存在入站移位登记，展示态按原设备同 RFID 盘笼历史盘位覆盖（推送落库不变）。
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { RackSlotDetailDTO, RackSlotDTO, RackSlotGroupDTO } from "@/lib/api/dto"
import {
  discTypeToLegacySlotStatus,
  displaySlotIndex,
  displaySlotLabel,
  normalizeOpticalDiscType,
  opticalDiscTypeLabel,
} from "@/lib/devices/disc-slot-display"
import {
  isHddDeviceTypeLabel,
  isOpticalDeviceTypeLabel,
  isTapeDeviceTypeLabel,
  resolveDeviceTypeLabel,
} from "@/lib/devices/device-display"
import { sliceHdMagazineSlots } from "@/lib/devices/hd-tray-slice"
import {
  applyHistoricalSlotOverlay,
  loadSlotHistoryOverlayMaps,
  lookupHistoryForMagazineRfid,
  resolveDeviceIpPort,
} from "@/lib/devices/cage-move-slot-overlay"

export const dynamic = "force-dynamic"

interface DeviceRow {
  source_site_id: string
  source_id: string
  device_id: string | null
  device_type: string | null
  ip_address: string | null
  raw_data: Record<string, unknown> | null
}

interface SlotRow {
  id: string
  source_site_id: string
  source_table: string
  source_id: string
  source_record_id: string | null
  slot_id: string | null
  slot_index: number | null
  magazine_id: string | null
  status: string | null
  occupied: boolean
  media_id: string | null
  media_type: string | null
  capacity: string | null
  raw_data: Record<string, unknown> | null
  cage_position: string | null
  mag_raw_order: string | null
  mag_disc_type: string | null
  mag_rfid: string | null
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatBytes(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim()
    // 已是 "1.2 GB" 之类则直接保留
    if (/^\d+(\.\d+)?\s*[KMGTP]?B$/i.test(trimmed)) return trimmed
  }
  const bytes = numberValue(value)
  if (bytes === null || bytes < 0) return undefined
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index++
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

/** 优先用 raw max_cap/rest_cap，避免 capacity 列未格式化的原始字节串直出 */
function resolveCapacity(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    const formatted = formatBytes(candidate)
    if (formatted) return formatted
  }
  return undefined
}

function mapMediaType(value: unknown): RackSlotDTO["mediaType"] | undefined {
  const normalized = String(value ?? "").toLowerCase()
  if (normalized === "hdd" || normalized === "1") return "hdd"
  if (normalized === "bd" || normalized === "optical" || normalized === "0") return "bd"
  if (normalized === "offline") return "offline"
  return undefined
}

/** mag_order → position；展示：托盘${mag_order+1}（仅硬盘库） */
function resolveMagazineDisplayName(
  deviceTypeLabel: string | undefined,
  position: string | null,
  magRawOrder: string | null
): string | undefined {
  // 光盘库 / 磁带库：单「盘笼」，不展示 magazine 标识
  if (isOpticalDeviceTypeLabel(deviceTypeLabel) || isTapeDeviceTypeLabel(deviceTypeLabel)) {
    return undefined
  }
  if (!isHddDeviceTypeLabel(deviceTypeLabel)) {
    return undefined
  }
  const order0 = numberValue(position) ?? numberValue(magRawOrder) ?? 0
  return `托盘${order0 + 1}`
}

function mapSlot(
  row: SlotRow,
  cageName: string | undefined,
  options?: { magDiscType?: number | null; discTypeSide?: number | null },
): RackSlotDTO {
  const raw = row.raw_data ?? {}
  const rawDiscType = numberValue(raw.disc_type)
  const opticalDiscType = normalizeOpticalDiscType(rawDiscType)
  const rawSlotOrder = numberValue(raw.slot_order)
  const order0Based = rawSlotOrder ?? row.slot_index
  const discSide = numberValue(raw.disc_side)
  const rawMaxCapacity = numberValue(raw.max_cap)
  const rawRemainingCapacity = numberValue(raw.rest_cap)
  const occupied = row.occupied || (rawDiscType !== null && rawDiscType !== 0)
  const statusValue = String(row.status ?? "").toLowerCase()
  const status: RackSlotDTO["status"] =
    statusValue === "error" || statusValue === "damaged" || rawDiscType === 4
      ? "error"
      : opticalDiscType !== null
        ? discTypeToLegacySlotStatus(opticalDiscType)
        : occupied
          ? "used"
          : "free"
  const cageId = String(row.magazine_id ?? raw.mag_id ?? "unassigned")
  const index = displaySlotIndex(order0Based ?? numberValue(row.source_id))

  return {
    id: row.id,
    // 与业务一致：展示序号 = slot_order + 1；双面追加 A/B
    index,
    indexLabel: displaySlotLabel(order0Based ?? numberValue(row.source_id), {
      discSide,
      magDiscType: options?.magDiscType,
      discTypeSide: options?.discTypeSide,
    }),
    discSide: discSide ?? undefined,
    occupied,
    status,
    discType: opticalDiscType ?? rawDiscType ?? undefined,
    discTypeLabel: opticalDiscTypeLabel(opticalDiscType ?? rawDiscType),
    sourceSiteId: row.source_site_id,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    cageId,
    cageName,
    slotId: row.slot_id ?? String(raw.slot_id ?? row.source_id),
    discNo: row.media_id ?? (raw.serial_num ? String(raw.serial_num) : undefined),
    label: row.cage_position ?? undefined,
    mediaType: mapMediaType(row.media_type ?? raw.hd_type),
    capacity: resolveCapacity(rawMaxCapacity, row.capacity),
    usedCapacity:
      rawMaxCapacity !== null && rawRemainingCapacity !== null
        ? formatBytes(Math.max(0, rawMaxCapacity - rawRemainingCapacity))
        : undefined,
    remainingCapacity: resolveCapacity(rawRemainingCapacity),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const siteCode = request.nextUrl.searchParams.get("siteCode")
    const deviceParams: unknown[] = [id]
    const siteCondition = siteCode ? "AND source_site_id = $2" : ""
    if (siteCode) deviceParams.push(siteCode)

    const deviceResult = await query<DeviceRow>(
      `SELECT source_site_id, source_id, device_id, device_type, ip_address, raw_data
       FROM unified_devices
       WHERE (id::text = $1 OR device_id = $1 OR source_id = $1)
       ${siteCondition}
       ORDER BY (id::text = $1) DESC
       LIMIT 2`,
      deviceParams
    )

    if (deviceResult.rows.length === 0) {
      return NextResponse.json(
        { code: 404, message: "Rack not found", data: null, source: "empty", traceId: `api-${Date.now()}` },
        { status: 404 }
      )
    }

    if (!siteCode && deviceResult.rows.length > 1) {
      return NextResponse.json(
        {
          code: 400,
          message: "siteCode required for ambiguous rack id",
          data: null,
          source: "empty",
          traceId: `api-${Date.now()}`,
        },
        { status: 400 }
      )
    }

    const device = deviceResult.rows[0]
    const deviceTypeLabel = resolveDeviceTypeLabel(device.device_type)
    const isHddDevice = isHddDeviceTypeLabel(deviceTypeLabel)
    const identifiers = [...new Set([device.device_id, device.source_id].filter(Boolean))]
    const [slotResult, discTypeResult] = await Promise.all([
      query<SlotRow>(
        `SELECT s.id::text, s.source_site_id, s.source_table,
                COALESCE(s.source_id, s.source_record_id, s.slot_id) AS source_id,
                s.source_record_id, s.slot_id, s.slot_index, s.magazine_id, s.status, s.occupied,
                s.media_id, s.media_type, s.capacity, s.raw_data,
                m.position AS cage_position,
                m.raw_data->>'mag_order' AS mag_raw_order,
                m.raw_data->>'disc_type' AS mag_disc_type,
                m.rfid AS mag_rfid
         FROM unified_slots s
         INNER JOIN unified_magazines m
           ON m.source_site_id = s.source_site_id
          AND (m.magazine_id = s.magazine_id OR m.source_record_id = s.magazine_id OR m.source_id = s.magazine_id)
          AND (m.raw_data->>'mag_order') IS NOT NULL
         WHERE s.source_site_id = $1
           AND s.device_id = ANY($2::text[])
         ORDER BY
           CASE WHEN m.position ~ '^[0-9]+$' THEN m.position::int ELSE 2147483647 END,
           COALESCE(s.slot_index, (s.raw_data->>'slot_order')::int) NULLS LAST,
           COALESCE((s.raw_data->>'disc_side')::int, 0),
           COALESCE(s.source_id, s.source_record_id)`,
        [device.source_site_id, identifiers]
      ),
      query<{ src_type_id: string | null; disc_side: number | null; raw_data: Record<string, unknown> | null }>(
        `SELECT src_type_id, disc_side, raw_data
         FROM unified_disc_types
         WHERE source_site_id = $1`,
        [device.source_site_id]
      ).catch(() => ({ rows: [] as { src_type_id: string | null; disc_side: number | null; raw_data: Record<string, unknown> | null }[] })),
    ])

    const discTypeSideById = new Map<number, number>()
    for (const row of discTypeResult.rows) {
      const typeId = numberValue(row.src_type_id) ?? numberValue(row.raw_data?.id)
      if (typeId == null) continue
      const side =
        numberValue(row.disc_side) ??
        numberValue(row.raw_data?.disc_side) ??
        1
      discTypeSideById.set(typeId, side)
    }

    const { ip: deviceIp, port: devicePort } = resolveDeviceIpPort(device)
    const historyOverlays = await loadSlotHistoryOverlayMaps({
      siteCode: device.source_site_id,
      deviceIp,
      devicePort,
      magazineRfids: slotResult.rows.map((row) => row.mag_rfid),
    })

    type GroupMeta = {
      cageId: string
      cageName: string
      cageIndex: number
      magOrder: number
      magDiscType: number | null
      slots: RackSlotDTO[]
    }

    const groups = new Map<string, GroupMeta>()
    for (const row of slotResult.rows) {
      const slotOrder =
        numberValue(row.raw_data?.slot_order) ?? numberValue(row.slot_index)
      const history = lookupHistoryForMagazineRfid(historyOverlays, row.mag_rfid)
      const overlaid = applyHistoricalSlotOverlay(
        {
          magazineRfid: row.mag_rfid,
          slotOrder,
          rawData: row.raw_data,
          occupied: row.occupied,
          status: row.status,
          mediaId: row.media_id,
          capacity: row.capacity,
        },
        history
      )
      const displayRow: SlotRow = {
        ...row,
        raw_data: overlaid.rawData,
        occupied: overlaid.occupied,
        status: overlaid.status,
        media_id: overlaid.mediaId,
        capacity: overlaid.capacity,
      }
      const cageName = resolveMagazineDisplayName(
        deviceTypeLabel,
        row.cage_position,
        row.mag_raw_order
      )
      const magDiscType =
        numberValue(row.mag_disc_type) ?? (isHddDevice ? 9 : null)
      const slot = mapSlot(displayRow, cageName, {
        magDiscType,
        discTypeSide: magDiscType != null ? discTypeSideById.get(magDiscType) ?? null : null,
      })
      const cageId = slot.cageId ?? "unassigned"
      if (!groups.has(cageId)) {
        const magOrder =
          numberValue(row.cage_position) ??
          numberValue(row.mag_raw_order) ??
          groups.size
        groups.set(cageId, {
          cageId,
          cageName: slot.cageName ?? "",
          cageIndex: magOrder + 1,
          magOrder,
          // 业务 lib_magInfo：仅 disc_type==9 才裁剪；硬盘库托盘缺字段时按 9 兜底
          magDiscType,
          slots: [],
        })
      }
      const group = groups.get(cageId)!
      slot.cageIndex = group.cageIndex
      group.slots.push(slot)
    }

    const magCount = groups.size
    const cages: RackSlotGroupDTO[] = [...groups.values()]
      .sort((a, b) => a.cageIndex - b.cageIndex)
      .map((group) => {
        const sliced = isHddDevice
          ? sliceHdMagazineSlots(group.slots, {
              magDiscType: group.magDiscType,
              magOrder: group.magOrder,
              magCount,
              deviceType: device.device_type,
            })
          : group.slots
        // 兜底：同笼若出现 B 面（disc_side>0），按双面补齐 A/B 标签
        const dualByData = sliced.some((s) => (s.discSide ?? 0) > 0)
        if (dualByData) {
          for (const slot of sliced) {
            slot.indexLabel = displaySlotLabel(slot.index - 1, {
              discSide: slot.discSide ?? 0,
              dualSided: true,
            })
          }
        }
        return {
          cageId: group.cageId,
          cageName: group.cageName,
          cageIndex: group.cageIndex,
          slots: sliced,
        }
      })

    const flatSlots = cages.flatMap((c) => c.slots)

    const data: RackSlotDetailDTO = {
      rackId: device.device_id ?? device.source_id,
      siteCode: device.source_site_id,
      cages,
      slots: flatSlots,
    }

    return NextResponse.json({
      code: 0,
      message: "ok",
      data,
      source: flatSlots.length > 0 ? "database" : "empty",
      traceId: `api-${Date.now()}`,
    })
  } catch (error) {
    console.error("[API Error] /api/racks/[id]/slots:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "未知异常",
        data: null,
        source: "empty",
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
