/**
 * GET /api/sync/packages/trend
 * R.94 补丁 — 同步包趋势聚合 (供 Dashboard SyncTrendChart 真实数据源)
 *
 * Query params:
 *   days (default 7, max 30)
 *   siteCode / regionCode (optional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requirePermission, requireSession } from '@/lib/auth/middleware'
import { resolveRequestScope, sqlColumnInSiteScope } from '@/lib/auth/site-scope'

export const dynamic = 'force-dynamic'

const BEIJING_TZ = 'Asia/Shanghai'

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

/** 统一为 YYYY-MM-DD；已是文本日历日则原样截取，避免 Date→UTC 偏一天 */
function toBeijingDateString(val: unknown): string {
  if (typeof val === 'string') {
    const m = val.trim().match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) return m[1]
  }
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: BEIJING_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(val)
  }
  return String(val)
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const days = Math.min(30, Math.max(1, parseInt(sp.get('days') ?? '7', 10) || 7))

  try {
    const session = await requireSession(request)
    requirePermission(session, 'dashboard:read')
    const scope = await resolveRequestScope(session, {
      siteCode: sp.get('siteCode'),
      regionCode: sp.get('regionCode'),
    })

    if (scope.kind === 'listed' && scope.siteCodes.length === 0) {
      return NextResponse.json({
        code: 0,
        message: 'ok',
        source: 'empty',
        data: [],
      } satisfies ApiResponse)
    }

    const siteClause = sqlColumnInSiteScope('site_code', scope, 2)
    const params: unknown[] = [days, ...siteClause.params]

    const rows = await query<{
      site_code: string
      day: string
      status: string
      count: string
    }>(
      `SELECT site_code,
              to_char((finished_at AT TIME ZONE '${BEIJING_TZ}'), 'YYYY-MM-DD') AS day,
              status,
              count(*)::text AS count
       FROM sync_package_log
       WHERE finished_at IS NOT NULL
         AND finished_at >= NOW() - ($1::int * interval '1 day')
         AND (${siteClause.sql})
       GROUP BY site_code,
                to_char((finished_at AT TIME ZONE '${BEIJING_TZ}'), 'YYYY-MM-DD'),
                status
       ORDER BY site_code, day`,
      params
    )

    const siteMap = new Map<string, Map<string, TrendDay>>()

    for (const row of rows.rows) {
      const dayStr = toBeijingDateString(row.day)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayStr)) continue
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
