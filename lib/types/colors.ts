/**
 * Sprint UI-Tweaks · 全站状态色 source of truth
 *
 * 设计原则:
 * - 100 / 700 组合是基础, 50/900/30 是 hover/dark 变体
 * - 同一状态 (success/failed/warning) 全站一致
 * - 不重复定义, 所有页面共享
 */

export const LOG_LEVEL_COLORS = {
  info:  "bg-slate-50 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  warn:  "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  error: "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300",
} as const

export const TASK_STATUS_COLORS = {
  running:          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  completed:        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed:           "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  paused:           "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  pending_dispatch: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  dispatched:       "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  queued:           "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  cancelled:        "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
} as const

export const TASK_TYPE_COLORS = {
  full_scan:          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  incremental_scan:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  full_package:       "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  incremental_package:"bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  backup:             "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  restore:            "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  migrate:            "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  device_scan:        "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  raid_check:         "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  other:              "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
} as const

export const VOLUME_STATUS_COLORS = {
  online:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  offline:   "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  archiving: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  error:     "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  warning:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
} as const

export const SYNC_STATUS_COLORS = {
  success:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed:     "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  partial:    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  running:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  pending:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  matched:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  mismatched: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
} as const