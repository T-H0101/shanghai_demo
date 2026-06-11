/**
 * GET /api/sync/scheduler/logs?siteCode=SH01&limit=10
 * Sprint R.8 — 自动同步调度日志查询
 *
 * 返回 sync_scheduler_log 最近记录
 * 不做假数据，无结果返回空数组
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const siteCode = request.nextUrl.searchParams.get('siteCode') ?? ''
    const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '10', 10)

    const conditions: string[] = []
    const params: unknown[] = []
    if (siteCode) {
      conditions.push(`site_code = $${params.length + 1}`)
      params.push(siteCode)
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(limit)

    const result = await query<{
      id: string
      site_code: string
      run_id: string
      started_at: string
      finished_at: string | null
      status: string
      export_status: string
      push_status: string
      consistency_status: string
      package_batch_id: string | null
      error_message: string | null
      result_json: unknown
    }>(
      `SELECT id, site_code, run_id, started_at, finished_at,
              status, export_status, push_status, consistency_status,
              package_batch_id, error_message, result_json
       FROM sync_scheduler_log
       ${whereClause}
       ORDER BY started_at DESC
       LIMIT $${params.length}`,
      params
    )

    return NextResponse.json({
      code: 0,
      message: 'ok',
      data: {
        items: result.rows,
        total: result.rows.length,
      },
      dataSource: 'sync_scheduler_log (database)',
      traceId: `api-${Date.now()}`,
    })
  } catch (error) {
    console.error('[API Error] /api/sync/scheduler/logs:', error)
    return NextResponse.json(
      {
        code: 500,
        message: 'Internal server error',
        dataSource: 'error',
        error: error instanceof Error ? error.message : String(error),
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
