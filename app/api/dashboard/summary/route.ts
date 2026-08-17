/**
 * GET /api/dashboard/summary
 * Sprint 2G.2 - 首页真实总览统计
 *
 * 统计来源:
 *   - unified_tasks      (taskCount + 完成/进行中/失败)
 *   - unified_devices    (deviceCount + 在线/离线/异常)
 *   - unified_volumes    (volumeCount + 总/已用容量)
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

/** 与 buildTaskStatusFilterSql 对齐 */
const TASK_COMPLETED = `(status IN ('burn_success','download_success','success','no_file_changed','read_from_disc_done') OR status ~ '^unknown_[0-9]+_0$')`
const TASK_FAILED = `(status IN ('burn_failed','read_failed','read_from_disc_failed','restore_warning','warning') OR status ~ '^unknown_[0-9]+_(10|11)$')`
const TASK_RUNNING = `(status NOT IN (
  'burn_success','download_success','success','no_file_changed','read_from_disc_done',
  'burn_failed','read_failed','read_from_disc_failed','restore_warning','warning'
) AND status !~ '^unknown_[0-9]+_(0|10|11)$')`

export interface DashboardSummaryData {
  taskCount: number
  taskCompletedCount: number
  taskRunningCount: number
  taskFailedCount: number
  deviceCount: number
  deviceOnlineCount: number
  deviceOfflineCount: number
  deviceAbnormalCount: number
  volumeCount: number
  volumeTotalCapacityBytes: number
  volumeUsedCapacityBytes: number
  volumeUsagePercent: number | null
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
    taskCompletedCount: 0,
    taskRunningCount: 0,
    taskFailedCount: 0,
    deviceCount: 0,
    deviceOnlineCount: 0,
    deviceOfflineCount: 0,
    deviceAbnormalCount: 0,
    volumeCount: 0,
    volumeTotalCapacityBytes: 0,
    volumeUsedCapacityBytes: 0,
    volumeUsagePercent: null,
    userCount: 0,
    packageCount: 0,
    failedPackageCount: 0,
    lastSyncAt: null,
    successRate: null,
    siteCount: null,
  }
}

function usagePercent(total: number, used: number): number | null {
  if (total <= 0) return null
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)))
}

type SummaryRow = {
  task_count: number
  task_completed: number
  task_running: number
  task_failed: number
  device_count: number
  device_online: number
  device_offline: number
  device_abnormal: number
  volume_count: number
  volume_total_bytes: string | number
  volume_used_bytes: string | number
  user_count: number
  package_count: number
  failed_count: number
  last_sync: string | null
  success_count: number
  site_count?: number
}

function mapRow(row: SummaryRow, siteCount: number | null): DashboardSummaryData {
  const totalBytes = Number(row.volume_total_bytes) || 0
  const usedBytes = Number(row.volume_used_bytes) || 0
  const packageCount = row.package_count
  return {
    taskCount: row.task_count,
    taskCompletedCount: row.task_completed,
    taskRunningCount: row.task_running,
    taskFailedCount: row.task_failed,
    deviceCount: row.device_count,
    deviceOnlineCount: row.device_online,
    deviceOfflineCount: row.device_offline,
    deviceAbnormalCount: row.device_abnormal,
    volumeCount: row.volume_count,
    volumeTotalCapacityBytes: totalBytes,
    volumeUsedCapacityBytes: usedBytes,
    volumeUsagePercent: usagePercent(totalBytes, usedBytes),
    userCount: row.user_count,
    packageCount,
    failedPackageCount: row.failed_count,
    lastSyncAt: row.last_sync,
    successRate: packageCount > 0 ? Math.round((row.success_count / packageCount) * 100) : null,
    siteCount,
  }
}

function buildScopedSql(mode: 'single' | 'all'): string {
  const taskSite = mode === 'single'
    ? 't.source_site_id = $1'
    : 't.source_site_id IN (SELECT site_code FROM sync_sites WHERE enabled = true)'
  const deviceSite = mode === 'single'
    ? 'd.source_site_id = $1'
    : 'd.source_site_id IN (SELECT site_code FROM sync_sites WHERE enabled = true)'
  const volumeSite = mode === 'single'
    ? 'v.source_site_id = $1'
    : 'v.source_site_id IN (SELECT site_code FROM sync_sites WHERE enabled = true)'
  const userSite = mode === 'single'
    ? 'source_site_id = $1'
    : 'source_site_id IN (SELECT site_code FROM sync_sites WHERE enabled = true)'
  const pkgSite = mode === 'single'
    ? 'site_code = $1'
    : 'site_code IN (SELECT site_code FROM sync_sites WHERE enabled = true)'

  return `SELECT
    (SELECT COUNT(*)::int FROM unified_tasks t WHERE ${taskSite}) AS task_count,
    (SELECT COUNT(*)::int FROM unified_tasks t WHERE ${taskSite} AND ${TASK_COMPLETED}) AS task_completed,
    (SELECT COUNT(*)::int FROM unified_tasks t WHERE ${taskSite} AND ${TASK_RUNNING}) AS task_running,
    (SELECT COUNT(*)::int FROM unified_tasks t WHERE ${taskSite} AND ${TASK_FAILED}) AS task_failed,
    (SELECT COUNT(*)::int FROM unified_devices d WHERE ${deviceSite} AND (d.status IS NULL OR d.status <> 'deleted')) AS device_count,
    (SELECT COUNT(*)::int FROM unified_devices d WHERE ${deviceSite} AND d.status = 'online') AS device_online,
    (SELECT COUNT(*)::int FROM unified_devices d WHERE ${deviceSite} AND (d.status IS NULL OR d.status <> 'deleted') AND (d.status IS NULL OR d.status NOT IN ('online','warning','error'))) AS device_offline,
    (SELECT COUNT(*)::int FROM unified_devices d WHERE ${deviceSite} AND d.status IN ('warning','error')) AS device_abnormal,
    (SELECT COUNT(*)::int FROM unified_volumes v WHERE ${volumeSite}) AS volume_count,
    (SELECT COALESCE(SUM(
      CASE
        WHEN NULLIF(TRIM(v.capacity::text), '') ~ '^[0-9]+(\\.[0-9]+)?$'
          THEN TRUNC(NULLIF(TRIM(v.capacity::text), '')::numeric)::bigint
        ELSE 0
      END
    ), 0) FROM unified_volumes v WHERE ${volumeSite}) AS volume_total_bytes,
    (SELECT COALESCE(SUM(COALESCE(v.used_capacity, 0)), 0) FROM unified_volumes v WHERE ${volumeSite}) AS volume_used_bytes,
    (SELECT COUNT(*)::int FROM unified_users WHERE ${userSite}) AS user_count,
    (SELECT COUNT(*)::int FROM sync_package_log WHERE ${pkgSite}) AS package_count,
    (SELECT COUNT(*)::int FROM sync_package_log WHERE ${pkgSite} AND status = 'failed') AS failed_count,
    (SELECT MAX(finished_at) FROM sync_package_log WHERE ${pkgSite}) AS last_sync,
    (SELECT COUNT(*)::int FROM sync_package_log WHERE ${pkgSite} AND status = 'success') AS success_count
    ${mode === 'all' ? ', (SELECT COUNT(*)::int FROM sync_sites WHERE enabled = true) AS site_count' : ''}`
}

export async function GET(request: NextRequest) {
  const siteCodeRaw = request.nextUrl.searchParams.get('siteCode')
  const siteCode = siteCodeRaw && siteCodeRaw.trim().length > 0 && siteCodeRaw !== '__all__'
    ? siteCodeRaw.trim()
    : null

  try {
    if (siteCode) {
      const r = await query<SummaryRow>(buildScopedSql('single'), [siteCode])
      const row = r.rows[0]
      const data = row ? mapRow(row, null) : emptySummary(siteCode)
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

    const r = await query<SummaryRow>(buildScopedSql('all'))
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
    const response: ApiResponse<DashboardSummaryData> = {
      code: 0,
      message: 'ok',
      source: 'database',
      data: mapRow(row, row.site_count ?? 0),
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
