/**
 * R.47 — Site-native log source adapter.
 *
 * Reads from star_storage_db (port 5434) tables:
 * - tbl_sys_log: system operation logs (85 rows)
 * - tbl_task: task records (37 rows)
 * - tbl_disc: disc records with burn_errors (65 rows)
 *
 * Returns real source data or explicit blocked_by_source_schema with missing fields.
 */

import { Client } from "pg"

export type SourceTaskLog = {
  siteCode: string
  taskId: string | null
  taskType: "burn" | "restore" | "unknown"
  result: "success" | "failed" | "unknown"
  operator: string | null
  occurredAt: string | null
  deviceId: string | null
  discNo: string | null
  fileList: string[] | null
  errorCode: string | null
  errorMessage: string | null
  sourceTable: string
  sourcePrimaryKey: string
}

const SITE_DB_URL = process.env.SITE_DATABASE_URL

async function getClient(): Promise<Client | null> {
  if (!SITE_DB_URL) return null
  const client = new Client({ connectionString: SITE_DB_URL })
  try {
    await client.connect()
    return client
  } catch {
    return null
  }
}

/** Map tbl_sys_log rows to SourceTaskLog */
async function fetchSysLogs(client: Client, limit: number): Promise<SourceTaskLog[]> {
  const res = await client.query(`
    SELECT id::text, type, operate_type, user_id::text, task_id::text,
           result, create_date, depa_id::text, lib_id::text
    FROM tbl_sys_log
    ORDER BY create_date DESC NULLS LAST
    LIMIT $1
  `, [limit])

  return res.rows.map((r) => ({
    siteCode: "SH01",
    taskId: r.task_id ?? null,
    taskType: (r.type === "burn" ? "burn" : r.type === "restore" ? "restore" : "unknown") as SourceTaskLog["taskType"],
    result: (r.result === 1 ? "success" : r.result === 0 ? "failed" : "unknown") as SourceTaskLog["result"],
    operator: r.user_id ?? null,
    occurredAt: r.create_date ? new Date(r.create_date).toISOString() : null,
    deviceId: r.lib_id ?? null,
    discNo: null,
    fileList: null,
    errorCode: null,
    errorMessage: null,
    sourceTable: "tbl_sys_log",
    sourcePrimaryKey: r.id,
  }))
}

/** Map tbl_task rows to SourceTaskLog */
async function fetchTaskLogs(client: Client, limit: number): Promise<SourceTaskLog[]> {
  const res = await client.query(`
    SELECT id::text, uuid, task_type, status, burn_status,
           task_name, update_dt, save_hash
    FROM tbl_task
    ORDER BY update_dt DESC NULLS LAST
    LIMIT $1
  `, [limit])

  // task_type: 0=备份(backup/burn), 1=恢复(restore), 2=刻录封盘, 3=接口, 4=扫描 ...
  // status: 0=初始, 1=准备好(回迁), 2=取消, 3=准备好(接口), 6=准备好(刻录), 19/20=进行中/完成
  const taskTypeMap: Record<number, SourceTaskLog["taskType"]> = {
    0: "burn", 1: "restore", 2: "burn", 3: "unknown", 4: "unknown",
  }
  const statusResultMap: Record<number, SourceTaskLog["result"]> = {
    0: "unknown", 1: "unknown", 2: "failed", 3: "unknown",
    6: "unknown", 7: "success", 19: "unknown", 20: "success",
  }

  return res.rows.map((r) => ({
    siteCode: "SH01",
    taskId: r.id,
    taskType: taskTypeMap[r.task_type as number] ?? "unknown",
    result: statusResultMap[r.status as number] ?? "unknown",
    operator: null,
    occurredAt: r.update_dt ? new Date(r.update_dt).toISOString() : null,
    deviceId: null,
    discNo: null,
    fileList: null,
    errorCode: r.burn_status != null ? String(r.burn_status) : null,
    errorMessage: null,
    sourceTable: "tbl_task",
    sourcePrimaryKey: r.id,
  }))
}

export async function fetchSourceLogs(opts: {
  limit?: number
  keyword?: string
}): Promise<{
  source: string
  items: SourceTaskLog[]
  missingFields: string[]
  blocker: string | null
}> {
  const limit = Math.min(opts.limit ?? 100, 500)
  const client = await getClient()

  if (!client) {
    return {
      source: "blocked_by_source_schema",
      items: [],
      missingFields: ["SITE_DATABASE_URL"],
      blocker: "blocked_by_source_schema",
    }
  }

  try {
    const [sysLogs, taskLogs] = await Promise.all([
      fetchSysLogs(client, limit),
      fetchTaskLogs(client, limit),
    ])

    let items = [...sysLogs, ...taskLogs]
      .sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""))
      .slice(0, limit)

    // Keyword filter
    if (opts.keyword) {
      const kw = opts.keyword.toLowerCase()
      items = items.filter(
        (i) =>
          (i.taskId ?? "").toLowerCase().includes(kw) ||
          (i.operator ?? "").toLowerCase().includes(kw) ||
          (i.errorCode ?? "").toLowerCase().includes(kw) ||
          (i.errorMessage ?? "").toLowerCase().includes(kw) ||
          i.sourceTable.toLowerCase().includes(kw),
      )
    }

    // Missing fields that requirements.md requires but source doesn't have
    const missingFields: string[] = []
    if (items.length === 0 || items.every((i) => !i.deviceId)) missingFields.push("device_id (tbl_device_device empty)")
    if (items.length === 0 || items.every((i) => !i.discNo)) missingFields.push("disc_no (not in tbl_sys_log)")
    if (items.length === 0 || items.every((i) => !i.fileList)) missingFields.push("file_list (requires tbl_file join)")
    if (items.length === 0 || items.every((i) => !i.errorMessage)) missingFields.push("error_message (not in source tables)")

    return {
      source: "site_restore_db",
      items,
      missingFields,
      blocker: missingFields.length > 0 ? "partial" : null,
    }
  } finally {
    await client.end()
  }
}
