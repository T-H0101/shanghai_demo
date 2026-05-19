// Mock Providers - 使用现有 Mock 数据实现 Provider 接口
// 便于后续替换为真实后端 API

import type {
  SiteProvider, TaskProvider, UserProvider, RackProvider,
  SearchProvider, AuditProvider, SettingsProvider,
  TaskFilters, CreateTaskInput, CreateUserInput, TransferInput, ExportConfig,
  ConsistencyReport, SyncResult, SearchResult, FilterOptions, ExportJob
} from "./providers"
import type { SystemSettings } from "@/lib/types/settings"

// 导入现有 Mock 数据
import { sites, siteStats } from "@/lib/mock/sites"
import { tasks, taskStats, taskLogs, taskAlerts } from "@/lib/mock/tasks"
import { users, userStats } from "@/lib/mock/users"
import { racks, rackStats } from "@/lib/mock/racks"
import { searchFiles, searchSites, searchDepartments, searchFileTypes } from "@/lib/mock/search"
import { auditLogs, auditStats } from "@/lib/mock/audit"
import { defaultSettings } from "@/lib/mock/settings"

// ============================================================
// Mock Site Provider
// ============================================================

let mockSites = [...sites]
let mockSiteStats = { ...siteStats }

export const mockSiteProvider: SiteProvider = {
  getAll: async () => {
    await simulateDelay(100)
    return [...mockSites]
  },

  getById: async (id: string) => {
    await simulateDelay(50)
    return mockSites.find(s => s.id === id)
  },

  getStats: async () => {
    await simulateDelay(80)
    return { ...mockSiteStats }
  },

  syncSite: async (id: string) => {
    await simulateDelay(1500)
    const site = mockSites.find(s => s.id === id)
    if (site) {
      site.syncStatus = "synced"
      site.lastSyncAt = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
    }
  },

  checkConsistency: async (id: string): Promise<ConsistencyReport> => {
    await simulateDelay(2000)
    const site = mockSites.find(s => s.id === id)
    if (!site) {
      return {
        siteId: id,
        checkedAt: new Date().toISOString(),
        status: "inconsistent",
        issues: [{ type: "device", severity: "error", message: "站点不存在", affectedCount: 0 }]
      }
    }
    // 模拟一致性校验结果
    const hasIssue = Math.random() > 0.7
    return {
      siteId: id,
      checkedAt: new Date().toISOString(),
      status: hasIssue ? "inconsistent" : "consistent",
      issues: hasIssue ? [
        { type: "device", severity: "warning", message: "设备状态同步延迟", affectedCount: 2 },
        { type: "file", severity: "warning", message: "文件索引差异", affectedCount: 15 }
      ] : []
    }
  }
}

// ============================================================
// Mock Task Provider
// ============================================================

let mockTasks = [...tasks]

export const mockTaskProvider: TaskProvider = {
  getAll: async (filters?: TaskFilters) => {
    await simulateDelay(100)
    let result = [...mockTasks]
    if (filters) {
      if (filters.type && filters.type !== "all") {
        result = result.filter(t => t.type === filters.type)
      }
      if (filters.status) {
        result = result.filter(t => t.status === filters.status)
      }
      if (filters.siteCode) {
        result = result.filter(t => t.siteCode === filters.siteCode)
      }
      if (filters.keyword) {
        result = result.filter(t => t.name.includes(filters.keyword!) || t.siteName.includes(filters.keyword!))
      }
    }
    return result
  },

  getById: async (id: string) => {
    await simulateDelay(50)
    return mockTasks.find(t => t.id === id)
  },

  getStats: async () => {
    await simulateDelay(80)
    return { ...taskStats }
  },

  getLogs: async (taskId: string) => {
    await simulateDelay(80)
    return taskLogs.filter(l => !taskId || l.taskId === taskId)
  },

  getAlerts: async () => {
    await simulateDelay(60)
    return [...taskAlerts]
  },

  createTask: async (input: CreateTaskInput) => {
    await simulateDelay(200)
    const newTask = {
      id: `t${Date.now()}`,
      name: input.name,
      type: input.type,
      status: "pending_dispatch" as const,
      priority: input.priority,
      progress: 0,
      siteName: input.siteCode,
      siteCode: input.siteCode,
      operator: "当前用户",
      startedAt: "—",
      updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
    }
    mockTasks = [newTask, ...mockTasks]
    return newTask
  },

  updateTask: async (id: string, updates: Partial<import("@/lib/types/task").TaskItem>) => {
    await simulateDelay(100)
    const index = mockTasks.findIndex(t => t.id === id)
    if (index === -1) throw new Error("Task not found")
    mockTasks[index] = { ...mockTasks[index], ...updates }
    return mockTasks[index]
  },

  pauseTask: async (id: string) => {
    await simulateDelay(100)
    const task = mockTasks.find(t => t.id === id)
    if (task) task.status = "paused"
  },

  resumeTask: async (id: string) => {
    await simulateDelay(100)
    const task = mockTasks.find(t => t.id === id)
    if (task) task.status = "running"
  },

  retryTask: async (id: string) => {
    await simulateDelay(100)
    const task = mockTasks.find(t => t.id === id)
    if (task) {
      task.status = "running"
      task.errorMessage = undefined
      task.retryCount = (task.retryCount || 0) + 1
    }
  }
}

// ============================================================
// Mock User Provider
// ============================================================

let mockUsers = [...users]

export const mockUserProvider: UserProvider = {
  getAll: async () => {
    await simulateDelay(100)
    return [...mockUsers]
  },

  getById: async (id: string) => {
    await simulateDelay(50)
    return mockUsers.find(u => u.id === id)
  },

  getStats: async () => {
    await simulateDelay(80)
    return { ...userStats }
  },

  createUser: async (input: CreateUserInput) => {
    await simulateDelay(200)
    const accessibleSites = input.accessibleSites || []
    const siteLabels = sites.map((site) => site.name)
    const hasAllSites = accessibleSites.includes("全部站点")
    const newUser = {
      id: `u${Date.now()}`,
      username: input.username,
      displayName: input.displayName,
      department: input.department || "",
      role: input.role || "operator",
      roleLabel: input.role || "operator",
      accessibleSites,
      status: "active" as const,
      lastLoginAt: "—",
      permissionSyncStatus: "pending" as const,
      email: input.email || "",
      phone: input.phone || "",
      permissions: {
        sites: siteLabels.map((label) => hasAllSites || accessibleSites.includes(label)),
        siteLabels,
        devices: [],
        volumes: [],
        tasks: [],
        logs: [],
        allSiteNotify: false,
        hasConflict: false,
        conflictMessage: ""
      }
    }
    mockUsers = [...mockUsers, newUser]
    return newUser
  },

  updateUser: async (id: string, updates: Partial<import("@/lib/types/user").User>) => {
    await simulateDelay(100)
    const index = mockUsers.findIndex(u => u.id === id)
    if (index === -1) throw new Error("User not found")
    mockUsers[index] = { ...mockUsers[index], ...updates }
    return mockUsers[index]
  },

  syncPermissions: async (id: string): Promise<SyncResult> => {
    await simulateDelay(1500)
    return {
      status: "success",
      message: "权限同步成功",
      syncedAt: new Date().toISOString()
    }
  }
}

// ============================================================
// Mock Rack Provider
// ============================================================

export const mockRackProvider: RackProvider = {
  getAll: async (siteCode?: string) => {
    await simulateDelay(100)
    if (siteCode) {
      return racks.filter(r => r.siteCode === siteCode)
    }
    return [...racks]
  },

  getById: async (id: string) => {
    await simulateDelay(50)
    return racks.find(r => r.id === id)
  },

  getStats: async (siteCode?: string) => {
    await simulateDelay(80)
    return { ...rackStats }
  },

  registerTransfer: async (input: TransferInput): Promise<any> => {
    await simulateDelay(300)
    const newTransfer = {
      id: `tr${Date.now()}`,
      rackId: input.rackId,
      fromSiteCode: input.fromSiteCode,
      toSiteCode: input.toSiteCode,
      reason: input.reason,
      operator: input.operator,
      approver: input.approver,
      status: "pending",
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
    }
    return newTransfer
  }
}

// ============================================================
// Mock Search Provider
// ============================================================

export const mockSearchProvider: SearchProvider = {
  search: async (filters: any): Promise<SearchResult> => {
    await simulateDelay(300)
    let result = [...searchFiles]

    if (filters.keyword) {
      result = result.filter(f =>
        f.fileName.includes(filters.keyword) ||
        f.discNo.includes(filters.keyword)
      )
    }
    if (filters.siteCode) {
      result = result.filter(f => f.siteCode === filters.siteCode)
    }
    if (filters.department) {
      result = result.filter(f => f.department === filters.department)
    }
    if (filters.fileType) {
      result = result.filter(f => f.fileType === filters.fileType)
    }

    // 站点分布统计
    const siteBreakdown: Record<string, number> = {}
    result.forEach(f => {
      siteBreakdown[f.siteCode] = (siteBreakdown[f.siteCode] || 0) + 1
    })

    return {
      total: result.length,
      returned: Math.min(result.length, 20),
      files: result.slice(0, 20),
      siteBreakdown
    }
  },

  getFilterOptions: async (): Promise<FilterOptions> => {
    await simulateDelay(100)
    return {
      sites: searchSites.slice(1).map((name, idx) => ({ code: `site-${idx}`, name })),
      departments: searchDepartments.slice(1),
      fileTypes: searchFileTypes.slice(1),
      dateRange: { start: "2024-01-01", end: "2026-12-31" }
    }
  },

  exportIndex: async (config: ExportConfig): Promise<ExportJob> => {
    await simulateDelay(2000)
    return {
      id: `exp${Date.now()}`,
      status: "completed",
      progress: 100,
      downloadUrl: "#",
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    }
  }
}

// ============================================================
// Mock Audit Provider
// ============================================================

export const mockAuditProvider: AuditProvider = {
  getLogs: async (filters?: any): Promise<any[]> => {
    await simulateDelay(150)
    let result = [...auditLogs]
    if (filters?.tab) {
      result = result.filter(l => l.type === filters.tab)
    }
    if (filters?.keyword) {
      result = result.filter(l => l.summary.includes(filters.keyword))
    }
    return result
  },

  getStats: async () => {
    await simulateDelay(80)
    return { ...auditStats }
  },

  exportLogs: async (config: ExportConfig): Promise<ExportJob> => {
    await simulateDelay(2000)
    return {
      id: `exp${Date.now()}`,
      status: "completed",
      progress: 100,
      downloadUrl: "#",
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    }
  }
}

// ============================================================
// Mock Settings Provider
// ============================================================

let mockSettings = { ...defaultSettings }

export const mockSettingsProvider: SettingsProvider = {
  get: async () => {
    await simulateDelay(80)
    return { ...mockSettings }
  },

  update: async (updates: Partial<SystemSettings>): Promise<SystemSettings> => {
    await simulateDelay(200)
    mockSettings = { ...mockSettings, ...updates }
    return { ...mockSettings }
  }
}

// ============================================================
// Helper Functions
// ============================================================

function simulateDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================
// Provider Selection (运行时切换)
// ============================================================

// 当前使用 Mock Provider
// 后端接入时替换为 realSiteProvider, realTaskProvider 等
export const isUsingMock = true

export const siteProvider = mockSiteProvider
export const taskProvider = mockTaskProvider
export const userProvider = mockUserProvider
export const rackProvider = mockRackProvider
export const searchProvider = mockSearchProvider
export const auditProvider = mockAuditProvider
export const settingsProvider = mockSettingsProvider
