/**
 * 同步结果
 */
export interface SyncResult {
  status: 'success' | 'skipped' | 'failed'
  rowsRead: number
  rowsUpserted: number
  rowsSkipped: number
  startedAt: string
  finishedAt: string
  lastSourceIdBefore: number
  lastSourceIdAfter: number
  message?: string
  error?: string
}

/**
 * 源数据记录（mock_tbl_task）
 */
export interface TaskSourceRecord {
  id: number
  task_no: string
  task_name: string
  task_type: string
  status: string
  phase: string
  priority: string
  data_classification: string
  archive_name: string
  source_path: string
  package_path: string
  operator: string
  department: string
  created_at: Date
  updated_at: Date
}

/**
 * 源数据记录（mock_tbl_device）
 */
export interface DeviceSourceRecord {
  id: number
  device_id: string
  device_name: string
  device_type: string
  device_status: string
  last_heartbeat: Date | null
  operator: string
  ip_address: string
  location: string
  room: string
  floor: string
  total_capacity: number
  used_capacity: number
  created_at: Date
  updated_at: Date
}

/**
 * 统一任务记录（unified_tasks）
 */
export interface UnifiedTaskRecord {
  source_site_id: string
  source_table: string
  source_id: string
  synced_at: Date
  task_no: string
  task_name: string
  task_type: string
  status: string
  phase: string
  priority: string
  data_classification: string
  archive_name: string
  source_path: string
  package_path: string
  operator: string
  department: string
  total_files: number
  total_size: number
  raw_data: TaskSourceRecord
}

/**
 * 统一设备记录（unified_devices）
 */
export interface UnifiedDeviceRecord {
  source_site_id: string
  source_table: string
  source_id: string
  synced_at: Date
  device_id: string
  device_name: string
  device_type: string
  status: string
  ip_address: string
  location: string
  room: string
  floor: string
  total_capacity: number
  used_capacity: number
  raw_data: DeviceSourceRecord
}

/**
 * 同步进度记录
 */
export interface SyncProgress {
  id: string
  source_site_id: string
  source_table: string
  last_sync_time: Date | null
  last_source_id: number
  last_status: string
  synced_rows: number
  last_error: string | null
  created_at: Date
  updated_at: Date
}

/**
 * 同步任务日志
 */
export interface SyncJobLog {
  id: string
  job_id: string
  source_site_id: string
  source_table: string
  started_at: Date
  finished_at: Date | null
  status: string
  rows_read: number
  rows_upserted: number
  rows_skipped: number
  error_message: string | null
  created_at: Date
}