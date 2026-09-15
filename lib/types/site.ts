import type { OnlineStatus, SyncStatus } from "./common"

/**
 * Site.status: 站点可达性（在线/离线/探测中）
 * - GET /api/sites：可探测站先返回 checking；禁用/无地址可直接 offline
 * - GET /api/sites/reachability：异步 TCP 探测后更新 online/offline
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
