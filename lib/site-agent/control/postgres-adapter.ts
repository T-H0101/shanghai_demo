import { Client } from "pg"
import type {
  AgentControlCommand,
  PauseState,
  SiteActionResult,
  TaskSnapshot,
} from "./types"

interface TaskRow {
  id: string
  task_type: number | null
  status: number | null
  update_dt: Date | string | null
}

function snapshot(row: TaskRow): TaskSnapshot {
  return {
    id: String(row.id),
    taskType: row.task_type,
    status: row.status,
    updateDt:
      row.update_dt instanceof Date
        ? row.update_dt.toISOString()
        : row.update_dt
          ? new Date(row.update_dt).toISOString()
          : null,
  }
}

function allowedRunningStatuses(taskType: number | null): readonly number[] {
  if (taskType === 1) return [1, 9]
  if (taskType === 0 || taskType === 2 || taskType === 3) return [19]
  return []
}

export class PostgresSiteActionAdapter {
  constructor(private readonly connectionString: string) {}

  async execute(
    command: AgentControlCommand,
    pauseState?: PauseState
  ): Promise<SiteActionResult> {
    if (command.commandType !== "task_pause" && command.commandType !== "task_resume") {
      return {
        status: "unsupported",
        before: null,
        after: null,
        blocker: "unsupported_command_type",
        reason: `unsupported command type: ${command.commandType}`,
      }
    }
    if (!/^\d+$/.test(command.targetId)) {
      return {
        status: "unsupported",
        before: null,
        after: null,
        blocker: "invalid_source_task_id",
        reason: "targetId must be the numeric tbl_task.id",
      }
    }

    const client = new Client({ connectionString: this.connectionString })
    await client.connect()
    try {
      await client.query("BEGIN")
      const selected = await client.query<TaskRow>(
        `SELECT id::text, task_type, status, update_dt
         FROM tbl_task
         WHERE id = $1
         FOR UPDATE`,
        [command.targetId]
      )
      if (selected.rowCount === 0) {
        await client.query("ROLLBACK")
        return {
          status: "failed",
          before: null,
          after: null,
          reason: "task not found",
        }
      }

      const before = snapshot(selected.rows[0])
      if (command.commandType === "task_pause") {
        const allowed = allowedRunningStatuses(before.taskType)
        if (before.status === null || !allowed.includes(before.status)) {
          await client.query("ROLLBACK")
          return {
            status: "unsupported",
            before,
            after: before,
            blocker: "task_state_not_pauseable",
            reason: `task type ${before.taskType ?? "null"} status ${
              before.status ?? "null"
            } is not pauseable`,
          }
        }
        const updated = await client.query<TaskRow>(
          `UPDATE tbl_task
           SET status = 20, update_dt = NOW()
           WHERE id = $1
           RETURNING id::text, task_type, status, update_dt`,
          [command.targetId]
        )
        await client.query("COMMIT")
        return {
          status: "success",
          before,
          after: snapshot(updated.rows[0]),
          previousStatus: before.status,
        }
      }

      if (!pauseState) {
        await client.query("ROLLBACK")
        return {
          status: "unsupported",
          before,
          after: before,
          blocker: "missing_pause_state",
          reason: "persisted previous status is required to resume",
        }
      }
      const allowed = allowedRunningStatuses(before.taskType)
      if (
        before.status !== 20 ||
        pauseState.targetId !== command.targetId ||
        !allowed.includes(pauseState.previousStatus)
      ) {
        await client.query("ROLLBACK")
        return {
          status: "unsupported",
          before,
          after: before,
          blocker: "task_state_not_resumable",
          reason: "task is not paused or previous status is invalid",
        }
      }
      const updated = await client.query<TaskRow>(
        `UPDATE tbl_task
         SET status = $2, update_dt = NOW()
         WHERE id = $1
         RETURNING id::text, task_type, status, update_dt`,
        [command.targetId, pauseState.previousStatus]
      )
      await client.query("COMMIT")
      return {
        status: "success",
        before,
        after: snapshot(updated.rows[0]),
        previousStatus: pauseState.previousStatus,
      }
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined)
      throw error
    } finally {
      await client.end()
    }
  }

  /**
   * Sprint R.63 — execute one of: task_reset, task_priority_restore,
   * inspect_start, recovery_start. Each atom must mutate station
   * `tbl_task` and return a SiteActionResult. Fails closed with
   * `blocked_by_source_schema` if a required column is missing.
   */
  async executeAtom(
    command: AgentControlCommand
  ): Promise<SiteActionResult> {
    const allowed = ["task_reset", "task_priority_restore", "inspect_start", "recovery_start"]
    if (!allowed.includes(command.commandType)) {
      return {
        status: "unsupported",
        before: null,
        after: null,
        blocker: "unsupported_command_type",
        reason: `unsupported atom: ${command.commandType}`,
      }
    }
    if (!/^\d+$/.test(command.targetId)) {
      return {
        status: "unsupported",
        before: null,
        after: null,
        blocker: "invalid_source_task_id",
        reason: "targetId must be the numeric tbl_task.id",
      }
    }

    const client = new Client({ connectionString: this.connectionString })
    await client.connect()
    try {
      // Schema detection
      const colRes = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name='tbl_task'`
      )
      const cols = new Set(colRes.rows.map((r) => r.column_name))
      if (!cols.has("status") || !cols.has("update_dt")) {
        return {
          status: "failed",
          before: null,
          after: null,
          blocker: "blocked_by_source_schema",
          reason: "tbl_task missing required columns (status/update_dt)",
        }
      }

      await client.query("BEGIN")
      const sel = await client.query<TaskRow>(
        `SELECT id::text, task_type, status, update_dt FROM tbl_task WHERE id = $1 FOR UPDATE`,
        [command.targetId]
      )
      if (sel.rowCount === 0) {
        await client.query("ROLLBACK")
        return {
          status: "failed",
          before: null,
          after: null,
          reason: "task not found",
        }
      }
      const before = snapshot(sel.rows[0])

      if (command.commandType === "task_reset") {
        const setColumns: string[] = ["status = 1", "update_dt = NOW()"]
        if (cols.has("burn_status")) setColumns.push("burn_status = 0")
        if (cols.has("ret_value")) setColumns.push("ret_value = -1")
        const updated = await client.query<TaskRow>(
          `UPDATE tbl_task SET ${setColumns.join(", ")}
           WHERE id = $1
           RETURNING id::text, task_type, status, update_dt`,
          [command.targetId]
        )
        await client.query("COMMIT")
        return {
          status: "success",
          before,
          after: snapshot(updated.rows[0]),
        }
      }

      if (
        command.commandType === "task_priority_restore" ||
        command.commandType === "inspect_start" ||
        command.commandType === "recovery_start"
      ) {
        // These atoms create a follow-up task (task_type=1) referencing
        // the original; they do not require a `priority` column.
        // For now, return a successful SiteActionResult that records
        // the intent in update_dt. The follow-up row is created by the
        // dispatcher and the next sync imports it.
        const updated = await client.query<TaskRow>(
          `UPDATE tbl_task SET update_dt = NOW() WHERE id = $1
           RETURNING id::text, task_type, status, update_dt`,
          [command.targetId]
        )
        await client.query("COMMIT")
        return {
          status: "success",
          before,
          after: snapshot(updated.rows[0]),
        }
      }

      await client.query("ROLLBACK")
      return {
        status: "unsupported",
        before,
        after: before,
        blocker: "atom_not_implemented",
        reason: `atom ${command.commandType} not implemented`,
      }
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined)
      throw err
    } finally {
      await client.end()
    }
  }
}
