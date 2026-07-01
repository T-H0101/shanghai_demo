/**
 * GET /api/sync/packages/trend
 * R.94 补丁 — 同步包趋势聚合 (供 Dashboard SyncTrendChart 真实数据源)
 *
 * 查询 sync_package_log, 按日期聚合最近 7 天的 success/failed/partial 包数,
 * 按站点分组。
 *
 * Query params:
 *   days (default 7, max 30)
 *   siteCode (optional, 按站点过滤)
 *
 * 只读 sync_package_log, 不回退 mock
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

const SITE_CODE_PATTERN = /^[A-Za-z0-9_-]+$/

interface TrendDay {
  date: string
  success: number
  failed: number
  partial: number
  skipped: number
}

interface TrendSite {
  siteCode: string
  days: TrendDay[]
}

interface ApiResponse {
  code: number
  message: string
  source: 'database' | 'empty'
  data: TrendSite[]
}

function toDateString(val: unknown): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'string') return val
  return String(val)
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const days = Math.min(30, Math.max(1, parseInt(sp.get('days') ?? '7', 10) || 7))
  const siteCode = sp.get('siteCode') ?? undefined

  if (siteCode && !SITE_CODE_PATTERN.test(siteCode)) {
    return NextResponse.json(
      { code: 400, message: 'invalid siteCode', source: 'empty', data: [] },
      { status: 400 }
    )
  }

  try {
    const params: Array<string | number> = [days]
    if (siteCode) params.push(siteCode)
    const siteFilter = siteCode ? `AND site_code = $2` : ''
    const rows = await query<{
      site_code: string
      day: unknown
      status: string
      count: string
    }>(
      `SELECT site_code,
              DATE(finished_at) AS day,
              status,
              count(*)::text AS count
       FROM sync_package_log
       WHERE finished_at >= NOW() - ($1::int * interval '1 day')
         ${siteFilter}
       GROUP BY site_code, DATE(finished_at), status
       ORDER BY site_code, day`,
      params
    )

    // Aggregate into site → day → status structure
    const siteMap = new Map<string, Map<string, TrendDay>>()

    for (const row of rows.rows) {
      const dayStr = toDateString(row.day)
      if (!siteMap.has(row.site_code)) {
        siteMap.set(row.site_code, new Map())
      }
      const dayMap = siteMap.get(row.site_code)!
      if (!dayMap.has(dayStr)) {
        dayMap.set(dayStr, {
          date: dayStr,
          success: 0,
          failed: 0,
          partial: 0,
          skipped: 0,
        })
      }
      const day = dayMap.get(dayStr)!
      const count = parseInt(row.count, 10)
      if (row.status === 'success') day.success += count
      else if (row.status === 'failed') day.failed += count
      else if (row.status === 'partial') day.partial += count
      else if (row.status === 'skipped') day.skipped += count
    }

    const data: TrendSite[] = Array.from(siteMap.entries()).map(([sc, dayMap]) => ({
      siteCode: sc,
      days: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    }))

    const response: ApiResponse = {
      code: 0,
      message: 'ok',
      source: data.length > 0 ? 'database' : 'empty',
      data,
    }
    return NextResponse.json(response)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[API/sync/packages/trend] Error: ${errorMessage}`)
    return NextResponse.json(
      { code: 0, message: 'ok', source: 'empty', data: [] },
      { status: 200 }
    )
  }
}
