/**
 * Devices Ingest Service
 * Sprint 2B.7 - Devices Ingest
 *
 * 接收站点推送的 devices 数据包，经过校验、幂等、UPSERT 写入 unified_devices
 */

import { transaction } from '@/lib/db'
import { upsertDevicesInTransaction } from '@/lib/sync/upsert'
import type { DeviceSourceRecord, UnifiedDeviceRecord } from '@/lib/sync/types'
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
const ALLOWED_SOURCE_TABLES = ['tbl_disc_lib']

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
 * Map device source record for ingest (uses API-provided siteCode)
 */
function mapDeviceForIngest(source: DeviceSourceRecord, siteCode: string, sourceTable: string): UnifiedDeviceRecord {
  return {
    source_site_id: siteCode,
    source_table: sourceTable,
    source_id: String(source.id),
    synced_at: new Date(),
    device_id: source.device_no,
    device_name: source.device_name,
    device_type: source.device_type,
    status: source.device_status,
    ip_address: source.ip_address,
    location: source.location,
    room: source.room,
    floor: source.floor,
    total_capacity: source.total_capacity,
    used_capacity: source.used_capacity,
    raw_data: source,
  }
}

/**
 * 处理 devices ingest
 */
export async function ingestDevices(
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
    // 6. 转换为 DeviceSourceRecord
    const deviceRecords: DeviceSourceRecord[] = records.map((r) => ({
      id: r.id as number,
      device_no: r.device_no as string,
      device_name: r.device_name as string,
      device_type: r.device_type as string,
      device_status: r.device_status as string,
      last_heartbeat: r.last_heartbeat ? new Date(r.last_heartbeat as string) : null,
      operator: r.operator as string,
      ip_address: r.ip_address as string,
      location: r.location as string,
      room: r.room as string,
      floor: r.floor as string,
      total_capacity: r.total_capacity as number,
      used_capacity: r.used_capacity as number,
      created_at: new Date(r.created_at as string),
      updated_at: new Date(r.updated_at as string),
    }))

    // 7. 映射为统一格式
    const mappedRecords = deviceRecords.map((r) => mapDeviceForIngest(r, siteCode, sourceTable))

    // 8. 事务内 UPSERT
    const { rowsUpserted } = await transaction(async (client) => {
      return upsertDevicesInTransaction(mappedRecords, client)
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
