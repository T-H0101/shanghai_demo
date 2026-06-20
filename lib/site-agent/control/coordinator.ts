import type {
  AgentControlCommand,
  ControlExecution,
  PauseState,
  PendingControlResult,
  SiteActionResult,
} from "./types"
import type { ControlTransport } from "./transport"

export type { ControlTransport } from "./transport"

export interface AgentControlStore {
  loadExecution(commandId: string): Promise<ControlExecution | null>
  saveExecution(
    commandId: string,
    execution: ControlExecution
  ): Promise<void>
  enqueueResult(commandId: string, result: SiteActionResult): Promise<void>
  listPendingResults(): Promise<PendingControlResult[]>
  removePendingResult(commandId: string): Promise<void>
  loadPauseState(targetId: string): Promise<PauseState | null>
  savePauseState(targetId: string, state: PauseState): Promise<void>
  clearPauseState(targetId: string): Promise<void>
}

export interface SiteActionAdapter {
  execute(
    command: AgentControlCommand,
    pauseState?: PauseState
  ): Promise<SiteActionResult>
}

export interface ControlCoordinatorOptions {
  store: AgentControlStore
  transport: ControlTransport
  adapter: SiteActionAdapter
  resync: (input?: { includeSnapshots?: boolean }) => Promise<{
    replayed: number
    tableCount: number
    recordCount: number
    lastSyncAt: string | null
  }>
  now?: () => Date
}

export interface ControlCycleResult {
  replayed: number
  polled: number
  executed: number
  finalized: number
}

export class ControlCoordinator {
  private readonly now: () => Date

  constructor(private readonly options: ControlCoordinatorOptions) {
    this.now = options.now ?? (() => new Date())
  }

  async runOnce(limit: number): Promise<ControlCycleResult> {
    const replayed = await this.replayPending()
    const commands = await this.options.transport.poll(limit)
    let executed = 0
    let finalized = replayed

    for (const command of commands) {
      await this.options.transport.ack(command.id)
      const storedExecution = await this.options.store.loadExecution(command.id)
      let result = storedExecution?.result ?? null

      if (!result) {
        if (command.commandType === "sync_full" || command.commandType === "sync_incremental") {
          const syncType = command.commandType === "sync_full" ? "full" : "incremental"
          const syncResult = await this.options.resync({
            includeSnapshots: syncType === "full",
          })
          result = {
            status: "success",
            before: null,
            after: null,
            sync: {
              type: syncType,
              replayed: syncResult.replayed,
              tableCount: syncResult.tableCount,
              recordCount: syncResult.recordCount,
              lastSyncAt: syncResult.lastSyncAt,
              protocol:
                (command.payload as { protocol?: string } | null)?.protocol ??
                "json_package",
              transport:
                (command.payload as { transport?: string } | null)?.transport ??
                "agent_poll",
            },
          }
          executed++
        } else if (
          command.commandType !== "task_pause" &&
          command.commandType !== "task_resume" &&
          command.commandType !== "task_create"
        ) {
          result = {
            status: "unsupported",
            before: null,
            after: null,
            blocker: "unsupported_command_type",
            reason: `Site Agent does not implement ${command.commandType}`,
          }
        } else if (command.commandType === "task_create") {
          // R.58: route task_create through task-create-adapter
          const pl = command.payload as {
            taskName?: string
            taskType?: number
            taskMode?: number
            priority?: number
          } | null
          if (!pl?.taskName || typeof pl.taskType !== "number") {
            result = {
              status: "failed",
              before: null,
              after: null,
              blocker: "task_create_payload_invalid",
            }
          } else {
            const { executeTaskCreate } = await import(
              "./task-create-adapter"
            )
            const createResult = await executeTaskCreate({
              taskName: pl.taskName,
              taskType: pl.taskType,
              taskMode: pl.taskMode,
              priority: pl.priority,
              siteCode: command.sourceSiteId,
            })
            if (createResult.status === "success") {
              result = {
                status: "success",
                before: null,
                after: {
                  id: createResult.taskId ?? "",
                  taskId: createResult.taskId ?? null,
                  taskName: pl.taskName,
                  taskType: pl.taskType,
                  status: 0,
                  updateDt: new Date().toISOString(),
                },
              }
              executed++
            } else {
              result = {
                status: "failed",
                before: null,
                after: null,
                blocker: createResult.blocker ?? createResult.reason ?? "task_create_failed",
              }
            }
          }
        } else {
          const pauseState =
            command.commandType === "task_resume"
              ? await this.options.store.loadPauseState(command.targetId)
              : null
          result = await this.options.adapter.execute(
            command,
            pauseState ?? undefined
          )
          executed++
        }

        await this.options.store.saveExecution(command.id, {
          command,
          executedAt: this.now().toISOString(),
          result,
        })

        if (
          command.commandType === "task_pause" &&
          result.status === "success" &&
          Number.isInteger(result.previousStatus)
        ) {
          await this.options.store.savePauseState(command.targetId, {
            targetId: command.targetId,
            previousStatus: result.previousStatus!,
            pausedAt: this.now().toISOString(),
          })
        }
      }

      await this.options.store.enqueueResult(command.id, result)
      if (
        result.status === "success" &&
        (command.commandType === "task_pause" || command.commandType === "task_resume")
      ) {
        await this.options.resync({ includeSnapshots: false })
      }
      await this.options.transport.result(command.id, result)
      await this.options.store.removePendingResult(command.id)
      finalized++

      if (result.status === "success") {
        if (command.commandType === "task_resume") {
          await this.options.store.clearPauseState(command.targetId)
        }
      }
    }

    return {
      replayed,
      polled: commands.length,
      executed,
      finalized,
    }
  }

  private async replayPending(): Promise<number> {
    const pending = await this.options.store.listPendingResults()
    for (const entry of pending) {
      if (
        entry.result.status === "success" &&
        !entry.result.sync
      ) {
        await this.options.resync({ includeSnapshots: false })
      }
      await this.options.transport.result(entry.commandId, entry.result)
      await this.options.store.removePendingResult(entry.commandId)
    }
    return pending.length
  }
}
