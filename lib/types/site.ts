import type { OnlineStatus, SyncStatus } from "./common"

/**
 * Site.status: 站点业务状态
 * - online/offline: 站点真实登记状态 (来自 unified_sites)
 * - derived: 由同步数据派生的待确认状态 (来自 unified_tasks/devices/volumes 等表)
 */
export type SiteStatusValue = OnlineStatus | "derived"

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
