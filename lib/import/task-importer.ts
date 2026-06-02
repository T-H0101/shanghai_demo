/**
 * Task Importer
 * Sprint 2B.12 - 真实 source_restore Import 试点
 *
 * 从 source_restore 读取 tbl_task，映射后写入 unified_tasks。
 */

import { sourceQuery } from '@/lib/db/source-pool'
import { transaction } from '@/lib/db'
import { upsertTasksInTransaction } from '@/lib/sync/upsert'
import { mapRealTask } from './real-field-mapper'

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

  const duration = Date.now() - startTime
  console.log(`[Import] Done: ${rowsUpserted} rows upserted, ${sourceRows.length - rowsUpserted} updated`)
  console.log(`[Import] Duration: ${duration}ms`)
}
