/** checking: 列表已返回、TCP 探测尚未完成（异步探测中） */
export type OnlineStatus = "online" | "offline" | "checking"
export type SyncStatus = "synced" | "syncing" | "failed" | "pending"
export type TaskStatus = "pending_dispatch" | "dispatched" | "running" | "paused" | "completed" | "failed" | "queued" | "cancelled"
export type Priority = "critical" | "high" | "normal" | "low"
export type AccountStatus = "active" | "locked" | "disabled"
export type LogResult = "success" | "failure" | "warning"

export interface StatItem {
  label: string
  value: string | number
  unit?: string
  trend?: string
  color?: string
}
