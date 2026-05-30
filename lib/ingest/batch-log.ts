/**
 * ingest_batch_log 读写操作
 * Sprint 2B.6 - Tasks Ingest API
 */

import { query } from '@/lib/db'

/**
 * 计算 payload hash (SHA-256)
 */
export async function calculatePayloadHash(payload: unknown): Promise<string> {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 检查 batchId 是否已成功处理
 * @returns 已成功返回记录，未找到返回 null
 */
export async function getSuccessfulBatch(
  batchId: string,
  siteCode: string,
  sourceTable: string
) {
  const sql = `
    SELECT id, batch_id, payload_hash
    FROM ingest_batch_log
    WHERE batch_id = $1
      AND site_code = $2
      AND source_table = $3
      AND status = 'success'
    ORDER BY created_at DESC
    LIMIT 1
  `
  const result = await query(sql, [batchId, siteCode, sourceTable])
  return result.rows[0] || null
}

/**
 * 创建 ingest_batch_log 记录
 * @returns 创建的记录 id
 */
export async function createBatchLog(
  batchId: string,
  siteCode: string,
  sourceTable: string,
  snapshotAt: string | null,
  rowsReceived: number,
  payloadHash: string,
  batchSource: string = 'provided'
): Promise<string> {
  const sql = `
    INSERT INTO ingest_batch_log (
      batch_id, site_code, source_table, snapshot_at,
      received_at, status, rows_received, payload_hash, batch_source
    ) VALUES ($1, $2, $3, $4, NOW(), 'pending', $5, $6, $7)
    RETURNING id
  `
  const result = await query(sql, [
    batchId,
    siteCode,
    sourceTable,
    snapshotAt,
    rowsReceived,
    payloadHash,
    batchSource,
  ])
  return result.rows[0].id
}

/**
 * 更新 batch_log 状态为 success
 */
export async function updateBatchLogSuccess(
  logId: string,
  rowsUpserted: number,
  duplicated: boolean = false
) {
  const sql = `
    UPDATE ingest_batch_log
    SET status = 'success',
        processed_at = NOW(),
        rows_upserted = $1,
        duplicated = $2
    WHERE id = $3
  `
  await query(sql, [rowsUpserted, duplicated, logId])
}

/**
 * 更新 batch_log 状态为 failed
 */
export async function updateBatchLogFailed(
  logId: string,
  errorMessage: string
) {
  const sql = `
    UPDATE ingest_batch_log
    SET status = 'failed',
        processed_at = NOW(),
        error_message = $1
    WHERE id = $2
  `
  await query(sql, [errorMessage, logId])
}
