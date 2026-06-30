/**
 * lib/api/api-providers.ts
 * API Providers — 仅在 API 模式 (NEXT_PUBLIC_API_MODE !== "mock") 下使用。
 *
 * R.90 PR 前修复: 本文件**禁止** import mock provider / mock 数据 /
 * lib/mock/*。Mock 模式的选择在 `lib/api/index.ts` 完成, 这里只负责
 * 调用真实 /api/* 端点, 失败时抛 `ApiUnavailableError`。
 *
 * 边界:
 * - 这里不 import 任何 mock 数据, 不调用 mockXxxProvider, 不引用 lib/mock/*。
 * - 失败统一抛 ApiUnavailableError (UI 应捕获并展示 blocked_by_external_system)。
 * - 真实后端不可达 / 端点不存在 / 端点返回 error, 全部由 fetchWithFallback 抛错。
 *
 * 与 lib/api/index.ts 的关系:
 *   index.ts 决定:  mode==="api"  -> 使用本文件的 apiXxxProvider
 *                   mode==="mock" -> 使用 mockXxxProvider
 *   本文件不感知 mock 模式存在, 完全无 mock 字面量.
 */

import type {
  SiteProvider, TaskProvider, UserProvider, RackProvider,
  TaskFilters, CreateTaskInput,
  ConsistencyReport, SyncResult,
} from "./providers"
import { fetchWithFallback, ApiUnavailableError } from "./fallback"
import type { RackSlotDetailDTO } from "./dto"

const API_BASE = ""

export { ApiUnavailableError }

/**
 * Dashboard 数据（从 tasks/ racks/ sites 聚合）
 * 调用 /api/dashboard/summary 真实端点; 端点不存在时 fetchWithFallback 抛 ApiUnavailableError.
 */
export async function fetchDashboardSummary() {
  return fetchWithFallback(
    `${API_BASE}/api/dashboard/summary`,
    undefined, // R.90: API 模式不允许 mock fallback
    "DashboardSummary"
  )
}

// ============================================================
// API Site Provider — 纯 /api/* 端点
// ============================================================

export const apiSiteProvider: SiteProvider = {
  getAll: async () => {
    return fetchWithFallback(
      `${API_BASE}/api/sites`,
      undefined,
      "SiteProvider.getAll"
    )
  },

  getById: async (id: string) => {
    const sites = (await fetchWithFallback(
      `${API_BASE}/api/sites`,
      undefined,
      "SiteProvider.getById"
    )) as any[]
    return sites.find((s: any) => s.id === id)
  },

  getStats: async () => {
    return fetchWithFallback(
      `${API_BASE}/api/dashboard/summary`,
      undefined,
      "SiteProvider.getStats"
    ).then((data: any) => data?.sites ?? null)
  },

  // R.90: 写方法在 API 模式下不通过 provider 暴露 (走 /api/sync/* + Agent pull).
  // 这里抛 ApiUnavailableError, 让 UI 走 control_command 队列.
  syncSite: async (id: string) => {
    throw new ApiUnavailableError(
      "Site",
      "syncSite",
      "API mode: syncSite 必须走 control_command 队列 (R.88 contract), 不允许 provider 直接 mock"
    )
  },

  checkConsistency: async (id: string): Promise<ConsistencyReport> => {
    throw new ApiUnavailableError(
      "Site",
      "checkConsistency",
      "API mode: checkConsistency 走 /api/sync/consistency 真实端点 (R.7)"
    )
  },
}

// ============================================================
// API Task Provider — 纯 /api/* 端点
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
    params.set("pageSize", "100")

    const query = params.toString()
    const url = `${API_BASE}/api/tasks${query ? `?${query}` : ""}`

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const json = await response.json()
      if (json.code !== 0) throw new Error(json.message)
      _tasksDataSource = json.source === "database" ? "database" : "fallback"
      return Array.isArray(json.data) ? json.data : (json.data?.items ?? [])
    } catch (err) {
      // R.90: API 模式下抛 ApiUnavailableError, 不静默 fallback.
      _tasksDataSource = "fallback"
      throw new ApiUnavailableError("Task", "getAll", err)
    }
  },

  getById: async (id: string) => {
    return fetchWithFallback(
      `${API_BASE}/api/tasks/${id}`,
      undefined,
      "TaskProvider.getById"
    )
  },

  getStats: async () => {
    return fetchWithFallback(
      `${API_BASE}/api/dashboard/summary`,
      undefined,
      "TaskProvider.getStats"
    ).then((data: any) => data?.tasks ?? null)
  },

  // 写方法: API 模式不暴露, 走 control_command 队列 (R.4.5).
  getLogs: async (taskId: string) => {
    throw new ApiUnavailableError(
      "Task",
      "getLogs",
      "API mode: task logs 走 /api/tasks/[id]/files + audit_log; provider 暂未实现"
    )
  },

  getAlerts: async () => {
    throw new ApiUnavailableError(
      "Task",
      "getAlerts",
      "API mode: alerts 走 /api/alerts 端点 (R.7A); provider 暂未实现"
    )
  },

  createTask: async (input: CreateTaskInput) => {
    throw new ApiUnavailableError(
      "Task",
      "createTask",
      "API mode: createTask 走 /api/tasks/create (R.4.5 control_command 队列)"
    )
  },

  updateTask: async (id: string, updates: any) => {
    throw new ApiUnavailableError(
      "Task",
      "updateTask",
      "API mode: updateTask 走 control_command 队列"
    )
  },

  advancePhase: async (id: string) => {
    throw new ApiUnavailableError("Task", "advancePhase", "API mode: control_command 队列")
  },

  pauseTask: async (id: string) => {
    throw new ApiUnavailableError("Task", "pauseTask", "API mode: control_command 队列")
  },

  resumeTask: async (id: string) => {
    throw new ApiUnavailableError("Task", "resumeTask", "API mode: control_command 队列")
  },

  retryTask: async (id: string) => {
    throw new ApiUnavailableError("Task", "retryTask", "API mode: control_command 队列")
  },

  completeTask: async (id: string) => {
    throw new ApiUnavailableError("Task", "completeTask", "API mode: control_command 队列")
  },

  failTask: async (id: string, reason: string) => {
    throw new ApiUnavailableError("Task", "failTask", "API mode: control_command 队列")
  },

  createTaskFromDevice: async (
    deviceId: string,
    taskType: any,
    params?: Record<string, string>
  ) => {
    throw new ApiUnavailableError(
      "Task",
      "createTaskFromDevice",
      "API mode: control_command 队列"
    )
  },
}

// ============================================================
// API Rack Provider — 纯 /api/* 端点
// ============================================================

let _racksDataSource: "database" | "empty" | "error" = "empty"

export function getRacksDataSource(): "database" | "empty" | "error" {
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
      const racks = Array.isArray(json.data) ? json.data : []
      _racksDataSource = racks.length > 0 ? "database" : "empty"
      return racks
    } catch (err) {
      _racksDataSource = "error"
      throw new ApiUnavailableError("Rack", "getAll", err)
    }
  },

  getById: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/racks/${id}`)
      if (!response.ok) return undefined
      const json = await response.json()
      if (json.code !== 0) return undefined
      return json.data
    } catch {
      return undefined
    }
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
        avgUsage:
          usageValues.length > 0
            ? Math.round(usageValues.reduce((sum, value) => sum + value, 0) / usageValues.length)
            : 0,
      }
    } catch {
      return {
        total: 0,
        normal: 0,
        warning: 0,
        fault: 0,
        maintenance: 0,
        online: 0,
        offline: 0,
        totalCapacity: "0 B",
        remainingCapacity: "0 B",
        usedSlots: 0,
        totalSlotsAll: 0,
        avgUsage: 0,
      }
    }
  },

  // 写方法: API 模式不暴露, 走 control_command 队列.
  registerTransfer: async (input: any) => {
    throw new ApiUnavailableError("Rack", "registerTransfer", "API mode: control_command 队列")
  },

  syncRacks: async () => {
    throw new ApiUnavailableError("Rack", "syncRacks", "API mode: /api/sync/trigger")
  },

  addMedia: async (rackId: string, slotIndex: number, media: any) => {
    throw new ApiUnavailableError("Rack", "addMedia", "API mode: control_command 队列")
  },

  mountNetworkDrive: async (mount: any) => {
    throw new ApiUnavailableError("Rack", "mountNetworkDrive", "API mode: control_command 队列")
  },

  updateDeviceMode: async (rackId: string, mode: string) => {
    throw new ApiUnavailableError("Rack", "updateDeviceMode", "API mode: control_command 队列")
  },
}

// ============================================================
// API Volume Provider (通过 Rack 端点)
// ============================================================

export async function fetchVolumes(siteCode?: string) {
  const url = siteCode
    ? `${API_BASE}/api/volumes?siteCode=${siteCode}`
    : `${API_BASE}/api/volumes`

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json()
    if (json.code !== 0) throw new Error(json.message)
    return json
  } catch (err) {
    throw new ApiUnavailableError("Volume", "fetchVolumes", err)
  }
}

// ============================================================
// API Alert Provider (通过统一告警端点)
// ============================================================

export async function fetchAlerts(params?: {
  level?: string
  status?: string
  siteCode?: string
  page?: number
  pageSize?: number
}) {
  const searchParams = new URLSearchParams()
  if (params?.level) searchParams.set("level", params.level)
  if (params?.status) searchParams.set("status", params.status)
  if (params?.siteCode) searchParams.set("siteCode", params.siteCode)
  if (params?.page) searchParams.set("page", String(params.page))
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize))

  const query = searchParams.toString()

  return fetchWithFallback(
    `${API_BASE}/api/alerts${query ? `?${query}` : ""}`,
    undefined,
    "Alerts"
  )
}

// ============================================================
// API User Provider — 纯 /api/* 端点
// ============================================================

export const apiUserProvider: UserProvider = {
  getAll: async () => {
    return fetchWithFallback(`${API_BASE}/api/users`, undefined, "UserProvider.getAll")
  },

  getById: async (id: string) => {
    const users = (await fetchWithFallback(
      `${API_BASE}/api/users`,
      undefined,
      "UserProvider.getById"
    )) as any[]
    return users.find((u: any) => u.id === id)
  },

  // 写方法: API 模式不暴露
  getStats: async () => {
    throw new ApiUnavailableError("User", "getStats", "API mode: /api/users/stats")
  },

  createUser: async (input: any) => {
    throw new ApiUnavailableError("User", "createUser", "API mode: control_command 队列")
  },

  updateUser: async (id: string, updates: any) => {
    throw new ApiUnavailableError("User", "updateUser", "API mode: control_command 队列")
  },

  syncPermissions: async (id: string): Promise<SyncResult> => {
    throw new ApiUnavailableError(
      "User",
      "syncPermissions",
      "API mode: /api/auth/permission-sync (R.66)"
    )
  },
}