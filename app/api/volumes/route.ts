/**
 * GET /api/volumes
 * 存储卷列表 API
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { resolveRequestScope, sqlColumnInSiteScope } from "@/lib/auth/site-scope"
import type { ApiResponse, VolumeDTO } from "@/lib/api/dto"
import { mapVolumeTypeToDto, mapVolumeTypeLabel, volumeTypeFilterValues } from "@/lib/devices/volume-type"

interface VolumeRow {
  id: string
  source_site_id: string
  source_id: string
  synced_at: Date | string
  volume_id: string | null
  volume_name: string | null
  volume_type: string | null
  capacity: string | null
  used_capacity: number | string | null
  file_count: number | null
  site_code: string | null
  site_name: string | null
  device_id: string | null
  status: string | null
  health_status: string | null
  // Sprint 2H.3: 透传 raw_data._aggregate
  raw_data: { _aggregate?: { slot_count?: number; online_slot_count?: number; offline_slot_count?: number; source_table?: string; aggregated_at?: string } } | null
}

function formatBytes(value: number | string | null | undefined): string {
  if (value == null || value === "") return ""
  const bytes = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return String(value)

  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index++
  }
  return `${size.toFixed(2)} ${units[index]}`
}

function toNumber(value: number | string | null | undefined): number | undefined {
  if (value == null || value === "") return undefined
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function mapVolumeToDTO(row: VolumeRow): VolumeDTO {
  const capacity = toNumber(row.capacity)
  const usedCapacity = toNumber(row.used_capacity)
  const remainingCapacity = capacity != null && usedCapacity != null
    ? Math.max(capacity - usedCapacity, 0)
    : undefined

  const syncedAt = typeof row.synced_at === "string" ? row.synced_at : row.synced_at.toISOString()
  const siteCode = row.site_code ?? row.source_site_id
  const siteName = row.site_name?.trim() || null
  const statusParts = [
    siteName ? `站点 ${siteName}（${siteCode}）` : `站点 ${siteCode}`,
    row.status ? `状态 ${row.status}` : null,
    row.health_status ? `健康 ${row.health_status}` : null,
    `同步 ${syncedAt}`,
  ].filter(Boolean)

  return {
    // 站点作用域 id，避免跨站 volume_id 重复导致详情串行
    id: `${siteCode}::${row.volume_id ?? row.source_id}`,
    name: row.volume_name ?? `卷-${row.source_id}`,
    type: mapVolumeTypeToDto(row.volume_type),
    typeLabel: mapVolumeTypeLabel(row.volume_type),
    totalCapacity: formatBytes(row.capacity),
    remainingCapacity: remainingCapacity == null ? "" : formatBytes(remainingCapacity),
    info: statusParts.join(" · "),
    siteCode,
    siteName: siteName ?? undefined,
    discCount: row.file_count ?? undefined,
    aggregate: row.raw_data?._aggregate,
  }
}

export async function GET(request: NextRequest) {
  try {
    // Sprint R.29: 防越权
    const session = await requireSession(request)
    requirePermission(session, "volumes:read")
    const scope = await resolveRequestScope(session, {
      siteCode: request.nextUrl.searchParams.get("siteCode"),
      regionCode: request.nextUrl.searchParams.get("regionCode"),
    })

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get("type")

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (scope.kind === "listed" && scope.siteCodes.length === 0) {
      return NextResponse.json({
        code: 0,
        message: "ok",
        data: [],
        source: "database",
      })
    }

    const siteClause = sqlColumnInSiteScope("v.source_site_id", scope, paramIndex)
    conditions.push(siteClause.sql)
    params.push(...siteClause.params)
    paramIndex = siteClause.nextParam

    if (type && type !== "all") {
      conditions.push(`v.volume_type = ANY($${paramIndex++})`)
      params.push(volumeTypeFilterValues(type))
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const sql = `
      SELECT v.id, v.source_site_id, v.source_id, v.synced_at,
             v.volume_id, v.volume_name, v.volume_type,
             v.capacity, v.used_capacity, v.file_count,
             v.site_code, ss.site_name, v.device_id, v.status, v.health_status,
             v.raw_data
      FROM unified_volumes v
      LEFT JOIN sync_sites ss ON ss.site_code = v.source_site_id
      ${whereClause}
      ORDER BY v.source_site_id, v.volume_id NULLS LAST, v.source_id
    `
    const { rows } = await query<VolumeRow>(sql, params)
    const adaptedVolumes = rows.map(mapVolumeToDTO)

    const response: ApiResponse<VolumeDTO[]> & { source: "database"; sourceEvidence?: any } = {
      code: 0,
      message: "ok",
      data: adaptedVolumes,
      source: "database",
      sourceEvidence: {
        sourceTable: "unified_volumes",
        rowCount: adaptedVolumes.length,
        syncedAt: rows[0]?.synced_at ? (typeof rows[0].synced_at === "string" ? rows[0].synced_at : rows[0].synced_at.toISOString()) : new Date().toISOString(),
        mapper: "Sprint 2H.2 inlineUpsert (R.17 复核)",
      },
      traceId: `api-${Date.now()}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof NextResponse) return error
    console.error("[API Error] /api/volumes:", error)
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
