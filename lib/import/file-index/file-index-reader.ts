/**
 * File Index Reader
 * Sprint 2C.18B - 从 source_restore 读取 tbl_file
 *
 * 严格使用 taskId + watermark (id > fromId) + limit 限制
 * 防护：limit 不能超过 5000
 */

import { sourceQuery } from '@/lib/db/source-pool'

export interface SourceFileRecord {
  id: number
  folder_id: number | null
  file_name: string
  file_size: string | null
  content_type: string | null
  status: number | null
  hash: string | null
  created_at: Date | null
}

/**
 * 从 source_restore 读取 tbl_file 记录
 *
 * @param siteCode 站点代码（仅用于日志）
 * @param taskId 任务 ID
 * @param fromId 起始 ID（watermark）
 * @param limit 最大记录数 <= 5000
 */
export async function readFileIndexRecords(
  siteCode: string,
  taskId: string,
  fromId: number,
  limit: number
): Promise<{ rows: SourceFileRecord[]; recordCount: number }> {
  // 防护：limit 不能超过 5000
  if (limit > 5000) {
    throw new Error(`limit cannot exceed 5000, got ${limit}`)
  }

  const sql = `
    SELECT f.id, f.folder_id, f.file_name, f.file_size,
           f.content_type, f.status, f.hash, f.create_date AS created_at
    FROM tbl_file f
    WHERE f.task_id = $1 AND f.id > $2
    ORDER BY f.id ASC
    LIMIT $3
  `

  console.log(`[FileIndexReader] site=${siteCode}, task=${taskId}, fromId=${fromId}, limit=${limit}`)

  const { rows } = await sourceQuery<SourceFileRecord>(sql, [taskId, fromId, limit])

  console.log(`[FileIndexReader] Read ${rows.length} records`)

  return {
    rows,
    recordCount: rows.length,
  }
}