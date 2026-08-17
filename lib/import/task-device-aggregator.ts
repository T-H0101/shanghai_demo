/**
 * Task-Device Aggregator
 * Sprint 2C.8 - 从 source_restore 聚合任务-设备关联
 *
 * 数据来源：tbl_lib_task (task_id, lib_id)
 * 关联路径：tbl_lib_task.lib_id → tbl_disc_lib.lib_id → unified_devices.device_id
 *
 * 一个 task 只关联一台设备（已验证：22 个 task 各自只有 1 个 distinct lib_id）
 */

import { sourceQuery } from '@/lib/db/source-pool'
import { query } from '@/lib/db'

export interface TaskDeviceMapping {
  task_id: number
  lib_id: number
  device_name: string | null
  command: string | null
}

/**
 * 聚合每个 task 关联的主设备（取第一条记录的 lib_id）
 */
export async function aggregateTaskDevices(): Promise<Map<number, TaskDeviceMapping>> {
  const { rows } = await sourceQuery<TaskDeviceMapping>(`
    SELECT DISTINCT ON (lt.task_id)
      lt.task_id,
      lt.lib_id,
      dl.name as device_name,
      lt.command
    FROM tbl_lib_task lt
    LEFT JOIN tbl_disc_lib dl ON lt.lib_id = dl.lib_id
    ORDER BY lt.task_id, lt.id
  `)

  const map = new Map<number, TaskDeviceMapping>()
  for (const row of rows) {
    map.set(row.task_id, row)
  }
  return map
}

/**
 * 从 sync package 的 tbl_lib_task records 构建 task_id → device_id(lib_id) 映射。
 * 同一 task 多行时取 id 最小的一条（对齐 DISTINCT ON ... ORDER BY id）。
 */
export function buildTaskDeviceMapFromRecords(
  records: Record<string, unknown>[]
): Map<string, string> {
  const rows = records
    .map((r) => ({
      id: typeof r.id === 'number' ? r.id : Number(r.id) || 0,
      taskId: r.task_id != null ? String(r.task_id) : '',
      libId: r.lib_id != null && r.lib_id !== '' ? String(r.lib_id) : '',
    }))
    .filter((r) => r.taskId && r.libId)
    .sort((a, b) => a.id - b.id)

  const map = new Map<string, string>()
  for (const r of rows) {
    if (!map.has(r.taskId)) map.set(r.taskId, r.libId)
  }
  return map
}

/**
 * 将 task→device 映射写回 unified_tasks.device_id
 */
export async function applyTaskDeviceIds(
  siteCode: string,
  taskDeviceMap: Map<string, string>
): Promise<{ scanned: number; updated: number }> {
  let updated = 0
  let scanned = 0
  for (const [taskId, deviceId] of taskDeviceMap.entries()) {
    scanned += 1
    const result = await query(
      `UPDATE unified_tasks
       SET device_id = $1,
           updated_at = NOW()
       WHERE source_site_id = $2
         AND source_table = 'tbl_task'
         AND source_id = $3
         AND (device_id IS NULL OR device_id = '' OR device_id IS DISTINCT FROM $1)`,
      [deviceId, siteCode, taskId]
    )
    updated += result.rowCount ?? 0
  }
  return { scanned, updated }
}

/**
 * 用推包 records 回填 unified_tasks.device_id。
 * 总控推送路径禁止回退 SOURCE_DATABASE_URL / 站点业务库；records 为空则跳过。
 */
export async function backfillTaskDeviceIds(
  siteCode: string,
  records: Record<string, unknown>[] = [],
): Promise<{ source: 'records' | 'empty'; scanned: number; updated: number }> {
  if (!records.length) {
    return { source: 'empty', scanned: 0, updated: 0 }
  }
  const map = buildTaskDeviceMapFromRecords(records)
  if (map.size === 0) {
    return { source: 'empty', scanned: 0, updated: 0 }
  }
  const result = await applyTaskDeviceIds(siteCode, map)
  return { source: 'records', ...result }
}
