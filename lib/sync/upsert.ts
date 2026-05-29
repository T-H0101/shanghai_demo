/**
 * UPSERT 操作封装
 * Sprint 2B - 同步模块
 */

import { query, transaction } from '@/lib/db'
import type { UnifiedTaskRecord } from './types'

/**
 * UPSERT 单条记录到 unified_tasks
 */
export async function upsertTask(record: UnifiedTaskRecord): Promise<number> {
  const sql = `
    INSERT INTO unified_tasks (
      source_site_id, source_table, source_id, synced_at,
      task_no, task_name, task_type, status, phase, priority,
      data_classification, archive_name, source_path, package_path,
      operator, department, total_files, total_size, raw_data
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19
    )
    ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
      synced_at = EXCLUDED.synced_at,
      task_no = EXCLUDED.task_no,
      task_name = EXCLUDED.task_name,
      task_type = EXCLUDED.task_type,
      status = EXCLUDED.status,
      phase = EXCLUDED.phase,
      priority = EXCLUDED.priority,
      data_classification = EXCLUDED.data_classification,
      archive_name = EXCLUDED.archive_name,
      source_path = EXCLUDED.source_path,
      package_path = EXCLUDED.package_path,
      operator = EXCLUDED.operator,
      department = EXCLUDED.department,
      total_files = EXCLUDED.total_files,
      total_size = EXCLUDED.total_size,
      raw_data = EXCLUDED.raw_data,
      updated_at = NOW()
    RETURNING id
  `

  const result = await query(sql, [
    record.source_site_id,
    record.source_table,
    record.source_id,
    record.synced_at,
    record.task_no,
    record.task_name,
    record.task_type,
    record.status,
    record.phase,
    record.priority,
    record.data_classification,
    record.archive_name,
    record.source_path,
    record.package_path,
    record.operator,
    record.department,
    record.total_files,
    record.total_size,
    JSON.stringify(record.raw_data),
  ])

  return result.rowCount ?? 0
}

/**
 * 批量 UPSERT（在同一事务内）
 */
export async function upsertTasksInTransaction(
  records: UnifiedTaskRecord[],
  onProgressUpdate: (maxSourceId: number, syncedRows: number) => Promise<void>
): Promise<{ rowsUpserted: number; maxSourceId: number }> {
  if (records.length === 0) {
    return { rowsUpserted: 0, maxSourceId: 0 }
  }

  return transaction(async (client) => {
    let rowsUpserted = 0
    let maxSourceId = 0

    for (const record of records) {
      const sql = `
        INSERT INTO unified_tasks (
          source_site_id, source_table, source_id, synced_at,
          task_no, task_name, task_type, status, phase, priority,
          data_classification, archive_name, source_path, package_path,
          operator, department, total_files, total_size, raw_data
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
        ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
          synced_at = EXCLUDED.synced_at,
          task_no = EXCLUDED.task_no,
          task_name = EXCLUDED.task_name,
          task_type = EXCLUDED.task_type,
          status = EXCLUDED.status,
          phase = EXCLUDED.phase,
          priority = EXCLUDED.priority,
          data_classification = EXCLUDED.data_classification,
          archive_name = EXCLUDED.archive_name,
          source_path = EXCLUDED.source_path,
          package_path = EXCLUDED.package_path,
          operator = EXCLUDED.operator,
          department = EXCLUDED.department,
          total_files = EXCLUDED.total_files,
          total_size = EXCLUDED.total_size,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
        RETURNING id
      `

      const res = await client.query(sql, [
        record.source_site_id,
        record.source_table,
        record.source_id,
        record.synced_at,
        record.task_no,
        record.task_name,
        record.task_type,
        record.status,
        record.phase,
        record.priority,
        record.data_classification,
        record.archive_name,
        record.source_path,
        record.package_path,
        record.operator,
        record.department,
        record.total_files,
        record.total_size,
        JSON.stringify(record.raw_data),
      ])

      if (res.rowCount && res.rowCount > 0) {
        rowsUpserted += res.rowCount
      }

      // 计算最大 source_id
      const sourceIdNum = parseInt(record.source_id, 10)
      if (sourceIdNum > maxSourceId) {
        maxSourceId = sourceIdNum
      }
    }

    // 更新 sync_progress（事务内）
    await onProgressUpdate(maxSourceId, rowsUpserted)

    return { rowsUpserted, maxSourceId }
  })
}