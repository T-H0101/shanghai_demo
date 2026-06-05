/**
 * File Index UPSERT
 * Sprint 2C.18B - UPSERT file index 到 unified_file_index
 *
 * 幂等策略：source_site_id + source_table + source_id 唯一
 */

import type { PoolClient } from 'pg'
import type { FileIndexRecord } from './types'
import { computeFileChecksum } from './checksum'
import { transaction } from '@/lib/db'

export interface UpsertFileIndexResult {
  insertedCount: number
  updatedCount: number
  skippedCount: number
}

/**
 * 在事务中 UPSERT file index 记录
 *
 * @param records 要写入的记录
 * @param client 数据库客户端（可选）
 */
export async function upsertFileIndexesInTransaction(
  records: FileIndexRecord[],
  client?: PoolClient
): Promise<UpsertFileIndexResult> {
  if (records.length === 0) {
    return { insertedCount: 0, updatedCount: 0, skippedCount: 0 }
  }

  // 计算 checksum 用于幂等检测
  const checksum = computeFileChecksum(records)
  const recordsWithChecksum = records.map((r) => ({ ...r, checksum }))

  const sql = `
    INSERT INTO unified_file_index (
      source_site_id, source_table, source_id, task_source_id,
      folder_source_id, slot_id, file_name, file_size, content_type,
      status, hash, source_created_at, indexed_at, batch_id, checksum, raw_metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb
    )
    ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
      task_source_id = EXCLUDED.task_source_id,
      folder_source_id = EXCLUDED.folder_source_id,
      slot_id = COALESCE(EXCLUDED.slot_id, unified_file_index.slot_id),
      file_name = COALESCE(EXCLUDED.file_name, unified_file_index.file_name),
      file_size = COALESCE(EXCLUDED.file_size, unified_file_index.file_size),
      content_type = COALESCE(EXCLUDED.content_type, unified_file_index.content_type),
      status = COALESCE(EXCLUDED.status, unified_file_index.status),
      hash = COALESCE(EXCLUDED.hash, unified_file_index.hash),
      indexed_at = EXCLUDED.indexed_at,
      batch_id = EXCLUDED.batch_id,
      checksum = EXCLUDED.checksum,
      raw_metadata = EXCLUDED.raw_metadata,
      updated_at = NOW()
    RETURNING (xmax = 0) AS inserted
  `

  const executeUpsert = async (c: PoolClient) => {
    let insertedCount = 0
    let updatedCount = 0

    for (const record of recordsWithChecksum) {
      const result = await c.query(sql, [
        record.source_site_id,
        record.source_table,
        record.source_id,
        record.task_source_id,
        record.folder_source_id,
        record.slot_id,
        record.file_name,
        record.file_size,
        record.content_type,
        record.status,
        record.hash,
        record.source_created_at,
        record.indexed_at,
        record.batch_id,
        record.checksum,
        JSON.stringify(record.raw_metadata),
      ])

      if (result.rows[0]?.inserted) {
        insertedCount++
      } else {
        updatedCount++
      }
    }

    return { insertedCount, updatedCount, skippedCount: 0 }
  }

  if (client) {
    return executeUpsert(client)
  }

  return transaction(executeUpsert)
}