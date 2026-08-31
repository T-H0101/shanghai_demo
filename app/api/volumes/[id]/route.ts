/**
 * GET /api/volumes/[id]
 * 存储卷详情 API (R.17 新增 / R.102 分配介质分组)
 *
 * 返回:
 *   - volume 基础信息 (capacity / used_capacity / file_count / status)
 *   - raw_data._aggregate 透传 (slot_count / online_slot_count)
 *   - mediaGroups: 按设备分组的分配介质
 *   - 关联 site/devices (从统一库聚合)
 *   - sourceEvidence 强制披露
 *
 * 跨站注意: volume_id 各站可重复，按业务号查询时必须带 siteCode
 * （query ?siteCode= 或 path 形如 {siteCode}::{volumeId}）
 *
 * 不 mock fallback (R.1 §一)
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { VolumeDTO } from "@/lib/api/dto"
import { mapVolumeTypeToDto, mapVolumeTypeLabel } from "@/lib/devices/volume-type"
import { loadVolumeMediaGroups } from "@/lib/volumes/media-allocation"

function toNumber(value: number | string | null | undefined): number | undefined {
  if (value == null || value === "") return undefined
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatBytes(value: number | string | null | undefined): string {
  if (value == null || value === "") return ""
  const bytes = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return String(value)
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let size = bytes, index = 0
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index++ }
  return `${size.toFixed(2)} ${units[index]}`
}

/** 解析 path id：支持 `siteCode::volumeId` 或纯 volumeId / uuid */
function parseVolumePathId(raw: string): { siteCode?: string; lookupId: string } {
  const idx = raw.indexOf("::")
  if (idx > 0) {
    const siteCode = raw.slice(0, idx).trim()
    const lookupId = raw.slice(idx + 2).trim()
    if (siteCode && lookupId) return { siteCode, lookupId }
  }
  return { lookupId: raw }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params
    if (!rawId) {
      return NextResponse.json({ code: 400, message: "missing id", data: null }, { status: 400 })
    }

    const parsed = parseVolumePathId(decodeURIComponent(rawId))
    const siteFromQuery = request.nextUrl.searchParams.get("siteCode")?.trim() || undefined
    const siteCode = siteFromQuery || parsed.siteCode
    const lookupId = parsed.lookupId

    // 中心 UUID 可全局唯一定位；业务 volume_id 必须带站点，避免跨站串行
    const looksLikeUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lookupId)

    if (!siteCode && !looksLikeUuid) {
      return NextResponse.json(
        {
          code: 400,
          message: "siteCode required when looking up by volume_id (cross-site ids are not unique)",
          data: null,
        },
        { status: 400 }
      )
    }

    const volRes = siteCode
      ? await query<{
          id: string; source_site_id: string; source_id: string | null; source_record_id: string | null; synced_at: Date | string
          volume_id: string | null; volume_name: string | null; volume_type: string | null
          capacity: string | null; used_capacity: number | string | null; file_count: number | null
          site_code: string | null; device_id: string | null; status: string | null
          health_status: string | null; raw_data: any
        }>(
          `SELECT id, source_site_id, source_id, source_record_id, synced_at,
                  volume_id, volume_name, volume_type,
                  capacity, used_capacity, file_count,
                  site_code, device_id, status, health_status,
                  raw_data
           FROM unified_volumes
           WHERE (source_site_id = $1 OR site_code = $1)
             AND (
               id::text = $2
               OR source_id = $2
               OR source_record_id = $2
               OR volume_id = $2
             )
           LIMIT 1`,
          [siteCode, lookupId]
        )
      : await query<{
          id: string; source_site_id: string; source_id: string | null; source_record_id: string | null; synced_at: Date | string
          volume_id: string | null; volume_name: string | null; volume_type: string | null
          capacity: string | null; used_capacity: number | string | null; file_count: number | null
          site_code: string | null; device_id: string | null; status: string | null
          health_status: string | null; raw_data: any
        }>(
          `SELECT id, source_site_id, source_id, source_record_id, synced_at,
                  volume_id, volume_name, volume_type,
                  capacity, used_capacity, file_count,
                  site_code, device_id, status, health_status,
                  raw_data
           FROM unified_volumes
           WHERE id::text = $1
           LIMIT 1`,
          [lookupId]
        )

    const vol = volRes.rows[0]
    if (!vol) {
      return NextResponse.json(
        { code: 404, message: "Volume not found", data: null, blocker: "blocked_by_source_schema" },
        { status: 404 }
      )
    }

    const lookupSiteCode = vol.site_code ?? vol.source_site_id
    const siteRes = lookupSiteCode
      ? await query<{ id: string; site_name: string | null; site_code: string }>(
          `SELECT id::text, site_name, site_code FROM unified_sites WHERE site_code = $1
           UNION ALL
           SELECT site_code AS id, site_name, site_code FROM sync_sites WHERE site_code = $1
           LIMIT 1`,
          [lookupSiteCode]
        )
      : { rows: [] }
    const site = siteRes.rows[0]

    const devRes = vol.device_id
      ? await query<{ device_id: string; device_name: string | null; device_type: string | null; status: string | null }>(
          `SELECT device_id, device_name, device_type, status FROM unified_devices
           WHERE source_site_id = $2
             AND (device_id = $1 OR source_id = $1 OR source_record_id = $1)
           LIMIT 1`,
          [vol.device_id, vol.source_site_id]
        )
      : { rows: [] }
    const device = devRes.rows[0]

    const volumeKey = String(vol.volume_id ?? vol.source_record_id ?? vol.source_id ?? "")
    const resolvedSite = vol.source_site_id
    let mediaGroups: VolumeDTO["mediaGroups"] = []
    try {
      if (volumeKey) {
        mediaGroups = await loadVolumeMediaGroups(resolvedSite, volumeKey)
      }
    } catch (e) {
      console.warn("[API] /api/volumes/[id] mediaGroups:", (e as Error).message)
      mediaGroups = []
    }

    const capacity = toNumber(vol.capacity)
    const usedCapacity = toNumber(vol.used_capacity)
    const remainingCapacity = capacity != null && usedCapacity != null
      ? Math.max(capacity - usedCapacity, 0)
      : undefined
    const usagePercent = capacity && capacity > 0 && usedCapacity != null
      ? Math.round((usedCapacity / capacity) * 100)
      : undefined

    const syncedAt = typeof vol.synced_at === "string" ? vol.synced_at : vol.synced_at.toISOString()
    const aggregate = vol.raw_data?._aggregate
    const dtoSite = vol.site_code ?? vol.source_site_id
    const businessId = vol.volume_id ?? vol.source_id ?? vol.source_record_id ?? vol.id

    const dto: VolumeDTO & {
      siteInfo?: any
      deviceInfo?: any
      usagePercent?: number
      sourceEvidence?: any
    } = {
      // 站点作用域 id，避免前端跨站同 volume_id 误合并
      id: `${dtoSite}::${businessId}`,
      name: vol.volume_name ?? `卷-${businessId}`,
      type: mapVolumeTypeToDto(vol.volume_type),
      typeLabel: mapVolumeTypeLabel(vol.volume_type),
      totalCapacity: formatBytes(vol.capacity),
      remainingCapacity: remainingCapacity == null ? "" : formatBytes(remainingCapacity),
      info: [
        `站点 ${dtoSite}`,
        vol.status ? `状态 ${vol.status}` : null,
        vol.health_status ? `健康 ${vol.health_status}` : null,
        `同步 ${syncedAt}`,
      ].filter(Boolean).join(" · "),
      discCount: vol.file_count ?? undefined,
      aggregate,
      mediaGroups,
      siteCode: dtoSite,
      siteName: site?.site_name ?? undefined,
      usagePercent,
      siteInfo: site ? { id: site.id, siteName: site.site_name, siteCode: site.site_code } : undefined,
      deviceInfo: device ? {
        deviceId: device.device_id,
        deviceName: device.device_name,
        deviceType: device.device_type,
        status: device.status,
      } : undefined,
      sourceEvidence: {
        sourceTable: "tbl_logical_volume",
        sourceId: vol.volume_id ?? vol.source_id ?? vol.source_record_id,
        sourceSiteId: vol.source_site_id,
        rawData: vol.raw_data,
        syncedAt,
        mapper: "R.17 inlineUpsert (Sprint 2H.2) + R.102 mediaGroups + site-scoped lookup",
      },
    }

    return NextResponse.json({
      code: 0,
      message: "ok",
      data: dto,
      source: "database" as const,
      traceId: `api-${Date.now()}`,
    })
  } catch (error) {
    console.error("[API Error] /api/volumes/[id]:", error)
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null },
      { status: 500 }
    )
  }
}
