/**
 * GET /api/dashboard/summary
 * Sprint 2G.2 - 首页真实总览统计
 *
 * 统计来源:
 *   - unified_tasks      (taskCount)
 *   - unified_devices    (deviceCount)
 *   - unified_volumes    (volumeCount)
 *   - unified_users      (userCount)
 *   - sync_package_log   (packageCount, failedPackageCount, lastSyncAt, successRate)
 *   - sync_sites         (registered siteCount and all-site scope)
 *
 * 参数:
 *   - siteCode: 可选, 不传 = 全部站点
 *   - 注: siteCount 仅在 "全部站点" 时返回, 单站点返回 null
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/postgres'

export const dynamic = 'force-dynamic'

interface DashboardSummaryData {
  taskCount: number
  deviceCount: number
  volumeCount: number
  userCount: number
  packageCount: number
  failedPackageCount: number
  lastSyncAt: string | null
  successRate: number | null
  siteCount: number | null
}

interface ApiResponse<T> {
  code: number
  message: string
  source: 'database'
  data: T
  siteCode: string | null
  generatedAt: string
}

function emptySummary(siteCode: string | null): DashboardSummaryData {
  return {
    taskCount: 0,
    deviceCount: 0,
    volumeCount: 0,
    userCount: 0,
    packageCount: 0,
    failedPackageCount: 0,
    lastSyncAt: null,
    successRate: null,
    siteCount: null,
  }
}

export async function GET(request: NextRequest) {
  const siteCodeRaw = request.nextUrl.searchParams.get('siteCode')
  const siteCode = siteCodeRaw && siteCodeRaw.trim().length > 0 && siteCodeRaw !== '__all__'
    ? siteCodeRaw.trim()
    : null

  try {
    // 单站点模式
    if (siteCode) {
      const r = await query<{
        task_count: number
        device_count: number
        volume_count: number
        user_count: number
        package_count: number
        failed_count: number
        last_sync: string | null
        success_count: number
      }>(
        `SELECT
           (SELECT COUNT(*)::int FROM unified_tasks WHERE source_site_id = $1) AS task_count,
           (SELECT COUNT(*)::int FROM unified_devices WHERE source_site_id = $1) AS device_count,
           (SELECT COUNT(*)::int FROM unified_volumes WHERE source_site_id = $1) AS volume_count,
           (SELECT COUNT(*)::int FROM unified_users WHERE source_site_id = $1) AS user_count,
           (SELECT COUNT(*)::int FROM sync_package_log WHERE site_code = $1) AS package_count,
           (SELECT COUNT(*)::int FROM sync_package_log WHERE site_code = $1 AND status = 'failed') AS failed_count,
           (SELECT MAX(finished_at) FROM sync_package_log WHERE site_code = $1) AS last_sync,
           (SELECT COUNT(*)::int FROM sync_package_log WHERE site_code = $1 AND status = 'success') AS success_count`,
        [siteCode]
      )
      const row = r.rows[0] ?? {
        task_count: 0,
        device_count: 0,
        volume_count: 0,
        user_count: 0,
        package_count: 0,
        failed_count: 0,
        last_sync: null,
        success_count: 0,
      }
      const total = row.package_count
      const data: DashboardSummaryData = {
        taskCount: row.task_count,
        deviceCount: row.device_count,
        volumeCount: row.volume_count,
        userCount: row.user_count,
        packageCount: row.package_count,
        failedPackageCount: row.failed_count,
        lastSyncAt: row.last_sync,
        successRate: total > 0 ? Math.round((row.success_count / total) * 100) : null,
        siteCount: null,
      }
      const response: ApiResponse<DashboardSummaryData> = {
        code: 0,
        message: 'ok',
        source: 'database',
        data,
        siteCode,
        generatedAt: new Date().toISOString(),
      }
      return NextResponse.json(response)
    }

    // 全部站点模式
    const r = await query<{
      task_count: number
      device_count: number
      volume_count: number
      user_count: number
      package_count: number
      failed_count: number
      last_sync: string | null
      success_count: number
      site_count: number
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM unified_tasks WHERE source_site_id IN (SELECT site_code FROM sync_sites WHERE enabled = true)) AS task_count,
         (SELECT COUNT(*)::int FROM unified_devices WHERE source_site_id IN (SELECT site_code FROM sync_sites WHERE enabled = true)) AS device_count,
         (SELECT COUNT(*)::int FROM unified_volumes WHERE source_site_id IN (SELECT site_code FROM sync_sites WHERE enabled = true)) AS volume_count,
         (SELECT COUNT(*)::int FROM unified_users WHERE source_site_id IN (SELECT site_code FROM sync_sites WHERE enabled = true)) AS user_count,
         (SELECT COUNT(*)::int FROM sync_package_log WHERE site_code IN (SELECT site_code FROM sync_sites WHERE enabled = true)) AS package_count,
         (SELECT COUNT(*)::int FROM sync_package_log WHERE site_code IN (SELECT site_code FROM sync_sites WHERE enabled = true) AND status = 'failed') AS failed_count,
         (SELECT MAX(finished_at) FROM sync_package_log WHERE site_code IN (SELECT site_code FROM sync_sites WHERE enabled = true)) AS last_sync,
         (SELECT COUNT(*)::int FROM sync_package_log WHERE site_code IN (SELECT site_code FROM sync_sites WHERE enabled = true) AND status = 'success') AS success_count,
         (SELECT COUNT(*)::int FROM sync_sites WHERE enabled = true) AS site_count`
    )
    const row = r.rows[0]
    if (!row) {
      const response: ApiResponse<DashboardSummaryData> = {
        code: 0,
        message: 'ok',
        source: 'database',
        data: emptySummary(null),
        siteCode: null,
        generatedAt: new Date().toISOString(),
      }
      return NextResponse.json(response)
    }
    const total = row.package_count
    const data: DashboardSummaryData = {
      taskCount: row.task_count,
      deviceCount: row.device_count,
      volumeCount: row.volume_count,
      userCount: row.user_count,
      packageCount: row.package_count,
      failedPackageCount: row.failed_count,
      lastSyncAt: row.last_sync,
      successRate: total > 0 ? Math.round((row.success_count / total) * 100) : null,
      siteCount: row.site_count,
    }
    const response: ApiResponse<DashboardSummaryData> = {
      code: 0,
      message: 'ok',
      source: 'database',
      data,
      siteCode: null,
      generatedAt: new Date().toISOString(),
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] /api/dashboard/summary error:', error)
    const response: ApiResponse<DashboardSummaryData> = {
      code: 500,
      message: 'failed to query summary',
      source: 'database',
      data: emptySummary(siteCode),
      siteCode,
      generatedAt: new Date().toISOString(),
    }
    return NextResponse.json(response, { status: 500 })
  }
}
