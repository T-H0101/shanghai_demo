/**
 * Provider Factory - Provider 选择器
 *
 * 根据 NEXT_PUBLIC_API_MODE 选择使用 mock 或 api provider:
 * - "api" (默认): 使用 API provider，请求 /api/* 端点，失败时显式报错/阻塞
 * - "mock": 仅限隔离前端样式调试，不可作为 requirements 完成证据
 *
 * 注意: NEXT_PUBLIC_API_MODE 在 `pnpm build` 时写入客户端 JS。
 * 运行时改 .env.local 不会生效, 必须 rebuild。
 */

import type {
  SiteProvider, TaskProvider, UserProvider, RackProvider,
  SearchProvider, AuditProvider, SettingsProvider,
  SearchResult, FilterOptions, ExportJob,
} from "./providers"
import type { AuditLog, AuditStats } from "@/lib/types/audit"
import type { SystemSettings } from "@/lib/types/settings"

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
  fetchTasksPage,
} from "./api-providers"

export type ApiMode = "mock" | "api"

function normalizeApiMode(raw: string | undefined): ApiMode {
  const mode = (raw ?? "").trim() || "api"
  return mode === "api" ? "api" : "mock"
}

/** 每次调用读取当前模式 (客户端值来自 build 时内联的 NEXT_PUBLIC_API_MODE) */
export function getApiMode(): ApiMode {
  return normalizeApiMode(process.env.NEXT_PUBLIC_API_MODE)
}

export function isApiMode(): boolean {
  return getApiMode() === "api"
}

export function isMockMode(): boolean {
  return getApiMode() === "mock"
}

function createProviderProxy<T extends object>(apiProvider: T, mockProvider: T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const provider = isApiMode() ? apiProvider : mockProvider
      const value = provider[prop as keyof T]
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(provider)
        : value
    },
  })
}

export const siteProvider: SiteProvider = createProviderProxy(apiSiteProvider, mockSiteProvider)
export const taskProvider: TaskProvider = createProviderProxy(apiTaskProvider, mockTaskProvider)
export const userProvider: UserProvider = createProviderProxy(apiUserProvider, mockUserProvider)
export const rackProvider: RackProvider = createProviderProxy(apiRackProvider, mockRackProvider)

// ============================================================
// R.71: search / audit / settings providers
// ============================================================

export const searchProvider: SearchProvider = {
  search: async (): Promise<SearchResult> => ({
    total: 0,
    returned: 0,
    files: [],
    siteBreakdown: {},
  }),
  getFilterOptions: async (): Promise<FilterOptions> => ({
    sites: [],
    departments: [],
    fileTypes: [],
    dateRange: { start: "", end: "" },
  }),
  exportIndex: async (): Promise<ExportJob> => ({
    id: "",
    status: "failed",
    progress: 0,
  }),
}

export const auditProvider: AuditProvider = {
  getLogs: async (): Promise<AuditLog[]> => {
    throw new Error(
      "audit provider blocked: AuditProvider 暂未实现真实 API, 等待站点审计日志通道接入"
    )
  },
  getStats: async (): Promise<AuditStats> => {
    throw new Error(
      "audit provider blocked: AuditProvider 暂未实现真实 API, 等待站点审计日志通道接入"
    )
  },
  exportLogs: async (): Promise<ExportJob> => ({
    id: "",
    status: "failed",
    progress: 0,
  }),
}

export const settingsProvider: SettingsProvider = {
  get: async (): Promise<SystemSettings> => {
    throw new Error(
      "settings provider blocked: SettingsProvider 暂未实现真实 API, 等待系统设置通道接入"
    )
  },
  update: async (): Promise<SystemSettings> => {
    throw new Error(
      "settings provider blocked: SettingsProvider 暂未实现真实 API, 等待系统设置通道接入"
    )
  },
}

export async function getDashboardSummary() {
  if (isApiMode()) {
    return fetchDashboardSummary()
  }
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
      critical: taskAlerts.filter((a: { level: string }) => a.level === "critical").length,
      warning: taskAlerts.filter((a: { level: string }) => a.level === "warning").length,
    },
    capacity: {
      totalBytes: 0,
      usedBytes: 0,
      usagePercent: rackStats.avgUsage,
    },
  }
}

export async function getVolumes(siteCode?: string, regionCode?: string) {
  if (isApiMode()) {
    return fetchVolumes(siteCode, regionCode)
  }
  const racks = await mockRackProvider.getAll(siteCode, regionCode)
  return racks.flatMap((r: { volumes?: unknown[] }) => r.volumes ?? [])
}

export async function getAlerts(params?: { level?: string; status?: string; siteCode?: string }) {
  if (isApiMode()) {
    return fetchAlerts(params)
  }
  const [taskAlerts, racks, sites] = await Promise.all([
    mockTaskProvider.getAlerts(),
    mockRackProvider.getAll(),
    mockSiteProvider.getAll(),
  ])

  let alerts: Array<Record<string, unknown>> = [
    ...taskAlerts.map((a: { id: string; taskName: string; level: string; message: string; time: string }) => ({
      id: a.id,
      title: a.taskName,
      severity: a.level,
      message: a.message,
      createdAt: a.time,
      status: "active",
    })),
    ...sites
      .filter((s: { alertCount?: number }) => (s.alertCount ?? 0) > 0)
      .flatMap((s: { id: string; name: string; alertCount?: number; description?: string; lastSyncAt: string; code: string }) =>
        Array.from({ length: s.alertCount ?? 0 }, (_, i) => ({
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
      .filter((r: { status: string }) => r.status === "fault" || r.status === "warning")
      .map((r: { id: string; rackName: string; status: string; lastSyncAt: string; siteCode: string; siteName: string }) => ({
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

  if (params?.level) {
    alerts = alerts.filter((a) => a.severity === params.level)
  }
  if (params?.status) {
    alerts = alerts.filter((a) => a.status === params.status)
  }
  if (params?.siteCode) {
    alerts = alerts.filter((a) => a.siteCode === params.siteCode)
  }

  return alerts
}

export {
  mockSiteProvider,
  mockTaskProvider,
  mockUserProvider,
  mockRackProvider,
  mockSearchProvider,
  mockAuditProvider,
  mockSettingsProvider,
}

export {
  apiSiteProvider,
  apiTaskProvider,
  apiUserProvider,
  apiRackProvider,
  fetchRackSlots,
  fetchTasksPage,
}

export { getRacksDataSource } from "./api-providers"
export { getTasksDataSource } from "./api-providers"
