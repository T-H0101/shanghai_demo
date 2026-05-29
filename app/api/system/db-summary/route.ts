/**
 * 数据库统计接口
 * GET /api/system/db-summary
 *
 * Sprint 2B.1 - 返回中心库各表数据统计
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 查询各表记录数
    const countsQuery = `
      SELECT 'sites' as tbl, COUNT(*) as cnt FROM sites
      UNION ALL
      SELECT 'syncSites', COUNT(*) FROM sync_sites
      UNION ALL
      SELECT 'tasks', COUNT(*) FROM unified_tasks
      UNION ALL
      SELECT 'devices', COUNT(*) FROM unified_devices
      UNION ALL
      SELECT 'volumes', COUNT(*) FROM unified_volumes
      UNION ALL
      SELECT 'alerts', COUNT(*) FROM unified_alerts
    `

    const result = await query(countsQuery)

    // 转换为对象格式
    const counts: Record<string, number> = {}
    for (const row of result.rows) {
      counts[row.tbl] = parseInt(row.cnt, 10)
    }

    return NextResponse.json({
      status: 'ok',
      connected: true,
      timestamp: new Date().toISOString(),
      counts: {
        sites: counts['sites'] || 0,
        syncSites: counts['syncSites'] || 0,
        tasks: counts['tasks'] || 0,
        devices: counts['devices'] || 0,
        volumes: counts['volumes'] || 0,
        alerts: counts['alerts'] || 0,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        status: 'error',
        connected: false,
        timestamp: new Date().toISOString(),
        error: errorMessage,
        counts: {
          sites: 0,
          syncSites: 0,
          tasks: 0,
          devices: 0,
          volumes: 0,
          alerts: 0,
        },
      },
      { status: 500 }
    )
  }
}