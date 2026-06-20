/**
 * lib/control/task-create.ts
 * Sprint R.58 — center-side service for creating station tasks via the
 * control command queue. The command is consumed by Site Agent which
 * inserts a real row into the station `tbl_task`.
 *
 * This service does NOT write `unified_tasks` directly. The center
 * `unified_tasks` is populated by the existing sync import after
 * Site Agent reports success and the next sync run picks up the new
 * row.
 */

import { createControlCommand } from "./control-command"
import { writeAudit } from "./audit"

export type CenterTaskType = "backup" | "restore"
export type CenterTaskSource = "center_ui" | "api"

export interface CenterTaskCreateInput {
  siteCode: string
  taskName: string
  taskType: CenterTaskType
  priority?: number
  source?: CenterTaskSource
  taskMode?: number
  actor?: string
  ip?: string
  fileRefs?: Array<{
    rootPath: string
    originalPath?: string
    itemName: string
    isFolder?: number
  }>
}

export interface CenterTaskCreateResult {
  commandId: string
  commandNo: string
  status: "queued"
  message: string
}

const TASK_TYPE_TO_STATION: Record<CenterTaskType, number> = {
  backup: 0, // tbl_task.task_type 0 = 备份
  restore: 1, // tbl_task.task_type 1 = 恢复
}

export async function createCenterTaskCommand(
  input: CenterTaskCreateInput
): Promise<CenterTaskCreateResult> {
  if (!input.taskName || !input.siteCode) {
    throw new Error("siteCode and taskName are required")
  }
  if (!(input.taskType in TASK_TYPE_TO_STATION)) {
    throw new Error(`unsupported taskType: ${input.taskType}`)
  }
  const stationTaskType = TASK_TYPE_TO_STATION[input.taskType]

  const command = await createControlCommand({
    sourceSiteId: input.siteCode,
    commandType: "task_create",
    targetType: "task",
    targetId: input.taskName,
    payload: {
      taskName: input.taskName,
      taskType: stationTaskType,
      taskMode: input.taskMode ?? (input.taskType === "restore" ? 0 : 0),
      priority: input.priority ?? 0,
      source: input.source ?? "center_ui",
      fileRefs: input.fileRefs ?? [],
    },
    requestedBy: input.actor ?? null,
    requestedIp: input.ip ?? "unknown",
  })

  await writeAudit({
    action: "task_create_queued",
    targetTable: "control_command",
    targetId: command.id,
    after: {
      commandNo: command.commandNo,
      siteCode: input.siteCode,
      taskName: input.taskName,
      taskType: input.taskType,
      stationTaskType,
    },
    actor: input.actor ?? "admin",
    siteCode: input.siteCode,
    result: "success",
  })

  return {
    commandId: command.id,
    commandNo: command.commandNo,
    status: "queued",
    message: "任务创建命令已提交到控制队列, 等待站点 Agent 执行",
  }
}
