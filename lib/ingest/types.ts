/**
 * Ingest 相关类型定义
 * Sprint 2B.6 - Tasks Ingest API
 */

/**
 * Ingest 请求体
 */
export interface IngestRequest {
  siteCode: string
  sourceTable: string
  batchId: string
  snapshotAt: string
  recordCount: number
  records: Record<string, unknown>[]
}

/**
 * Ingest 成功响应
 */
export interface IngestSuccessResponse {
  status: 'success'
  duplicated: boolean
  rowsUpserted: number
  batchId: string
}

/**
 * Ingest 错误响应
 */
export interface IngestErrorResponse {
  status: 'error'
  code: string
  message: string
  errors?: Array<{
    field: string
    expected?: unknown
    actual?: unknown
    message?: string
  }>
}

/**
 * ingest_batch_log 记录
 */
export interface IngestBatchLog {
  id: string
  batch_id: string
  site_code: string
  source_table: string
  snapshot_at: Date | null
  received_at: Date
  processed_at: Date | null
  status: string
  rows_received: number
  rows_upserted: number
  error_message: string | null
  duplicated: boolean
  payload_hash: string | null
  batch_source: string
  created_at: Date
}

/**
 * API Key 配置
 */
export interface ApiKeyConfig {
  siteCode: string
  apiKey: string
}
