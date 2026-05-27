import type { Site, SiteStats } from "@/lib/types/site"
import type { TaskItem, TaskStats, TaskLogEntry, TaskAlert, TaskType, TaskPhase } from "@/lib/types/task"
import type { User, UserStats } from "@/lib/types/user"
import type { Rack, RackStats } from "@/lib/types/rack"
import type { SearchFile, SearchFilters } from "@/lib/types/search"
import type { AuditLog, AuditStats, AuditFilters } from "@/lib/types/audit"
import type { SystemSettings } from "@/lib/types/settings"

// ============================================================
// Provider Interface Definitions
// 统一接口定义 - 后端接入时实现 real-providers.ts
// ============================================================

export interface SiteProvider {
  getAll(): Promise<Site[]>
  getById(id: string): Promise<Site | undefined>
  getStats(): Promise<SiteStats>
  syncSite(id: string): Promise<void>
  checkConsistency(id: string): Promise<ConsistencyReport>
}

export interface TaskProvider {
  getAll(filters?: TaskFilters): Promise<TaskItem[]>
  getById(id: string): Promise<TaskItem | undefined>
  getStats(): Promise<TaskStats>
  getLogs(taskId: string): Promise<TaskLogEntry[]>
  getAlerts(): Promise<TaskAlert[]>
  createTask(task: CreateTaskInput): Promise<TaskItem>
  updateTask(id: string, updates: Partial<TaskItem>): Promise<TaskItem>
  advancePhase(id: string): Promise<TaskItem>       // 推进进度（演示用）
  pauseTask(id: string): Promise<void>
  resumeTask(id: string): Promise<void>
  retryTask(id: string): Promise<void>
  completeTask(id: string): Promise<void>
  failTask(id: string, reason: string): Promise<void>
  createTaskFromDevice(deviceId: string, taskType: TaskType, params?: Record<string, string>): Promise<TaskItem>
}

export interface UserProvider {
  getAll(): Promise<User[]>
  getById(id: string): Promise<User | undefined>
  getStats(): Promise<UserStats>
  createUser(user: CreateUserInput): Promise<User>
  updateUser(id: string, updates: Partial<User>): Promise<User>
  syncPermissions(id: string): Promise<SyncResult>
}

export interface RackProvider {
  getAll(siteCode?: string): Promise<Rack[]>
  getById(id: string): Promise<Rack | undefined>
  getStats(siteCode?: string): Promise<RackStats>
  registerTransfer(transfer: TransferInput): Promise<TransferRecord>
  syncRacks(): Promise<Rack[]>
  addMedia(rackId: string, slotIndex: number, media: AddMediaInput): Promise<void>
  mountNetworkDrive(mount: MountInput): Promise<Rack>
  updateDeviceMode(rackId: string, mode: string): Promise<void>
}

export interface SearchProvider {
  search(filters: SearchFilters): Promise<SearchResult>
  getFilterOptions(): Promise<FilterOptions>
  exportIndex(exportConfig: ExportConfig): Promise<ExportJob>
}

export interface AuditProvider {
  getLogs(filters?: AuditFilters): Promise<AuditLog[]>
  getStats(): Promise<AuditStats>
  exportLogs(exportConfig: ExportConfig): Promise<ExportJob>
}

export interface SettingsProvider {
  get(): Promise<SystemSettings>
  update(settings: Partial<SystemSettings>): Promise<SystemSettings>
}

// ============================================================
// Filter Types
// ============================================================

export interface TaskFilters {
  type?: TaskType | "all"
  status?: string
  siteCode?: string
  keyword?: string
  phase?: TaskPhase | "all"
}

export interface CreateTaskInput {
  name: string
  taskNo?: string
  type: TaskType
  archiveName: string
  dataClassification: string
  siteCode: string
  sourcePath: string
  packagePath: string
  volumeId?: string
  backupScope?: "full" | "incremental"
  packagingMode?: "scan_while_package" | "scan_then_package"
  deviceId?: string
  rackId?: string
  priority: "critical" | "high" | "normal" | "low"
  operator: string
  department?: string
  notes?: string

  // ============================================================
  // 数据恢复相关字段（restore 任务类型）
  // ============================================================
  restoreMode?: "server" | "local"       // 恢复模式
  sourceVolumeId?: string                  // 源存储卷 ID
  sourceVolumeName?: string                // 源存储卷名称
  selectedFiles?: import("@/lib/types/rack").RestoreItem[]  // 已选文件
  sourcePaths?: string[]                   // 源路径列表
  targetPath?: string                      // 目标路径
}

export interface CreateUserInput {
  username: string
  displayName: string
  department?: string
  role?: User["role"]
  accessibleSites?: string[]
  email?: string
  phone?: string
}

export interface TransferInput {
  rackId: string
  fromSiteCode: string
  toSiteCode: string
  reason: string
  operator: string
  approver: string
}

export interface AddMediaInput {
  discNo: string
  mediaType: "hdd" | "bd" | "offline"
  capacity: string
  volumeId?: string
}

export interface MountInput {
  deviceName: string
  deviceGroup: string
  protocol: "CIFS" | "NFS"
  encoding: "UTF-8" | "GBK"
  mountPath: string
  managePath: string
  dataSource: string
  username?: string
  password?: string
  permission: "readonly" | "readwrite"
  speedLimit?: number
  extraParams?: string
  siteName?: string      // 所属站点（可选，挂载时指定）
  datacenter?: string    // 数据中心
}

export interface ExportConfig {
  format: "csv" | "json" | "xlsx"
  filters?: SearchFilters | AuditFilters
  pushUrl?: string
}

// ============================================================
// Result Types
// ============================================================

export interface ConsistencyReport {
  siteId: string
  checkedAt: string
  status: "consistent" | "inconsistent" | "checking"
  issues: ConsistencyIssue[]
}

export interface ConsistencyIssue {
  type: "device" | "rack" | "disc" | "file"
  severity: "warning" | "error"
  message: string
  affectedCount: number
}

export interface SyncResult {
  status: "success" | "failed" | "syncing"
  message?: string
  syncedAt?: string
}

export interface SearchResult {
  total: number
  returned: number
  files: SearchFile[]
  siteBreakdown: Record<string, number>
}

export interface FilterOptions {
  sites: Array<{ code: string; name: string }>
  departments: string[]
  fileTypes: string[]
  dateRange: { start: string; end: string }
}

export interface ExportJob {
  id: string
  status: "pending" | "processing" | "completed" | "failed"
  progress: number
  downloadUrl?: string
  expiresAt?: string
}