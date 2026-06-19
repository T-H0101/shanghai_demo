/**
 * GET /api/volumes
 * 存储卷列表 API
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireSession, requirePermission, getVisibleSites } from "@/lib/auth/middleware"
import type { ApiResponse, VolumeDTO } from "@/lib/api/dto"

const VOLUME_TYPE_MAP: Record<string, VolumeDTO["type"]> = {
  optical: "optical",
  magnetic: "magnetic",
  hard_disk: "magnetic",
  hdd: "magnetic",
  composite: "composite",
}

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
  return `${size.toFixed(1)} ${units[index]}`
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

  const type = row.volume_type ? VOLUME_TYPE_MAP[row.volume_type] : undefined
  const syncedAt = typeof row.synced_at === "string" ? row.synced_at : row.synced_at.toISOString()
  const statusParts = [
    `站点 ${row.site_code ?? row.source_site_id}`,
    row.status ? `状态 ${row.status}` : null,
    row.health_status ? `健康 ${row.health_status}` : null,
    `同步 ${syncedAt}`,
  ].filter(Boolean)

  return {
    id: row.volume_id ?? row.source_id,
    name: row.volume_name ?? `卷-${row.source_id}`,
    type: type ?? "composite",
    totalCapacity: formatBytes(row.capacity),
    remainingCapacity: remainingCapacity == null ? "" : formatBytes(remainingCapacity),
    info: statusParts.join(" · "),
    discCount: row.file_count ?? undefined,
    aggregate: row.raw_data?._aggregate,
  }
}

export async function GET(request: NextRequest) {
  try {
    // Sprint R.29: 防越权
    const session = await requireSession(request)
    requirePermission(session, "platform:read")
    const visibleSites = getVisibleSites(session)

    const searchParams = request.nextUrl.searchParams
    const siteCode = searchParams.get("siteCode")
    const type = searchParams.get("type")

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (siteCode) {
      conditions.push(`source_site_id = $${paramIndex++}`)
      params.push(siteCode)
    } else if (visibleSites) {
      conditions.push(`source_site_id = ANY($${paramIndex++})`)
      params.push(visibleSites)
    }
    if (type && type !== "all") {
      if (type === "magnetic") {
        conditions.push(`volume_type = ANY($${paramIndex++})`)
        params.push(["magnetic", "hard_disk", "hdd"])
      } else {
        conditions.push(`volume_type = $${paramIndex++}`)
        params.push(type)
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const sql = `
      SELECT id, source_site_id, source_id, synced_at,
             volume_id, volume_name, volume_type,
             capacity, used_capacity, file_count,
             site_code, device_id, status, health_status,
             raw_data
      FROM unified_volumes ${whereClause}
      ORDER BY source_site_id, volume_id NULLS LAST, source_id
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
