export type SupportedControlType = "task_pause" | "task_resume"

export interface AgentControlCommand {
  id: string
  commandNo: string
  sourceSiteId: string
  commandType: string
  targetType: string
  targetId: string
  payload: Record<string, unknown>
}

export interface TaskSnapshot {
  id: string
  taskType: number | null
  status: number | null
  updateDt: string | null
}

export interface PauseState {
  targetId: string
  previousStatus: number
  pausedAt: string
}

export interface SiteActionResult {
  status: "success" | "failed" | "unsupported"
  before: TaskSnapshot | null
  after: TaskSnapshot | null
  previousStatus?: number
  blocker?: string
  reason?: string
}

export interface ControlExecution {
  command: AgentControlCommand
  executedAt: string
  result: SiteActionResult
}

export interface PendingControlResult {
  commandId: string
  result: SiteActionResult
}
