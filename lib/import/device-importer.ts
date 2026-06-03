/**
 * Device Importer
 * Sprint 2B.12 - 真实 source_restore Import 试点
 * Sprint 2C.2 - 扩展：聚合盘位/容量数据
 *
 * 从 source_restore 读取 tbl_disc_lib，映射后写入 unified_devices。
 * 然后聚合 tbl_slots + tbl_magzines 补充容量/盘位数据。
 */

import { sourceQuery } from '@/lib/db/source-pool'
import { transaction, query } from '@/lib/db'
import { upsertDevicesInTransaction } from '@/lib/sync/upsert'
import { mapRealDevice } from './real-field-mapper'
import { aggregateAllCapacity } from './device-capacity-aggregator'

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

  // 4. 聚合盘位/容量数据并更新
  console.log(`[Import] Aggregating slot capacity from tbl_slots + tbl_magzines...`)
  const capacityMap = await aggregateAllCapacity()
  const libIds = Object.keys(capacityMap)
  console.log(`[Import] Found capacity data for ${libIds.length} devices`)

  let updatedCount = 0
  for (const libId of libIds) {
    const cap = capacityMap[libId]
    const result = await query(
      `UPDATE unified_devices
       SET total_capacity = $1,
           used_capacity = $2,
           slot_count = $3,
           cage_count = $4,
           used_slots = $5
       WHERE device_id = $6 AND source_site_id = $7`,
      [cap.total_capacity, cap.used_capacity, cap.total_slots, cap.cage_count, cap.used_slots, libId, siteCode]
    )
    updatedCount += result.rowCount ?? 0
  }
  console.log(`[Import] Updated capacity for ${updatedCount} devices`)

  const duration = Date.now() - startTime
  console.log(`[Import] Done: ${rowsUpserted} rows upserted, ${sourceRows.length - rowsUpserted} updated`)
  console.log(`[Import] Duration: ${duration}ms`)
}
