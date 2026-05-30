/**
 * 源数据读取器
 * Sprint 2B.0 - 从源表读取数据
 */

import { query } from '@/lib/db'
import type { TaskSourceRecord } from './types'
import { TASK_SYNC_CONFIG } from './config'

/**
 * 读取源数据（ID > lastSourceId）
 * @param lastSourceId 上次同步的最大 ID
 * @returns 源数据记录数组
 */
export async function readSourceRecords(lastSourceId: number = 0): Promise<TaskSourceRecord[]> {
  const sql = `
    SELECT id, task_no, task_name, task_type, status, phase, priority,
           data_classification, archive_name, source_path, package_path,
           operator, department, created_at, updated_at
    FROM ${TASK_SYNC_CONFIG.mockSourceTable}
    WHERE id > $1
    ORDER BY id ASC
  `

  const result = await query(sql, [lastSourceId])
  return result.rows as TaskSourceRecord[]
}

/**
 * 获取源表的最大 ID
 */
export async function getMaxSourceId(): Promise<number> {
  const sql = `SELECT COALESCE(MAX(id), 0) as max_id FROM ${TASK_SYNC_CONFIG.mockSourceTable}`
  const result = await query(sql)
  return result.rows[0]?.max_id ?? 0
}