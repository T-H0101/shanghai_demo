/**
 * 同步状态 DTO（API 对外响应）
 */
export interface SyncStatusDTO {
  siteId: string
  tableName: string
  lastSourceId: number
  lastSyncTime: string | null
  lastStatus: string
  syncedRows: number
  lastError: string | null
}

/**
 * 同步日志 DTO（API 对外响应）
 */
export interface SyncLogDTO {
  siteId: string
  tableName: string
  jobId: string
  status: 'success' | 'failed' | 'skipped' | 'running'
  rowsRead: number
  rowsUpserted: number
  rowsSkipped: number
  error: string | null
  startedAt: string
  finishedAt: string | null
}