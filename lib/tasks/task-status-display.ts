/**
 * 任务状态展示 —— 对齐 LongTermStorage-ui taskListStatusText.formatTaskListStatus
 *
 * 规则:
 * 1. status ∈ {0,10,11,20} → 终态文案（不看类型）
 * 2. 其余 → 按 task_type / task_mode 细化中间态
 * 3. 仍匹配不上 → 「正在运行中」（不用「空闲」）
 */

import { resolveNumericTaskType } from "@/lib/tasks/task-type-display"
import type { TaskPhase, TaskStatus } from "@/lib/api/dto"

/** 列表「状态」筛选 —— 对齐业务磁光电 optionsStatus */
export const TASK_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "running", label: "正在运行中" },
  { value: "finished", label: "已经结束" },
  { value: "success", label: "成功" },
  { value: "warning", label: "警告" },
  { value: "aborted", label: "中止" },
  { value: "paused", label: "暂停" },
]

/** URL ?phase= 旧值 → 新状态筛选 value */
export const PHASE_QUERY_TO_STATUS_FILTER: Record<string, string> = {
  completed: "success",
  failed: "aborted",
  paused: "paused",
  scanning: "running",
  packaging: "running",
  splitting: "running",
  preparing: "running",
  writing: "running",
  verifying: "running",
  pending: "running",
  idle: "running",
  finished: "finished",
  running: "running",
  success: "success",
  warning: "warning",
  aborted: "aborted",
}

/** 中心库 status 字符串 → 源 status 数字（按 task_type 反查） */
const STATUS_STRING_TO_NUM_0_2_3: Record<string, number> = {
  burn_success: 0,
  data_preparing: 1,
  cancelled: 2,
  restful_ready: 3,
  video_project_added: 4,
  video_download_ready: 5,
  ready: 6,
  remote_backup_created: 7,
  burn_failed: 10,
  s3_data_preparing: 13,
  make_task_done_backup_running: 19,
  paused: 20,
  no_file_changed: 21,
  make_task_scan_started: 22,
  make_task_scan_unfinished: 23,
  jdf_generated: 29,
}

const STATUS_STRING_TO_NUM_1: Record<string, number> = {
  download_success: 0,
  restore_started: 1,
  restful_ready: 3,
  read_from_disc_done: 6,
  read_from_disc_failed: 7,
  reading_from_disc: 9,
  read_failed: 10,
  restore_warning: 11,
  paused: 20,
}

/** 全类型共用的终态英文码（同步层也可写入） */
const TERMINAL_STATUS_STRING_TO_NUM: Record<string, number> = {
  burn_success: 0,
  download_success: 0,
  success: 0,
  cancelled: 2,
  burn_failed: 10,
  read_failed: 10,
  restore_warning: 11,
  warning: 11,
  paused: 20,
}

/**
 * 源 tbl_task.status + task_type + task_mode → 业务列表中文状态
 * 对齐 formatTaskListStatus（不含灾备环境下 status=10→警告 的环境分支，总控固定「中止」）
 */
export function formatTaskStatusLabel(
  status: number,
  taskType: number | null | undefined,
  taskMode: number | null | undefined,
): string {
  const type = taskType ?? -1
  const mode = taskMode ?? 0

  if (status === 0) return "成功"
  if (status === 10) return "中止"
  if (status === 11) return "警告"

  if (![0, 10, 11, 20].includes(status)) {
    if (type === 8) {
      if (status === 6) return "等待中"
      if (status === 19) return "封包中"
      if (status === 22) {
        return (
          ({
            9: "分盘中",
            10: "扫描中",
            11: "扫描中",
            12: "边扫描边封包中",
          } as Record<number, string>)[mode] ?? "正在运行中"
        )
      }
    }
    if (type === 0 && mode === 5 && status === 19) return "待确认"
    return "正在运行中"
  }

  if (status === 20) return "暂停"
  return String(status)
}

/** 从中心库 unified_tasks.status 反解源 status 数字 */
export function resolveNumericTaskStatus(
  unifiedStatus: string,
  unifiedTaskType: string,
): number | null {
  const unknown = /^unknown_(\d+)_(\d+)$/.exec(unifiedStatus)
  if (unknown) return parseInt(unknown[2], 10)

  if (unifiedStatus in TERMINAL_STATUS_STRING_TO_NUM) {
    return TERMINAL_STATUS_STRING_TO_NUM[unifiedStatus]
  }

  const taskType = resolveNumericTaskType(unifiedTaskType)
  if (taskType === 1) {
    return STATUS_STRING_TO_NUM_1[unifiedStatus] ?? null
  }
  if (taskType === 0 || taskType === 2 || taskType === 3 || taskType === 8) {
    return STATUS_STRING_TO_NUM_0_2_3[unifiedStatus] ?? null
  }
  return STATUS_STRING_TO_NUM_0_2_3[unifiedStatus] ?? null
}

export function formatTaskStatusLabelFromUnified(
  unifiedTaskType: string,
  unifiedStatus: string,
  taskMode: number | null | undefined,
): string {
  const taskType = resolveNumericTaskType(unifiedTaskType)
  const status = resolveNumericTaskStatus(unifiedStatus, unifiedTaskType)
  if (status == null) {
    // 无法反解时：paused 等已覆盖；其余按运行中，避免「空闲」
    if (unifiedStatus === "paused") return "暂停"
    if (
      unifiedStatus === "burn_success" ||
      unifiedStatus === "download_success" ||
      unifiedStatus === "success" ||
      unifiedStatus === "no_file_changed" ||
      unifiedStatus === "read_from_disc_done"
    ) {
      return "成功"
    }
    if (
      unifiedStatus === "burn_failed" ||
      unifiedStatus === "read_failed" ||
      unifiedStatus === "read_from_disc_failed"
    ) {
      return "中止"
    }
    if (unifiedStatus === "cancelled") return "正在运行中"
    if (unifiedStatus === "restore_warning" || unifiedStatus === "warning") return "警告"
    return "正在运行中"
  }
  return formatTaskStatusLabel(status, taskType, taskMode)
}

/** 盘聚合（可选）：用于备份/刻录粗阶段推断，避免分盘中 burn_success=1 误判为已刻 */
export type TaskDiscPhaseHint = {
  packageCount?: number | null
  successCount?: number | null
}

/**
 * 业务状态 → 总控 phase（步骤条/筛选）；未知运行中用 pending，不用 idle。
 * 备份/刻录族（type 0/2/3）粗进度：开始 → 准备 → 分盘 → 刻录 → 结束。
 * 分盘中 disc 行 burn_success 常全为 1，仅在进入刻录态或已有未刻盘时才把 burn_success=1 当已刻。
 */
export function resolveTaskPhaseFromBusiness(
  status: number | null,
  taskType: number | null,
  taskMode: number | null | undefined,
  unifiedStatusFallback?: string,
  disc?: TaskDiscPhaseHint,
): TaskPhase {
  if (status === 0) return "completed"
  if (status === 10 || status === 11) return "failed"
  if (status === 20) return "paused"

  // 封包任务：保留扫描/分盘/封包细阶段
  if (status != null && taskType === 8) {
    if (status === 6) return "pending"
    if (status === 19) return "packaging"
    if (status === 22) {
      if (taskMode === 9) return "splitting"
      if (taskMode === 10 || taskMode === 11) return "scanning"
      if (taskMode === 12) return "packaging"
      return "scanning"
    }
  }

  const isBurnFamily = taskType === 0 || taskType === 2 || taskType === 3
  if (isBurnFamily && status != null) {
    if (status === 19 && (taskMode ?? 0) === 5) return "preparing"
    if (status === 1 || status === 13) return "preparing"
    // 就绪/下载等待类 → 开始
    if (status === 3 || status === 4 || status === 5 || status === 6 || status === 7) return "pending"

    const pkg = disc?.packageCount
    const ok = disc?.successCount
    const hasDiscs = pkg != null && pkg > 0
    const allMarkedOne = hasDiscs && ok != null && ok === pkg
    const someUnburned = hasDiscs && ok != null && ok < pkg

    // 明确刻录相关 status，或分盘结束后已有未刻盘 → 刻录
    if (status === 9 || status === 19) return "writing"
    if (someUnburned) return "writing"

    // 有盘且全部 burn_success=1、又非明确刻录 status → 分盘中（业务分盘期标记）
    if (allMarkedOne) return "splitting"
    if (hasDiscs) return "splitting"

    if (status === 22 || status === 23) return "preparing"
    if (![0, 10, 11, 20].includes(status)) return "preparing"
  }

  if (status === 19 && taskType === 0 && (taskMode ?? 0) === 5) return "preparing"
  if (status === 1 || status === 13) return "preparing"
  if (status === 22 || status === 23) return "scanning"
  if (status === 9 || status === 19) return "writing"

  if (status != null && ![0, 10, 11, 20].includes(status)) return "pending"

  // 无法反解数字时，用已有英文码粗分；绝不回 idle
  const s = unifiedStatusFallback ?? ""
  if (s === "paused") return "paused"
  if (s === "burn_success" || s === "download_success" || s === "no_file_changed" || s === "read_from_disc_done") {
    return "completed"
  }
  if (
    s === "burn_failed" ||
    s === "read_failed" ||
    s === "cancelled" ||
    s === "restore_warning" ||
    s === "read_from_disc_failed"
  ) {
    return "failed"
  }
  if (s.includes("scan")) return "scanning"
  if (s.includes("prepar")) return "preparing"
  return "pending"
}

/** 把遗留细阶段折叠进备份类五步流程，便于步骤条 indexOf */
export function normalizePhaseForProgressFlow(phase: TaskPhase, taskType: string): TaskPhase {
  const fiveStep = taskType === "backup" || taskType === "other" || taskType === "restore" || taskType === "migrate"
  if (!fiveStep) return phase
  if (phase === "scanning") return "preparing"
  if (phase === "packaging" || phase === "verifying") return "writing"
  if (phase === "idle") return "pending"
  return phase
}

export function resolveTaskStatusFromBusiness(status: number | null, unifiedStatusFallback?: string): TaskStatus {
  if (status === 0) return "completed"
  if (status === 10 || status === 11) return "failed"
  if (status === 20) return "paused"
  if (status != null && ![0, 10, 11, 20].includes(status)) return "running"

  const s = unifiedStatusFallback ?? ""
  if (s === "paused") return "paused"
  if (s === "burn_success" || s === "download_success" || s === "no_file_changed" || s === "read_from_disc_done") {
    return "completed"
  }
  if (
    s === "burn_failed" ||
    s === "read_failed" ||
    s === "cancelled" ||
    s === "restore_warning" ||
    s === "read_from_disc_failed"
  ) {
    return "failed"
  }
  return "running"
}

/** 列表 Badge 颜色：按业务文案粗分 */
export function taskStatusLabelColorClass(label: string): string {
  if (label === "成功") return "bg-emerald-100 text-emerald-700"
  if (label === "暂停") return "bg-amber-100 text-amber-700"
  if (label === "警告" || label === "中止") return "bg-red-100 text-red-700"
  if (
    label === "扫描中" ||
    label === "封包中" ||
    label === "分盘中" ||
    label === "边扫描边封包中" ||
    label === "等待中" ||
    label === "待确认" ||
    label === "正在运行中"
  ) {
    return "bg-blue-100 text-blue-700"
  }
  return "bg-slate-100 text-slate-600"
}

export function buildTaskStatusFilterSql(
  filterValue: string,
  paramIndex: number,
): { sql: string; params: unknown[]; nextIndex: number } | null {
  if (!filterValue || filterValue === "all") return null

  const result = (sql: string, params: unknown[] = []) => ({
    sql,
    params,
    nextIndex: paramIndex + params.length,
  })

  switch (filterValue) {
    case "success":
      return result(
        `(status IN ('burn_success','download_success','success','no_file_changed','read_from_disc_done') OR status ~ '^unknown_[0-9]+_0$')`,
      )
    case "aborted":
    case "failed":
      return result(
        `(status IN ('burn_failed','read_failed','read_from_disc_failed') OR status ~ '^unknown_[0-9]+_10$')`,
      )
    case "warning":
      return result(
        `(status IN ('restore_warning','warning') OR status ~ '^unknown_[0-9]+_11$')`,
      )
    case "paused":
    case "pause":
      return result(
        `(status = 'paused' OR status ~ '^unknown_[0-9]+_20$')`,
      )
    case "finished":
      // 已经结束 = 成功 + 中止 + 警告（不含暂停）
      return result(
        `(status IN (
          'burn_success','download_success','success','no_file_changed','read_from_disc_done',
          'burn_failed','read_failed','read_from_disc_failed','restore_warning','warning'
        ) OR status ~ '^unknown_[0-9]+_(0|10|11)$')`,
      )
    case "waiting":
      return result(
        `((task_type = 'package' AND (status = 'ready' OR status ~ '^unknown_8_6$')) OR status IN ('ready','remote_backup_created','restful_ready','jdf_generated'))`,
      )
    case "packaging":
      return result(
        `(task_type = 'package' AND (status = 'make_task_done_backup_running' OR status ~ '^unknown_8_19$'))`,
      )
    case "scanning":
      return result(
        `((task_type = 'package' AND task_mode IN (10,11) AND (status = 'make_task_scan_started' OR status ~ '^unknown_8_22$')) OR status IN ('make_task_scan_started','make_task_scan_unfinished'))`,
      )
    case "splitting":
      return result(
        `(task_type = 'package' AND task_mode = 9 AND (status = 'make_task_scan_started' OR status ~ '^unknown_8_22$'))`,
      )
    case "scan_packaging":
      return result(
        `(task_type = 'package' AND task_mode = 12 AND (status = 'make_task_scan_started' OR status ~ '^unknown_8_22$'))`,
      )
    case "confirming":
      return result(
        `(task_type = 'backup' AND task_mode = 5 AND (status = 'make_task_done_backup_running' OR status ~ '^unknown_0_19$'))`,
      )
    case "running":
      return result(
        `(status NOT IN (
          'burn_success','download_success','success','no_file_changed','read_from_disc_done',
          'burn_failed','read_failed','read_from_disc_failed','restore_warning','warning','paused'
        ) AND status !~ '^unknown_[0-9]+_(0|10|11|20)$')`,
      )
    default:
      return null
  }
}

