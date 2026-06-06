import type { Priority, TaskStatus } from "./common"
import type { RestoreItem, RecoveryLogEntry } from "./rack"

export type TaskType =
  | "full_scan"       // 全量扫描
  | "incremental_scan"// 增量扫描
  | "full_package"    // 全量封包
  | "incremental_package" // 增量封包
  | "backup"          // 数据备份
  | "restore"         // 数据恢复
  | "migrate"         // 盘笼移位
  | "device_scan"     // 设备扫描
  | "raid_check"      // RAID 校验
  | "other"           // 其他

export type BackupScope = "full" | "incremental"

export type PackagingMode = "scan_then_package" | "scan_while_package"

// 业务阶段（任务详情中展示）
export type TaskPhase =
  | "pending"     // 待处理
  | "scanning"    // 扫描中
  | "preparing"   // 准备中
  | "splitting"   // 分盘中
  | "packaging"   // 封包中
  | "verifying"   // 校验中
  | "writing"     // 写入中
  | "completed"   // 已完成
  | "failed"      // 已失败
  | "paused"      // 已暂停
  | "idle"        // 空闲（设备扫描/RAID校验等）

// 各任务类型的流程步骤映射
export const TASK_PHASES_BY_TYPE: Record<TaskType, TaskPhase[]> = {
  full_package:    ["pending", "scanning", "preparing", "splitting", "packaging", "verifying", "writing", "completed"],
  incremental_package: ["pending", "scanning", "preparing", "splitting", "packaging", "verifying", "writing", "completed"],
  full_scan:       ["pending", "scanning", "completed"],
  incremental_scan:["pending", "scanning", "completed"],
  backup:          ["pending", "scanning", "preparing", "splitting", "packaging", "verifying", "writing", "completed"],
  restore:         ["pending", "scanning", "preparing", "writing", "completed"],
  migrate:         ["pending", "preparing", "writing", "completed"],
  device_scan:     ["pending", "scanning", "completed"],
  raid_check:      ["pending", "verifying", "completed"],
  other:           ["pending", "completed"],
}

// 任务类型中文标签
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  full_scan:        "全量扫描",
  incremental_scan: "增量扫描",
  full_package:     "全量封包",
  incremental_package: "增量封包",
  backup:           "数据备份",
  restore:          "数据恢复",
  migrate:          "盘笼移位",
  device_scan:      "设备扫描",
  raid_check:       "RAID 校验",
  other:            "其他",
}

// 阶段中文标签
export const TASK_PHASE_LABELS: Record<TaskPhase, string> = {
  pending:    "待处理",
  scanning:   "扫描中",
  preparing:  "准备中",
  splitting:  "分盘中",
  packaging:  "封包中",
  verifying:  "校验中",
  writing:    "写入中",
  completed:  "已完成",
  failed:     "已失败",
  paused:     "已暂停",
  idle:       "空闲",
}

export const TASK_PHASE_COLORS: Record<TaskPhase, string> = {
  pending:   "bg-slate-100 text-slate-600",
  scanning:  "bg-blue-100 text-blue-700",
  preparing: "bg-indigo-100 text-indigo-700",
  splitting: "bg-purple-100 text-purple-700",
  packaging: "bg-violet-100 text-violet-700",
  verifying: "bg-cyan-100 text-cyan-700",
  writing:   "bg-emerald-100 text-emerald-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed:    "bg-red-100 text-red-700",
  paused:    "bg-amber-100 text-amber-700",
  idle:      "bg-slate-100 text-slate-500",
}

// 多线程封包单元
export interface PackagingThread {
  id: string
  name: string
  status: "running" | "completed" | "waiting" | "error"
  progress: number
  speed?: string
}

// 任务主记录
export interface TaskItem {
  id: string
  name: string
  taskNo: string
  type: TaskType
  phase: TaskPhase           // 当前业务阶段
  status: TaskStatus          // 基础状态（running/paused/completed/failed/pending_dispatch）
  priority: Priority
  progress: number           // 总体进度 0-100

  // 基本信息
  archiveName: string        // 档案馆名称
  dataClassification: string // 数据分类
  siteName: string
  siteCode: string
  operator: string           // 负责人
  department?: string        // 分配部门

  // 路径
  sourcePath: string         // 源数据路径
  packagePath: string       // 封包路径 / 目标存储路径
  volumeId?: string         // 目标存储卷

  // 封包配置
  backupScope: BackupScope
  packagingMode: PackagingMode

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
  fileCount?: number         // 扫描文件数量
  totalSize?: string         // 总文件大小
  packagedSize?: string      // 已封包大小
  packageCount?: number      // 封包数量
  successCount?: number     // 成功数
  errorCount?: number        // 异常数
  speed?: string             // 当前速度
  remainingTime?: string     // 剩余时间（仅真实来源存在时展示）

  // Sprint 2F.1 / 2F.3: 任务运行时字段 (来自 unified_tasks)
  taskMode?: number          // tbl_task.task_mode
  runtime?: number           // update_dt - create_dt (秒)
  currentPhase?: string      // tbl_disc.max(stage)

  // 多线程封包
  packagingThreads?: PackagingThread[]

  // SM3 校验
  sm3Status?: "pending" | "in_progress" | "completed" | "failed"
  sm3Progress?: number

  // 错误
  errorMessage?: string
  retryCount?: number
  lastRetryAt?: string

  // 运行时日志（每次推进自动追加）
  recentLogs: TaskLogEntry[]

  // ============================================================
  // 数据恢复相关字段（restore 任务类型）
  // ============================================================
  restoreMode?: "server" | "local"       // 恢复模式：恢复到服务器 / 下载到本地
  sourceVolumeId?: string                  // 源存储卷 ID
  sourceVolumeName?: string                // 源存储卷名称
  selectedFiles?: RestoreItem[]            // 已选择的恢复文件列表
  sourcePaths?: string[]                   // 源路径列表
  targetPath?: string                      // 目标路径
  recoveryLogs?: RecoveryLogEntry[]        // 恢复日志
}

export interface TaskLogEntry {
  id: string
  taskId: string
  timestamp: string
  level: "info" | "warn" | "error"
  message: string
  operator?: string
}

export interface TaskStats {
  total: number
  pending: number
  running: number
  completed: number
  failed: number
  paused: number
}

export interface TaskAlert {
  id: string
  taskName: string
  level: "critical" | "warning"
  message: string
  time: string
}
