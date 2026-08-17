import type { OnlineStatus, SyncStatus } from "./common"

/**
 * Site.status: 站点可达性（在线/离线）
 * - 来自 GET /api/sites → 对 sync_sites.db_host:db_port 的 TCP 探测
 */
export type SiteStatusValue = OnlineStatus

export interface Site {
  id: string
  name: string
  code: string
  status: SiteStatusValue
  ip: string
  port: number
  datacenter: string
  contact: string
  contactPhone: string
  deviceCount: number
  lastSyncAt: string
  syncStatus: SyncStatus
  storageUsedPercent: number
  storageTotal: string
  storageUsed: string
  region: string
  ssoEnabled: boolean
  syncDelay?: number
  alertCount?: number
  description?: string
  rackCount?: number
  onlineRackCount?: number
  cageCount?: number
  totalSlots?: number
  usedSlots?: number
  taskCount?: number
}

export interface SiteStats {
  total: number
  online: number
  offline: number
  degraded: number
  syncing: number
  avgStorageUsed: number
}
