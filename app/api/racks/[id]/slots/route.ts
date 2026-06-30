/**
 * GET /api/racks/[id]/slots
 * 只读中心库 unified_slots，不直连 source_restore。
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { RackSlotDetailDTO, RackSlotDTO, RackSlotGroupDTO } from "@/lib/api/dto"

export const dynamic = "force-dynamic"

interface DeviceRow {
  source_site_id: string
  source_id: string
  device_id: string | null
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
  cage_name: string | null
  cage_position: string | null
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatBytes(value: unknown): string | undefined {
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

function mapMediaType(value: unknown): RackSlotDTO["mediaType"] | undefined {
  const normalized = String(value ?? "").toLowerCase()
  if (normalized === "hdd" || normalized === "1") return "hdd"
  if (normalized === "bd" || normalized === "optical" || normalized === "0") return "bd"
  if (normalized === "offline") return "offline"
  return undefined
}

function mapSlot(row: SlotRow): RackSlotDTO {
  const raw = row.raw_data ?? {}
  const rawDiscType = numberValue(raw.disc_type)
  const rawSlotOrder = numberValue(raw.slot_order)
  const rawMaxCapacity = numberValue(raw.max_cap)
  const rawRemainingCapacity = numberValue(raw.rest_cap)
  const occupied = row.occupied || (rawDiscType !== null && rawDiscType !== 0)
  const statusValue = String(row.status ?? "").toLowerCase()
  const status: RackSlotDTO["status"] =
    statusValue === "error" || statusValue === "damaged" || rawDiscType === 4
      ? "error"
      : occupied
        ? "used"
        : "free"
  const cageId = String(row.magazine_id ?? raw.mag_id ?? "unassigned")

  return {
    id: row.id,
    index: row.slot_index ?? (rawSlotOrder !== null ? rawSlotOrder + 1 : numberValue(row.source_id) ?? 0),
    occupied,
    status,
    sourceSiteId: row.source_site_id,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    cageId,
    cageName: row.cage_name ?? `盘笼 ${cageId}`,
    slotId: row.slot_id ?? String(raw.slot_id ?? row.source_id),
    discNo: row.media_id ?? (raw.serial_num ? String(raw.serial_num) : undefined),
    label: row.cage_position ?? undefined,
    mediaType: mapMediaType(row.media_type ?? raw.hd_type),
    capacity: row.capacity ?? formatBytes(rawMaxCapacity),
    usedCapacity:
      rawMaxCapacity !== null && rawRemainingCapacity !== null
        ? formatBytes(Math.max(0, rawMaxCapacity - rawRemainingCapacity))
        : undefined,
    remainingCapacity: formatBytes(rawRemainingCapacity),
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
      `SELECT source_site_id, source_id, device_id
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
    const identifiers = [...new Set([device.device_id, device.source_id].filter(Boolean))]
    const slotResult = await query<SlotRow>(
      `SELECT s.id::text, s.source_site_id, s.source_table,
              COALESCE(s.source_id, s.source_record_id, s.slot_id) AS source_id,
              s.source_record_id, s.slot_id, s.slot_index, s.magazine_id, s.status, s.occupied,
              s.media_id, s.media_type, s.capacity, s.raw_data,
              COALESCE(m.barcode, m.magazine_id) AS cage_name,
              m.position AS cage_position
       FROM unified_slots s
       LEFT JOIN unified_magazines m
         ON m.source_site_id = s.source_site_id
        AND (m.magazine_id = s.magazine_id OR m.source_record_id = s.magazine_id OR m.source_id = s.magazine_id)
       WHERE s.source_site_id = $1
         AND s.device_id = ANY($2::text[])
       ORDER BY COALESCE(s.magazine_id, ''), s.slot_index NULLS LAST, COALESCE(s.source_id, s.source_record_id)`,
      [device.source_site_id, identifiers]
    )

    const slots = slotResult.rows.map(mapSlot)
    const groups = new Map<string, RackSlotGroupDTO>()
    for (const slot of slots) {
      const cageId = slot.cageId ?? "unassigned"
      if (!groups.has(cageId)) {
        groups.set(cageId, {
          cageId,
          cageName: slot.cageName ?? `盘笼 ${cageId}`,
          cageIndex: groups.size + 1,
          slots: [],
        })
      }
      const group = groups.get(cageId)!
      slot.cageIndex = group.cageIndex
      group.slots.push(slot)
    }

    const data: RackSlotDetailDTO = {
      rackId: device.device_id ?? device.source_id,
      siteCode: device.source_site_id,
      cages: [...groups.values()],
      slots,
    }

    return NextResponse.json({
      code: 0,
      message: "ok",
      data,
      source: slots.length > 0 ? "database" : "empty",
      traceId: `api-${Date.now()}`,
    })
  } catch (error) {
    console.error("[API Error] /api/racks/[id]/slots:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        data: null,
        source: "empty",
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
