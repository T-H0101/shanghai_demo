/**
 * 检索 hit 展示补全：卷名/站点名 + 盘笼移位登记覆盖站点与设备
 * 不改 ES 文档；仅对本页结果做内存映射（登记表量通常很小）。
 */

import { query } from "@/lib/db"
import {
  listCurrentMagazineLocations,
  type MagazineCurrentLocation,
} from "@/lib/control/cage-move-register"
import type { FileSearchHit } from "@/lib/ports/search-port"

export type EnrichedSearchHit = FileSearchHit & {
  siteName: string | null
  displaySiteCode: string
}

function volumeKey(siteId: string, volumeId: string | number) {
  return `${siteId}::${String(volumeId)}`
}

export function locationMapFromRows(
  rows: MagazineCurrentLocation[]
): Map<string, MagazineCurrentLocation> {
  const map = new Map<string, MagazineCurrentLocation>()
  for (const row of rows) {
    const rfid = row.magazine_rfid?.trim()
    if (rfid) map.set(rfid, row)
  }
  return map
}

export function relocationFilterFromLocations(
  locations: MagazineCurrentLocation[],
  siteCodes: string[]
): { inboundRfids: string[]; outboundRfids: string[] } {
  if (!siteCodes.length) return { inboundRfids: [], outboundRfids: [] }
  const selected = new Set(siteCodes)
  const inboundRfids: string[] = []
  const outboundRfids: string[] = []
  for (const loc of locations) {
    const rfid = loc.magazine_rfid?.trim()
    if (!rfid) continue
    if (selected.has(loc.target_site_code)) inboundRfids.push(rfid)
    else outboundRfids.push(rfid)
  }
  return { inboundRfids, outboundRfids }
}

/** 按本页命中的设备 IP 批量补设备名（可选，失败不影响检索） */
export async function loadDeviceNameByIp(
  ips: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ips.map((ip) => ip.trim()).filter(Boolean))]
  const map = new Map<string, string>()
  if (!unique.length) return map
  try {
    const { rows } = await query<{ ip_address: string | null; device_name: string | null }>(
      `SELECT NULLIF(TRIM(ip_address), '') AS ip_address,
              NULLIF(TRIM(device_name), '') AS device_name
       FROM unified_devices
       WHERE NULLIF(TRIM(ip_address), '') = ANY($1::text[])`,
      [unique]
    )
    for (const row of rows) {
      const ip = row.ip_address?.trim()
      const name = row.device_name?.trim()
      if (ip && name && !map.has(ip)) map.set(ip, name)
    }
  } catch {
    // ignore
  }
  return map
}

export async function loadCageMoveLocationMap(): Promise<Map<string, MagazineCurrentLocation>> {
  const rows = await listCurrentMagazineLocations()
  return locationMapFromRows(rows)
}

/**
 * 卷名按归档站解析；站点/设备按最新移位登记覆盖。
 */
export function enrichSearchHits(
  hits: FileSearchHit[],
  opts: {
    volumeNames: Map<string, string>
    siteNames: Map<string, string>
    locationMap: Map<string, MagazineCurrentLocation>
    deviceNames?: Map<string, string>
  }
): EnrichedSearchHit[] {
  const { volumeNames, siteNames, locationMap, deviceNames } = opts

  return hits.map((hit) => {
    const archiveSite = hit.sourceSiteId
    let volumeName = hit.volumeName
    if (!volumeName && hit.volumeId != null) {
      volumeName =
        volumeNames.get(volumeKey(archiveSite, hit.volumeId)) ?? `卷-${hit.volumeId}`
    }

    const rfid = hit.magazineRfid?.trim() || null
    const loc = rfid ? locationMap.get(rfid) : undefined

    const displaySiteCode = loc?.target_site_code?.trim() || archiveSite
    const deviceIp = loc?.target_device_ip?.trim() || hit.deviceIp?.trim() || null
    const devicePort = loc
      ? loc.target_device_port?.trim() || null
      : hit.devicePort?.trim() || null
    const deviceName =
      (deviceIp ? deviceNames?.get(deviceIp) : null) || hit.deviceName || null

    return {
      ...hit,
      volumeName: volumeName ?? (hit.volumeId != null ? `卷-${hit.volumeId}` : null),
      volumeCode: hit.volumeCode ?? (hit.volumeId != null ? String(hit.volumeId) : null),
      magazineRfid: rfid,
      deviceIp,
      devicePort,
      deviceName,
      displaySiteCode,
      siteName: siteNames.get(displaySiteCode) ?? displaySiteCode,
    }
  })
}
