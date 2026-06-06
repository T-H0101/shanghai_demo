/**
 * Provider Factory - Provider 选择器
 *
 * 根据 NEXT_PUBLIC_API_MODE 选择使用 mock 或 api provider:
 * - "mock" (默认): 使用 mock provider，不发起 API 请求
 * - "api": 使用 API provider，请求 /api/* 端点，失败时 fallback 到 mock
 */

import type {
  SiteProvider, TaskProvider, UserProvider, RackProvider,
  SearchProvider, AuditProvider, SettingsProvider,
} from "./providers"

// Mock Providers
import {
  mockSiteProvider,
  mockTaskProvider,
  mockUserProvider,
  mockRackProvider,
  mockSearchProvider,
  mockAuditProvider,
  mockSettingsProvider,
} from "./mock-providers"

// API Providers
import {
  apiSiteProvider,
  apiTaskProvider,
  apiUserProvider,
  apiRackProvider,
  fetchDashboardSummary,
  fetchVolumes,
  fetchAlerts,
  fetchRackSlots,
} from "./api-providers"

export type ApiMode = "mock" | "api"

// 获取当前 API 模式
export function getApiMode(): ApiMode {
  if (typeof window === "undefined") {
    // Server-side，默认 mock
    return "mock"
  }
  const mode = process.env.NEXT_PUBLIC_API_MODE || "mock"
  return mode === "api" ? "api" : "mock"
}

// 当前模式
export const apiMode = getApiMode()

// 是否使用 API 模式
export const isApiMode = apiMode === "api"

// 是否使用 Mock 模式
export const isMockMode = apiMode === "mock"

// Provider 导出（根据模式选择）
export const siteProvider: SiteProvider = isApiMode ? apiSiteProvider : mockSiteProvider
export const taskProvider: TaskProvider = isApiMode ? apiTaskProvider : mockTaskProvider
export const userProvider: UserProvider = isApiMode ? apiUserProvider : mockUserProvider
export const rackProvider: RackProvider = isApiMode ? apiRackProvider : mockRackProvider
export const searchProvider: SearchProvider = mockSearchProvider  // Sprint 2A 暂不实现 API
export const auditProvider: AuditProvider = mockAuditProvider  // Sprint 2A 暂不实现 API
export const settingsProvider: SettingsProvider = mockSettingsProvider  // Sprint 2A 暂不实现 API

// Dashboard 数据获取（聚合函数）
export async function getDashboardSummary() {
  if (isApiMode) {
    return fetchDashboardSummary()
  }
  // Mock 聚合
  const [taskStats, rackStats, siteStats, taskAlerts] = await Promise.all([
    mockTaskProvider.getStats(),
    mockRackProvider.getStats(),
    mockSiteProvider.getStats(),
    mockTaskProvider.getAlerts(),
  ])
  return {
    tasks: taskStats,
    devices: rackStats,
    sites: siteStats,
    alerts: {
      total: taskAlerts.length,
      critical: taskAlerts.filter((a: any) => a.level === "critical").length,
      warning: taskAlerts.filter((a: any) => a.level === "warning").length,
    },
    capacity: {
      totalBytes: 0,
      usedBytes: 0,
      usagePercent: rackStats.avgUsage,
    },
  }
}

// Volume 数据获取
export async function getVolumes(siteCode?: string) {
  if (isApiMode) {
    return fetchVolumes(siteCode)
  }
  const racks = await mockRackProvider.getAll(siteCode)
  return racks.flatMap((r: any) => r.volumes ?? [])
}

// Alert 数据获取
export async function getAlerts(params?: { level?: string; status?: string; siteCode?: string }) {
  if (isApiMode) {
    return fetchAlerts(params)
  }
  const [taskAlerts, racks, sites] = await Promise.all([
    mockTaskProvider.getAlerts(),
    mockRackProvider.getAll(),
    mockSiteProvider.getAll(),
  ])

  let alerts: any[] = [
    ...taskAlerts.map((a: any) => ({
      id: a.id,
      title: a.taskName,
      severity: a.level,
      message: a.message,
      createdAt: a.time,
      status: "active",
    })),
    ...sites
      .filter((s: any) => s.alertCount > 0)
      .flatMap((s: any) =>
        Array.from({ length: s.alertCount }, (_, i) => ({
          id: `site-alert-${s.id}-${i}`,
          title: `${s.name} 设备告警`,
          severity: i === 0 ? "critical" : "warning",
          message: s.description || "站点设备异常",
          createdAt: s.lastSyncAt,
          status: "active",
          siteCode: s.code,
          siteName: s.name,
        }))
      ),
    ...racks
      .filter((r: any) => r.status === "fault" || r.status === "warning")
      .map((r: any) => ({
        id: `rack-alert-${r.id}`,
        title: `${r.rackName} 状态异常`,
        severity: r.status === "fault" ? "critical" : "warning",
        message: `设备状态: ${r.status === "fault" ? "离线故障" : "警告"}`,
        createdAt: r.lastSyncAt,
        status: "active",
        deviceId: r.id,
        deviceName: r.rackName,
        siteCode: r.siteCode,
        siteName: r.siteName,
      })),
  ]

  // 过滤
  if (params?.level) {
    alerts = alerts.filter((a: any) => a.severity === params.level)
  }
  if (params?.status) {
    alerts = alerts.filter((a: any) => a.status === params.status)
  }
  if (params?.siteCode) {
    alerts = alerts.filter((a: any) => a.siteCode === params.siteCode)
  }

  return alerts
}

// 重新导出 mock providers（便于直接使用）
export {
  mockSiteProvider,
  mockTaskProvider,
  mockUserProvider,
  mockRackProvider,
  mockSearchProvider,
  mockAuditProvider,
  mockSettingsProvider,
}

// 重新导出 API providers（便于直接使用）
export {
  apiSiteProvider,
  apiTaskProvider,
  apiUserProvider,
  apiRackProvider,
  fetchRackSlots,
}

// 数据源追踪
export { getRacksDataSource } from "./api-providers"
export { getTasksDataSource } from "./api-providers"
