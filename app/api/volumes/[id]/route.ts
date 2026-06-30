/**
 * GET /api/volumes/[id]
 * 存储卷详情 API (R.17 新增)
 *
 * 返回:
 *   - volume 基础信息 (capacity / used_capacity / file_count / status)
 *   - raw_data._aggregate 透传 (slot_count / online_slot_count)
 *   - 关联 site/devices (从统一库聚合)
 *   - sourceEvidence 强制披露
 *
 * 不 mock fallback (R.1 §一)
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { VolumeDTO } from "@/lib/api/dto"

const VOLUME_TYPE_MAP: Record<string, VolumeDTO["type"]> = {
  optical: "optical",
  magnetic: "magnetic",
  hard_disk: "magnetic",
  hdd: "magnetic",
  composite: "composite",
}

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
  return `${size.toFixed(1)} ${units[index]}`
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ code: 400, message: "missing id", data: null }, { status: 400 })
    }

    // 1. 查 volume (兼容 source_id / source_record_id / volume_id / uuid)
    const volRes = await query<{
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
       WHERE id::text = $1 OR source_id = $1 OR source_record_id = $1 OR volume_id = $1
       LIMIT 1`,
      [id]
    )
    const vol = volRes.rows[0]
    if (!vol) {
      return NextResponse.json(
        { code: 404, message: "Volume not found", data: null, blocker: "blocked_by_source_schema" },
        { status: 404 }
      )
    }

    // 2. 关联 site (try unified_sites first, fall back to sync_sites)
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

    // 3. 关联设备 (该 site 下所有设备 + device_id 优先)
    const devRes = vol.device_id
      ? await query<{ device_id: string; device_name: string | null; device_type: string | null; status: string | null }>(
          `SELECT device_id, device_name, device_type, status FROM unified_devices
           WHERE device_id = $1 OR source_id = $1 LIMIT 1`,
          [vol.device_id]
        )
      : { rows: [] }
    const device = devRes.rows[0]

    // 4. 构造 DTO
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

    const dto: VolumeDTO & {
      siteInfo?: any
      deviceInfo?: any
      usagePercent?: number
      sourceEvidence?: any
    } = {
      id: vol.volume_id ?? vol.source_id ?? vol.source_record_id ?? vol.id,
      name: vol.volume_name ?? `卷-${vol.volume_id ?? vol.source_id ?? vol.source_record_id ?? vol.id}`,
      type: (vol.volume_type ? VOLUME_TYPE_MAP[vol.volume_type] : undefined) ?? "composite",
      totalCapacity: formatBytes(vol.capacity),
      remainingCapacity: remainingCapacity == null ? "" : formatBytes(remainingCapacity),
      info: [
        `站点 ${vol.site_code ?? vol.source_site_id}`,
        vol.status ? `状态 ${vol.status}` : null,
        vol.health_status ? `健康 ${vol.health_status}` : null,
        `同步 ${syncedAt}`,
      ].filter(Boolean).join(" · "),
      discCount: vol.file_count ?? undefined,
      aggregate,
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
        rawData: vol.raw_data,
        syncedAt,
        mapper: "R.17 inlineUpsert (Sprint 2H.2)",
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
