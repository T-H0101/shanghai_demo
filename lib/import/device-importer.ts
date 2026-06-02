/**
 * Device Importer
 * Sprint 2B.12 - 真实 source_restore Import 试点
 *
 * 从 source_restore 读取 tbl_disc_lib，映射后写入 unified_devices。
 */

import { sourceQuery } from '@/lib/db/source-pool'
import { transaction } from '@/lib/db'
import { upsertDevicesInTransaction } from '@/lib/sync/upsert'
import { mapRealDevice } from './real-field-mapper'

export async function importDevices(siteCode: string): Promise<void> {
  const startTime = Date.now()

  console.log(`[Import] Starting devices import from source_restore...`)
  console.log(`[Import] Site: ${siteCode}`)
  console.log(`[Import] Source: source_restore.tbl_disc_lib`)

  // 1. 读取源表
  console.log(`[Import] Reading source records...`)
  const { rows: sourceRows } = await sourceQuery('SELECT * FROM tbl_disc_lib ORDER BY lib_id')
  console.log(`[Import] Found ${sourceRows.length} records`)

  // 2. 映射
  console.log(`[Import] Mapping records...`)
  const mappedRecords = sourceRows.map((row) => mapRealDevice(row, siteCode))

  // 3. UPSERT
  console.log(`[Import] UPSERT to unified_disc_platform.unified_devices...`)
  const { rowsUpserted } = await transaction(async (client) => {
    return upsertDevicesInTransaction(mappedRecords, client)
  })

  const duration = Date.now() - startTime
  console.log(`[Import] Done: ${rowsUpserted} rows upserted, ${sourceRows.length - rowsUpserted} updated`)
  console.log(`[Import] Duration: ${duration}ms`)
}
