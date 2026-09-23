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
import type { ApiResponse, SiteDTO, SyncStatus } from "@/lib/api/dto"
import { deriveListReachabilityPending } from "@/lib/site/reachability"
import { isProbeableEndpoint } from "@/lib/site/probe-tcp"
import { aggregateSitesStorage, toSiteStorageDisplay } from "@/lib/site/site-storage"
import { requireDashboardReadOr, requireSession } from "@/lib/auth/middleware"
import { filterRegistrySiteCodes } from "@/lib/auth/site-scope"

interface SiteRegistryRow {
  id: string
  site_code: string
  site_name: string
  db_host: string
  db_port: number
  enabled: boolean
  status: string | null
  sync_interval_seconds: number
  last_connected_at: string | null
  business_region: string | null
  region_code: string | null
  business_datacenter: string | null
  contact_name: string | null
  contact_phone: string | null
  task_count: number
  device_count: number
  online_device_count: number
  optical_rack_count: number
  optical_online_count: number
  cage_count: number
  total_slots: number
  used_slots: number
  volume_count: number
  package_count: number
  last_sync_at: string | null
  last_package_status: string | null
  last_package_at: string | null
  agent_reported_at: string | null
  agent_database_reachable: boolean | null
}

function formatRegistryEndpoint(
  dbHost: string | null | undefined,
  dbPort: number | null | undefined,
): { ip: string; port: number } {
  const host = dbHost?.trim()
  if (!host || host === "site-agent") {
    return { ip: "—", port: 0 }
  }
  const port = typeof dbPort === "number" && dbPort > 0 ? dbPort : 0
  return { ip: host, port }
}

interface OrphanSiteRow {
  site_code: string
  task_count: number
  device_count: number
  volume_count: number
  package_count: number
}

function toSyncStatus(
  enabled: boolean,
  lastPackageStatus: string | null,
  lastSyncAt: string | null,
): SyncStatus {
  if (!enabled) return "pending"
  if (!lastSyncAt) return "pending"
  if (lastPackageStatus === "failed") return "failed"
  if (lastPackageStatus === "partial" || lastPackageStatus === "receiving" || lastPackageStatus === "running") {
    return "syncing"
  }
  return "synced"
}

export async function GET(_request: NextRequest) {
  const traceId = `api-${Date.now()}`

  try {
    const session = await requireSession(_request)
    requireDashboardReadOr(session, "sites:list")

    const registryResult = await query<SiteRegistryRow>(
      `WITH task_counts AS (
         SELECT source_site_id AS site_code, COUNT(*)::int AS cnt
         FROM unified_tasks
         GROUP BY source_site_id
       ),
       -- 全部设备（页面「设备数量」）
       device_counts AS (
         SELECT
           source_site_id AS site_code,
           COUNT(*) FILTER (WHERE status IS NULL OR status <> 'deleted')::int AS cnt,
           COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'online')::int AS online_cnt
         FROM unified_devices
         GROUP BY source_site_id
       ),
       -- 光盘库：业务 type 1/3/4/6/15（排除已删除，与设备管理列表口径一致）
       optical_devices AS (
         SELECT source_site_id, device_id, source_id, status
         FROM unified_devices
         WHERE (status IS NULL OR status <> 'deleted')
           AND device_type IN (
           'gen2_library',
           'gen1_legacy',
           'gen1_new',
           'gen3_library',
           'gen4_library'
         )
       ),
       optical_rack_counts AS (
         SELECT
           source_site_id AS site_code,
           COUNT(*)::int AS cnt,
           COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'online')::int AS online_cnt
         FROM optical_devices
         GROUP BY source_site_id
       ),
       magazine_counts AS (
         SELECT m.source_site_id AS site_code, COUNT(*)::int AS cnt
         FROM unified_magazines m
         INNER JOIN optical_devices d
           ON d.source_site_id = m.source_site_id
          AND (m.device_id = d.device_id OR m.device_id = d.source_id)
         GROUP BY m.source_site_id
       ),
       slot_counts AS (
         SELECT
           s.source_site_id AS site_code,
           COUNT(*)::int AS total_cnt,
           COUNT(*) FILTER (
             WHERE s.occupied IS TRUE
                OR COALESCE(s.status, '') ILIKE 'occupied'
                OR COALESCE((s.raw_data->>'disc_type')::int, 0) > 0
           )::int AS used_cnt
         FROM unified_slots s
         INNER JOIN optical_devices d
           ON d.source_site_id = s.source_site_id
          AND (s.device_id = d.device_id OR s.device_id = d.source_id)
         GROUP BY s.source_site_id
       ),
       volume_counts AS (
         SELECT source_site_id AS site_code, COUNT(*)::int AS cnt
         FROM unified_volumes
         GROUP BY source_site_id
       ),
       latest_packages AS (
         SELECT DISTINCT ON (site_code)
           site_code,
           status AS last_package_status,
           COALESCE(finished_at, updated_at, started_at) AS last_package_at
         FROM sync_package_log
         ORDER BY site_code, COALESCE(finished_at, updated_at, started_at) DESC NULLS LAST
       ),
       package_counts AS (
         SELECT site_code, COUNT(*)::int AS cnt
         FROM sync_package_log
         GROUP BY site_code
       )
       SELECT
         ss.id::text,
         ss.site_code,
         ss.site_name,
         ss.db_host,
         ss.db_port,
         ss.enabled,
         ss.status,
         ss.sync_interval_seconds,
         ss.last_connected_at::text,
         COALESCE(sr.name, s.region) AS business_region,
         sr.code AS region_code,
         s.datacenter AS business_datacenter,
         s.contact_name,
         s.contact_phone,
         COALESCE(t.cnt, 0) AS task_count,
         COALESCE(d.cnt, 0) AS device_count,
         COALESCE(d.online_cnt, 0) AS online_device_count,
         COALESCE(od.cnt, 0) AS optical_rack_count,
         COALESCE(od.online_cnt, 0) AS optical_online_count,
         COALESCE(m.cnt, 0) AS cage_count,
         COALESCE(sl.total_cnt, 0) AS total_slots,
         COALESCE(sl.used_cnt, 0) AS used_slots,
         COALESCE(v.cnt, 0) AS volume_count,
         COALESCE(p.cnt, 0) AS package_count,
         lp.last_package_status,
         lp.last_package_at::text AS last_package_at,
         agent.reported_at::text AS agent_reported_at,
         agent.database_reachable AS agent_database_reachable,
         GREATEST(
           ss.last_connected_at,
           lp.last_package_at
         )::text AS last_sync_at
       FROM sync_sites ss
       LEFT JOIN site_regions sr ON sr.code = ss.region_code
       LEFT JOIN sites s ON s.site_code = ss.site_code
       LEFT JOIN site_agent_runtime agent ON agent.site_code = ss.site_code
       LEFT JOIN task_counts t ON t.site_code = ss.site_code
       LEFT JOIN device_counts d ON d.site_code = ss.site_code
       LEFT JOIN optical_rack_counts od ON od.site_code = ss.site_code
       LEFT JOIN magazine_counts m ON m.site_code = ss.site_code
       LEFT JOIN slot_counts sl ON sl.site_code = ss.site_code
       LEFT JOIN volume_counts v ON v.site_code = ss.site_code
       LEFT JOIN package_counts p ON p.site_code = ss.site_code
       LEFT JOIN latest_packages lp ON lp.site_code = ss.site_code
       ORDER BY
         CASE WHEN ss.region_code IS NULL THEN 1 ELSE 0 END,
         sr.sort_order ASC NULLS LAST,
         sr.code ASC NULLS LAST,
         ss.site_name ASC,
         ss.site_code ASC`
    )

    const allowedCodes = filterRegistrySiteCodes(
      registryResult.rows.map((r) => r.site_code),
      session.accessibleSites,
    )
    const allowedSet = new Set(allowedCodes)
    const visibleRows = registryResult.rows.filter((r) => allowedSet.has(r.site_code))

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

    const storageBySite = await aggregateSitesStorage(
      visibleRows.map((r) => r.site_code),
    ).catch((err) => {
      console.warn("[GET /api/sites] storage aggregate failed:", err instanceof Error ? err.message : err)
      return new Map() as Map<string, import("@/lib/site/site-storage").SiteStorageBytes>
    })

    // 不做 TCP：列表先返回；需探测的站 status=checking，由 GET /api/sites/reachability 异步补齐
    const data: SiteDTO[] = visibleRows.map((row) => {
      const endpoint = formatRegistryEndpoint(row.db_host, row.db_port)
      const reachability = deriveListReachabilityPending({
        enabled: row.enabled,
        dbHost: row.db_host,
        dbPort: row.db_port,
      })
      const lastSyncAt = row.last_sync_at ?? row.last_connected_at ?? "—"
      const storage = toSiteStorageDisplay(storageBySite.get(row.site_code))
      return {
        id: row.id,
        name: row.site_name,
        code: row.site_code,
        status: reachability.status,
        ip: endpoint.ip,
        port: endpoint.port,
        datacenter: row.business_datacenter ?? "—",
        contact: row.contact_name ?? "—",
        contactPhone: row.contact_phone ?? "—",
        deviceCount: Number(row.device_count) || 0,
        rackCount: Number(row.optical_rack_count) || 0,
        onlineRackCount: Number(row.optical_online_count) || 0,
        cageCount: Number(row.cage_count) || 0,
        totalSlots: Number(row.total_slots) || 0,
        usedSlots: Number(row.used_slots) || 0,
        lastSyncAt,
        syncStatus: toSyncStatus(
          row.enabled,
          row.last_package_status,
          lastSyncAt === "—" ? null : lastSyncAt,
        ),
        syncDelay: 0,
        storageUsedPercent: storage.storageUsedPercent,
        storageTotal: storage.storageTotal,
        storageUsed: storage.storageUsed,
        region: row.business_region ?? "—",
        regionCode: row.region_code ?? null,
        ssoEnabled: isProbeableEndpoint(row.db_host, row.db_port),
        taskCount: Number(row.task_count) || 0,
        reachabilitySource: reachability.source,
        reachabilityNote: reachability.note,
        sourceSiteId: row.site_code,
        sourceTable: "sync_sites",
        sourceId: row.site_code,
      }
    })

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
        reachability: "List returns checking for probeable sites; TCP probe is async via GET /api/sites/reachability (does not block list)",
        requirement: {
          id: "REQ-2.1.1",
          text: "站点配置 (名称/IP/状态)",
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
    if (error instanceof NextResponse) return error
    console.error("[API Error] /api/sites:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "未知异常",
        data: null,
        dataSource: "error",
        error: error instanceof Error ? error.message : String(error),
        traceId,
      },
      { status: 500 }
    )
  }
}
