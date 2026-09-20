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
 *   - siteCode: 可选, 不传 = 当前用户可访问的全部站点
 *   - 注: siteCount 仅在聚合多站时返回, 单站点返回 null
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/postgres'
import { requirePermission, requireSession } from '@/lib/auth/middleware'
import { resolveRequestScope, sqlColumnInSiteScope, type SiteScope } from '@/lib/auth/site-scope'
import { TASK_ALERT_STATUS_SQL } from '@/lib/tasks/task-status-display'

export const dynamic = 'force-dynamic'

/** 与 buildTaskStatusFilterSql 对齐 */
const TASK_COMPLETED = `(status IN ('burn_success','download_success','success','no_file_changed','read_from_disc_done') OR status ~ '^unknown_[0-9]+_0$')`
const TASK_FAILED = TASK_ALERT_STATUS_SQL
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

function siteCountSql(scope: SiteScope): string {
  if (scope.kind === 'single') return ''
  if (scope.kind === 'all_registered') {
    return ', (SELECT COUNT(*)::int FROM sync_sites WHERE enabled = true) AS site_count'
  }
  if (scope.siteCodes.length === 0) {
    return ', 0::int AS site_count'
  }
  return ', (SELECT COUNT(*)::int FROM sync_sites WHERE enabled = true AND site_code = ANY($1)) AS site_count'
}

function buildScopedSql(scope: SiteScope): { sql: string; params: unknown[] } {
  const taskSite = sqlColumnInSiteScope('t.source_site_id', scope, 1)
  const deviceSite = sqlColumnInSiteScope('d.source_site_id', scope, 1)
  const volumeSite = sqlColumnInSiteScope('v.source_site_id', scope, 1)
  const userSite = sqlColumnInSiteScope('source_site_id', scope, 1)
  const pkgSite = sqlColumnInSiteScope('site_code', scope, 1)
  const params = taskSite.params

  const sql = `SELECT
    (SELECT COUNT(*)::int FROM unified_tasks t WHERE ${taskSite.sql}) AS task_count,
    (SELECT COUNT(*)::int FROM unified_tasks t WHERE ${taskSite.sql} AND ${TASK_COMPLETED}) AS task_completed,
    (SELECT COUNT(*)::int FROM unified_tasks t WHERE ${taskSite.sql} AND ${TASK_RUNNING}) AS task_running,
    (SELECT COUNT(*)::int FROM unified_tasks t WHERE ${taskSite.sql} AND ${TASK_FAILED}) AS task_failed,
    (SELECT COUNT(*)::int FROM unified_devices d WHERE ${deviceSite.sql} AND (d.status IS NULL OR d.status <> 'deleted')) AS device_count,
    (SELECT COUNT(*)::int FROM unified_devices d WHERE ${deviceSite.sql} AND d.status = 'online') AS device_online,
    (SELECT COUNT(*)::int FROM unified_devices d WHERE ${deviceSite.sql} AND (d.status IS NULL OR d.status <> 'deleted') AND (d.status IS NULL OR d.status NOT IN ('online','warning','error'))) AS device_offline,
    (SELECT COUNT(*)::int FROM unified_devices d WHERE ${deviceSite.sql} AND d.status IN ('warning','error')) AS device_abnormal,
    (SELECT COUNT(*)::int FROM unified_volumes v WHERE ${volumeSite.sql}) AS volume_count,
    (SELECT COALESCE(SUM(
      CASE
        WHEN NULLIF(TRIM(v.capacity::text), '') ~ '^[0-9]+(\\.[0-9]+)?$'
          THEN TRUNC(NULLIF(TRIM(v.capacity::text), '')::numeric)::bigint
        ELSE 0
      END
    ), 0) FROM unified_volumes v WHERE ${volumeSite.sql}) AS volume_total_bytes,
    (SELECT COALESCE(SUM(COALESCE(v.used_capacity, 0)), 0) FROM unified_volumes v WHERE ${volumeSite.sql}) AS volume_used_bytes,
    (SELECT COUNT(*)::int FROM unified_users WHERE ${userSite.sql}) AS user_count,
    (SELECT COUNT(*)::int FROM sync_package_log WHERE ${pkgSite.sql}) AS package_count,
    (SELECT COUNT(*)::int FROM sync_package_log WHERE ${pkgSite.sql} AND status = 'failed') AS failed_count,
    (SELECT MAX(finished_at) FROM sync_package_log WHERE ${pkgSite.sql}) AS last_sync,
    (SELECT COUNT(*)::int FROM sync_package_log WHERE ${pkgSite.sql} AND status = 'success') AS success_count
    ${siteCountSql(scope)}`

  return { sql, params }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request)
    requirePermission(session, 'dashboard:read')
    const scope = await resolveRequestScope(session, {
      siteCode: request.nextUrl.searchParams.get('siteCode'),
      regionCode: request.nextUrl.searchParams.get('regionCode'),
    })
    const siteCode = scope.kind === 'single' ? scope.siteCode : null

    if (scope.kind === 'listed' && scope.siteCodes.length === 0) {
      const response: ApiResponse<DashboardSummaryData> = {
        code: 0,
        message: 'ok',
        source: 'database',
        data: { ...emptySummary(siteCode), siteCount: 0 },
        siteCode: null,
        generatedAt: new Date().toISOString(),
      }
      return NextResponse.json(response)
    }

    const { sql, params } = buildScopedSql(scope)
    const r = await query<SummaryRow>(sql, params)
    const row = r.rows[0]
    const responseSiteCode = scope.kind === 'single' ? scope.siteCode : null
    const siteCount =
      scope.kind === 'single' ? null : (row?.site_count ?? (scope.kind === 'listed' ? scope.siteCodes.length : 0))

    const response: ApiResponse<DashboardSummaryData> = {
      code: 0,
      message: 'ok',
      source: 'database',
      data: row ? mapRow(row, siteCount) : emptySummary(responseSiteCode),
      siteCode: responseSiteCode,
      generatedAt: new Date().toISOString(),
    }
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof NextResponse) return error
    console.error('[API] /api/dashboard/summary error:', error)
    const response: ApiResponse<DashboardSummaryData> = {
      code: 500,
      message: 'failed to query summary',
      source: 'database',
      data: emptySummary(null),
      siteCode: null,
      generatedAt: new Date().toISOString(),
    }
    return NextResponse.json(response, { status: 500 })
  }
}
