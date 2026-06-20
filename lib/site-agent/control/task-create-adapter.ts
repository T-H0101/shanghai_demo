/**
 * lib/site-agent/control/task-create-adapter.ts
 * Sprint R.58 — station-side adapter that inserts a real row into
 * station `tbl_task` from a center `task_create` command.
 *
 * In production, this adapter connects to the station DB. In local
 * e2e / test mode, it uses the configured restore DB
 * (DATABASE_URL=...source_restore) to verify the insert.
 *
 * Fails closed with `blocked_by_source_schema` if the station schema
 * is missing required columns. Does not fake success.
 */

import { Client } from "pg"

export interface TaskCreateInput {
  taskName: string
  taskType: number
  taskMode?: number
  priority?: number
  siteCode: string
}

export interface TaskCreateResult {
  status: "success" | "failed" | "blocked_by_source_schema"
  taskId?: string
  blocker?: string
  reason?: string
}

const REQUIRED_COLUMNS = ["task_name", "status", "task_type", "create_dt", "update_dt"]

export async function executeTaskCreate(
  input: TaskCreateInput
): Promise<TaskCreateResult> {
  const url =
    process.env.SITE_DATABASE_URL ??
    process.env.SOURCE_DATABASE_URL ??
    process.env.SITE_RESTORE_DATABASE_URL
  if (!url) {
    return {
      status: "blocked_by_source_schema",
      blocker: "site_database_url_not_configured",
    }
  }
  const client = new Client({ connectionString: url })
  try {
    await client.connect()

    // Schema detection: required columns
    const colRes = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='tbl_task'`
    )
    const cols = new Set(colRes.rows.map((r) => r.column_name))
    const missing = REQUIRED_COLUMNS.filter((c) => !cols.has(c))
    if (missing.length > 0) {
      return {
        status: "blocked_by_source_schema",
        blocker: `missing_columns: ${missing.join(",")}`,
      }
    }

    const ins = await client.query<{ id: string }>(
      `INSERT INTO tbl_task (task_name, status, task_type, task_mode, create_dt, update_dt)
       VALUES ($1, 0, $2, $3, NOW(), NOW())
       RETURNING id`,
      [
        input.taskName,
        input.taskType,
        input.taskMode ?? 0,
      ]
    )
    return {
      status: "success",
      taskId: ins.rows[0]?.id,
    }
  } catch (err) {
    return {
      status: "failed",
      reason: err instanceof Error ? err.message : "unknown",
    }
  } finally {
    await client.end()
  }
}
