import type { OnlineStatus, SyncStatus } from "./common"

export interface Site {
  id: string
  name: string
  code: string
  status: OnlineStatus
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
  description?: string
  rackCount?: number
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
