/**
 * 任务路径 / 目标卷聚合
 * 对齐业务系统 getTaskDetail + DgTaskDetailForm：
 * - 普通任务: original_path + '/' + item_name（unified_task_items）
 * - 物理位置回迁 (task_type=1, task_mode=2): file_full_path + restore_root_path（unified_restore_files）
 * - 备份路径: volumeName + lib_parent_folder（回迁任务前端文案为「介质源路径」）
 * - 路径成对列出（不去两侧各自拼成一长串）
 * - 目标存储卷: 多卷名去重后逗号连接
 */

import { query } from "@/lib/db"
import { isPhysicalRestoreTask } from "@/lib/tasks/restore-file-display"

export { isPhysicalRestoreTask, formatRestoreFileStatus } from "@/lib/tasks/restore-file-display"

/** 一条源路径 ↔ 备份路径 对（对齐业务 paths[]） */
export interface TaskPathPair {
  fromPath: string
  backupPath: string
  volumeName?: string
  /** 物理回迁：restore_status（1 待处理 / 6 成功 / 7 离线 / 9 失败） */
  restoreStatus?: number | null
  /** 物理回迁：restore_comment（失败原因等） */
  restoreComment?: string | null
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
  /** 路径数据来源 */
  pathSource?: "task_items" | "restore_file"
  /** 物理回迁失败时汇总的错误说明 */
  restoreErrorMessage?: string | null
}

interface ItemRow {
  task_id: string | number
  original_path: string | null
  item_name: string | null
  lib_parent_folder: string | null
  volume_name: string | null
}

interface RestoreFileRow {
  task_id: string | number
  file_full_path: string | null
  restore_root_path: string | null
  restore_status: number | null
  restore_comment: string | null
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
    pathSource: "task_items",
  }
}

export function aggregateRestoreFileRows(rows: RestoreFileRow[]): TaskPathAggregate {
  const pairSet = new Set<string>()
  const paths: TaskPathPair[] = []
  const errorParts: string[] = []

  for (const row of rows) {
    const fromPath = row.file_full_path ? normSlash(String(row.file_full_path).trim()) : ""
    const backupPath = row.restore_root_path
      ? normSlash(String(row.restore_root_path).trim())
      : ""
    if (!fromPath && !backupPath) continue

    const key = `${fromPath}|${backupPath}|${row.restore_status ?? ""}|${row.restore_comment ?? ""}`
    if (!pairSet.has(key)) {
      pairSet.add(key)
      paths.push({
        fromPath,
        backupPath,
        restoreStatus: row.restore_status,
        restoreComment: row.restore_comment?.trim() || null,
      })
    }

    const comment = row.restore_comment?.trim()
    if (row.restore_status === 9 && comment) {
      errorParts.push(comment)
    }
  }

  return {
    volumeNames: "",
    paths,
    sourcePath: paths.map((p) => p.fromPath).filter(Boolean).join(", "),
    backupPath: paths.map((p) => p.backupPath).filter(Boolean).join(", "),
    pathSource: "restore_file",
    restoreErrorMessage: errorParts.length ? [...new Set(errorParts)].join("；") : null,
  }
}

const EMPTY: TaskPathAggregate = {
  volumeNames: "",
  paths: [],
  sourcePath: "",
  backupPath: "",
}

/**
 * 按站点 + 源任务 id（tbl_task.id / unified_tasks.source_id）批量聚合 task_items
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

/**
 * 按站点 + 源任务 id 批量聚合 unified_restore_files（物理位置回迁）
 */
export async function loadRestoreFilePathAggregates(
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

  try {
    const { rows } = await query<RestoreFileRow>(
      `SELECT
         rf.task_id::text AS task_id,
         rf.file_full_path,
         rf.restore_root_path,
         rf.restore_status,
         rf.restore_comment
       FROM unified_restore_files rf
       WHERE rf.source_site_id = $1
         AND rf.task_id = ANY($2::bigint[])
       ORDER BY rf.task_id, rf.src_restore_file_id NULLS LAST, rf.id`,
      [siteCode, ids.map((id) => Number(id))]
    )

    const byTask = new Map<string, RestoreFileRow[]>()
    for (const row of rows) {
      const key = String(row.task_id)
      const list = byTask.get(key)
      if (list) list.push(row)
      else byTask.set(key, [row])
    }

    for (const [taskId, fileRows] of byTask) {
      result.set(taskId, aggregateRestoreFileRows(fileRows))
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/unified_restore_files/i.test(msg) || !/does not exist|42P01/i.test(msg)) {
      throw e
    }
  }

  for (const id of ids) {
    if (!result.has(id)) result.set(id, { ...EMPTY, pathSource: "restore_file" })
  }

  return result
}

/**
 * 按任务类型选择路径源：物理回迁走 restore_files，其余走 task_items。
 */
export async function loadTaskPathAggregatesForRows(
  siteCode: string,
  tasks: Array<{ sourceId: string | number; taskType: string | number | null; taskMode: number | null }>
): Promise<Map<string, TaskPathAggregate>> {
  const result = new Map<string, TaskPathAggregate>()
  if (!siteCode || tasks.length === 0) return result

  const physicalIds: Array<string | number> = []
  const normalIds: Array<string | number> = []
  for (const t of tasks) {
    if (isPhysicalRestoreTask(t.taskType, t.taskMode)) physicalIds.push(t.sourceId)
    else normalIds.push(t.sourceId)
  }

  const [restoreMap, itemsMap] = await Promise.all([
    physicalIds.length
      ? loadRestoreFilePathAggregates(siteCode, physicalIds)
      : Promise.resolve(new Map<string, TaskPathAggregate>()),
    normalIds.length
      ? loadTaskPathAggregates(siteCode, normalIds)
      : Promise.resolve(new Map<string, TaskPathAggregate>()),
  ])

  for (const [id, agg] of restoreMap) result.set(id, agg)
  for (const [id, agg] of itemsMap) result.set(id, agg)
  return result
}

export async function loadTaskPathAggregate(
  siteCode: string,
  sourceTaskId: string | number,
  opts?: { taskType?: string | number | null; taskMode?: number | null }
): Promise<TaskPathAggregate> {
  if (opts && isPhysicalRestoreTask(opts.taskType, opts.taskMode)) {
    const map = await loadRestoreFilePathAggregates(siteCode, [sourceTaskId])
    return map.get(String(sourceTaskId)) ?? { ...EMPTY, pathSource: "restore_file" }
  }
  const map = await loadTaskPathAggregates(siteCode, [sourceTaskId])
  return map.get(String(sourceTaskId)) ?? EMPTY
}
