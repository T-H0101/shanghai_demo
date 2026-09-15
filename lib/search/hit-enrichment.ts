/**
 * 检索 hit 展示补全：卷名/站点名 + 盘笼移位登记逻辑区域与展示
 */

import { query } from "@/lib/db"
import {
  listCurrentMagazineRelocations,
  type MagazineCurrentLocation,
  type MagazineRelocation,
} from "@/lib/control/cage-move-register"
import type { FileSearchHit } from "@/lib/ports/search-port"
import {
  formatDeviceLocationLabel,
  formatRelocatedLocationLabel,
} from "@/lib/search/location-display"

export type EnrichedSearchHit = FileSearchHit & {
  siteName: string | null
  displaySiteCode: string
  logicalRegionCode: string | null
  logicalRegionName: string | null
  siteDisplayLabel: string
  locationLabel: string
  relocated: boolean
}

export type MagazineLogicalLocation = MagazineCurrentLocation & {
  source_site_code: string | null
  relocated: boolean
  logicalRegionCode: string
  logicalRegionName: string
}

function volumeKey(siteId: string, volumeId: string | number) {
  return `${siteId}::${String(volumeId)}`
}

export function locationMapFromRows(
  rows: MagazineCurrentLocation[],
): Map<string, MagazineCurrentLocation> {
  const map = new Map<string, MagazineCurrentLocation>()
  for (const row of rows) {
    const rfid = row.magazine_rfid?.trim()
    if (rfid) map.set(rfid, row)
  }
  return map
}

export function relocationMapFromRelocations(
  relocations: MagazineRelocation[],
  regionNames: Map<string, string>,
): Map<string, MagazineLogicalLocation> {
  const map = new Map<string, MagazineLogicalLocation>()
  for (const row of relocations) {
    const rfid = row.magazine_rfid?.trim()
    if (!rfid) continue
    const code = row.target_region_code
    map.set(rfid, {
      ...row,
      relocated: true,
      logicalRegionCode: code,
      logicalRegionName: regionNames.get(code) ?? code,
    })
  }
  return map
}

/** 选区域 R 时：迁入 R 的 RFID + 从 R 迁出的 RFID（归档站在 R 内） */
export function relocationFilterFromRegion(
  relocations: MagazineRelocation[],
  regionCode: string,
  sitesInRegion: string[],
): { inboundRfids: string[]; outboundRfids: string[] } {
  const region = regionCode.trim().toUpperCase()
  const sitesSet = new Set(sitesInRegion)
  const inboundRfids: string[] = []
  const outboundRfids: string[] = []
  for (const loc of relocations) {
    const rfid = loc.magazine_rfid?.trim()
    if (!rfid) continue
    if (loc.target_region_code === region) {
      inboundRfids.push(rfid)
    }
    if (
      loc.source_region_code === region &&
      loc.target_region_code !== region
    ) {
      outboundRfids.push(rfid)
    } else if (
      loc.source_site_code != null &&
      sitesSet.has(loc.source_site_code) &&
      loc.target_region_code !== region
    ) {
      outboundRfids.push(rfid)
    }
  }
  return {
    inboundRfids: [...new Set(inboundRfids)],
    outboundRfids: [...new Set(outboundRfids)],
  }
}

/** @deprecated 站点筛选已废弃，保留供旧调用方 */
export function relocationFilterFromLocations(
  locations: MagazineCurrentLocation[],
  siteCodes: string[],
): { inboundRfids: string[]; outboundRfids: string[] } {
  if (!siteCodes.length) return { inboundRfids: [], outboundRfids: [] }
  const selected = new Set(siteCodes)
  const inboundRfids: string[] = []
  const outboundRfids: string[] = []
  for (const loc of locations) {
    const rfid = loc.magazine_rfid?.trim()
    if (!rfid) continue
    const targetSite = loc.target_site_code?.trim()
    if (targetSite && selected.has(targetSite)) inboundRfids.push(rfid)
    else outboundRfids.push(rfid)
  }
  return { inboundRfids, outboundRfids }
}

/** @deprecated 设备筛选已废弃 */
export function relocationFilterFromDevice(
  locations: MagazineCurrentLocation[],
  deviceIp: string,
): { inboundRfids: string[]; outboundRfids: string[] } {
  const ip = deviceIp.trim()
  if (!ip) return { inboundRfids: [], outboundRfids: [] }
  const inboundRfids: string[] = []
  const outboundRfids: string[] = []
  for (const loc of locations) {
    const rfid = loc.magazine_rfid?.trim()
    if (!rfid) continue
    if (loc.target_device_ip?.trim() === ip) inboundRfids.push(rfid)
    else outboundRfids.push(rfid)
  }
  return { inboundRfids, outboundRfids }
}

export async function loadSiteRegionMaps(): Promise<{
  siteToRegion: Map<string, string>
  regionNames: Map<string, string>
}> {
  const siteToRegion = new Map<string, string>()
  const regionNames = new Map<string, string>()
  try {
    const [sites, regions] = await Promise.all([
      query<{ site_code: string; region_code: string | null }>(
        `SELECT site_code, region_code FROM sync_sites WHERE enabled IS DISTINCT FROM FALSE`,
      ),
      query<{ code: string; name: string }>(
        `SELECT code, name FROM site_regions`,
      ),
    ])
    for (const r of regions.rows) {
      regionNames.set(r.code, r.name?.trim() || r.code)
    }
    for (const s of sites.rows) {
      const rc = s.region_code?.trim()
      if (rc) siteToRegion.set(s.site_code, rc)
    }
  } catch {
    // ignore
  }
  return { siteToRegion, regionNames }
}

/** 按本页命中的设备 IP 批量补设备名（可选，失败不影响检索） */
export async function loadDeviceNameByIp(
  ips: string[],
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
      [unique],
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

export async function loadCageMoveLocationMap(): Promise<
  Map<string, MagazineCurrentLocation>
> {
  const rows = await listCurrentMagazineRelocations()
  return locationMapFromRows(rows)
}

/**
 * 卷名按归档站解析；逻辑区域/展示按移位登记或归档站区域。
 */
export function enrichSearchHits(
  hits: FileSearchHit[],
  opts: {
    volumeNames: Map<string, string>
    siteNames: Map<string, string>
    relocationMap: Map<string, MagazineLogicalLocation>
    siteToRegion: Map<string, string>
    regionNames: Map<string, string>
    deviceNames?: Map<string, string>
  },
): EnrichedSearchHit[] {
  const { volumeNames, siteNames, relocationMap, siteToRegion, regionNames, deviceNames } =
    opts

  return hits.map((hit) => {
    const archiveSite = hit.sourceSiteId
    let volumeName = hit.volumeName
    if (!volumeName && hit.volumeId != null) {
      volumeName =
        volumeNames.get(volumeKey(archiveSite, hit.volumeId)) ?? `卷-${hit.volumeId}`
    }

    const rfid = hit.magazineRfid?.trim() || null
    const relocation = rfid ? relocationMap.get(rfid) : undefined
    const relocated = Boolean(relocation)

    let logicalRegionCode: string | null = null
    let logicalRegionName: string | null = null
    let displaySiteCode = archiveSite
    let siteName: string | null = siteNames.get(archiveSite) ?? archiveSite
    let deviceIp = hit.deviceIp?.trim() || null
    let devicePort = hit.devicePort?.trim() || null
    let deviceName = hit.deviceName?.trim() || null
    let siteDisplayLabel: string
    let locationLabel: string

    if (relocated && relocation) {
      logicalRegionCode = relocation.logicalRegionCode
      logicalRegionName = relocation.logicalRegionName
      displaySiteCode = archiveSite
      siteName = siteNames.get(archiveSite) ?? archiveSite
      deviceIp = null
      devicePort = null
      deviceName = null
      siteDisplayLabel = `${logicalRegionName} · 盘笼移位（站点未定）`
      locationLabel = formatRelocatedLocationLabel({
        magazineRfid: rfid,
        slotOrder: hit.slotOrder,
        discSide: hit.discSide,
      })
    } else {
      const archiveRegion = siteToRegion.get(archiveSite) ?? null
      logicalRegionCode = archiveRegion
      logicalRegionName = archiveRegion
        ? (regionNames.get(archiveRegion) ?? archiveRegion)
        : null
      const siteLabel = siteNames.get(archiveSite) ?? archiveSite
      siteDisplayLabel = logicalRegionName
        ? `${logicalRegionName}/${siteLabel}`
        : siteLabel
      if (deviceIp) {
        deviceName = deviceNames?.get(deviceIp) || deviceName || null
      }
      locationLabel = formatDeviceLocationLabel({
        volumeType: hit.volumeType,
        deviceName,
        deviceIp,
        devicePort,
        magazineRfid: rfid,
        slotOrder: hit.slotOrder,
        discSide: hit.discSide,
        serialNum: hit.serialNum,
      })
    }

    return {
      ...hit,
      volumeName: volumeName ?? (hit.volumeId != null ? `卷-${hit.volumeId}` : null),
      volumeCode: hit.volumeCode ?? (hit.volumeId != null ? String(hit.volumeId) : null),
      volumeType: hit.volumeType ?? null,
      magazineRfid: rfid,
      deviceIp,
      devicePort,
      deviceName,
      serialNum: hit.serialNum?.trim() || null,
      displaySiteCode,
      siteName,
      logicalRegionCode,
      logicalRegionName,
      siteDisplayLabel,
      relocated,
      locationLabel,
    }
  })
}

export async function buildSearchEnrichmentContext() {
  const [relocations, { siteToRegion, regionNames }] = await Promise.all([
    listCurrentMagazineRelocations(),
    loadSiteRegionMaps(),
  ])
  const relocationMap = relocationMapFromRelocations(relocations, regionNames)
  return { relocations, relocationMap, siteToRegion, regionNames }
}
