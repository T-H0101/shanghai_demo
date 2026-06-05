/**
 * Folder Index Reader
 * Sprint 2C.18B - 从 source_restore 读取 tbl_folder
 *
 * 仅读取本批次关联的 folder_id
 */

import { sourceQuery } from '@/lib/db/source-pool'

export interface SourceFolderRecord {
  id: number
  parent_id: number | null
  folder_name: string
  folder_path: string | null
  disc_path: string | null
  level: number | null
  file_count: number | null
  total_size: string | null
}

/**
 * 从 source_restore 读取 tbl_folder 记录
 *
 * @param siteCode 站点代码（仅用于日志）
 * @param folderIds 本批次文件关联的 folder_id 列表
 */
export async function readFolderIndexRecords(
  siteCode: string,
  folderIds: number[]
): Promise<{ rows: SourceFolderRecord[]; recordCount: number }> {
  if (folderIds.length === 0) {
    console.log(`[FolderIndexReader] No folder IDs to read`)
    return { rows: [], recordCount: 0 }
  }

  // 使用 PostgreSQL array 语法
  const sql = `
    SELECT id, parent_id, folder_name, folder_path, disc_path,
           level, file_count, total_size
    FROM tbl_folder
    WHERE id = ANY($1::int[])
    ORDER BY id ASC
  `

  console.log(
    `[FolderIndexReader] site=${siteCode}, reading ${folderIds.length} folders`
  )

  const { rows } = await sourceQuery<SourceFolderRecord>(sql, [folderIds])

  console.log(`[FolderIndexReader] Read ${rows.length} folder records`)

  return {
    rows,
    recordCount: rows.length,
  }
}