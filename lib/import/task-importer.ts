/**
 * Task Importer
 * Sprint 2B.12 - 真实 source_restore Import 试点
 * Sprint 2C.8 - 扩展：聚合任务-设备关联
 *
 * 从 source_restore 读取 tbl_task，映射后写入 unified_tasks。
 * 然后聚合 tbl_lib_task 补充 device_id。
 */

import { sourceQuery } from '@/lib/db/source-pool'
import { transaction, query } from '@/lib/db'
import { upsertTasksInTransaction } from '@/lib/sync/upsert'
import { mapRealTask } from './real-field-mapper'
import { aggregateTaskDevices } from './task-device-aggregator'
import { aggregateTaskUsers } from './task-user-aggregator'

export async function importTasks(siteCode: string): Promise<void> {
  const startTime = Date.now()

  console.log(`[Import] Starting tasks import from source_restore...`)
  console.log(`[Import] Site: ${siteCode}`)
  console.log(`[Import] Source: source_restore.tbl_task`)

  // 1. 读取源表
  console.log(`[Import] Reading source records...`)
  const { rows: sourceRows } = await sourceQuery('SELECT * FROM tbl_task ORDER BY id')
  console.log(`[Import] Found ${sourceRows.length} records`)

  // 2. 映射
  console.log(`[Import] Mapping records...`)
  const mappedRecords = sourceRows.map((row) => mapRealTask(row, siteCode))

  // 3. UPSERT
  console.log(`[Import] UPSERT to unified_disc_platform.unified_tasks...`)
  const { rowsUpserted } = await transaction(async (client) => {
    return upsertTasksInTransaction(mappedRecords, client)
  })

  // 4. 聚合任务-设备关联
  console.log(`[Import] Aggregating task-device associations from tbl_lib_task...`)
  const deviceMap = await aggregateTaskDevices()
  console.log(`[Import] Found device associations for ${deviceMap.size} tasks`)

  let updatedCount = 0
  for (const [taskId, mapping] of deviceMap) {
    const result = await query(
      `UPDATE unified_tasks SET device_id = $1 WHERE source_id = $2 AND source_site_id = $3`,
      [String(mapping.lib_id), String(taskId), siteCode]
    )
    updatedCount += result.rowCount ?? 0
  }
  console.log(`[Import] Updated device_id for ${updatedCount} tasks`)

  // 5. 聚合任务-用户关联
  console.log(`[Import] Aggregating task-user associations from tbl_user_task...`)
  const userMap = await aggregateTaskUsers()
  console.log(`[Import] Found user associations for ${userMap.size} tasks`)

  let userUpdatedCount = 0
  for (const [taskId, mapping] of userMap) {
    const result = await query(
      `UPDATE unified_tasks SET operator = $1 WHERE source_id = $2 AND source_site_id = $3 AND (operator IS NULL OR operator = '')`,
      [mapping.user_name, String(taskId), siteCode]
    )
    userUpdatedCount += result.rowCount ?? 0
  }
  console.log(`[Import] Updated operator for ${userUpdatedCount} tasks`)

  const duration = Date.now() - startTime
  console.log(`[Import] Done: ${rowsUpserted} rows upserted, ${sourceRows.length - rowsUpserted} updated`)
  console.log(`[Import] Duration: ${duration}ms`)
}
