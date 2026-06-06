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
import type { RackSlotDetailDTO } from "./dto"

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

let _tasksDataSource: "database" | "fallback" = "fallback"

export function getTasksDataSource(): "database" | "fallback" {
  return _tasksDataSource
}

export const apiTaskProvider: TaskProvider = {
  getAll: async (filters?: TaskFilters) => {
    const params = new URLSearchParams()
    if (filters?.type && filters.type !== "all") params.set("type", filters.type)
    if (filters?.status) params.set("status", filters.status)
    if (filters?.siteCode) params.set("siteCode", filters.siteCode)
    if (filters?.keyword) params.set("keyword", filters.keyword)

    const query = params.toString()
    const url = `${API_BASE}/api/tasks${query ? `?${query}` : ""}`

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const json = await response.json()
      if (json.code !== 0) throw new Error(json.message)
      _tasksDataSource = json.source === "database" ? "database" : "fallback"
      return Array.isArray(json.data) ? json.data : (json.data?.items ?? [])
    } catch {
      _tasksDataSource = "fallback"
      return mockTaskProvider.getAll(filters)
    }
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

// 数据源追踪：记录最近一次 racks 数据来源
let _racksDataSource: "database" | "fallback" = "fallback"

export function getRacksDataSource(): "database" | "fallback" {
  return _racksDataSource
}

export async function fetchRackSlots(
  rackId: string,
  siteCode: string
): Promise<RackSlotDetailDTO> {
  const response = await fetch(
    `${API_BASE}/api/racks/${encodeURIComponent(rackId)}/slots?siteCode=${encodeURIComponent(siteCode)}`
  )
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const json = await response.json()
  if (json.code !== 0) throw new Error(json.message)
  return json.data
}

function parseCapacity(value?: string): number {
  if (!value) return 0
  const match = value.match(/^([\d.]+)\s*(B|KB|MB|GB|TB|PB)$/i)
  if (!match) return 0
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  const unitIndex = units.indexOf(match[2].toUpperCase())
  return Number(match[1]) * (1024 ** unitIndex)
}

function formatCapacity(bytes: number): string {
  if (bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

export const apiRackProvider: RackProvider = {
  getAll: async (siteCode?: string) => {
    const url = siteCode
      ? `${API_BASE}/api/racks?siteCode=${siteCode}`
      : `${API_BASE}/api/racks`

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const json = await response.json()
      if (json.code !== 0) throw new Error(json.message)
      _racksDataSource = json.source === "database" ? "database" : "fallback"
      return json.data
    } catch {
      _racksDataSource = "fallback"
      return mockRackProvider.getAll(siteCode)
    }
  },

  getById: async (id: string) => {
    return fetchWithFallback(
      `${API_BASE}/api/racks/${id}`,
      () => mockRackProvider.getById(id),
      "RackProvider.getById"
    )
  },

  getStats: async (siteCode?: string) => {
    try {
      const racks = await apiRackProvider.getAll(siteCode)
      const usageValues = racks
        .map((rack) => rack.usagePercent)
        .filter((value): value is number => typeof value === "number")

      return {
        total: racks.length,
        normal: racks.filter((rack) => rack.status === "normal").length,
        warning: racks.filter((rack) => rack.status === "warning").length,
        fault: racks.filter((rack) => rack.status === "fault").length,
        maintenance: racks.filter((rack) => rack.status === "maintenance").length,
        online: racks.filter((rack) => rack.deviceStatus === "online").length,
        offline: racks.filter((rack) => rack.deviceStatus !== "online").length,
        totalCapacity: formatCapacity(
          racks.reduce((sum, rack) => sum + parseCapacity(rack.totalCapacity), 0)
        ),
        remainingCapacity: formatCapacity(
          racks.reduce((sum, rack) => sum + parseCapacity(rack.remainingCapacity), 0)
        ),
        usedSlots: racks.reduce((sum, rack) => sum + (rack.usedSlots ?? 0), 0),
        totalSlotsAll: racks.reduce((sum, rack) => sum + (rack.totalSlots ?? 0), 0),
        avgUsage: usageValues.length > 0
          ? Math.round(usageValues.reduce((sum, value) => sum + value, 0) / usageValues.length)
          : 0,
      }
    } catch {
      return mockRackProvider.getStats(siteCode)
    }
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
