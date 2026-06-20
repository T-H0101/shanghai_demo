/**
 * lib/site-agent/control/task-create-adapter.ts
 * Sprint R.58/R.62 — station-side adapter for center-created tasks.
 *
 * 1. INSERT real row into station `tbl_task`
 * 2. Discover a station relation table (best-effort) and write a
 *    task->item relation row. Discovery order:
 *      - tbl_task_items
 *      - tbl_task_folder
 *      - tbl_task_files
 *      - tbl_file_path_restore
 *      - tbl_file_recover_info
 *
 * Fails closed with `blocked_by_source_schema` if neither `tbl_task`
 * nor any relation table is available.
 */

import { Client } from "pg"

export interface TaskCreateInput {
  taskName: string
  taskType: number
  taskMode?: number
  priority?: number
  siteCode: string
  fileRefs?: Array<{
    rootPath: string
    originalPath?: string
    itemName: string
    isFolder?: number
  }>
}

export interface TaskCreateResult {
  status: "success" | "failed" | "blocked_by_source_schema"
  taskId?: string
  relationTable?: string
  relationRows?: number
  blocker?: string
  reason?: string
}

const REQUIRED_TASK_COLUMNS = ["task_name", "status", "task_type", "create_dt", "update_dt"]
const RELATION_CANDIDATES = [
  {
    name: "tbl_task_items",
    columns: ["task_id", "root_path", "item_name", "volume_id", "lib_parent_folder"],
  },
  {
    name: "tbl_task_folder",
    columns: ["task_id", "folder_path", "folder_name", "volume_id"],
  },
  {
    name: "tbl_task_files",
    columns: ["task_id", "file_path", "file_name", "volume_id"],
  },
  {
    name: "tbl_file_path_restore",
    columns: ["task_id", "root_path", "file_path"],
  },
  {
    name: "tbl_file_recover_info",
    columns: ["task_id", "file_path"],
  },
] as const

async function tableColumns(
  client: Client,
  table: string
): Promise<Set<string>> {
  const r = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1`,
    [table]
  )
  return new Set(r.rows.map((row) => row.column_name))
}

async function discoverRelationTable(
  client: Client
): Promise<{ name: string; columns: readonly string[] } | null> {
  for (const candidate of RELATION_CANDIDATES) {
    try {
      const cols = await tableColumns(client, candidate.name)
      if (cols.size === 0) continue
      const allPresent = candidate.columns.every((c) => cols.has(c))
      if (allPresent) {
        return candidate
      }
    } catch {
      // table does not exist
    }
  }
  return null
}

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

    // Schema detection: required columns on tbl_task
    const taskCols = await tableColumns(client, "tbl_task")
    const missing = REQUIRED_TASK_COLUMNS.filter((c) => !taskCols.has(c))
    if (missing.length > 0) {
      return {
        status: "blocked_by_source_schema",
        blocker: `tbl_task missing_columns: ${missing.join(",")}`,
      }
    }

    // Insert task
    const ins = await client.query<{ id: string }>(
      `INSERT INTO tbl_task (task_name, status, task_type, task_mode, create_dt, update_dt)
       VALUES ($1, 0, $2, $3, NOW(), NOW())
       RETURNING id`,
      [input.taskName, input.taskType, input.taskMode ?? 0]
    )
    const taskId = ins.rows[0]?.id
    if (!taskId) {
      return {
        status: "failed",
        reason: "task_insert_returned_no_id",
      }
    }

    if (!input.fileRefs || input.fileRefs.length === 0) {
      return {
        status: "success",
        taskId,
        relationRows: 0,
      }
    }

    // Discover relation table
    const rel = await discoverRelationTable(client)
    if (!rel) {
      return {
        status: "blocked_by_source_schema",
        taskId,
        blocker: "no_relation_table_found",
        reason: `none of [${RELATION_CANDIDATES.map((c) => c.name).join(", ")}] available`,
      }
    }

    // Insert relation rows (best-effort, with columns that exist)
    const cols = await tableColumns(client, rel.name)
    let inserted = 0
    for (const ref of input.fileRefs) {
      const colNames: string[] = []
      const colValues: unknown[] = []
      let p = 1
      if (cols.has("task_id")) {
        colNames.push("task_id")
        colValues.push(taskId)
      }
      const rootPath = ref.rootPath
      const originalPath = ref.originalPath
      const itemName = ref.itemName
      if (cols.has("root_path") && rootPath) {
        colNames.push("root_path")
        colValues.push(rootPath)
        p += 1
      }
      if (cols.has("folder_path") && rootPath) {
        colNames.push("folder_path")
        colValues.push(rootPath)
        p += 1
      }
      if (cols.has("file_path") && (originalPath ?? rootPath)) {
        colNames.push("file_path")
        colValues.push(originalPath ?? rootPath)
        p += 1
      }
      if (cols.has("item_name") && itemName) {
        colNames.push("item_name")
        colValues.push(itemName)
        p += 1
      }
      if (cols.has("folder_name") && itemName) {
        colNames.push("folder_name")
        colValues.push(itemName)
        p += 1
      }
      if (cols.has("file_name") && itemName) {
        colNames.push("file_name")
        colValues.push(itemName)
        p += 1
      }
      if (cols.has("is_folder") && typeof ref.isFolder === "number") {
        colNames.push("is_folder")
        colValues.push(ref.isFolder)
        p += 1
      }
      if (colNames.length === 1 && colNames[0] === "task_id") {
        // bare task_id row; skip to avoid empty meaningful record
        continue
      }
      const placeholders = colNames.map((_, i) => `$${i + 1}`).join(", ")
      await client.query(
        `INSERT INTO ${rel.name} (${colNames.join(", ")}) VALUES (${placeholders})`,
        colValues
      )
      inserted += 1
    }

    return {
      status: "success",
      taskId,
      relationTable: rel.name,
      relationRows: inserted,
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
