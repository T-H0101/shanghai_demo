/**
 * File Index Mapper
 * Sprint 2C.18B - 将 source tbl_file 映射为 unified_file_index
 */

import type { SourceFileRecord } from './file-index-reader'
import type { FileIndexRecord, RawMetadata } from './types'

/**
 * 将 source tbl_file 记录映射为 unified_file_index 记录
 *
 * @param row 源记录
 * @param siteCode 站点代码
 * @param batchId 批次 ID
 * @param taskId 任务 ID
 * @param fromId 起始 ID
 * @param limit 本次限制数
 */
export function mapFileIndexRecord(
  row: SourceFileRecord,
  siteCode: string,
  batchId: string,
  taskId: string,
  fromId: number,
  limit: number
): FileIndexRecord {
  const rawMetadata: RawMetadata = {
    batch_id: batchId,
    task_id: taskId,
    from_id: fromId,
    limit,
  }

  return {
    source_site_id: siteCode,
    source_table: 'tbl_file',
    source_id: String(row.id),
    task_source_id: taskId,
    folder_source_id: row.folder_id ? String(row.folder_id) : null,
    slot_id: null,
    file_name: row.file_name,
    file_size: row.file_size ? BigInt(row.file_size) : null,
    content_type: row.content_type,
    status: row.status,
    hash: row.hash,
    source_created_at: row.created_at,
    indexed_at: new Date(),
    batch_id: batchId,
    checksum: null, // 将在 upsert 前计算
    raw_metadata: rawMetadata,
  }
}

/**
 * 批量映射
 */
export function mapFileIndexRecords(
  rows: SourceFileRecord[],
  siteCode: string,
  batchId: string,
  taskId: string,
  fromId: number,
  limit: number
): FileIndexRecord[] {
  return rows.map((row) =>
    mapFileIndexRecord(row, siteCode, batchId, taskId, fromId, limit)
  )
}