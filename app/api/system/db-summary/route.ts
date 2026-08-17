/**
 * 数据库统计接口
 * GET /api/system/db-summary
 *
 * Sprint 2B.1 - 返回中心库各表数据统计
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

function readBuildApiMode(): string | null {
  try {
    const stampPath = join(process.cwd(), '.next', 'BUILD_API_MODE')
    if (!existsSync(stampPath)) return null
    const json = JSON.parse(readFileSync(stampPath, 'utf8')) as { nextPublicApiMode?: string }
    return json.nextPublicApiMode ?? null
  } catch {
    return null
  }
}

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
      build: {
        clientApiMode: readBuildApiMode(),
        serverNextPublicApiMode: (process.env.NEXT_PUBLIC_API_MODE ?? 'api').trim() || 'api',
        note: 'clientApiMode 来自最后一次 pnpm build 写入的前端 bundle; 与 .env.local 不一致时需 rebuild',
      },
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