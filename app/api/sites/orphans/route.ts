/**
 * GET /api/sites/orphans
 *
 * R.83.1: 返回中心库业务表中出现、但未在 sync_sites 注册的 site_code 清单 + 4 张表计数。
 * 只读,数据源 = 中心库业务表,绝不连 restore 测试库。
 */

import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { OrphanSiteRow, OrphanSitesResponse } from "@/lib/types/orphan-sites"

interface ObservedRow {
  site_code: string
  task_count: number
  device_count: number
  volume_count: number
  package_count: number
}

export async function GET() {
  const traceId = `orphans-${Date.now()}`
  try {
    const result = await query<ObservedRow>(
      `WITH observed AS (
         SELECT source_site_id AS site_code,
                COUNT(*)::int AS task_count,
                0::int AS device_count,
                0::int AS volume_count,
                0::int AS package_count
         FROM unified_tasks
         GROUP BY source_site_id
         UNION ALL
         SELECT source_site_id, 0, COUNT(*)::int, 0, 0
         FROM unified_devices
         GROUP BY source_site_id
         UNION ALL
         SELECT source_site_id, 0, 0, COUNT(*)::int, 0
         FROM unified_volumes
         GROUP BY source_site_id
         UNION ALL
         SELECT site_code, 0, 0, 0, COUNT(*)::int
         FROM sync_package_log
         GROUP BY site_code
       )
       SELECT o.site_code,
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

    const data: OrphanSiteRow[] = result.rows.map((r) => ({
      site_code: r.site_code,
      sources: {
        tasks: Number(r.task_count) || 0,
        devices: Number(r.device_count) || 0,
        volumes: Number(r.volume_count) || 0,
        packages: Number(r.package_count) || 0,
      },
    }))

    return NextResponse.json({
      code: 0,
      message: "ok",
      data,
      traceId,
    } satisfies OrphanSitesResponse)
  } catch (error) {
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        data: [],
        traceId,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}