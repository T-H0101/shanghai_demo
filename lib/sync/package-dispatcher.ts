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
import { aggregateLibTaskRuntimes } from '@/lib/import/lib-task-aggregator'
import { aggregateVolumeSlots } from '@/lib/import/volume-slot-aggregator'
import { aggregateUserTasks } from '@/lib/import/user-task-aggregator'
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
  /**
   * Sprint 2H.2: 真实状态
   *  - success: 全部 upserted 成功
   *  - failed: 全部记录都失败 (如 sourceId 全部缺失)
   *  - partial: 部分成功, 部分失败
   *  - skipped: 空包, dispatcher skip:true 或 records.length=0
   */
  status: 'success' | 'failed' | 'partial' | 'skipped'
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
  // Sprint 2H.2: 源表主键是 mag_id, 不是 id
  // 字段映射基于 source_restore 实际 schema (Sprint 2H.1R 审计)
  return inlineUpsert(input, 'unified_magazines', {
    sourceIdField: 'mag_id',
    // 源 → 中心: mag_id→magazine_id, lib_id→device_id, mag_order→position, door_status→status
    columns: [
      { source: 'lib_id',      target: 'device_id' },
      { source: 'rfid',        target: 'rfid' },
      { source: 'mag_order',   target: 'position' },
      { source: 'door_status', target: 'status' },
    ],
  })
}

async function dispatchSlots(input: DispatchInput): Promise<DispatchResult> {
  // Sprint 2H.2: 源表主键是 slot_id, 不是 id
  // 字段映射: mag_id→magazine_id, slot_order→slot_index, max_cap→capacity, disc_type→media_type
  // R.17 增强: tbl_slots 没有 lib_id 列, slot.device_id 通过 tbl_magzines.mag_id→lib_id 反查填入
  const upsertResult = await inlineUpsert(input, 'unified_slots', {
    sourceIdField: 'slot_id',
    columns: [
      { source: 'mag_id',     target: 'magazine_id' },
      { source: 'slot_order', target: 'slot_index' },
      { source: 'max_cap',    target: 'capacity' },
      { source: 'disc_type',  target: 'media_type' },
    ],
  })
  // R.17 二次回填: 用 unified_magazines.device_id 反向填 unified_slots.device_id
  // 仅对 device_id 为空的行更新
  // R.17.1 修正: unified_magazines.magazine_id 字段在源端是空, JOIN 应用 source_id (=tbl_magzines.mag_id)
  if (upsertResult.upserted > 0) {
    try {
      const { query: pgQuery } = await import('@/lib/db/postgres')
      await pgQuery(
        `UPDATE unified_slots s
         SET device_id = m.device_id, updated_at = NOW()
         FROM unified_magazines m
         WHERE s.source_site_id = m.source_site_id
           AND s.magazine_id = m.source_id
           AND s.source_site_id = $1
           AND (s.device_id IS NULL OR s.device_id = '')`,
        [input.siteCode]
      )
    } catch (e) {
      console.warn(`[R.17 dispatcherSlots] backfill device_id failed: ${(e as Error).message}`)
    }
  }
  return upsertResult
}

async function dispatchHardDisks(input: DispatchInput): Promise<DispatchResult> {
  // Sprint 2H.2: 源表主键是 slot_id, 中心表 disk_id 不存在
  // 字段映射: serial_num→serial_no, name→model, hd_status→status, health→health_status
  // 中心表 disk_id/capacity/used_capacity/total_capacity/slot_index 在源端不存在, 留空
  return inlineUpsert(input, 'unified_hard_disks', {
    sourceIdField: 'slot_id',
    columns: [
      { source: 'serial_num', target: 'serial_no' },
      { source: 'name',       target: 'model' },
      { source: 'hd_status',  target: 'status' },
      { source: 'health',     target: 'health_status' },
    ],
  })
}

async function dispatchLibTask(input: DispatchInput): Promise<DispatchResult> {
  // Sprint 2H.3 (autonomous): tbl_lib_task 是任务-设备关系表, dispatcher 收到 records 后
  // 触发 lib-task 聚合器, 把 runtime_seconds 写回 unified_tasks。
  // 注: 聚合器读的是 source_restore.tbl_lib_task, 这里用 records 数量作为"received",
  //     upserted 反映真实命中的 unified_tasks 行数 (runtime 推算后被更新)。
  try {
    const agg = await aggregateLibTaskRuntimes(input.siteCode)
    return {
      tableName: input.tableName,
      received: input.records.length,
      upserted: agg.unifiedRowsUpdated,
      inserted: 0,
      updated: agg.unifiedRowsUpdated,
      skipped: 0,
      failed: 0,
      status: agg.unifiedRowsUpdated > 0 ? 'success' : 'skipped',
      errorMessage:
        agg.readCount > 0 && agg.unifiedRowsUpdated === 0
          ? `tbl_lib_task ${agg.readCount} 行, 推算 ${agg.tasksWithRuntime} 个 task runtime, 但 ${agg.unifiedRowsScanned - agg.unifiedRowsUpdated} 个 task 已有 runtime / 未匹配到 siteCode=${input.siteCode} 的 source_id`
          : undefined,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return {
      tableName: input.tableName,
      received: input.records.length,
      upserted: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: input.records.length,
      status: 'failed',
      errorMessage: `aggregateLibTaskRuntimes failed: ${msg.slice(0, 200)}`,
    }
  }
}

async function dispatchDiscMedia(input: DispatchInput): Promise<DispatchResult> {
  // Sprint 2H.2: source 字段映射
  // task_id→source_task_id, disc_num→disc_num, disc_label→disc_label,
  // slot_id→slot_id, used_size→used_size, extra_size→extra_size,
  // iso_status→iso_status, iso_path→iso_path, burn_success→burn_success,
  // burn_errors→burn_errors, error_files→error_files, stage→stage
  return inlineUpsert(input, 'unified_disc_media', {
    sourceIdField: 'id',
    columns: [
      { source: 'task_id',      target: 'source_task_id' },
      { source: 'slot_id',      target: 'slot_id' },
      { source: 'disc_num',     target: 'disc_num' },
      { source: 'disc_label',   target: 'disc_label' },
      { source: 'used_size',    target: 'used_size' },
      { source: 'extra_size',   target: 'extra_size' },
      { source: 'iso_status',   target: 'iso_status' },
      { source: 'iso_path',     target: 'iso_path' },
      { source: 'burn_success', target: 'burn_success' },
      { source: 'burn_errors',  target: 'burn_errors' },
      { source: 'error_files',  target: 'error_files' },
      { source: 'stage',        target: 'stage' },
    ],
  })
}

async function dispatchLogicalVolume(input: DispatchInput): Promise<DispatchResult> {
  // Sprint 2H.2: 源表主键是 volume_id, 不是 id
  // 字段映射: name→volume_name, type→volume_type, total_cap→capacity, used_cap→used_capacity, del_flag→status
  return inlineUpsert(input, 'unified_volumes', {
    sourceIdField: 'volume_id',
    columns: [
      { source: 'name',      target: 'volume_name' },
      { source: 'type',      target: 'volume_type' },
      { source: 'total_cap', target: 'capacity' },
      { source: 'used_cap',  target: 'used_capacity' },
      { source: 'del_flag',  target: 'status' },
    ],
  })
}

async function dispatchVolumeSlot(input: DispatchInput): Promise<DispatchResult> {
  // Sprint 2H.3 (autonomous): 触发 volume-slot 聚合器, 把 slot_count/total_slot_cap
  // 写到 unified_volumes.raw_data._aggregate。
  try {
    const agg = await aggregateVolumeSlots(input.siteCode)
    return {
      tableName: input.tableName,
      received: input.records.length,
      upserted: agg.unifiedRowsUpdated,
      inserted: 0,
      updated: agg.unifiedRowsUpdated,
      skipped: 0,
      failed: 0,
      status: agg.unifiedRowsUpdated > 0 ? 'success' : 'skipped',
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return {
      tableName: input.tableName,
      received: input.records.length,
      upserted: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: input.records.length,
      status: 'failed',
      errorMessage: `aggregateVolumeSlots failed: ${msg.slice(0, 200)}`,
    }
  }
}

async function dispatchUserTask(input: DispatchInput): Promise<DispatchResult> {
  // Sprint 2H.3 (autonomous): 触发 user-task 聚合器, 写 raw_data._aggregate.user_task_count
  // 不写 user_id 字段 (源端 user_id NULL 风险)。
  try {
    const agg = await aggregateUserTasks(input.siteCode)
    return {
      tableName: input.tableName,
      received: input.records.length,
      upserted: agg.unifiedRowsUpdated,
      inserted: 0,
      updated: agg.unifiedRowsUpdated,
      skipped: 0,
      failed: 0,
      status: agg.unifiedRowsUpdated > 0 ? 'success' : 'skipped',
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return {
      tableName: input.tableName,
      received: input.records.length,
      upserted: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: input.records.length,
      status: 'failed',
      errorMessage: `aggregateUserTasks failed: ${msg.slice(0, 200)}`,
    }
  }
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

/**
 * 字段映射项: 源表列名 → 中心表列名
 * Sprint 2H.2: 取代旧版 columns: string[], 支持源/目标字段不同名
 */
interface ColumnMapping {
  source: string
  target: string
}

interface InlineUpsertConfig {
  sourceIdField: string
  /**
   * 列映射: { source: '源字段', target: '目标字段' }
   * 也支持简写 string (源/目标同名字段)
   */
  columns: Array<string | ColumnMapping>
  sourceIdTransform?: (v: unknown) => string
  skip?: boolean
}

/**
 * 标准化列映射为 { source, target } 形式
 */
function normalizeColumns(cols: InlineUpsertConfig['columns']): ColumnMapping[] {
  return cols.map((c) => (typeof c === 'string' ? { source: c, target: c } : c))
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

  const colMaps = normalizeColumns(config.columns)
  const targetCols = colMaps.map((c) => c.target)

  let upserted = 0
  let inserted = 0
  let updated = 0
  let skipped = 0
  let failed = 0
  const errorMessages: string[] = []

  for (const record of input.records) {
    // 1. 解析 sourceId
    const rawId = record[config.sourceIdField]
    const sourceId = config.sourceIdTransform
      ? config.sourceIdTransform(rawId)
      : String(rawId ?? '')

    if (!sourceId) {
      // Sprint 2H.2: 不再静默 continue, 计为 failed
      failed++
      const msg = `missing source id field '${config.sourceIdField}'`
      errorMessages.push(msg)
      console.warn(`[Dispatcher] ${input.tableName}: ${msg} (record keys: ${Object.keys(record).slice(0, 5).join(',')})`)
      continue
    }

    // 2. 拉取每列值 (从源字段)
    const values = colMaps.map((m) => record[m.source] ?? null)

    // 3. 拼 SQL
    const placeholders = [
      '$1', // source_site_id
      '$2', // source_table
      '$3', // source_id
      'NOW()', // synced_at
      ...targetCols.map((_, i) => `$${i + 4}`),
      '$' + (targetCols.length + 4) + '::jsonb', // raw_data
    ]

    const updateSet = [
      'synced_at = NOW()',
      ...targetCols.map((col) => `${col} = EXCLUDED.${col}`),
      'updated_at = NOW()',
    ]

    const sql = `
      INSERT INTO ${targetTable} (
        source_site_id, source_table, source_id, synced_at,
        ${targetCols.join(', ')},
        raw_data
      ) VALUES (
        ${placeholders.join(', ')}
      )
      ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
        ${updateSet.join(', ')}
      RETURNING (xmax = 0) AS is_insert
    `

    try {
      const result = await query<{ is_insert: boolean }>(sql, [
        input.siteCode,
        input.tableName,
        sourceId,
        ...values,
        JSON.stringify(record),
      ])
      // Sprint 2H.6: 用 RETURNING (xmax = 0) 区分 inserted vs updated
      // xmax = 0 表示行是新插入的 (没有老版本); xmax != 0 表示 update
      upserted += result.rowCount ?? 0
      if (result.rows.length > 0) {
        if (result.rows[0].is_insert) inserted++
        else updated++
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : 'unknown'
      errorMessages.push(`sourceId=${sourceId}: ${msg.slice(0, 100)}`)
      console.error(`[Dispatcher] ${input.tableName} upsert error: sourceId=${sourceId} ${msg}`)
    }
  }

  // 4. 决定 table status
  //    - received == 0 → success (空包)
  //    - upserted > 0 且 failed == 0 → success
  //    - upserted > 0 且 failed > 0 → partial (有 upserted 行, 也有 failed)
  //    - upserted == 0 且 failed == 0 → success (可能空)
  //    - upserted == 0 且 failed == received → failed (全部失败)
  let status: 'success' | 'failed' | 'partial' | 'skipped' = 'success'
  if (input.records.length === 0) {
    status = 'skipped'
  } else if (upserted === 0 && failed > 0) {
    status = 'failed'
  } else if (upserted > 0 && failed > 0) {
    status = 'partial'
  }

  // 5. inserted / updated 不可区分 (PG ON CONFLICT 不返回)
  //    真实处理数 = upserted, 文档化
  return {
    tableName: input.tableName,
    received: input.records.length,
    upserted,
    inserted,        // Sprint 2H.6: 真实 inserted 行数 (来自 RETURNING xmax = 0)
    updated,         // Sprint 2H.6: 真实 updated 行数
    skipped,
    failed,
    status,
    errorMessage: errorMessages.length > 0 ? errorMessages.slice(0, 3).join('; ') : undefined,
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