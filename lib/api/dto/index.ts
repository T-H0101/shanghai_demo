/**
 * API DTO Types - 后端 API 响应类型
 * 设计原则: 面向前端业务，字段名与前端类型一致
 */

// ─────────────────────────────────────────────────────────────
// 通用类型
// ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  traceId: string
}

export interface PaginatedResponse<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export type Priority = "critical" | "high" | "normal" | "low"

export type TaskPhase =
  | "pending"
  | "scanning"
  | "preparing"
  | "splitting"
  | "packaging"
  | "verifying"
  | "writing"
  | "completed"
  | "failed"
  | "paused"
  | "idle"

export type TaskStatus = "running" | "paused" | "completed" | "failed" | "pending_dispatch"

export type TaskType =
  | "full_scan"
  | "incremental_scan"
  | "full_package"
  | "incremental_package"
  | "backup"
  | "restore"
  | "migrate"
  | "device_scan"
  | "raid_check"
  | "other"

export type BackupScope = "full" | "incremental"
export type PackagingMode = "scan_then_package" | "scan_while_package"

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────

export interface DashboardSummaryDTO {
  // 任务统计
  tasks: {
    total: number
    running: number
    completed: number
    failed: number
    pending: number
  }
  // 设备统计
  devices: {
    total: number
    online: number
    offline: number
    warning: number
  }
  // 容量统计
  capacity: {
    totalBytes: number
    usedBytes: number
    usagePercent: number
    displayTotal: string
    displayUsed: string
  }
  // 告警统计
  alerts: {
    total: number
    critical: number
    warning: number
  }
  // 站点统计
  sites: {
    total: number
    online: number
    offline: number
  }
  // 同步状态
  sync: {
    syncing: number
    failed: number
    lastSyncAt: string
  }
}

// ─────────────────────────────────────────────────────────────
// Task
// ─────────────────────────────────────────────────────────────

export interface PackagingThreadDTO {
  id: string
  name: string
  status: "running" | "completed" | "waiting" | "error"
  progress: number
  speed?: string
}

export interface TaskLogEntryDTO {
  id: string
  taskId: string
  timestamp: string
  level: "info" | "warn" | "error"
  message: string
  operator?: string
}

export interface TaskDTO {
  id: string
  name: string
  taskNo: string
  type: TaskType
  phase: TaskPhase
  status: TaskStatus
  priority: Priority
  progress: number

  // 基本信息
  archiveName: string
  dataClassification: string
  siteName: string
  siteCode: string
  operator: string
  department?: string

  // 路径
  sourcePath: string
  packagePath: string
  volumeId?: string

  // 配置
  backupScope: BackupScope
  packagingMode?: PackagingMode

  // 关联设备
  deviceId?: string
  deviceName?: string
  rackId?: string
  rackName?: string

  // 时间
  startedAt: string
  updatedAt: string
  completedAt?: string

  // 统计
  fileCount?: number
  totalSize?: string
  packagedSize?: string
  packageCount?: number
  successCount?: number
  errorCount?: number
  speed?: string

  // 多线程封包
  packagingThreads?: PackagingThreadDTO[]

  // SM3 校验
  sm3Status?: "pending" | "in_progress" | "completed" | "failed"
  sm3Progress?: number

  // 错误
  errorMessage?: string
  retryCount?: number
  lastRetryAt?: string

  // 运行时日志
  recentLogs: TaskLogEntryDTO[]
}

export interface TaskStatsDTO {
  total: number
  pending: number
  running: number
  completed: number
  failed: number
  paused: number
}

// ─────────────────────────────────────────────────────────────
// Rack / Device
// ─────────────────────────────────────────────────────────────

export type RackStatus = "normal" | "warning" | "fault" | "maintenance"
export type OnlineStatus = "online" | "offline"
export type SlotStatus = "free" | "used" | "error" | "empty"
export type MediaType = "hdd" | "bd" | "offline"
export type DeviceMode = "off" | "standard" | "high_speed"

export interface RackSlotDTO {
  id: string
  index: number
  occupied: boolean
  status: SlotStatus
  discNo?: string
  label?: string
  mediaType?: MediaType
  capacity?: string
  volumeId?: string
}

export interface DeviceTrayDTO {
  id: string
  index: number
  slotCount: number
  usedCount: number
  label: string
}

export interface RelatedTaskDTO {
  id: string
  name: string
  type: string
  progress: number
  status: string
  startedAt: string
}

export interface DeviceLogDTO {
  id: string
  timestamp: string
  level: "info" | "warn" | "error"
  message: string
}

export interface RackDTO {
  id: string
  rackId: string
  rackName: string
  siteName: string
  siteCode: string
  datacenter: string
  cages: string[]
  totalSlots: number
  usedSlots?: number
  usagePercent: number
  status: RackStatus
  lastSyncAt: string
  floor?: string
  room?: string

  // 设备信息
  ip?: string
  deviceType?: string
  deviceStatus?: OnlineStatus
  onlineStatus?: OnlineStatus
  totalCapacity?: string
  remainingCapacity?: string
  currentTaskCount?: number
  mode?: DeviceMode
  cageCount?: number

  // 详情
  slots?: RackSlotDTO[]
  trays?: DeviceTrayDTO[]
  volumes?: VolumeDTO[]
  recentTasks?: RelatedTaskDTO[]
  deviceLogs?: DeviceLogDTO[]
}

export interface RackStatsDTO {
  total: number
  normal: number
  warning: number
  fault: number
  maintenance: number
  online: number
  offline: number
  totalCapacity: string
  remainingCapacity: string
  usedSlots: number
  totalSlotsAll: number
  avgUsage: number
}

// ─────────────────────────────────────────────────────────────
// Volume
// ─────────────────────────────────────────────────────────────

export type VolumeType = "optical" | "magnetic" | "composite"

export interface VolumeDTO {
  id: string
  name: string
  type: VolumeType
  totalCapacity: string
  remainingCapacity: string
  info: string
  discCount?: number
  usedCount?: number
  newCount?: number
}

// ─────────────────────────────────────────────────────────────
// Alert
// ─────────────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "warning"
export type AlertStatus = "active" | "resolved" | "acknowledged"

export interface AlertDTO {
  id: string
  title: string
  type: string
  severity: AlertSeverity
  status: AlertStatus
  message: string
  deviceId?: string
  deviceName?: string
  siteCode?: string
  siteName?: string
  createdAt: string
  resolvedAt?: string
}

export interface AlertStatsDTO {
  total: number
  critical: number
  warning: number
  active: number
}

// ─────────────────────────────────────────────────────────────
// Site
// ─────────────────────────────────────────────────────────────

export type SiteStatus = "online" | "offline"
export type SyncStatus = "synced" | "syncing" | "failed" | "pending"

export interface SiteDTO {
  id: string
  name: string
  code: string
  status: SiteStatus
  ip: string
  port: number
  datacenter: string
  contact: string
  contactPhone: string
  deviceCount: number
  lastSyncAt: string
  syncStatus: SyncStatus
  syncDelay?: number
  storageUsedPercent: number
  storageTotal: string
  storageUsed: string
  region: string
  ssoEnabled: boolean
  rackCount?: number
  onlineRackCount?: number
  cageCount?: number
  totalSlots?: number
  usedSlots?: number
  taskCount?: number
  alertCount?: number
  description?: string
}

export interface SiteStatsDTO {
  total: number
  online: number
  offline: number
  degraded: number
  syncing: number
  avgStorageUsed: number
}

// ─────────────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────────────

export type UserRole = "admin" | "operator" | "viewer"

export interface UserDTO {
  id: string
  username: string
  displayName: string
  role: UserRole
  department?: string
  email?: string
  phone?: string
  accessibleSites: string[]
  status: "active" | "disabled"
  lastLoginAt?: string
  createdAt: string
}

export interface UserStatsDTO {
  total: number
  active: number
  disabled: number
  admins: number
}

// ─────────────────────────────────────────────────────────────
// Sync Status
// ─────────────────────────────────────────────────────────────

export interface SyncStatusDTO {
  siteId: string
  siteName: string
  tables: TableSyncStatusDTO[]
  lastSyncAt: string
  status: "synced" | "syncing" | "failed" | "pending"
}

export interface TableSyncStatusDTO {
  tableName: string
  lastSyncAt: string
  recordCount: number
  status: "synced" | "syncing" | "failed"
}
