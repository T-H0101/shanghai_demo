/**
 * Sync Package Dispatch Registry
 * Sprint 2D.2 - 按 tableName 分发到对应 mapper/upsert
 * Sprint 2D.3 - 扩展到 10 张已接入小表
 *
 * 复用现有 mapper (lib/import/real-field-mapper.ts) for tbl_task / tbl_disc_lib
 * 其他 8 张表使用最小 inline UPSERT 写入 unified_* (避免复制原 importer 的复杂逻辑)
 *
 * 严格白名单: 见 ALLOWED_PACKAGE_TABLES
 */

import { transaction, query } from '@/lib/db'
import { mapRealTask, mapRealDevice } from '@/lib/import/real-field-mapper'
import { upsertTasksInTransaction, upsertDevicesInTransaction } from './upsert'
import {
  mapUser,
  mapSite,
  mapPlatform,
  sanitizeRawData,
} from '@/lib/import/user-site-platform/mapper'
import {
  upsertUsersInTransaction,
  upsertSitesInTransaction,
  upsertPlatformsInTransaction,
} from '@/lib/import/user-site-platform/upsert'
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

// ============================================================
// tbl_task (复用 mapRealTask)
// ============================================================
async function dispatchTask(input: DispatchInput): Promise<DispatchResult> {
  const mapped = input.records.map((r) => mapRealTask(r, input.siteCode, 'tbl_task'))
  const result = await transaction(async (client) => {
    return upsertTasksInTransaction(mapped, client)
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

// ============================================================
// tbl_disc_lib (复用 mapRealDevice)
// ============================================================
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

// ============================================================
// 其他 8 张表 - 最小 inline UPSERT
// 不复制原 importer 复杂逻辑，仅写入 unified_*
// ============================================================

async function dispatchMagzines(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_magazines', {
    sourceIdField: 'id',
    columns: ['magazine_id', 'barcode', 'rfid', 'device_id', 'status', 'position', 'slot_count'],
  })
}

async function dispatchSlots(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slots', {
    sourceIdField: 'id',
    columns: ['slot_id', 'slot_index', 'device_id', 'magazine_id', 'status', 'occupied', 'media_id', 'media_type', 'capacity'],
  })
}

async function dispatchHardDisks(input: DispatchInput): Promise<DispatchResult> {
  // hard-disk 用 slot_id 作为 source_id (与 hard-disk-importer 一致)
  return inlineUpsert(input, 'unified_hard_disks', {
    sourceIdField: 'slot_id',
    columns: ['disk_id', 'device_id', 'slot_index', 'capacity', 'model', 'serial_no', 'status', 'used_capacity', 'total_capacity', 'health_status'],
    sourceIdTransform: (v) => String(v),
  })
}

async function dispatchLibTask(input: DispatchInput): Promise<DispatchResult> {
  // tbl_lib_task 是任务-设备关系表，存为聚合记录
  return inlineUpsert(input, 'unified_tasks', {
    sourceIdField: 'task_id',
    columns: [], // 不直接写具体字段，由 device_id 关联在 task 上
    skip: true, // 占位: lib_task 由聚合器后置处理
  })
}

async function dispatchDiscMedia(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_disc_media', {
    sourceIdField: 'id',
    columns: ['source_task_id', 'disc_num', 'disc_label', 'slot_id', 'device_id', 'used_size', 'extra_size', 'iso_status', 'iso_path', 'burn_success', 'burn_errors', 'error_files', 'stage'],
  })
}

async function dispatchLogicalVolume(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_volumes', {
    sourceIdField: 'id',
    columns: ['volume_name', 'volume_type', 'capacity', 'used_capacity', 'status'],
  })
}

async function dispatchVolumeSlot(input: DispatchInput): Promise<DispatchResult> {
  // volume_slot 是逻辑卷-槽位关系，存为聚合
  return inlineUpsert(input, 'unified_volumes', {
    sourceIdField: 'volume_id',
    columns: [],
    skip: true, // 占位: 由聚合器处理
  })
}

async function dispatchUserTask(input: DispatchInput): Promise<DispatchResult> {
  // user_task 是任务-用户关系，存为聚合
  return inlineUpsert(input, 'unified_tasks', {
    sourceIdField: 'task_id',
    columns: [],
    skip: true, // 占位: 由聚合器处理
  })
}

// ============================================================
// Sprint 2E.2 - 用户 / 站点 / 平台
// ============================================================

async function dispatchUser(input: DispatchInput): Promise<DispatchResult> {
  const mapped = input.records.map((r) => mapUser(r, input.siteCode))
  const result = await transaction(async (client) => {
    return upsertUsersInTransaction(mapped, client)
  })
  return {
    tableName: input.tableName,
    received: input.records.length,
    upserted: result.insertedCount + result.updatedCount,
    inserted: result.insertedCount,
    updated: result.updatedCount,
    skipped: 0,
    failed: 0,
    status: 'success',
  }
}

async function dispatchSite(input: DispatchInput): Promise<DispatchResult> {
  const mapped = input.records.map((r) => mapSite(r, input.siteCode))
  const result = await transaction(async (client) => {
    return upsertSitesInTransaction(mapped, client)
  })
  return {
    tableName: input.tableName,
    received: input.records.length,
    upserted: result.insertedCount + result.updatedCount,
    inserted: result.insertedCount,
    updated: result.updatedCount,
    skipped: 0,
    failed: 0,
    status: 'success',
  }
}

async function dispatchPlatform(input: DispatchInput): Promise<DispatchResult> {
  const mapped = input.records.map((r) => mapPlatform(r, input.siteCode))
  const result = await transaction(async (client) => {
    return upsertPlatformsInTransaction(mapped, client)
  })
  return {
    tableName: input.tableName,
    received: input.records.length,
    upserted: result.insertedCount + result.updatedCount,
    inserted: result.insertedCount,
    updated: result.updatedCount,
    skipped: 0,
    failed: 0,
    status: 'success',
  }
}

// ============================================================
// 通用 inline UPSERT helper
// ============================================================

interface InlineUpsertConfig {
  sourceIdField: string
  columns: string[]
  sourceIdTransform?: (v: unknown) => string
  skip?: boolean
}

async function inlineUpsert(
  input: DispatchInput,
  targetTable: string,
  config: InlineUpsertConfig
): Promise<DispatchResult> {
  if (config.skip || input.records.length === 0) {
    return {
      tableName: input.tableName,
      received: input.records.length,
      upserted: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      status: 'success',
    }
  }

  let upserted = 0
  for (const record of input.records) {
    const sourceId = config.sourceIdTransform
      ? config.sourceIdTransform(record[config.sourceIdField])
      : String(record[config.sourceIdField] ?? '')

    if (!sourceId) {
      console.warn(`[Dispatcher] ${input.tableName}: missing ${config.sourceIdField}`)
      continue
    }

    const values = config.columns.map((col) => record[col] ?? null)
    const placeholders = [
      '$1', // source_site_id
      '$2', // source_table
      '$3', // source_id
      'NOW()', // synced_at
      ...config.columns.map((_, i) => `$${i + 4}`),
      '$' + (config.columns.length + 4) + '::jsonb', // raw_data
    ]

    const updateSet = [
      'synced_at = NOW()',
      ...config.columns.map((col) => `${col} = EXCLUDED.${col}`),
      'updated_at = NOW()',
    ]

    const sql = `
      INSERT INTO ${targetTable} (
        source_site_id, source_table, source_id, synced_at,
        ${config.columns.join(', ')},
        raw_data
      ) VALUES (
        ${placeholders.join(', ')}
      )
      ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
        ${updateSet.join(', ')}
    `

    const result = await query(sql, [
      input.siteCode,
      input.tableName,
      sourceId,
      ...values,
      JSON.stringify(record),
    ])
    upserted += result.rowCount ?? 0
  }

  return {
    tableName: input.tableName,
    received: input.records.length,
    upserted,
    inserted: upserted,
    updated: 0,
    skipped: 0,
    failed: 0,
    status: 'success',
  }
}

// ============================================================
// Dispatch Registry
// ============================================================
const REGISTRY: Record<AllowedPackageTable, (input: DispatchInput) => Promise<DispatchResult>> = {
  tbl_task: dispatchTask,
  tbl_disc_lib: dispatchDevice,
  tbl_magzines: dispatchMagzines,
  tbl_slots: dispatchSlots,
  tbl_hd_info: dispatchHardDisks,
  tbl_lib_task: dispatchLibTask,
  tbl_disc: dispatchDiscMedia,
  tbl_logical_volume: dispatchLogicalVolume,
  tbl_volume_slot: dispatchVolumeSlot,
  tbl_user_task: dispatchUserTask,
  tbl_user: dispatchUser,
  tbl_site: dispatchSite,
  tbl_platform: dispatchPlatform,
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