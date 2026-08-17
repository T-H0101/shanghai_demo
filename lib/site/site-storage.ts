/**
 * 站点级存储容量聚合（对齐 MultimediumCentral systemLibInfo / lib_libCap）
 *
 * 站点详情「存储总量 / 已用存储」= 该站点下全部设备容量之和。
 * - 光盘库: total ≈ 槽位数 × tbl_disc_type.disc_cap；rest 来自 slot.rest_cap
 * - 硬盘/磁带: total = SUM(max_cap)；rest = SUM(rest_cap)（disc_type 1/3）
 * - used = max(0, total - rest)
 */

import { query } from "@/lib/db"

const CD_LIB_TYPES = new Set([1, 3, 4, 6, 15])
const HD_LIB_TYPES = new Set([8, 9, 10, 11, 13])

export interface SiteStorageBytes {
  totalCap: number
  usedCap: number
  restCap: number
}

interface DeviceCap {
  total_cap: number
  used_cap: number
  rest_cap: number
}

type JsonRecord = Record<string, unknown>

type SlotAgg = {
  disc_type: number
  max_cap: number
  rest_cap: number
  total: number
  total_slot: number
}

function asNumber(value: unknown): number {
  if (value == null || value === "") return 0
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function rawOf(row: { raw_data?: unknown }): JsonRecord {
  const raw = row.raw_data
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as JsonRecord
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as JsonRecord
      }
    } catch {
      /* ignore */
    }
  }
  return {}
}

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let size = bytes
  let i = 0
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  const digits = size >= 100 || i === 0 ? 0 : size >= 10 ? 1 : 2
  return `${size.toFixed(digits)} ${units[i]}`
}

export function toSiteStorageDisplay(cap: SiteStorageBytes | undefined): {
  storageTotal: string
  storageUsed: string
  storageUsedPercent: number
} {
  if (!cap || cap.totalCap <= 0) {
    return { storageTotal: "—", storageUsed: "—", storageUsedPercent: 0 }
  }
  const used = Math.max(0, Math.min(cap.usedCap, cap.totalCap))
  return {
    storageTotal: formatStorageBytes(cap.totalCap),
    storageUsed: formatStorageBytes(used),
    storageUsedPercent: Math.round((used / cap.totalCap) * 100),
  }
}

function finalize(one: DeviceCap): DeviceCap {
  one.used_cap = one.total_cap - one.rest_cap > 0 ? one.total_cap - one.rest_cap : 0
  return one
}

async function loadSiteContext(siteCodes: string[]) {
  const devicesRes = await query<{ source_site_id: string; device_id: string | null; raw_data: unknown }>(
    `SELECT source_site_id, device_id, raw_data
     FROM unified_devices WHERE source_site_id = ANY($1)`,
    [siteCodes],
  )

  let mags: Array<{
    source_site_id: string
    magazine_id: string | null
    device_id: string | null
    disc_type: number | null
    raw_data: unknown
  }>
  try {
    const magsRes = await query<{
      source_site_id: string
      magazine_id: string | null
      device_id: string | null
      disc_type: number | null
      raw_data: unknown
    }>(
      `SELECT source_site_id, magazine_id, device_id, disc_type, raw_data
       FROM unified_magazines WHERE source_site_id = ANY($1)`,
      [siteCodes],
    )
    mags = magsRes.rows
  } catch {
    const magsRes = await query<{
      source_site_id: string
      magazine_id: string | null
      device_id: string | null
      disc_type: null
      raw_data: unknown
    }>(
      `SELECT source_site_id, magazine_id, device_id, NULL::int AS disc_type, raw_data
       FROM unified_magazines WHERE source_site_id = ANY($1)`,
      [siteCodes],
    )
    mags = magsRes.rows
  }

  let slots: Array<{
    source_site_id: string
    magazine_id: string | null
    capacity_bytes: number | string | null
    remaining_capacity: number | string | null
    raw_data: unknown
  }>
  try {
    const slotsRes = await query<{
      source_site_id: string
      magazine_id: string | null
      capacity_bytes: number | string | null
      remaining_capacity: number | string | null
      raw_data: unknown
    }>(
      `SELECT source_site_id, magazine_id, capacity_bytes, remaining_capacity, raw_data
       FROM unified_slots WHERE source_site_id = ANY($1)`,
      [siteCodes],
    )
    slots = slotsRes.rows
  } catch {
    const slotsRes = await query<{
      source_site_id: string
      magazine_id: string | null
      capacity_bytes: null
      remaining_capacity: null
      raw_data: unknown
    }>(
      `SELECT source_site_id, magazine_id,
              NULL::bigint AS capacity_bytes,
              NULL::bigint AS remaining_capacity,
              raw_data
       FROM unified_slots WHERE source_site_id = ANY($1)`,
      [siteCodes],
    )
    slots = slotsRes.rows
  }

  let types: Array<{
    source_site_id: string
    src_type_id: number | string | null
    disc_cap: number | string | null
    disc_side: number | string | null
    raw_data: unknown
  }>
  try {
    const typesRes = await query<{
      source_site_id: string
      src_type_id: number | string | null
      disc_cap: number | string | null
      disc_side: number | string | null
      raw_data: unknown
    }>(
      `SELECT source_site_id, src_type_id, disc_cap, disc_side, raw_data
       FROM unified_disc_types WHERE source_site_id = ANY($1)`,
      [siteCodes],
    )
    types = typesRes.rows
  } catch {
    try {
      const typesRes = await query<{
        source_site_id: string
        src_type_id: number | string | null
        disc_cap: null
        disc_side: null
        raw_data: unknown
      }>(
        `SELECT source_site_id, src_type_id,
                NULL::bigint AS disc_cap, NULL::smallint AS disc_side, raw_data
         FROM unified_disc_types WHERE source_site_id = ANY($1)`,
        [siteCodes],
      )
      types = typesRes.rows
    } catch {
      types = []
    }
  }

  return { devices: devicesRes.rows, mags, slots, types }
}

function buildIndexes(ctx: Awaited<ReturnType<typeof loadSiteContext>>) {
  const discTypeBySite = new Map<string, Map<number, { disc_cap: number; disc_side: number }>>()
  const discTypeGlobal = new Map<number, { disc_cap: number; disc_side: number }>()
  for (const row of ctx.types) {
    const raw = rawOf(row)
    const id = asNumber(row.src_type_id ?? raw.id)
    const disc_cap = asNumber(row.disc_cap ?? raw.disc_cap)
    if (!id || disc_cap <= 0) continue
    const entry = { disc_cap, disc_side: asNumber(row.disc_side ?? raw.disc_side) || 1 }
    if (!discTypeBySite.has(row.source_site_id)) discTypeBySite.set(row.source_site_id, new Map())
    discTypeBySite.get(row.source_site_id)!.set(id, entry)
    if (!discTypeGlobal.has(id)) discTypeGlobal.set(id, entry)
  }

  const slotsBySiteMag = new Map<string, Map<string, SlotAgg[]>>()
  for (const row of ctx.slots) {
    const magId = row.magazine_id ? String(row.magazine_id) : String(rawOf(row).mag_id ?? "")
    if (!magId) continue
    const raw = rawOf(row)
    const disc_type = asNumber(raw.disc_type)
    const max_cap = asNumber(row.capacity_bytes ?? raw.max_cap)
    const rest_cap = asNumber(row.remaining_capacity ?? raw.rest_cap)
    if (!slotsBySiteMag.has(row.source_site_id)) slotsBySiteMag.set(row.source_site_id, new Map())
    const magMap = slotsBySiteMag.get(row.source_site_id)!
    if (!magMap.has(magId)) magMap.set(magId, [])
    const list = magMap.get(magId)!
    let agg = list.find((x) => x.disc_type === disc_type)
    if (!agg) {
      agg = { disc_type, max_cap: 0, rest_cap: 0, total: 0, total_slot: 0 }
      list.push(agg)
    }
    agg.max_cap += max_cap
    agg.rest_cap += rest_cap
    agg.total += 1
    agg.total_slot += 1
  }

  const magsBySiteDevice = new Map<string, Map<string, Array<{ mag_id: string; disc_type: number }>>>()
  for (const row of ctx.mags) {
    const raw = rawOf(row)
    const magId = row.magazine_id ? String(row.magazine_id) : String(raw.mag_id ?? "")
    const deviceId = row.device_id ? String(row.device_id) : String(raw.lib_id ?? "")
    if (!magId || !deviceId) continue
    if (!magsBySiteDevice.has(row.source_site_id)) magsBySiteDevice.set(row.source_site_id, new Map())
    const devMap = magsBySiteDevice.get(row.source_site_id)!
    if (!devMap.has(deviceId)) devMap.set(deviceId, [])
    devMap.get(deviceId)!.push({
      mag_id: magId,
      disc_type: asNumber(row.disc_type ?? raw.disc_type),
    })
  }

  return { discTypeBySite, discTypeGlobal, slotsBySiteMag, magsBySiteDevice }
}

function computeDeviceCap(
  libType: number,
  mags: Array<{ mag_id: string; disc_type: number }>,
  slotMagMap: Map<string, SlotAgg[]> | undefined,
  typeMap: Map<number, { disc_cap: number; disc_side: number }>,
): DeviceCap {
  const one: DeviceCap = { total_cap: 0, used_cap: 0, rest_cap: 0 }

  if (CD_LIB_TYPES.has(libType)) {
    for (const mag of mags) {
      const diskType = typeMap.get(mag.disc_type)
      const slotRows = slotMagMap?.get(mag.mag_id) ?? []
      if (!diskType) {
        for (const slot of slotRows) {
          one.total_cap += slot.max_cap
          if (slot.disc_type === 1 || slot.disc_type === 3 || slot.disc_type === 10) {
            one.rest_cap += slot.rest_cap
          }
        }
        continue
      }
      let totalSlot = 0
      for (const slot of slotRows) {
        if (slot.disc_type !== 0) totalSlot += slot.total_slot
        if (slot.disc_type === 1 || slot.disc_type === 3 || slot.disc_type === 10) {
          one.rest_cap += slot.rest_cap
        }
      }
      one.total_cap += totalSlot * diskType.disc_cap
    }
    return finalize(one)
  }

  // HD / tape / 未知类型：按 max_cap / rest_cap
  for (const mag of mags) {
    for (const slot of slotMagMap?.get(mag.mag_id) ?? []) {
      one.total_cap += slot.max_cap
      if (HD_LIB_TYPES.has(libType)) {
        if (slot.disc_type === 1 || slot.disc_type === 3) one.rest_cap += slot.rest_cap
      } else {
        one.rest_cap += slot.rest_cap
      }
    }
  }
  return finalize(one)
}

/**
 * 按站点聚合全部设备容量（对标 Central statistics）
 */
export async function aggregateSitesStorage(
  siteCodes: string[],
): Promise<Map<string, SiteStorageBytes>> {
  const result = new Map<string, SiteStorageBytes>()
  for (const code of siteCodes) result.set(code, { totalCap: 0, usedCap: 0, restCap: 0 })
  if (siteCodes.length === 0) return result

  const ctx = await loadSiteContext(siteCodes)
  const { discTypeBySite, discTypeGlobal, slotsBySiteMag, magsBySiteDevice } = buildIndexes(ctx)

  for (const device of ctx.devices) {
    const raw = rawOf(device)
    if (asNumber(raw.device_status) === 2) continue
    const deviceId = device.device_id ? String(device.device_id) : String(raw.lib_id ?? "")
    if (!deviceId) continue

    const typeMap = discTypeBySite.get(device.source_site_id) ?? discTypeGlobal
    const one = computeDeviceCap(
      asNumber(raw.type),
      magsBySiteDevice.get(device.source_site_id)?.get(deviceId) ?? [],
      slotsBySiteMag.get(device.source_site_id),
      typeMap,
    )

    const site = result.get(device.source_site_id)!
    site.totalCap += one.total_cap
    site.usedCap += one.used_cap
    site.restCap += one.rest_cap
  }

  // 无设备行但有 slots：兜底 SUM
  for (const code of siteCodes) {
    const cur = result.get(code)!
    if (cur.totalCap > 0) continue
    const magMap = slotsBySiteMag.get(code)
    if (!magMap) continue
    let total = 0
    let rest = 0
    for (const slots of magMap.values()) {
      for (const s of slots) {
        total += s.max_cap
        rest += s.rest_cap
      }
    }
    if (total > 0) {
      result.set(code, {
        totalCap: total,
        restCap: rest,
        usedCap: total - rest > 0 ? total - rest : 0,
      })
    }
  }

  return result
}

/**
 * 把按设备聚合的容量写回 unified_devices，供机柜页复用
 */
export async function refreshSiteDeviceCapacities(siteCode: string): Promise<number> {
  const ctx = await loadSiteContext([siteCode])
  const { discTypeBySite, discTypeGlobal, slotsBySiteMag, magsBySiteDevice } = buildIndexes(ctx)
  const typeMap = discTypeBySite.get(siteCode) ?? discTypeGlobal
  let updated = 0

  for (const device of ctx.devices) {
    const raw = rawOf(device)
    if (asNumber(raw.device_status) === 2) continue
    const deviceId = device.device_id ? String(device.device_id) : String(raw.lib_id ?? "")
    if (!deviceId) continue

    const one = computeDeviceCap(
      asNumber(raw.type),
      magsBySiteDevice.get(siteCode)?.get(deviceId) ?? [],
      slotsBySiteMag.get(siteCode),
      typeMap,
    )

    try {
      await query(
        `UPDATE unified_devices
         SET total_capacity = $1,
             used_capacity = $2,
             updated_at = NOW()
         WHERE source_site_id = $3
           AND (device_id = $4 OR source_id = $4)`,
        [one.total_cap, one.used_cap, siteCode, deviceId],
      )
      updated++
    } catch (err) {
      console.warn(
        `[site-storage] refresh device ${deviceId} failed:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  return updated
}
