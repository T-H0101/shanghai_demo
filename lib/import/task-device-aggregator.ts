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
