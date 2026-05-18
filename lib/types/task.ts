import type { Priority, TaskStatus } from "./common"

export type TaskType = "backup" | "restore" | "inspect" | "burn"

export interface TaskItem {
  id: string
  name: string
  type: TaskType
  status: TaskStatus
  priority: Priority
  progress: number
  siteName: string
  siteCode: string
  operator: string
  startedAt: string
  updatedAt: string
  speed?: string
  errorMessage?: string
  discNo?: string
  estimatedEnd?: string
}

export interface TaskLogEntry {
  id: string
  taskId: string
  timestamp: string
  level: "info" | "warn" | "error"
  message: string
}

export interface TaskStats {
  total: number
  running: number
  paused: number
  failed: number
  completedToday: number
}

export interface TaskAlert {
  id: string
  taskName: string
  level: "critical" | "warning"
  message: string
  time: string
}
