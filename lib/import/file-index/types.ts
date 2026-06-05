/**
 * File Index Types
 * Sprint 2C.18B - 任务级文件索引
 */

export interface FileIndexRecord {
  source_site_id: string
  source_table: string
  source_id: string
  task_source_id: string
  folder_source_id: string | null
  slot_id: number | null
  file_name: string | null
  file_size: bigint | null
  content_type: string | null
  status: number | null
  hash: string | null
  source_created_at: Date | null
  indexed_at: Date
  batch_id: string
  checksum: string | null
  raw_metadata: RawMetadata
}

export interface FolderIndexRecord {
  source_site_id: string
  source_table: string
  source_id: string
  parent_source_id: string | null
  name: string | null
  folder_path: string | null
  disc_path: string | null
  level: number | null
  file_count: number | null
  total_size: bigint | null
  indexed_at: Date
  batch_id: string
  checksum: string | null
  raw_metadata: RawMetadata
}

export interface RawMetadata {
  batch_id: string
  task_id: string
  from_id: number
  limit: number
  storage_class?: string
  burn_times?: number
  record_count?: number
}

export interface FileIndexImportConfig {
  siteCode: string
  taskId: string
  fromId: number
  limit: number
  batchId: string
}

export interface FileIndexImportResult {
  status: 'success' | 'failed' | 'skipped' | 'duplicated'
  batchId: string
  fileCount: number
  folderCount: number
  errorMessage?: string
}