/**
 * Site Adapter - 站点数据适配器
 * 将 Mock/DB 数据转换为 SiteDTO
 */

import type { Site, SiteStats } from "@/lib/types/site"
import type { SiteDTO, SiteStatsDTO } from "@/lib/api/dto"

// SiteStatus 映射
const SITE_STATUS_MAP: Record<string, SiteDTO["status"]> = {
  online: "online",
  offline: "offline",
}

// SyncStatus 映射
const SYNC_STATUS_MAP: Record<string, SiteDTO["syncStatus"]> = {
  synced: "synced",
  syncing: "syncing",
  failed: "failed",
  pending: "pending",
}

// 安全的类型转换
function safeAdaptSiteStatus(status: string): SiteDTO["status"] {
  return SITE_STATUS_MAP[status] ?? "online"
}

function safeAdaptSyncStatus(status: string): SiteDTO["syncStatus"] {
  return SYNC_STATUS_MAP[status] ?? "synced"
}

export function adaptSite(site: Site): SiteDTO {
  return {
    id: site.id,
    name: site.name ?? "",
    code: site.code ?? "",
    status: safeAdaptSiteStatus(site.status ?? "online"),
    ip: site.ip ?? "",
    port: site.port ?? 8443,
    datacenter: site.datacenter ?? "",
    contact: site.contact ?? "",
    contactPhone: site.contactPhone ?? "",
    deviceCount: site.deviceCount ?? 0,
    lastSyncAt: site.lastSyncAt ?? "",
    syncStatus: safeAdaptSyncStatus(site.syncStatus ?? "synced"),
    syncDelay: site.syncDelay,
    storageUsedPercent: site.storageUsedPercent ?? 0,
    storageTotal: site.storageTotal ?? "",
    storageUsed: site.storageUsed ?? "",
    region: site.region ?? "",
    ssoEnabled: site.ssoEnabled ?? false,
    rackCount: site.rackCount,
    onlineRackCount: site.onlineRackCount,
    cageCount: site.cageCount,
    totalSlots: site.totalSlots,
    usedSlots: site.usedSlots,
    taskCount: site.taskCount,
    alertCount: site.alertCount,
    description: site.description,
  }
}

export function adaptSiteList(sites: Site[]): SiteDTO[] {
  return sites.map(adaptSite)
}

export function adaptSiteStats(stats: SiteStats): SiteStatsDTO {
  return {
    total: stats.total,
    online: stats.online,
    offline: stats.offline,
    degraded: stats.degraded ?? 0,
    syncing: stats.syncing ?? 0,
    avgStorageUsed: stats.avgStorageUsed ?? 0,
  }
}
