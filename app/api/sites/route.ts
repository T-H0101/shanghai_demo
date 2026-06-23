/**
 * GET /api/sites
 *
 * Registered site API. The center registry is the source of truth:
 *   sync_sites: scheduler/agent registration and safe credential references
 *   sites: optional business details for display
 *
 * Business data may contain historical test site codes. Those codes are
 * reported as orphan evidence in meta, but never counted as registered sites.
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { ApiResponse, SiteDTO } from "@/lib/api/dto"

interface SiteRegistryRow {
  id: string
  site_code: string
  site_name: string
  enabled: boolean
  status: string | null
  sync_interval_seconds: number
  last_connected_at: string | null
  business_region: string | null
  business_datacenter: string | null
  contact_name: string | null
  contact_phone: string | null
  task_count: number
  device_count: number
  volume_count: number
  package_count: number
  last_sync_at: string | null
}

interface OrphanSiteRow {
  site_code: string
  task_count: number
  device_count: number
  volume_count: number
  package_count: number
}

function toStatus(row: SiteRegistryRow): SiteDTO["status"] {
  if (!row.enabled) return "offline"
  if (row.status === "inactive") return "offline"
  if (row.status === "error") return "offline"
  return "online"
}

export async function GET(_request: NextRequest) {
  const traceId = `api-${Date.now()}`

  try {
    const registryResult = await query<SiteRegistryRow>(
      `WITH task_counts AS (
         SELECT source_site_id AS site_code, COUNT(*)::int AS cnt
         FROM unified_tasks
         GROUP BY source_site_id
       ),
       device_counts AS (
         SELECT source_site_id AS site_code, COUNT(*)::int AS cnt
         FROM unified_devices
         GROUP BY source_site_id
       ),
       volume_counts AS (
         SELECT source_site_id AS site_code, COUNT(*)::int AS cnt
         FROM unified_volumes
         GROUP BY source_site_id
       ),
       package_counts AS (
         SELECT site_code, COUNT(*)::int AS cnt, MAX(COALESCE(finished_at, updated_at, started_at)) AS last_completed_at
         FROM sync_package_log
         GROUP BY site_code
       )
       SELECT
         ss.id::text,
         ss.site_code,
         ss.site_name,
         ss.enabled,
         ss.status,
         ss.sync_interval_seconds,
         ss.last_connected_at::text,
         s.region AS business_region,
         s.datacenter AS business_datacenter,
         s.contact_name,
         s.contact_phone,
         COALESCE(t.cnt, 0) AS task_count,
         COALESCE(d.cnt, 0) AS device_count,
         COALESCE(v.cnt, 0) AS volume_count,
         COALESCE(p.cnt, 0) AS package_count,
         GREATEST(
           ss.last_connected_at,
           p.last_completed_at
         )::text AS last_sync_at
       FROM sync_sites ss
       LEFT JOIN sites s ON s.site_code = ss.site_code
       LEFT JOIN task_counts t ON t.site_code = ss.site_code
       LEFT JOIN device_counts d ON d.site_code = ss.site_code
       LEFT JOIN volume_counts v ON v.site_code = ss.site_code
       LEFT JOIN package_counts p ON p.site_code = ss.site_code
       ORDER BY ss.site_code`
    )

    const orphanResult = await query<OrphanSiteRow>(
      `WITH observed AS (
         SELECT source_site_id AS site_code, COUNT(*)::int AS task_count, 0::int AS device_count, 0::int AS volume_count, 0::int AS package_count
         FROM unified_tasks
         GROUP BY source_site_id
         UNION ALL
         SELECT source_site_id AS site_code, 0, COUNT(*)::int, 0, 0
         FROM unified_devices
         GROUP BY source_site_id
         UNION ALL
         SELECT source_site_id AS site_code, 0, 0, COUNT(*)::int, 0
         FROM unified_volumes
         GROUP BY source_site_id
         UNION ALL
         SELECT site_code, 0, 0, 0, COUNT(*)::int
         FROM sync_package_log
         GROUP BY site_code
       )
       SELECT
         o.site_code,
         SUM(o.task_count)::int AS task_count,
         SUM(o.device_count)::int AS device_count,
         SUM(o.volume_count)::int AS volume_count,
         SUM(o.package_count)::int AS package_count
       FROM observed o
       LEFT JOIN sync_sites ss ON ss.site_code = o.site_code
       WHERE ss.site_code IS NULL
       GROUP BY o.site_code
       ORDER BY o.site_code`
    )

    const data: SiteDTO[] = registryResult.rows.map((row) => ({
      id: row.id,
      name: row.site_name,
      code: row.site_code,
      status: toStatus(row),
      ip: "—",
      port: 0,
      datacenter: row.business_datacenter ?? "—",
      contact: row.contact_name ?? "—",
      contactPhone: row.contact_phone ?? "—",
      deviceCount: Number(row.device_count) || 0,
      lastSyncAt: row.last_sync_at ?? row.last_connected_at ?? "—",
      syncStatus: row.enabled ? "synced" : "pending",
      syncDelay: 0,
      storageUsedPercent: 0,
      storageTotal: "—",
      storageUsed: "—",
      region: row.business_region ?? "—",
      ssoEnabled: false,
      taskCount: Number(row.task_count) || 0,
      sourceSiteId: row.site_code,
      sourceTable: "sync_sites",
      sourceId: row.site_code,
      description: `registered site; tasks=${row.task_count}, devices=${row.device_count}, volumes=${row.volume_count}, packages=${row.package_count}`,
    }))

    return NextResponse.json({
      code: 0,
      message: "ok",
      data,
      dataSource: data.length > 0 ? "database" : "empty",
      source: "sync_sites",
      meta: {
        registrySource: "sync_sites",
        detailSource: "sites",
        orphanSiteCodes: orphanResult.rows,
        note: "Only sync_sites rows are registered sites. Orphan site codes are data quality evidence and are not counted as sites.",
        requirement: {
          id: "REQ-2.1.1",
          text: "站点配置 (名称/IP/状态/联系人)",
          status: data.length > 0 ? "partial" : "blocked_by_source_schema",
        },
      },
      traceId,
    } satisfies ApiResponse<SiteDTO[]> & {
      dataSource: string
      source: string
      meta: Record<string, unknown>
    })
  } catch (error) {
    console.error("[API Error] /api/sites:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        data: null,
        dataSource: "error",
        error: error instanceof Error ? error.message : String(error),
        traceId,
      },
      { status: 500 }
    )
  }
}
