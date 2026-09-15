/**
 * 光盘库设备详情盘位展示：按移位登记 RFID 映射到原设备同笼历史盘位态。
 * 不改推送/落库；撤销登记后自然回退当前设备同步态（与 ES 检索 RFID 归属同模型）。
 */

import { query } from "@/lib/db"
import {
  listCurrentMagazineRelocations,
  type MagazineRelocation,
} from "@/lib/control/cage-move-register"
import {
  magazineRfidVariants,
  magazineRfidsMatch,
  normalizeMagazineRfid,
} from "@/lib/devices/magazine-rfid"
import { pickDeviceIp, pickDevicePort } from "@/lib/devices/device-display"

export type HistoricalSlotState = {
  slotOrder: number
  rawData: Record<string, unknown>
  occupied: boolean | null
  status: string | null
  mediaId: string | null
  capacity: string | null
}

export type SlotOverlayTarget = {
  magazineRfid: string | null | undefined
  slotOrder: number | null
  rawData: Record<string, unknown> | null
  occupied: boolean
  status: string | null
  mediaId: string | null
  capacity: string | null
}

function trimOrEmpty(value: string | null | undefined): string {
  return String(value ?? "").trim()
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function portMatches(
  registeredPort: string | null | undefined,
  devicePort: string | null | undefined
): boolean {
  const rp = trimOrEmpty(registeredPort)
  if (!rp) return true
  const dp = trimOrEmpty(devicePort)
  if (!dp) return true
  return rp === dp
}

export function isRelocationTargetForDevice(
  reloc: MagazineRelocation,
  opts: {
    siteCode: string
    deviceIp: string
    devicePort?: string | null
  }
): boolean {
  if (reloc.target_site_code !== opts.siteCode) return false
  if (trimOrEmpty(reloc.target_device_ip) !== trimOrEmpty(opts.deviceIp)) return false
  return portMatches(reloc.target_device_port, opts.devicePort)
}

/** 在最新 registered 列表中，按 RFID 变体找到指向当前设备的入站登记 */
export function findInboundRelocationForMagazine(
  relocations: MagazineRelocation[],
  magazineRfid: string | null | undefined,
  device: { siteCode: string; deviceIp: string; devicePort?: string | null }
): MagazineRelocation | undefined {
  if (!normalizeMagazineRfid(magazineRfid)) return undefined
  return relocations.find(
    (row) =>
      magazineRfidsMatch(row.magazine_rfid, magazineRfid) &&
      isRelocationTargetForDevice(row, device)
  )
}

export function indexHistoricalSlotsByOrder(
  rows: Array<{
    slot_index: number | null
    raw_data: Record<string, unknown> | null
    occupied: boolean | null
    status: string | null
    media_id: string | null
    capacity: string | null
  }>
): Map<number, HistoricalSlotState> {
  const map = new Map<number, HistoricalSlotState>()
  for (const row of rows) {
    const order =
      numberValue(row.slot_index) ??
      numberValue(row.raw_data?.slot_order)
    if (order === null) continue
    map.set(order, {
      slotOrder: order,
      rawData: row.raw_data ?? {},
      occupied: row.occupied,
      status: row.status,
      mediaId: row.media_id,
      capacity: row.capacity,
    })
  }
  return map
}

/**
 * 用原设备历史盘位覆盖展示用业务字段；拓扑仍用当前设备行。
 * 无对应 slot_order 时保持当前（站点新盘）不变。
 */
export function applyHistoricalSlotOverlay<T extends SlotOverlayTarget>(
  current: T,
  historicalByOrder: Map<number, HistoricalSlotState> | undefined
): T {
  if (!historicalByOrder || current.slotOrder === null) return current
  const hist = historicalByOrder.get(current.slotOrder)
  if (!hist) return current

  const mergedRaw: Record<string, unknown> = {
    ...(current.rawData ?? {}),
  }
  const histRaw = hist.rawData
  for (const key of ["disc_type", "max_cap", "rest_cap", "hd_type", "serial_num"] as const) {
    if (histRaw[key] !== undefined && histRaw[key] !== null) {
      mergedRaw[key] = histRaw[key]
    }
  }

  const histDiscType = numberValue(histRaw.disc_type)
  return {
    ...current,
    rawData: mergedRaw,
    occupied:
      hist.occupied ??
      (histDiscType !== null ? histDiscType !== 0 : current.occupied),
    status: hist.status ?? current.status,
    mediaId: hist.mediaId ?? current.mediaId,
    capacity: hist.capacity ?? current.capacity,
  }
}

async function resolveDeviceIdentifiers(
  siteCode: string,
  deviceIp: string,
  devicePort?: string | null
): Promise<string[]> {
  const ip = trimOrEmpty(deviceIp)
  if (!ip) return []
  try {
    const { rows } = await query<{
      device_id: string | null
      source_id: string | null
      ip_address: string | null
      raw_data: Record<string, unknown> | null
    }>(
      `SELECT device_id, source_id, ip_address, raw_data
       FROM unified_devices
       WHERE source_site_id = $1
         AND (
           NULLIF(TRIM(ip_address), '') = $2
           OR COALESCE(raw_data->>'ip', raw_data->>'IP', raw_data->>'ip_address') = $2
         )`,
      [siteCode, ip]
    )
    const ids = new Set<string>()
    for (const row of rows) {
      const rowPort = pickDevicePort(row.raw_data)
      if (!portMatches(devicePort, rowPort)) continue
      if (row.device_id) ids.add(String(row.device_id))
      if (row.source_id) ids.add(String(row.source_id))
    }
    return [...ids]
  } catch {
    return []
  }
}

/**
 * 加载原站同 RFID 盘笼的盘位（允许离线 mag_order 为空；优先挂在登记原设备上的笼）。
 */
export async function loadHistoricalSlotsByRfid(opts: {
  sourceSiteCode: string
  sourceDeviceIp: string
  sourceDevicePort?: string | null
  magazineRfid: string
}): Promise<Map<number, HistoricalSlotState>> {
  const variants = magazineRfidVariants(opts.magazineRfid)
  if (!variants.length) return new Map()

  const deviceIds = await resolveDeviceIdentifiers(
    opts.sourceSiteCode,
    opts.sourceDeviceIp,
    opts.sourceDevicePort
  )

  try {
    const { rows: magazines } = await query<{
      magazine_id: string | null
      source_id: string | null
      source_record_id: string | null
      device_id: string | null
      mag_order: string | null
    }>(
      `SELECT magazine_id, source_id, source_record_id, device_id,
              raw_data->>'mag_order' AS mag_order
       FROM unified_magazines
       WHERE source_site_id = $1
         AND UPPER(TRIM(rfid)) = ANY($2::text[])
       ORDER BY
         CASE
           WHEN cardinality($3::text[]) > 0
            AND device_id = ANY($3::text[]) THEN 0
           ELSE 1
         END,
         CASE WHEN (raw_data->>'mag_order') IS NOT NULL AND TRIM(raw_data->>'mag_order') <> '' THEN 0 ELSE 1 END,
         synced_at DESC NULLS LAST`,
      [opts.sourceSiteCode, variants, deviceIds]
    )

    const mag = magazines[0]
    if (!mag) return new Map()

    const magKeys = [...new Set(
      [mag.magazine_id, mag.source_record_id, mag.source_id].filter(Boolean).map(String)
    )]
    if (!magKeys.length) return new Map()

    const { rows: slots } = await query<{
      slot_index: number | null
      raw_data: Record<string, unknown> | null
      occupied: boolean | null
      status: string | null
      media_id: string | null
      capacity: string | null
    }>(
      `SELECT slot_index, raw_data, occupied, status, media_id, capacity
       FROM unified_slots
       WHERE source_site_id = $1
         AND magazine_id = ANY($2::text[])
       ORDER BY COALESCE(slot_index, (raw_data->>'slot_order')::int) NULLS LAST`,
      [opts.sourceSiteCode, magKeys]
    )

    return indexHistoricalSlotsByOrder(slots)
  } catch (error) {
    console.warn(
      "[cage-move-slot-overlay] load historical slots failed:",
      error instanceof Error ? error.message : error
    )
    return new Map()
  }
}

/**
 * 为当前设备上各 RFID 预加载「若有入站移位登记 → 原设备历史盘位」映射。
 * key = 当前盘笼 RFID 的 normalize 主形式（调用方用 variants 查找）。
 */
export async function loadSlotHistoryOverlayMaps(opts: {
  siteCode: string
  deviceIp: string | null | undefined
  devicePort?: string | null
  magazineRfids: Array<string | null | undefined>
}): Promise<Map<string, Map<number, HistoricalSlotState>>> {
  const result = new Map<string, Map<number, HistoricalSlotState>>()
  const ip = trimOrEmpty(opts.deviceIp)
  if (!ip) return result

  const uniqueRfids = [
    ...new Set(
      opts.magazineRfids
        .map((r) => normalizeMagazineRfid(r))
        .filter(Boolean)
    ),
  ]
  if (!uniqueRfids.length) return result

  let relocations: MagazineRelocation[] = []
  try {
    relocations = await listCurrentMagazineRelocations()
  } catch {
    return result
  }

  const device = {
    siteCode: opts.siteCode,
    deviceIp: ip,
    devicePort: opts.devicePort,
  }

  for (const rfid of uniqueRfids) {
    const reloc = findInboundRelocationForMagazine(relocations, rfid, device)
    if (!reloc) continue
    if (!reloc.source_site_code?.trim() || !reloc.source_device_ip?.trim()) continue
    const history = await loadHistoricalSlotsByRfid({
      sourceSiteCode: reloc.source_site_code,
      sourceDeviceIp: reloc.source_device_ip,
      sourceDevicePort: reloc.source_device_port,
      magazineRfid: reloc.magazine_rfid,
    })
    if (!history.size) continue
    for (const variant of magazineRfidVariants(rfid)) {
      result.set(variant, history)
    }
  }

  return result
}

export function lookupHistoryForMagazineRfid(
  overlays: Map<string, Map<number, HistoricalSlotState>>,
  magazineRfid: string | null | undefined
): Map<number, HistoricalSlotState> | undefined {
  for (const variant of magazineRfidVariants(magazineRfid)) {
    const hit = overlays.get(variant)
    if (hit) return hit
  }
  return undefined
}

export function resolveDeviceIpPort(device: {
  ip_address?: string | null
  raw_data?: Record<string, unknown> | null
}): { ip: string | null; port: string | null } {
  const ip =
    trimOrEmpty(device.ip_address) ||
    pickDeviceIp(device.raw_data) ||
    null
  const port = pickDevicePort(device.raw_data)
  return { ip, port }
}
