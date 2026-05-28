/**
 * API Providers - 调用 Sprint 1 完成的 API 端点
 * 数据来自 /api/* 端点，端点内部返回 mock DTO
 */

import type {
  SiteProvider, TaskProvider, UserProvider, RackProvider,
  SearchProvider, AuditProvider, SettingsProvider,
  TaskFilters, CreateTaskInput,
  ConsistencyReport, SyncResult,
} from "./providers"
import { fetchWithFallback } from "./fallback"
import { mockSiteProvider, mockTaskProvider, mockUserProvider, mockRackProvider } from "./mock-providers"

const API_BASE = ""

/**
 * Dashboard 数据（从 tasks/ racks/ sites 聚合）
 * 暂无独立端点，通过其他端点聚合
 */
export async function fetchDashboardSummary() {
  return fetchWithFallback(
    `${API_BASE}/api/dashboard/summary`,
    async () => ({
      // 从 mock 聚合
      tasks: await mockTaskProvider.getStats(),
      racks: await mockRackProvider.getStats(),
      sites: await mockSiteProvider.getStats(),
    }),
    "DashboardSummary"
  )
}

// ============================================================
// API Site Provider
// ============================================================

export const apiSiteProvider: SiteProvider = {
  getAll: async () => {
    return fetchWithFallback(
      `${API_BASE}/api/sites`,
      () => mockSiteProvider.getAll(),
      "SiteProvider.getAll"
    )
  },

  getById: async (id: string) => {
    const sites = await fetchWithFallback(
      `${API_BASE}/api/sites`,
      () => mockSiteProvider.getAll(),
      "SiteProvider.getById"
    )
    return sites.find((s: any) => s.id === id)
  },

  getStats: async () => {
    return fetchWithFallback(
      `${API_BASE}/api/dashboard/summary`,
      async () => mockSiteProvider.getStats(),
      "SiteProvider.getStats"
    ).then((data: any) => data?.sites ?? mockSiteProvider.getStats())
  },

  syncSite: async (id: string) => {
    // Sprint 2A 不实现写操作
    return mockSiteProvider.syncSite(id)
  },

  checkConsistency: async (id: string): Promise<ConsistencyReport> => {
    return mockSiteProvider.checkConsistency(id)
  },
}

// ============================================================
// API Task Provider
// ============================================================

export const apiTaskProvider: TaskProvider = {
  getAll: async (filters?: TaskFilters) => {
    const params = new URLSearchParams()
    if (filters?.type && filters.type !== "all") params.set("type", filters.type)
    if (filters?.status) params.set("status", filters.status)
    if (filters?.siteCode) params.set("siteCode", filters.siteCode)
    if (filters?.keyword) params.set("keyword", filters.keyword)

    const query = params.toString()
    const url = `${API_BASE}/api/tasks${query ? `?${query}` : ""}`

    return fetchWithFallback(
      url,
      () => mockTaskProvider.getAll(filters),
      "TaskProvider.getAll"
    )
  },

  getById: async (id: string) => {
    return fetchWithFallback(
      `${API_BASE}/api/tasks/${id}`,
      () => mockTaskProvider.getById(id),
      "TaskProvider.getById"
    )
  },

  getStats: async () => {
    return fetchWithFallback(
      `${API_BASE}/api/dashboard/summary`,
      () => mockTaskProvider.getStats(),
      "TaskProvider.getStats"
    ).then((data: any) => data?.tasks ?? mockTaskProvider.getStats())
  },

  getLogs: async (taskId: string) => {
    return mockTaskProvider.getLogs(taskId)
  },

  getAlerts: async () => {
    return mockTaskProvider.getAlerts()
  },

  createTask: async (input: CreateTaskInput) => {
    // Sprint 2A 不实现写操作
    return mockTaskProvider.createTask(input)
  },

  updateTask: async (id: string, updates: any) => {
    return mockTaskProvider.updateTask(id, updates)
  },

  advancePhase: async (id: string) => {
    return mockTaskProvider.advancePhase(id)
  },

  pauseTask: async (id: string) => {
    return mockTaskProvider.pauseTask(id)
  },

  resumeTask: async (id: string) => {
    return mockTaskProvider.resumeTask(id)
  },

  retryTask: async (id: string) => {
    return mockTaskProvider.retryTask(id)
  },

  completeTask: async (id: string) => {
    return mockTaskProvider.completeTask(id)
  },

  failTask: async (id: string, reason: string) => {
    return mockTaskProvider.failTask(id, reason)
  },

  createTaskFromDevice: async (deviceId: string, taskType: any, params?: Record<string, string>) => {
    return mockTaskProvider.createTaskFromDevice(deviceId, taskType, params)
  },
}

// ============================================================
// API Rack Provider
// ============================================================

export const apiRackProvider: RackProvider = {
  getAll: async (siteCode?: string) => {
    const url = siteCode
      ? `${API_BASE}/api/racks?siteCode=${siteCode}`
      : `${API_BASE}/api/racks`

    return fetchWithFallback(
      url,
      () => mockRackProvider.getAll(siteCode),
      "RackProvider.getAll"
    )
  },

  getById: async (id: string) => {
    return fetchWithFallback(
      `${API_BASE}/api/racks/${id}`,
      () => mockRackProvider.getById(id),
      "RackProvider.getById"
    )
  },

  getStats: async (siteCode?: string) => {
    return fetchWithFallback(
      `${API_BASE}/api/dashboard/summary`,
      () => mockRackProvider.getStats(siteCode),
      "RackProvider.getStats"
    ).then((data: any) => data?.devices ?? mockRackProvider.getStats(siteCode))
  },

  registerTransfer: async (input: any) => {
    return mockRackProvider.registerTransfer(input)
  },

  syncRacks: async () => {
    return mockRackProvider.syncRacks()
  },

  addMedia: async (rackId: string, slotIndex: number, media: any) => {
    return mockRackProvider.addMedia(rackId, slotIndex, media)
  },

  mountNetworkDrive: async (mount: any) => {
    return mockRackProvider.mountNetworkDrive(mount)
  },

  updateDeviceMode: async (rackId: string, mode: string) => {
    return mockRackProvider.updateDeviceMode(rackId, mode)
  },
}

// ============================================================
// API Volume Provider (通过 Rack 端点)
// ============================================================

export async function fetchVolumes(siteCode?: string) {
  const url = siteCode
    ? `${API_BASE}/api/volumes?siteCode=${siteCode}`
    : `${API_BASE}/api/volumes`

  // Mock volumes 从 racks 获取
  return fetchWithFallback(
    url,
    async () => {
      const racks = await mockRackProvider.getAll(siteCode)
      return racks.flatMap((r: any) => r.volumes ?? [])
    },
    "Volumes"
  )
}

// ============================================================
// API Alert Provider (通过统一告警端点)
// ============================================================

export async function fetchAlerts(params?: { level?: string; status?: string; siteCode?: string; page?: number; pageSize?: number }) {
  const searchParams = new URLSearchParams()
  if (params?.level) searchParams.set("level", params.level)
  if (params?.status) searchParams.set("status", params.status)
  if (params?.siteCode) searchParams.set("siteCode", params.siteCode)
  if (params?.page) searchParams.set("page", String(params.page))
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize))

  const query = searchParams.toString()

  // Mock alerts 从 taskAlerts 和 racks/sites 聚合
  return fetchWithFallback(
    `${API_BASE}/api/alerts${query ? `?${query}` : ""}`,
    async () => {
      const [taskAlerts, racks, sites] = await Promise.all([
        mockTaskProvider.getAlerts(),
        mockRackProvider.getAll(),
        mockSiteProvider.getAll(),
      ])

      const alerts: any[] = [
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

      return alerts
    },
    "Alerts"
  )
}

// ============================================================
// API User Provider
// ============================================================

export const apiUserProvider: UserProvider = {
  getAll: async () => {
    return fetchWithFallback(
      `${API_BASE}/api/users`,
      () => mockUserProvider.getAll(),
      "UserProvider.getAll"
    )
  },

  getById: async (id: string) => {
    const users = await fetchWithFallback(
      `${API_BASE}/api/users`,
      () => mockUserProvider.getAll(),
      "UserProvider.getById"
    )
    return users.find((u: any) => u.id === id)
  },

  getStats: async () => {
    return mockUserProvider.getStats()
  },

  createUser: async (input: any) => {
    return mockUserProvider.createUser(input)
  },

  updateUser: async (id: string, updates: any) => {
    return mockUserProvider.updateUser(id, updates)
  },

  syncPermissions: async (id: string): Promise<SyncResult> => {
    return mockUserProvider.syncPermissions(id)
  },
}
