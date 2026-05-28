/**
 * Dashboard Adapter - Dashboard 统计适配器
 * 将 Mock/DB 数据转换为 DashboardSummaryDTO
 */

import type { TaskStats } from "@/lib/types/task"
import type { RackStats } from "@/lib/types/rack"
import type { SiteStats } from "@/lib/types/site"
import type { DashboardSummaryDTO } from "@/lib/api/dto"

// 解析容量字符串为 bytes
function parseCapacityToBytes(capacity: string): number {
  const match = capacity.match(/^([\d.]+)\s*(TB|GB|MB|KB)?$/i)
  if (!match) return 0

  const value = parseFloat(match[1])
  const unit = (match[2] || "GB").toUpperCase()

  const multipliers: Record<string, number> = {
    TB: 1024 * 1024 * 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    MB: 1024 * 1024,
    KB: 1024,
  }

  return Math.round(value * (multipliers[unit] || 1))
}

export function adaptDashboardSummary(params: {
  taskStats: TaskStats
  rackStats: RackStats
  siteStats: SiteStats
  alertCount?: { critical: number; warning: number }
}): DashboardSummaryDTO {
  const { taskStats, rackStats, siteStats, alertCount } = params

  // 计算总容量
  const totalBytes = parseCapacityToBytes(rackStats.totalCapacity)
  const usedBytes = parseCapacityToBytes(rackStats.remainingCapacity)
  const actualUsedBytes = totalBytes - usedBytes

  return {
    tasks: {
      total: taskStats.total,
      running: taskStats.running,
      completed: taskStats.completed,
      failed: taskStats.failed,
      pending: taskStats.pending,
    },
    devices: {
      total: rackStats.total,
      online: rackStats.online,
      offline: rackStats.offline,
      warning: rackStats.warning,
    },
    capacity: {
      totalBytes,
      usedBytes: actualUsedBytes,
      usagePercent: rackStats.avgUsage,
      displayTotal: rackStats.totalCapacity,
      displayUsed: `${Math.round(actualUsedBytes / (1024 * 1024 * 1024 * 1024))} TB`,
    },
    alerts: {
      total: (alertCount?.critical || 0) + (alertCount?.warning || 0),
      critical: alertCount?.critical || 0,
      warning: alertCount?.warning || 0,
    },
    sites: {
      total: siteStats.total,
      online: siteStats.online,
      offline: siteStats.offline,
    },
    sync: {
      syncing: siteStats.syncing,
      failed: siteStats.offline,
      lastSyncAt: new Date().toISOString(),
    },
  }
}
