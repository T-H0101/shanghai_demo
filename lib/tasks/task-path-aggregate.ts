/**
 * 任务路径 / 目标卷聚合
 * 对齐业务系统 getTaskDetail + DgTaskDetailForm：
 * - 源路径: original_path + '/' + item_name（有 item_name 时）
 * - 备份路径: volumeName + lib_parent_folder（回迁任务前端文案为「介质源路径」）
 * - 路径成对列出（不去两侧各自拼成一长串）
 * - 目标存储卷: 多卷名去重后逗号连接
 */

import { query } from "@/lib/db"

/** 一条源路径 ↔ 备份路径 对（对齐业务 paths[]） */
export interface TaskPathPair {
  fromPath: string
  backupPath: string
  volumeName?: string
}

export interface TaskPathAggregate {
  /** 目标存储卷名，多卷逗号连接 */
  volumeNames: string
  /** 成对路径列表 */
  paths: TaskPathPair[]
  /** 兼容旧字段：源路径逗号连接 */
  sourcePath: string
  /** 兼容旧字段：备份路径逗号连接 */
  backupPath: string
}

interface ItemRow {
  task_id: string | number
  original_path: string | null
  item_name: string | null
  lib_parent_folder: string | null
  volume_name: string | null
}

function normSlash(p: string): string {
  return p.replace(/\\/g, "/")
}

/** 源路径：original_path + optional /item_name */
export function buildSourcePath(
  originalPath: string | null | undefined,
  itemName: string | null | undefined
): string {
  if (!originalPath) return ""
  const base = normSlash(String(originalPath))
  if (itemName) return `${base}/${String(itemName)}`
  return base
}

/** 备份路径：卷名 + lib_parent_folder（与业务前端 volumeName+to_path 一致） */
export function buildBackupPath(
  volumeName: string | null | undefined,
  libParentFolder: string | null | undefined
): string {
  const folder = libParentFolder ? normSlash(String(libParentFolder)) : ""
  if (volumeName) return `${String(volumeName)}${folder}`
  return folder
}

export function aggregateItemRows(rows: ItemRow[]): TaskPathAggregate {
  const pairSet = new Set<string>()
  const paths: TaskPathPair[] = []
  const volumeSeen = new Set<string>()
  const volumeNames: string[] = []

  for (const row of rows) {
    const fromPath = buildSourcePath(row.original_path, row.item_name)
    const toPath = row.lib_parent_folder ? normSlash(String(row.lib_parent_folder)) : ""
    const volumeName = row.volume_name?.trim() || ""
    const backupPath = buildBackupPath(volumeName || null, toPath || null)

    if (!fromPath && !toPath && !volumeName) continue

    const key = `${fromPath}|${toPath}`
    if (!pairSet.has(key)) {
      pairSet.add(key)
      paths.push({
        fromPath,
        backupPath,
        volumeName: volumeName || undefined,
      })
    }

    if (volumeName && !volumeSeen.has(volumeName)) {
      volumeSeen.add(volumeName)
      volumeNames.push(volumeName)
    }
  }

  return {
    volumeNames: volumeNames.join(","),
    paths,
    sourcePath: paths.map((p) => p.fromPath).filter(Boolean).join(", "),
    backupPath: paths.map((p) => p.backupPath).filter(Boolean).join(", "),
  }
}

const EMPTY: TaskPathAggregate = {
  volumeNames: "",
  paths: [],
  sourcePath: "",
  backupPath: "",
}

/**
 * 按站点 + 源任务 id（tbl_task.id / unified_tasks.source_id）批量聚合
 */
export async function loadTaskPathAggregates(
  siteCode: string,
  sourceTaskIds: Array<string | number>
): Promise<Map<string, TaskPathAggregate>> {
  const result = new Map<string, TaskPathAggregate>()
  const ids = [
    ...new Set(
      sourceTaskIds
        .map((id) => String(id).trim())
        .filter((id) => id !== "" && /^[0-9]+$/.test(id))
    ),
  ]
  if (!siteCode || ids.length === 0) return result

  const { rows } = await query<ItemRow>(
    `SELECT
       ti.task_id::text AS task_id,
       ti.original_path,
       ti.item_name,
       ti.lib_parent_folder,
       v.volume_name
     FROM unified_task_items ti
     LEFT JOIN unified_volumes v
       ON v.source_site_id = ti.source_site_id
      AND v.volume_id = ti.volume_id::text
     WHERE ti.source_site_id = $1
       AND ti.task_id = ANY($2::bigint[])
     ORDER BY ti.task_id, ti.src_task_item_id NULLS LAST, ti.id`,
    [siteCode, ids.map((id) => Number(id))]
  )

  const byTask = new Map<string, ItemRow[]>()
  for (const row of rows) {
    const key = String(row.task_id)
    const list = byTask.get(key)
    if (list) list.push(row)
    else byTask.set(key, [row])
  }

  for (const [taskId, itemRows] of byTask) {
    result.set(taskId, aggregateItemRows(itemRows))
  }

  for (const id of ids) {
    if (!result.has(id)) result.set(id, EMPTY)
  }

  return result
}

export async function loadTaskPathAggregate(
  siteCode: string,
  sourceTaskId: string | number
): Promise<TaskPathAggregate> {
  const map = await loadTaskPathAggregates(siteCode, [sourceTaskId])
  return map.get(String(sourceTaskId)) ?? EMPTY
}
