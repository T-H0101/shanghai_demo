/**
 * GET /api/sites
 * 站点列表 API — Sprint R.4 Bug 3 修复
 *
 * 修复前: unified_sites 0 行 → fallback mock, 6 站点 (上海/北京/广州...) 全是假
 * 修复后:
 *   1. 优先读 unified_sites
 *   2. 若 0 行 → 从 unified_tasks / unified_devices / unified_volumes / sync_package_log 派生 source_site_id
 *   3. 永远不允许 mock fallback, dataSource 明确标识
 *
 * R.4 范围: 0 业务功能, 仅修 100% mock bug
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { ApiResponse, SiteDTO } from "@/lib/api/dto"

interface UnifiedSiteRow {
  id: string
  source_site_id: string
  source_table: string
  source_id: string
  site_code: string | null
  site_name: string | null
  status: string | null
  location: string | null
  endpoint_url: string | null
  description: string | null
  created_at: string
}

interface DerivedSiteRow {
  source_site_id: string
  task_count: number
  device_count: number
  volume_count: number
  package_count: number
  last_sync_at: string | null
}

export async function GET(request: NextRequest) {
  const traceId = `api-${Date.now()}`

  try {
    // 1. 优先读 unified_sites 真实中心表
    const realResult = await query<UnifiedSiteRow>(
      `SELECT id::text, source_site_id, source_table, source_id,
              site_code, site_name, status, location,
              endpoint_url, description, created_at::text
       FROM unified_sites
       ORDER BY created_at ASC`
    )
    const realRows = realResult.rows

    if (realRows.length > 0) {
      const data: SiteDTO[] = realRows.map((r: UnifiedSiteRow) => ({
        id: r.id,
        name: r.site_name ?? r.source_site_id,
        code: r.site_code ?? r.source_site_id,
        status: (r.status as SiteDTO["status"]) ?? "unknown",
        ip: "—",
        port: 0,
        datacenter: r.location ?? "—",
        contact: "—",
        contactPhone: "—",
        deviceCount: 0,
        lastSyncAt: r.created_at,
        syncStatus: "synced" as SiteDTO["syncStatus"],
        syncDelay: 0,
        storageUsedPercent: 0,
        storageTotal: "—",
        storageUsed: "—",
        region: "—",
        ssoEnabled: false,
        sourceSiteId: r.source_site_id,
        sourceTable: r.source_table,
        sourceId: r.source_id,
        description: r.description ?? undefined,
      }))
      return NextResponse.json({
        code: 0,
        message: "ok",
        data,
        dataSource: "database",
        source: "unified_sites",
        traceId,
      } as ApiResponse<SiteDTO[]> & { dataSource: string; source: string })
    }

    // 2. Fallback: 从其他表派生 source_site_id (允许 mock 但显式标记)
    const derivedResult = await query<DerivedSiteRow>(
      `SELECT
         u.source_site_id,
         COALESCE(t.cnt, 0) AS task_count,
         COALESCE(d.cnt, 0) AS device_count,
         COALESCE(v.cnt, 0) AS volume_count,
         COALESCE(s.cnt, 0) AS package_count,
         MAX(u.synced_at)::text AS last_sync_at
       FROM (SELECT DISTINCT source_site_id, synced_at FROM unified_tasks) u
       LEFT JOIN (SELECT source_site_id, COUNT(*) AS cnt FROM unified_tasks GROUP BY source_site_id) t
         ON t.source_site_id = u.source_site_id
       LEFT JOIN (SELECT source_site_id, COUNT(*) AS cnt FROM unified_devices GROUP BY source_site_id) d
         ON d.source_site_id = u.source_site_id
       LEFT JOIN (SELECT source_site_id, COUNT(*) AS cnt FROM unified_volumes GROUP BY source_site_id) v
         ON v.source_site_id = u.source_site_id
       LEFT JOIN (SELECT site_code AS source_site_id, COUNT(*) AS cnt FROM sync_package_log GROUP BY site_code) s
         ON s.source_site_id = u.source_site_id
       GROUP BY u.source_site_id, t.cnt, d.cnt, v.cnt, s.cnt
       ORDER BY u.source_site_id`
    )
    const derivedRows = derivedResult.rows

    if (derivedRows.length > 0) {
      const data: SiteDTO[] = derivedRows.map((r: DerivedSiteRow) => ({
        id: r.source_site_id,
        name: r.source_site_id,
        code: r.source_site_id,
        status: "derived" as SiteDTO["status"],
        ip: "—",
        port: 0,
        datacenter: "—",
        contact: "—",
        contactPhone: "—",
        deviceCount: Number(r.device_count) || 0,
        lastSyncAt: r.last_sync_at ?? new Date().toISOString(),
        syncStatus: "synced" as SiteDTO["syncStatus"],
        syncDelay: 0,
        storageUsedPercent: 0,
        storageTotal: "—",
        storageUsed: "—",
        region: "—",
        ssoEnabled: false,
        sourceSiteId: r.source_site_id,
        sourceTable: "(derived)",
        sourceId: r.source_site_id,
        description: `derived from unified_tasks(${r.task_count})/unified_devices(${r.device_count})/unified_volumes(${r.volume_count})/sync_package_log(${r.package_count})`,
      }))
      return NextResponse.json({
        code: 0,
        message: "ok",
        data,
        dataSource: "derived",
        source: "unified_tasks/unified_devices/unified_volumes/sync_package_log",
        meta: {
          reason: "unified_sites 表 0 行, 从相关表派生 source_site_id",
          derivedFromTables: [
            "unified_tasks",
            "unified_devices",
            "unified_volumes",
            "sync_package_log",
          ],
          requirement: {
            id: "REQ-2.1.1",
            text: "站点配置 (名称/IP/状态/联系人)",
            status: "blocked_by_source_schema",
          },
        },
        traceId,
      } as ApiResponse<SiteDTO[]> & { dataSource: string; source: string; meta: any })
    }

    // 3. 完全无数据, 返回 empty (不 mock)
    return NextResponse.json({
      code: 0,
      message: "ok (no sites found)",
      data: [],
      dataSource: "empty",
      source: "none",
      meta: {
        reason: "unified_sites 0 行, 其他相关表也 0 行, 无法派生",
        requirement: {
          id: "REQ-2.1.1",
          text: "站点配置 (名称/IP/状态/联系人)",
          status: "blocked_by_source_schema",
        },
      },
      traceId,
    } satisfies ApiResponse<SiteDTO[]> & { dataSource: string; source: string; meta: any })
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
