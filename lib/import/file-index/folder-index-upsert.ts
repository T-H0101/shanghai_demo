/**
 * Folder Index UPSERT
 * Sprint 2C.18B - UPSERT folder index 到 unified_folder_index
 *
 * 幂等策略：source_site_id + source_table + source_id 唯一
 */

import type { PoolClient } from 'pg'
import type { FolderIndexRecord } from './types'
import { computeFolderChecksum } from './checksum'
import { transaction } from '@/lib/db'

export interface UpsertFolderIndexResult {
  insertedCount: number
  updatedCount: number
  skippedCount: number
}

/**
 * 在事务中 UPSERT folder index 记录
 *
 * @param records 要写入的记录
 * @param client 数据库客户端（可选）
 */
export async function upsertFolderIndexesInTransaction(
  records: FolderIndexRecord[],
  client?: PoolClient
): Promise<UpsertFolderIndexResult> {
  if (records.length === 0) {
    return { insertedCount: 0, updatedCount: 0, skippedCount: 0 }
  }

  // 计算 checksum 用于幂等检测
  const checksum = computeFolderChecksum(records)
  const recordsWithChecksum = records.map((r) => ({ ...r, checksum }))

  const sql = `
    INSERT INTO unified_folder_index (
      source_site_id, source_table, source_id, parent_source_id,
      name, folder_path, disc_path, level, file_count, total_size,
      indexed_at, batch_id, checksum, raw_metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb
    )
    ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
      parent_source_id = EXCLUDED.parent_source_id,
      name = COALESCE(EXCLUDED.name, unified_folder_index.name),
      folder_path = COALESCE(EXCLUDED.folder_path, unified_folder_index.folder_path),
      disc_path = COALESCE(EXCLUDED.disc_path, unified_folder_index.disc_path),
      level = COALESCE(EXCLUDED.level, unified_folder_index.level),
      file_count = COALESCE(EXCLUDED.file_count, unified_folder_index.file_count),
      total_size = COALESCE(EXCLUDED.total_size, unified_folder_index.total_size),
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
        record.parent_source_id,
        record.name,
        record.folder_path,
        record.disc_path,
        record.level,
        record.file_count,
        record.total_size,
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