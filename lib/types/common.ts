export type OnlineStatus = "online" | "offline" | "degraded"
export type SyncStatus = "synced" | "syncing" | "failed" | "pending"
export type TaskStatus = "running" | "paused" | "completed" | "failed" | "queued" | "cancelled"
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
