/**
 * Task Adapter - 任务数据适配器
 * 将 Mock/DB 数据转换为 TaskDTO
 */

import type { TaskItem, TaskLogEntry, TaskStats } from "@/lib/types/task"
import type { TaskDTO, TaskStatsDTO } from "@/lib/api/dto"

// TaskType 映射
const TASK_TYPE_MAP: Record<string, TaskDTO["type"]> = {
  full_package: "full_package",
  incremental_package: "incremental_package",
  backup: "backup",
  restore: "restore",
  full_scan: "full_scan",
  incremental_scan: "incremental_scan",
  migrate: "migrate",
  device_scan: "device_scan",
  raid_check: "raid_check",
}

// TaskPhase 映射
const PHASE_MAP: Record<string, TaskDTO["phase"]> = {
  pending: "pending",
  scanning: "scanning",
  preparing: "preparing",
  splitting: "splitting",
  packaging: "packaging",
  verifying: "verifying",
  writing: "writing",
  completed: "completed",
  failed: "failed",
  paused: "paused",
  idle: "idle",
}

// Priority 映射
const PRIORITY_MAP: Record<string, TaskDTO["priority"]> = {
  critical: "critical",
  high: "high",
  normal: "normal",
  low: "low",
}

// 安全的类型转换
function safeAdaptTaskType(type: string): TaskDTO["type"] {
  return TASK_TYPE_MAP[type] ?? "other"
}

function safeAdaptPhase(phase: string): TaskDTO["phase"] {
  return PHASE_MAP[phase] ?? "pending"
}

function safeAdaptPriority(priority: string): TaskDTO["priority"] {
  return PRIORITY_MAP[priority] ?? "normal"
}

function safeAdaptStatus(status: string): TaskDTO["status"] {
  if (status === "running") return "running"
  if (status === "paused") return "paused"
  if (status === "completed") return "completed"
  if (status === "failed") return "failed"
  if (status === "pending_dispatch") return "pending_dispatch"
  return "running"
}

function adaptLog(log: TaskLogEntry): TaskDTO["recentLogs"][0] {
  return {
    id: log.id,
    taskId: log.taskId,
    timestamp: log.timestamp,
    level: log.level,
    message: log.message,
    operator: log.operator,
  }
}

export function adaptTask(task: TaskItem): TaskDTO {
  return {
    id: task.id,
    name: task.name,
    taskNo: task.taskNo,
    type: safeAdaptTaskType(task.type),
    phase: safeAdaptPhase(task.phase),
    status: safeAdaptStatus(task.status),
    priority: safeAdaptPriority(task.priority),
    progress: task.progress ?? 0,

    // 基本信息
    archiveName: task.archiveName ?? "",
    dataClassification: task.dataClassification ?? "",
    siteName: task.siteName ?? "",
    siteCode: task.siteCode ?? "",
    operator: task.operator ?? "",
    department: task.department,

    // 路径
    sourcePath: task.sourcePath ?? "",
    packagePath: task.packagePath ?? "",
    volumeId: task.volumeId,

    // 配置
    backupScope: task.backupScope ?? "full",
    packagingMode: task.packagingMode ?? "scan_then_package",

    // 关联设备
    deviceId: task.deviceId,
    deviceName: task.deviceName,
    rackId: task.rackId,
    rackName: task.rackName,

    // 时间
    startedAt: task.startedAt ?? "",
    updatedAt: task.updatedAt ?? "",
    completedAt: task.completedAt,

    // 统计
    fileCount: task.fileCount,
    totalSize: task.totalSize,
    packagedSize: task.packagedSize,
    packageCount: task.packageCount,
    successCount: task.successCount,
    errorCount: task.errorCount,
    speed: task.speed,

    // 多线程封包
    packagingThreads: task.packagingThreads?.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status as "running" | "completed" | "waiting" | "error",
      progress: t.progress,
      speed: t.speed,
    })),

    // SM3 校验
    sm3Status: task.sm3Status,
    sm3Progress: task.sm3Progress,

    // 错误
    errorMessage: task.errorMessage,
    retryCount: task.retryCount,
    lastRetryAt: task.lastRetryAt,

    // 运行时日志
    recentLogs: task.recentLogs?.map(adaptLog) ?? [],
  }
}

export function adaptTaskList(tasks: TaskItem[]): TaskDTO[] {
  return tasks.map(adaptTask)
}

export function adaptTaskStats(stats: TaskStats): TaskStatsDTO {
  return {
    total: stats.total,
    pending: stats.pending,
    running: stats.running,
    completed: stats.completed,
    failed: stats.failed,
    paused: stats.paused,
  }
}
