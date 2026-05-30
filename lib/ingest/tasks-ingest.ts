/**
 * Tasks Ingest Service
 * Sprint 2B.6 - 最小 ingest API 原型
 *
 * 接收站点推送的 tasks 数据包，经过校验、幂等、UPSERT 写入 unified_tasks
 */

import { transaction } from '@/lib/db'
import { upsertTasksInTransaction } from '@/lib/sync/upsert'
import type { TaskSourceRecord, UnifiedTaskRecord } from '@/lib/sync/types'
import type { IngestRequest, IngestSuccessResponse } from './types'
import {
  validationError,
  unsupportedSourceTableError,
  recordLimitExceededError,
  duplicateBatchError,
  databaseError,
} from './errors'
import {
  getSuccessfulBatch,
  createBatchLog,
  updateBatchLogSuccess,
  updateBatchLogFailed,
  calculatePayloadHash,
} from './batch-log'

// 允许的 sourceTable
const ALLOWED_SOURCE_TABLES = ['tbl_task']

// 最大记录数限制
const MAX_RECORDS = 10000

/**
 * 校验请求体
 */
function validateRequest(body: IngestRequest) {
  const errors: Array<{ field: string; expected?: unknown; actual?: unknown; message?: string }> = []

  // 必填字段
  if (!body.siteCode) {
    errors.push({ field: 'siteCode', message: 'siteCode is required' })
  }
  if (!body.sourceTable) {
    errors.push({ field: 'sourceTable', message: 'sourceTable is required' })
  }
  if (!body.batchId) {
    errors.push({ field: 'batchId', message: 'batchId is required' })
  }
  if (!body.snapshotAt) {
    errors.push({ field: 'snapshotAt', message: 'snapshotAt is required' })
  }
  if (body.recordCount === undefined || body.recordCount === null) {
    errors.push({ field: 'recordCount', message: 'recordCount is required' })
  }
  if (!Array.isArray(body.records)) {
    errors.push({ field: 'records', message: 'records must be an array' })
  }

  // recordCount 校验（只在 recordCount 未超过限制时检查 mismatch）
  if (body.recordCount !== undefined && body.recordCount !== null && body.recordCount <= MAX_RECORDS) {
    if (Array.isArray(body.records) && body.recordCount !== body.records.length) {
      errors.push({
        field: 'recordCount',
        expected: body.recordCount,
        actual: body.records.length,
        message: 'recordCount does not match records.length',
      })
    }
  }

  return errors
}

/**
 * Map task source record for ingest (uses API-provided siteCode)
 */
function mapTaskForIngest(source: TaskSourceRecord, siteCode: string, sourceTable: string): UnifiedTaskRecord {
  return {
    source_site_id: siteCode,
    source_table: sourceTable,
    source_id: String(source.id),
    synced_at: new Date(),
    task_no: source.task_no,
    task_name: source.task_name,
    task_type: source.task_type,
    status: source.status,
    phase: source.phase,
    priority: source.priority,
    data_classification: source.data_classification,
    archive_name: source.archive_name,
    source_path: source.source_path,
    package_path: source.package_path,
    operator: source.operator,
    department: source.department,
    total_files: 0,
    total_size: 0,
    raw_data: source,
  }
}

/**
 * 处理 tasks ingest
 */
export async function ingestTasks(
  body: IngestRequest,
  siteCode: string
): Promise<IngestSuccessResponse> {
  const { sourceTable, batchId, snapshotAt, records } = body

  // 1. 校验 sourceTable
  if (!ALLOWED_SOURCE_TABLES.includes(sourceTable)) {
    throw { response: unsupportedSourceTableError(sourceTable) }
  }

  // 2. 校验记录数限制（检查 recordCount，返回 413）
  if (body.recordCount > MAX_RECORDS) {
    throw { response: recordLimitExceededError(body.recordCount, MAX_RECORDS) }
  }

  // 3. 校验请求体
  const validationErrors = validateRequest(body)
  if (validationErrors.length > 0) {
    throw {
      response: validationError('Validation failed', validationErrors),
    }
  }

  // 4. 计算 payload hash 和检查 batchId 幂等（并行执行）
  const [payloadHash, existingBatch] = await Promise.all([
    calculatePayloadHash(body),
    getSuccessfulBatch(batchId, siteCode, sourceTable),
  ])
  if (existingBatch) {
    // 检查 payload hash 是否一致
    if (existingBatch.payload_hash === payloadHash) {
      // 内容一致，返回 duplicated
      return {
        status: 'success',
        duplicated: true,
        rowsUpserted: 0,
        batchId,
      }
    } else {
      // 内容不一致，返回 409
      throw { response: duplicateBatchError(batchId) }
    }
  }

  // 5. 创建 batch_log
  const logId = await createBatchLog(
    batchId,
    siteCode,
    sourceTable,
    snapshotAt,
    records.length,
    payloadHash
  )

  try {
    // 6. 转换为 UnifiedTaskRecord
    const taskRecords: TaskSourceRecord[] = records.map((r) => ({
      id: r.id as number,
      task_no: r.task_no as string,
      task_name: r.task_name as string,
      task_type: r.task_type as string,
      status: r.status as string,
      phase: r.phase as string,
      priority: r.priority as string,
      data_classification: r.data_classification as string,
      archive_name: r.archive_name as string,
      source_path: r.source_path as string,
      package_path: r.package_path as string,
      operator: r.operator as string,
      department: r.department as string,
      created_at: new Date(r.created_at as string),
      updated_at: new Date(r.updated_at as string),
    }))

    // 7. 映射为统一格式
    const mappedRecords = taskRecords.map((r) => mapTaskForIngest(r, siteCode, sourceTable))

    // 8. 事务内 UPSERT
    const { rowsUpserted } = await transaction(async (client) => {
      return upsertTasksInTransaction(mappedRecords, client)
    })

    // 9. 更新 batch_log 为 success
    await updateBatchLogSuccess(logId, rowsUpserted)

    return {
      status: 'success',
      duplicated: false,
      rowsUpserted,
      batchId,
    }
  } catch (error) {
    // 10. 失败处理
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await updateBatchLogFailed(logId, errorMessage)

    // 如果是已知错误响应，直接抛出
    if (error && typeof error === 'object' && 'response' in error) {
      throw error
    }

    throw { response: databaseError(errorMessage) }
  }
}
