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
  /** 由 task_type + task_mode 解析的业务类型中文名 */
  typeLabel?: string
  /** 由 status + task_type + task_mode 解析的业务状态中文名 */
  statusLabel?: string
  phase: TaskPhase
  status: TaskStatus
  priority: Priority
  progress: number | null
  // R.16: 源端 tbl_task.id (bigint 字符串), executor parseInt 必需
  sourceId?: string

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
  /** 源路径↔备份路径成对列表（对齐业务 getTaskDetail.paths） */
  pathPairs?: Array<{
    fromPath: string
    backupPath: string
    volumeName?: string
    restoreStatus?: number | null
    restoreComment?: string | null
  }>
  /** 路径来源：普通 task_items / 物理回迁 restore_file */
  pathSource?: "task_items" | "restore_file"

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
  remainingTime?: string

  // 多线程封包
  packagingThreads?: PackagingThreadDTO[]

  // SM3 校验
  sm3Status?: "pending" | "in_progress" | "completed" | "failed"
  sm3Progress?: number

  // 错误
  errorMessage?: string
  retryCount?: number
  lastRetryAt?: string

  // Sprint 2F.1: 任务运行时字段 (新增)
  taskMode?: number
  runtime?: number
  currentPhase?: string

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
/** 设备运行态（对齐 tbl_disc_lib.device_status：在线/离线/警告/错误；删除不入列表） */
export type DeviceRuntimeStatus = "online" | "offline" | "warning" | "error"
export type SlotStatus = "free" | "used" | "error" | "empty"
export type MediaType = "hdd" | "bd" | "offline"
export type DeviceMode = "off" | "standard" | "high_speed"

/** 网盘挂载信息（只读展示；密码已脱敏） */
export interface NasMountInfoDTO {
  protocol?: number
  protocolLabel?: string
  encoding?: number
  encodingLabel?: string
  transportProtocol?: string
  srcPath?: string
  managerPath?: string
  mountPoint?: string
  userName?: string
  passwordMasked?: string
  hasPassword?: boolean
  quotaBytes?: number
  quotaLabel?: string
  permission?: number
  permissionLabel?: string
  maxSpeed?: number
  maxSpeedLabel?: string
  extraParam?: string
  mountedAt?: string
}

export interface RackSlotDTO {
  id: string
  index: number
  /**
   * 盘位展示标签：单面 "1"；双面 "1A"/"1B"
   * （缺省时前端回退 String(index)）
   */
  indexLabel?: string
  /** tbl_slots.disc_side：0=A，1=B */
  discSide?: number
  occupied: boolean
  status: SlotStatus
  /** 业务 disc_type：0 无盘 / 1 未刻 / 2 满盘 / 3 未满 / 4 坏盘 */
  discType?: number
  discTypeLabel?: string
  sourceSiteId?: string
  sourceTable?: string
  sourceId?: string
  cageId?: string
  cageName?: string
  cageIndex?: number
  slotId?: string
  discNo?: string
  label?: string
  mediaType?: MediaType
  capacity?: string
  usedCapacity?: string
  remainingCapacity?: string
  volumeId?: string
}

export interface RackSlotGroupDTO {
  cageId: string
  cageName: string
  cageIndex: number
  slots: RackSlotDTO[]
}

export interface RackSlotDetailDTO {
  rackId: string
  siteCode: string
  cages: RackSlotGroupDTO[]
  slots: RackSlotDTO[]
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
  usagePercent?: number
  status: RackStatus
  lastSyncAt: string
  floor?: string
  room?: string

  // 设备信息
  ip?: string
  /** 设备服务端口（来自 unified_devices.raw_data.port） */
  port?: string
  serialNo?: string
  deviceType?: string
  deviceStatus?: DeviceRuntimeStatus
  onlineStatus?: OnlineStatus
  totalCapacity?: string
  remainingCapacity?: string
  currentTaskCount?: number
  mode?: DeviceMode
  cageCount?: number

  /** 网盘挂载信息（device_type=nas）；非网盘不返回 */
  mountInfo?: NasMountInfoDTO

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

export type VolumeType = "optical" | "magnetic" | "tape" | "composite"

export interface VolumeDTO {
  id: string
  name: string
  type: VolumeType
  /** 业务对齐展示名（光存储卷 / 磁存储卷 / 磁带存储卷 / 组合卷 等） */
  typeLabel?: string
  totalCapacity: string
  remainingCapacity: string
  info: string
  /** 所属站点编码（用于 SSO 跳转） */
  siteCode?: string
  /** 所属站点名称（展示用） */
  siteName?: string
  discCount?: number
  usedCount?: number
  newCount?: number
  /**
   * Sprint 2H.3 (autonomous): 来自 tbl_volume_slot 的聚合数据
   * 写到 unified_volumes.raw_data._aggregate, 透传到前端
   * - slot_count: 该 volume 下的盘位总数 (来自 tbl_volume_slot)
   * - online_slot_count / offline_slot_count: 盘位在线/离线分布
   */
  aggregate?: {
    slot_count?: number
    online_slot_count?: number
    offline_slot_count?: number
    source_table?: string
    aggregated_at?: string
  }
  /**
   * R.102: 卷下分配介质（按设备分组）
   * 光库：设备名 · 盘笼 RFID；其他：设备名 · IP:port
   */
  mediaGroups?: VolumeMediaGroupDTO[]
}

export interface VolumeMediaCellDTO {
  slotId: string
  displayNo: number
  /** 0–4 对齐业务 disc_type；无则 null */
  discType: number | null
  onLine: number | null
}

export interface VolumeMediaGroupDTO {
  key: string
  deviceId?: string | null
  deviceName: string
  deviceTypeLabel?: string | null
  cageRfid?: string | null
  endpoint?: string | null
  isOptical: boolean
  mediaKind: "disc" | "disk" | "tape" | "media"
  mediaCount: number
  title: string
  cells: VolumeMediaCellDTO[]
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
  /** 站点区域编码（site_regions.code），未挂靠时为空 */
  regionCode?: string | null
  ssoEnabled: boolean
  rackCount?: number
  onlineRackCount?: number
  cageCount?: number
  totalSlots?: number
  usedSlots?: number
  taskCount?: number
  alertCount?: number
  description?: string
  /** 在线判定依据: agent_heartbeat | sync_package | disabled | none */
  reachabilitySource?: string
  /** 在线状态说明（用于 UI tooltip） */
  reachabilityNote?: string
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
