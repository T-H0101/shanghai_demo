/**
 * 日志检索页的有限枚举值定义
 * 数据源: databases/sprint-2c17 / sprint-4.5 / sprint-4.8 / sprint-r39 的 SQL CHECK 约束
 */

export const LOG_STATUS_OPTIONS_BY_TAB = {
  sync_package: [
    "success", "failed", "running", "pending", "completed",
    "matched", "mismatched", "synced",
  ],
  sync_table: [
    "success", "failed", "running", "pending", "completed",
    "matched", "mismatched", "synced",
  ],
  sync_scheduler: ["running", "completed", "failed", "warning"],
  sync_consistency: ["matched", "mismatched", "warning"],
  control: [
    "pending", "pulled", "running", "success", "failed",
    "cancelled", "unsupported", "dry_run_success",
  ],
  audit: ["success", "failed", "warning"],
  login_audit: ["success", "failed"],
} as const

export type LogTabKey = keyof typeof LOG_STATUS_OPTIONS_BY_TAB

// command_type 来自 databases/sprint-r39/sync-command-types.sql
export const LOG_TASK_TYPE_OPTIONS = [
  { value: "task_pause", label: "暂停任务" },
  { value: "task_resume", label: "恢复任务" },
  { value: "task_reset", label: "重置任务" },
  { value: "task_create", label: "新建任务" },
  { value: "task_priority_restore", label: "优先级恢复" },
  { value: "inspect_start", label: "开始巡检" },
  { value: "recovery_start", label: "开始热恢复" },
  { value: "sync_full", label: "全量同步" },
  { value: "sync_incremental", label: "增量同步" },
] as const