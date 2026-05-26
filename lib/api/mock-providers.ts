// Mock Providers - 使用现有 Mock 数据实现 Provider 接口
// 便于后续替换为真实后端 API

import type {
  SiteProvider, TaskProvider, UserProvider, RackProvider,
  SearchProvider, AuditProvider, SettingsProvider,
  TaskFilters, CreateTaskInput, CreateUserInput, TransferInput, ExportConfig,
  ConsistencyReport, SyncResult, SearchResult, FilterOptions, ExportJob,
  AddMediaInput, MountInput,
} from "./providers"
import type { SystemSettings } from "@/lib/types/settings"
import type { TransferRecord, Rack } from "@/lib/types/rack"
import type { TaskPhase } from "@/lib/types/task"
import { TASK_PHASES_BY_TYPE } from "@/lib/types/task"
import { readMockStore, writeMockStore, getStorageKey } from "./mock-store"

// 导入现有 Mock 数据
import { sites, siteStats } from "@/lib/mock/sites"
import { tasks, taskStats, taskLogs, taskAlerts } from "@/lib/mock/tasks"
import { users, userStats } from "@/lib/mock/users"
import { racks as defaultRacks, rackStats as defaultRackStats } from "@/lib/mock/racks"
import { searchFiles, searchSites, searchDepartments, searchFileTypes } from "@/lib/mock/search"
import { auditLogs, auditStats } from "@/lib/mock/audit"
import { defaultSettings } from "@/lib/mock/settings"

// 保持可变性（用于模拟状态变化）
let mockTasks = [...tasks]
let mockRacks = [...defaultRacks]

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
      if (filters.phase && filters.phase !== "all") {
        result = result.filter(t => t.phase === filters.phase)
      }
      if (filters.siteCode) {
        result = result.filter(t => t.siteCode === filters.siteCode)
      }
      if (filters.keyword) {
        result = result.filter(t =>
          t.name.includes(filters.keyword!) ||
          (t.taskNo ?? "").includes(filters.keyword!) ||
          t.siteName.includes(filters.keyword!) ||
          (t.archiveName ?? "").includes(filters.keyword!)
        )
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
    const now = new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-")
    const nowTime = new Date().toLocaleTimeString("zh-CN", { hour12: false })
    const newTask = {
      id: `t${Date.now()}`,
      taskNo: input.taskNo ?? `TK-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(mockTasks.length + 1).padStart(3, "0")}`,
      name: input.name,
      type: input.type,
      phase: "pending" as const,
      status: "pending_dispatch" as const,
      priority: input.priority,
      progress: 0,
      archiveName: input.archiveName,
      dataClassification: input.dataClassification,
      siteName: input.siteCode,
      siteCode: input.siteCode,
      operator: input.operator,
      department: input.department,
      sourcePath: input.sourcePath,
      packagePath: input.packagePath,
      volumeId: input.volumeId,
      backupScope: input.backupScope ?? "full",
      packagingMode: input.packagingMode ?? "scan_while_package",
      deviceId: input.deviceId,
      rackId: input.rackId,
      startedAt: "—",
      updatedAt: now,
      recentLogs: [
        {
          id: `log-${Date.now()}`,
          taskId: `t${Date.now()}`,
          timestamp: nowTime,
          level: "info" as const,
          message: `任务创建成功，等待调度`,
          operator: input.operator,
        },
      ],
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
      task.phase = task.phase === "failed" ? "pending" : task.phase
      task.errorMessage = undefined
      task.retryCount = (task.retryCount || 0) + 1
    }
  },

  advancePhase: async (id: string) => {
    await simulateDelay(100)
    const task = mockTasks.find(t => t.id === id)
    if (!task) throw new Error("Task not found")
    const phases = TASK_PHASES_BY_TYPE[task.type]
    const currentIndex = phases.indexOf(task.phase as TaskPhase)
    if (currentIndex < 0 || currentIndex >= phases.length - 1) {
      // Already at end, complete it
      task.phase = "completed"
      task.status = "completed"
      task.progress = 100
      task.completedAt = new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-")
      return task
    }
    const nextPhase = phases[currentIndex + 1]
    task.phase = nextPhase
    task.status = nextPhase === "completed" ? "completed" : nextPhase === "failed" ? "failed" : "running"
    if (nextPhase === "completed") {
      task.progress = 100
      task.completedAt = new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-")
    } else {
      task.progress = Math.min(100, task.progress + Math.floor(15 + Math.random() * 20))
    }
    // Append log
    const phaseLog: Record<string, string> = {
      pending: "任务已创建，等待调度",
      scanning: "进入扫描阶段，开始扫描源目录",
      preparing: "扫描完成，进入准备阶段",
      splitting: "准备完成，开始分盘操作",
      packaging: "分盘完成，开始多线程封包",
      verifying: "封包完成，开始 SM3 校验",
      writing: "校验完成，开始写入目标存储",
      completed: "任务执行完成",
      failed: "任务执行失败",
      paused: "任务已暂停",
    }
    task.recentLogs = [
      {
        id: `log-${Date.now()}`,
        taskId: task.id,
        timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
        level: nextPhase === "failed" ? "error" : "info",
        message: phaseLog[nextPhase] ?? `进入阶段：${nextPhase}`,
        operator: "系统",
      },
      ...task.recentLogs,
    ]
    return task
  },

  completeTask: async (id: string) => {
    await simulateDelay(100)
    const task = mockTasks.find(t => t.id === id)
    if (task) {
      task.phase = "completed"
      task.status = "completed"
      task.progress = 100
      task.completedAt = new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-")
    }
  },

  failTask: async (id: string, reason: string) => {
    await simulateDelay(100)
    const task = mockTasks.find(t => t.id === id)
    if (task) {
      task.phase = "failed"
      task.status = "failed"
      task.errorMessage = reason
    }
  },

  createTaskFromDevice: async (deviceId: string, taskType: import("@/lib/types/task").TaskType, params?: Record<string, string>) => {
    await simulateDelay(300)
    const device = mockRacks.find(r => r.id === deviceId)
    const newTask: import("@/lib/types/task").TaskItem = {
      id: `t${Date.now()}`,
      taskNo: `TK-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(mockTasks.length + 1).padStart(3, "0")}`,
      name: params?.name ?? `${device?.rackName ?? "设备"}-${taskType === "device_scan" ? "设备扫描" : taskType === "raid_check" ? "RAID校验" : "任务"}`,
      type: taskType,
      phase: "pending",
      status: "pending_dispatch",
      priority: "normal",
      progress: 0,
      archiveName: device?.rackName ?? "—",
      dataClassification: taskType === "device_scan" ? "设备扫描" : taskType === "raid_check" ? "RAID校验" : "其他",
      siteName: device?.siteName ?? "—",
      siteCode: device?.siteCode ?? "—",
      operator: "当前用户",
      department: "设备运维部",
      sourcePath: params?.sourcePath ?? "/dev/sda",
      packagePath: params?.packagePath ?? "/output/",
      deviceId,
      deviceName: device?.rackId,
      rackId: deviceId,
      startedAt: "—",
      updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-"),
      recentLogs: [
        {
          id: `log-${Date.now()}`,
          taskId: `t${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          level: "info",
          message: `从设备 ${device?.rackId} 生成任务，等待调度`,
          operator: "系统",
        },
      ],
    }
    mockTasks = [newTask, ...mockTasks]
    return newTask
  },
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
    const stored = readMockStore(getStorageKey("racks"), null)
    if (stored) mockRacks = stored
    if (siteCode) {
      return mockRacks.filter(r => r.siteCode === siteCode)
    }
    return [...mockRacks]
  },

  getById: async (id: string) => {
    await simulateDelay(50)
    const stored = readMockStore(getStorageKey("racks"), null)
    if (stored) mockRacks = stored
    return mockRacks.find(r => r.id === id)
  },

  getStats: async (siteCode?: string) => {
    await simulateDelay(80)
    const stored = readMockStore(getStorageKey("racks"), null)
    if (stored) mockRacks = stored
    const filtered = siteCode ? mockRacks.filter(r => r.siteCode === siteCode) : mockRacks
    const total = filtered.length
    const normal = filtered.filter(r => r.status === "normal").length
    const warning = filtered.filter(r => r.status === "warning").length
    const fault = filtered.filter(r => r.status === "fault").length
    const maintenance = filtered.filter(r => r.status === "maintenance").length
    const online = filtered.filter(r => r.deviceStatus === "online").length
    const offline = filtered.filter(r => r.deviceStatus === "offline" || r.deviceStatus === "error").length
    const usedSlots = filtered.reduce((s, r) => s + (r.usedSlots || 0), 0)
    const totalSlotsAll = filtered.reduce((s, r) => s + (r.totalSlots || 0), 0)
    const avgUsage = total > 0 ? Math.round(filtered.reduce((s, r) => s + r.usagePercent, 0) / total) : 0
    return {
      total, normal, warning, fault, maintenance,
      online, offline,
      totalCapacity: defaultRackStats.totalCapacity,
      remainingCapacity: defaultRackStats.remainingCapacity,
      usedSlots, totalSlotsAll, avgUsage,
    }
  },

  registerTransfer: async (input: TransferInput) => {
    const stored = readMockStore(getStorageKey("racks"), null)
    if (stored) mockRacks = stored

    const rack = mockRacks.find(r => r.rackId === input.rackId)
    if (!rack) throw new Error("Rack not found")

    const transferRecord: TransferRecord = {
      id: `tr-${Date.now()}`,
      rackId: input.rackId,
      fromSite: rack.siteName,
      toSite: input.toSiteCode,
      reason: input.reason,
      operator: input.operator,
      approver: input.approver,
      status: "pending",
      requestedAt: new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-"),
    }

    // 找目标站点 code
    const siteCodeMap: Record<string, string> = {
      "上海研发中心": "SH-RD-01",
      "北京总部机房": "BJ-HQ-02",
      "广州生产基地": "GZ-PD-03",
      "南京中心": "NJ-DC-05",
      "武汉备份中心": "WH-BK-06",
    }

    // 移位完成前保留原站点，避免列表在 pending 阶段提前显示为目标站点
    const idx = mockRacks.findIndex(r => r.rackId === input.rackId)
    mockRacks[idx] = {
      ...rack,
      status: "maintenance",
      lastSyncAt: transferRecord.requestedAt,
      transferHistory: [transferRecord, ...(rack.transferHistory ?? [])],
    }
    writeMockStore(getStorageKey("racks"), mockRacks)

    // 模拟状态流转: pending -> in_transit (1.2s) -> completed (3.2s)
    setTimeout(() => {
      const s = readMockStore<Rack[]>(getStorageKey("racks"), mockRacks)
      const ri = s.findIndex(r => r.rackId === input.rackId)
      if (ri !== -1) {
        s[ri] = {
          ...s[ri],
          transferHistory: s[ri].transferHistory?.map(t =>
            t.id === transferRecord.id ? { ...t, status: "in_transit" as const } : t
          ),
        }
        writeMockStore(getStorageKey("racks"), s)
      }
    }, 1200)

    setTimeout(() => {
      const s = readMockStore<Rack[]>(getStorageKey("racks"), mockRacks)
      const ri = s.findIndex(r => r.rackId === input.rackId)
      if (ri !== -1) {
        s[ri] = {
          ...s[ri],
          status: "normal",
          siteName: input.toSiteCode,
          siteCode: siteCodeMap[input.toSiteCode] ?? s[ri].siteCode,
          lastSyncAt: new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-"),
          transferHistory: s[ri].transferHistory?.map(t =>
            t.id === transferRecord.id
              ? { ...t, status: "completed" as const, completedAt: new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-") }
              : t
          ),
        }
        writeMockStore(getStorageKey("racks"), s)
      }
    }, 3200)

    await simulateDelay(300)
    return transferRecord
  },

  syncRacks: async () => {
    await simulateDelay(1500)
    const stored = readMockStore(getStorageKey("racks"), null)
    if (stored) mockRacks = stored
    const now = new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-")
    mockRacks = mockRacks.map(r => ({ ...r, lastSyncAt: now }))
    writeMockStore(getStorageKey("racks"), mockRacks)
    return [...mockRacks]
  },

  addMedia: async (rackId: string, slotIndex: number, media: AddMediaInput) => {
    await simulateDelay(200)
    const stored = readMockStore(getStorageKey("racks"), null)
    if (stored) mockRacks = stored
    const rack = mockRacks.find(r => r.id === rackId)
    if (!rack) throw new Error("Rack not found")
    const slot = rack.slots.find(s => s.index === slotIndex)
    if (!slot) throw new Error("Slot not found")
    if (slot.occupied) throw new Error("Slot already occupied")
    slot.occupied = true
    slot.status = "used"
    slot.discNo = media.discNo
    slot.mediaType = media.mediaType
    slot.capacity = media.capacity
    slot.volumeId = media.volumeId
    rack.usedSlots = (rack.usedSlots || 0) + 1
    // Recalculate usage percent
    if (rack.totalSlots > 0) {
      rack.usagePercent = Math.round((rack.usedSlots / rack.totalSlots) * 100)
    }
    // Add device log
    if (!rack.deviceLogs) rack.deviceLogs = []
    rack.deviceLogs = [
      {
        id: `dl-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
        level: "info" as const,
        message: `介质 ${media.discNo} 已添加到 ${rack.rackId} 槽位 ${slotIndex}`,
      },
      ...rack.deviceLogs,
    ]
    writeMockStore(getStorageKey("racks"), mockRacks)
  },

  mountNetworkDrive: async (mount: MountInput) => {
    await simulateDelay(2000)
    const stored = readMockStore(getStorageKey("racks"), null)
    if (stored) mockRacks = stored
    // Create new CIFS network drive as a rack
    const newRack: Rack = {
      id: `r-${Date.now()}`,
      rackId: `R-NAS-${Date.now() % 10000}`,
      rackName: `${mount.protocol}网盘-${mount.deviceName}`,
      siteName: mount.siteName || mount.deviceGroup,
      siteCode: mount.siteName || mount.deviceGroup,
      datacenter: mount.datacenter || "网络存储",
      cages: ["网盘挂载"],
      totalSlots: 0,
      usedSlots: 0,
      usagePercent: 0,
      status: "normal",
      lastSyncAt: new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-"),
      slots: [],
      ip: mount.deviceName,
      deviceType: `${mount.protocol} 网盘`,
      deviceStatus: "online",
      totalCapacity: "待挂载后确定",
      remainingCapacity: "待挂载后确定",
      currentTaskCount: 0,
      trays: [],
      mode: "standard",
      volumes: [{
        id: `v-${Date.now()}`,
        name: mount.mountPath.split("/").pop() || mount.deviceName,
        type: "magnetic",
        totalCapacity: "待挂载后确定",
        remainingCapacity: "待挂载后确定",
        info: `挂载路径: ${mount.mountPath} | 数据源: ${mount.dataSource} | 权限: ${mount.permission === "readonly" ? "只读" : "读写"}`,
      }],
      deviceLogs: [
        {
          id: `dl-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          level: "info" as const,
          message: `网盘挂载启动：${mount.dataSource}`,
        },
        {
          id: `dl-${Date.now() + 1}`,
          timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          level: "info" as const,
          message: `权限测试通过（${mount.permission === "readonly" ? "只读" : "读写"}）`,
        },
        {
          id: `dl-${Date.now() + 2}`,
          timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          level: "info" as const,
          message: `挂载成功：${mount.mountPath} -> ${mount.dataSource}`,
        },
      ],
    }
    mockRacks = [newRack, ...mockRacks]
    writeMockStore(getStorageKey("racks"), mockRacks)
    return newRack
  },

  updateDeviceMode: async (rackId: string, mode: string) => {
    await simulateDelay(300)
    const stored = readMockStore(getStorageKey("racks"), null)
    if (stored) mockRacks = stored
    const rack = mockRacks.find(r => r.id === rackId)
    if (!rack) throw new Error("Rack not found")
    const modeMap: Record<string, import("@/lib/types/rack").DeviceMode> = {
      "关": "off",
      "开-标准模式": "standard",
      "开-高速模式（深度休眠不下电）": "high_speed",
      off: "off",
      standard: "standard",
      high_speed: "high_speed",
    }
    rack.mode = modeMap[mode] ?? "off"
    if (!rack.deviceLogs) rack.deviceLogs = []
    rack.deviceLogs = [
      {
        id: `dl-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
        level: "info" as const,
        message: `设备模式切换：${mode}`,
      },
      ...rack.deviceLogs,
    ]
    writeMockStore(getStorageKey("racks"), mockRacks)
  },
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
