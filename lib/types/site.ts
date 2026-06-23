import type { OnlineStatus, SyncStatus } from "./common"

/**
 * Site.status: 站点业务状态
 * - online/offline: 站点真实登记状态 (来自 sync_sites + sites)
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
