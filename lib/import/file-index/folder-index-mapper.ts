/**
 * Folder Index Mapper
 * Sprint 2C.18B - 将 source tbl_folder 映射为 unified_folder_index
 */

import type { SourceFolderRecord } from './folder-index-reader'
import type { FolderIndexRecord, RawMetadata } from './types'

/**
 * 将 source tbl_folder 记录映射为 unified_folder_index 记录
 *
 * @param row 源记录
 * @param siteCode 站点代码
 * @param batchId 批次 ID
 */
export function mapFolderIndexRecord(
  row: SourceFolderRecord,
  siteCode: string,
  batchId: string
): FolderIndexRecord {
  const rawMetadata: RawMetadata = {
    batch_id: batchId,
    task_id: '', // folder 不直接关联 task
    from_id: 0,
    limit: 0,
  }

  return {
    source_site_id: siteCode,
    source_table: 'tbl_folder',
    source_id: String(row.id),
    parent_source_id: row.parent_id ? String(row.parent_id) : null,
    name: row.folder_name,
    folder_path: row.folder_path,
    disc_path: row.disc_path,
    level: row.level,
    file_count: row.file_count,
    total_size: row.total_size ? BigInt(row.total_size) : null,
    indexed_at: new Date(),
    batch_id: batchId,
    checksum: null,
    raw_metadata: rawMetadata,
  }
}

/**
 * 批量映射
 */
export function mapFolderIndexRecords(
  rows: SourceFolderRecord[],
  siteCode: string,
  batchId: string
): FolderIndexRecord[] {
  return rows.map((row) => mapFolderIndexRecord(row, siteCode, batchId))
}