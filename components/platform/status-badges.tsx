import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { OnlineStatus, SyncStatus, TaskStatus, Priority, AccountStatus, LogResult } from "@/lib/types"

const onlineMap: Record<OnlineStatus, { label: string; className: string }> = {
  online: { label: "在线", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  offline: { label: "离线", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
}

const syncMap: Record<SyncStatus, { label: string; className: string }> = {
  synced: { label: "已同步", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  syncing: { label: "同步中", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  failed: { label: "同步失败", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  pending: { label: "待同步", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
}

const taskStatusMap: Record<TaskStatus, { label: string; className: string }> = {
  pending_dispatch: { label: "待下发", className: "text-purple-600 dark:text-purple-300" },
  dispatched: { label: "已下发", className: "text-violet-600 dark:text-violet-300" },
  running: { label: "运行中", className: "text-emerald-600 dark:text-emerald-300" },
  paused: { label: "已暂停", className: "text-amber-600 dark:text-amber-300" },
  completed: { label: "已完成", className: "text-slate-600 dark:text-slate-300" },
  failed: { label: "失败", className: "text-red-600 dark:text-red-300" },
  queued: { label: "排队中", className: "text-blue-600 dark:text-blue-300" },
  cancelled: { label: "已取消", className: "text-slate-400 dark:text-slate-500" },
}

const priorityMap: Record<Priority, { label: string; className: string }> = {
  critical: { label: "紧急", className: "bg-red-500 text-white" },
  high: { label: "高", className: "bg-orange-500 text-white" },
  normal: { label: "普通", className: "bg-blue-500 text-white" },
  low: { label: "低", className: "bg-slate-400 text-white" },
}

export function OnlineStatusBadge({ status }: { status: OnlineStatus }) {
  const s = onlineMap[status]
  if (!s) return null
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", s.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5 inline-block", status === "online" ? "bg-emerald-500" : status === "offline" ? "bg-red-500" : "bg-amber-500")} />
      {s.label}
    </Badge>
  )
}

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const s = syncMap[status]
  if (!s) return <Badge className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">未知</Badge>
  return <Badge className={cn("text-xs hover:opacity-90", s.className)}>{s.label}</Badge>
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const s = taskStatusMap[status]
  if (!s) return <span className="text-xs text-slate-500 dark:text-slate-400">未知</span>
  return <span className={cn("text-xs font-medium flex items-center gap-1", s.className)}>{s.label}</span>
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const s = priorityMap[priority]
  if (!s) return <Badge className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">未知</Badge>
  return <Badge className={cn("text-xs hover:opacity-90", s.className)}>{s.label}</Badge>
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const map = { active: "正常", locked: "已锁定", disabled: "已禁用" }
  const colors = { active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", locked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", disabled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" }
  return <Badge className={cn("text-xs", colors[status])}>{map[status]}</Badge>
}

export function LogResultBadge({ result }: { result: LogResult }) {
  const map = { success: "成功", failure: "失败", warning: "警告" }
  const colors = { success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", failure: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" }
  return <Badge className={cn("text-xs", colors[result])}>{map[result]}</Badge>
}