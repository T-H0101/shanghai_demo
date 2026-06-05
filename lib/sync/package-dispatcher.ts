/**
 * Sync Package Dispatch Registry
 * Sprint 2D.2 - 按 tableName 分发到对应 mapper/upsert
 *
 * 严格白名单：仅 tbl_task / tbl_disc_lib
 * 复用现有 mapper 和 upsert，不复制两套
 */

import { transaction } from '@/lib/db'
import { mapRealTask, mapRealDevice } from '@/lib/import/real-field-mapper'
import { upsertTasksInTransaction, upsertDevicesInTransaction } from './upsert'
import type { AllowedPackageTable } from './package-schema'

export interface DispatchInput {
  tableName: AllowedPackageTable
  siteCode: string
  records: Record<string, unknown>[]
}

export interface DispatchResult {
  tableName: string
  received: number
  upserted: number
  inserted: number
  updated: number
  skipped: number
  failed: number
  status: 'success' | 'failed' | 'skipped'
  errorMessage?: string
}

/**
 * tbl_task 派发
 */
async function dispatchTask(input: DispatchInput): Promise<DispatchResult> {
  const mapped = input.records.map((r) => mapRealTask(r, input.siteCode, 'tbl_task'))
  const result = await transaction(async (client) => {
    return upsertTasksInTransaction(mapped, client)
  })
  return {
    tableName: input.tableName,
    received: input.records.length,
    upserted: result.rowsUpserted,
    inserted: result.rowsUpserted, // 当前 upsert 不区分 inserted/updated
    updated: 0,
    skipped: 0,
    failed: 0,
    status: 'success',
  }
}

/**
 * tbl_disc_lib 派发
 */
async function dispatchDevice(input: DispatchInput): Promise<DispatchResult> {
  const mapped = input.records.map((r) => mapRealDevice(r, input.siteCode, 'tbl_disc_lib'))
  const result = await transaction(async (client) => {
    return upsertDevicesInTransaction(mapped, client)
  })
  return {
    tableName: input.tableName,
    received: input.records.length,
    upserted: result.rowsUpserted,
    inserted: result.rowsUpserted,
    updated: 0,
    skipped: 0,
    failed: 0,
    status: 'success',
  }
}

/**
 * dispatch 注册表
 * 新增表只需在此添加一行
 */
const REGISTRY: Record<AllowedPackageTable, (input: DispatchInput) => Promise<DispatchResult>> = {
  tbl_task: dispatchTask,
  tbl_disc_lib: dispatchDevice,
}

/**
 * 统一派发入口
 */
export async function dispatchTable(input: DispatchInput): Promise<DispatchResult> {
  const handler = REGISTRY[input.tableName]
  if (!handler) {
    return {
      tableName: input.tableName,
      received: input.records.length,
      upserted: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: input.records.length,
      status: 'failed',
      errorMessage: `No dispatcher for ${input.tableName}`,
    }
  }

  try {
    return await handler(input)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return {
      tableName: input.tableName,
      received: input.records.length,
      upserted: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: input.records.length,
      status: 'failed',
      errorMessage,
    }
  }
}

export const SUPPORTED_PACKAGE_TABLES = Object.keys(REGISTRY) as AllowedPackageTable[]