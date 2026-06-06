/**
 * GET /api/dashboard/recent-syncs
 * Sprint 2G.2 - Dashboard 最近同步记录
 *
 * 来自 sync_package_log, 按 finished_at DESC 返回最近 N 条
 * 支持 ?siteCode=... (单站点), 不传 = 全部站点
 *
 * 默认 limit=10, 上限 50
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/postgres'

export const dynamic = 'force-dynamic'

interface RecentSyncItem {
  siteCode: string
  batchId: string
  status: string
  totalRecordCount: number
  successTableCount: number
  failedTableCount: number
  tableCount: number
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
}

interface ApiResponse<T> {
  code: number
  message: string
  source: 'database'
  data: T
  siteCode: string | null
  count: number
  generatedAt: string
}

export async function GET(request: NextRequest) {
  const siteCodeRaw = request.nextUrl.searchParams.get('siteCode')
  const siteCode = siteCodeRaw && siteCodeRaw.trim().length > 0 && siteCodeRaw !== '__all__'
    ? siteCodeRaw.trim()
    : null

  const limitRaw = request.nextUrl.searchParams.get('limit')
  const limit = Math.min(Math.max(parseInt(limitRaw ?? '10', 10) || 10, 1), 50)

  try {
    const r = siteCode
      ? await query<{
          site_code: string
          batch_id: string
          status: string
          total_record_count: number
          success_table_count: number
          failed_table_count: number
          table_count: number
          started_at: string | null
          finished_at: string | null
        }>(
          `SELECT site_code, batch_id, status,
                  total_record_count, success_table_count, failed_table_count, table_count,
                  started_at, finished_at
           FROM sync_package_log
           WHERE site_code = $1
           ORDER BY finished_at DESC NULLS LAST, started_at DESC NULLS LAST
           LIMIT $2`,
          [siteCode, limit]
        )
      : await query<{
          site_code: string
          batch_id: string
          status: string
          total_record_count: number
          success_table_count: number
          failed_table_count: number
          table_count: number
          started_at: string | null
          finished_at: string | null
        }>(
          `SELECT site_code, batch_id, status,
                  total_record_count, success_table_count, failed_table_count, table_count,
                  started_at, finished_at
           FROM sync_package_log
           ORDER BY finished_at DESC NULLS LAST, started_at DESC NULLS LAST
           LIMIT $1`,
          [limit]
        )

    const items: RecentSyncItem[] = r.rows.map((row) => {
      const started = row.started_at ? new Date(row.started_at).getTime() : null
      const finished = row.finished_at ? new Date(row.finished_at).getTime() : null
      return {
        siteCode: row.site_code,
        batchId: row.batch_id,
        status: row.status,
        totalRecordCount: row.total_record_count,
        successTableCount: row.success_table_count,
        failedTableCount: row.failed_table_count,
        tableCount: row.table_count,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        durationMs: started !== null && finished !== null ? finished - started : null,
      }
    })

    const response: ApiResponse<RecentSyncItem[]> = {
      code: 0,
      message: 'ok',
      source: 'database',
      data: items,
      siteCode,
      count: items.length,
      generatedAt: new Date().toISOString(),
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] /api/dashboard/recent-syncs error:', error)
    const response: ApiResponse<RecentSyncItem[]> = {
      code: 500,
      message: 'failed to query recent syncs',
      source: 'database',
      data: [],
      siteCode,
      count: 0,
      generatedAt: new Date().toISOString(),
    }
    return NextResponse.json(response, { status: 500 })
  }
}
