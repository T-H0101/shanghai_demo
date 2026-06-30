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
    // R.93: mag_id→magazine_id 是业务主键, 必须写入 (R.83.9 dispatcher 遗漏)
    columns: [
      { source: 'mag_id',      target: 'magazine_id' },
      { source: 'lib_id',      target: 'device_id' },
      { source: 'rfid',        target: 'rfid' },
      { source: 'mag_order',   target: 'position' },
      { source: 'door_status', target: 'status' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchSlots(input: DispatchInput): Promise<DispatchResult> {
  // Sprint 2H.2: 源表主键是 slot_id, 不是 id
  // 字段映射: mag_id→magazine_id, slot_order→slot_index, max_cap→capacity, disc_type→media_type
  // R.17 增强: tbl_slots 没有 lib_id 列, slot.device_id 通过 tbl_magzines.mag_id→lib_id 反查填入
  const upsertResult = await inlineUpsert(input, 'unified_slots', {
    sourceIdField: 'slot_id',
    columns: [
      { source: 'slot_id',    target: 'slot_id' },
      { source: 'mag_id',     target: 'magazine_id' },
      { source: 'slot_order', target: 'slot_index' },
      { source: 'max_cap',    target: 'capacity' },
      { source: 'disc_type',  target: 'media_type' },
    ],
    sourceIdColumn: 'source_record_id',
  })
  // R.93: unified_slots 二次回填 device_id, JOIN 条件适配 R.83+ source_record_id 溯源
  // magazine_id 在 R.93 dispatcher 已写入, 优先用 magazine_id JOIN; legacy 行可能仍靠 source_id
  if (upsertResult.upserted > 0) {
    try {
      const { query: pgQuery } = await import('@/lib/db/postgres')
      await pgQuery(
        `UPDATE unified_slots s
         SET device_id = m.device_id, updated_at = NOW()
         FROM unified_magazines m
         WHERE s.source_site_id = m.source_site_id
           AND (s.magazine_id = m.magazine_id OR s.magazine_id = m.source_record_id OR s.magazine_id = m.source_id)
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
    sourceIdColumn: 'source_record_id',
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
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchLogicalVolume(input: DispatchInput): Promise<DispatchResult> {
  // Sprint 2H.2: 源表主键是 volume_id, 不是 id
  // 字段映射: volume_id→volume_id (业务主键), name→volume_name, type→volume_type, total_cap→capacity, used_cap→used_capacity, del_flag→status
  // R.93: volume_id 必须写入 unified_volumes.volume_id (R.83.9 dispatcher 遗漏)
  return inlineUpsert(input, 'unified_volumes', {
    sourceIdField: 'volume_id',
    columns: [
      { source: 'volume_id', target: 'volume_id' },
      { source: 'name',      target: 'volume_name' },
      { source: 'type',      target: 'volume_type' },
      { source: 'total_cap', target: 'capacity' },
      { source: 'used_cap',  target: 'used_capacity' },
      { source: 'del_flag',  target: 'status' },
    ],
    sourceIdColumn: 'source_record_id',
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
// R.83.1 部门/项目/任务接收单 15 张 — inline UPSERT
// 全部走 source_record_id 溯源(与 R.83.1 DDL §4.3 item 2 对齐)
// ============================================================

// 复合 PK: tbl_user_role (user_id, role_id) → source_record_id = "<user_id>::<role_id>"
async function dispatchUserRole(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_user_roles', {
    sourceIdField: '__composite__',
    sourceIdTransform: (rec) => `${String((rec as Record<string, unknown>).user_id ?? '')}::${String((rec as Record<string, unknown>).role_id ?? '')}`,
    columns: [
      { source: 'user_id', target: 'user_id' },
      { source: 'role_id', target: 'role_id' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_depa (depa_id) → source_record_id = String(depa_id)
async function dispatchDepa(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_departments', {
    sourceIdField: 'depa_id',
    columns: [
      { source: 'depa_id', target: 'depa_id' },
      { source: 'depa_name', target: 'depa_name' },
      { source: 'depa_code', target: 'depa_code' },
      { source: 'alia_name', target: 'alia_name' },
      { source: 'depa_enable', target: 'depa_enable' },
      { source: 'min_optical', target: 'min_optical' },
      { source: 'create_time', target: 'create_time' },
      { source: 'update_time', target: 'update_time' },
      { source: 'base', target: 'base' },
      { source: 'del_flag', target: 'del_flag' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_workspace (ws_id) → source_record_id = String(ws_id)
async function dispatchWorkspace(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_workspaces', {
    sourceIdField: 'ws_id',
    columns: [
      { source: 'ws_id', target: 'ws_id' },
      { source: 'depa_id', target: 'depa_id' },
      { source: 'user_id', target: 'user_id' },
      { source: 'ws_name', target: 'ws_name' },
      { source: 'alia_name', target: 'alia_name' },
      { source: 'ws_enable', target: 'ws_enable' },
      { source: 'ws_type', target: 'ws_type' },
      { source: 'ws_code', target: 'ws_code' },
      { source: 'model_id', target: 'model_id' },
      { source: 'tac_id', target: 'tac_id' },
      { source: 'min_optical', target: 'min_optical' },
      { source: 'last_optical', target: 'last_optical' },
      { source: 'disk_sn', target: 'disk_sn' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// 复合 PK: tbl_workspace_user (ws_id, user_id)
async function dispatchWorkspaceUser(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_workspace_users', {
    sourceIdField: '__composite__',
    sourceIdTransform: (rec) => `${String((rec as Record<string, unknown>).ws_id ?? '')}::${String((rec as Record<string, unknown>).user_id ?? '')}`,
    columns: [
      { source: 'ws_id', target: 'ws_id' },
      { source: 'user_id', target: 'user_id' },
      { source: 'permission', target: 'permission' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// 复合 PK: tbl_depa_user (depa_id, user_id)
async function dispatchDepaUser(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_department_users', {
    sourceIdField: '__composite__',
    sourceIdTransform: (rec) => `${String((rec as Record<string, unknown>).depa_id ?? '')}::${String((rec as Record<string, unknown>).user_id ?? '')}`,
    columns: [
      { source: 'depa_id', target: 'depa_id' },
      { source: 'user_id', target: 'user_id' },
      { source: 'black_list', target: 'black_list' },
      { source: 'white_list', target: 'white_list' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_depa_user_info (id AUTO_INCREMENT) → src_id BIGINT, source_record_id = String(id)
async function dispatchDepaUserInfo(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_department_user_info', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'depa_id', target: 'depa_id' },
      { source: 'user_id', target: 'user_id' },
      { source: 'fuc_id', target: 'fuc_id' },
      { source: 'create_time', target: 'create_time' },
      { source: 'update_time', target: 'update_time' },
      { source: 'del_status', target: 'del_status' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_project (project_id)
async function dispatchProject(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_projects', {
    sourceIdField: 'project_id',
    columns: [
      { source: 'project_id', target: 'project_id' },
      { source: 'maintitle', target: 'maintitle' },
      { source: 'project_title', target: 'project_title' },
      { source: 'subtitle', target: 'subtitle' },
      { source: 'project_dt', target: 'project_dt' },
      { source: 'volume_id', target: 'volume_id' },
      { source: 'status', target: 'status' },
      { source: 'cmt', target: 'cmt' },
      { source: 'project_num', target: 'project_num' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_project_site (id AUTO_INCREMENT)
async function dispatchProjectSite(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_project_sites', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'project_id', target: 'project_id' },
      { source: 'site_id', target: 'site_id' },
      { source: 'start_time', target: 'start_time' },
      { source: 'end_time', target: 'end_time' },
      { source: 'cmt', target: 'cmt' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_task_projects (id AUTO_INCREMENT)
async function dispatchTaskProject(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_task_projects', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'project_id', target: 'project_id' },
      { source: 'cmt', target: 'cmt' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_task_receipts (id AUTO_INCREMENT)
async function dispatchTaskReceipt(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_task_receipts', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'r_id', target: 'r_id' },
      { source: 'cmt', target: 'cmt' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_task_files (id AUTO_INCREMENT)
async function dispatchTaskFile(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_task_files', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'file_path', target: 'file_path' },
      { source: 'file_size', target: 'file_size' },
      { source: 'close_time', target: 'close_time' },
      { source: 'monitor_id', target: 'monitor_id' },
      { source: 'cmt', target: 'cmt' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_task_check (id AUTO_INCREMENT)
async function dispatchTaskCheck(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_task_checks', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'lib_id', target: 'lib_id' },
      { source: 'driver', target: 'driver' },
      { source: 'mode', target: 'mode' },
      { source: 'verify_std', target: 'verify_std' },
      { source: 'batch', target: 'batch' },
      { source: 'aql', target: 'aql' },
      { source: 'accept', target: 'accept' },
      { source: 'reject', target: 'reject' },
      { source: 'discs', target: 'discs' },
      { source: 'ignored', target: 'ignored' },
      { source: 'spot', target: 'spot' },
      { source: 'person', target: 'person' },
      { source: 'date', target: 'date' },
      { source: 'cmt', target: 'cmt' },
      { source: 'slot_start', target: 'slot_start' },
      { source: 'slot_end', target: 'slot_end' },
      { source: 'status', target: 'status' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_receipt (id AUTO_INCREMENT)
async function dispatchReceipt(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_receipts', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'annual', target: 'annual' },
      { source: 'batch', target: 'batch' },
      { source: 'receive_num', target: 'receive_num' },
      { source: 'transfer_unit', target: 'transfer_unit' },
      { source: 'transferer', target: 'transferer' },
      { source: 'transfer_date', target: 'transfer_date' },
      { source: 'receive_unit', target: 'receive_unit' },
      { source: 'receiver', target: 'receiver' },
      { source: 'files_count', target: 'files_count' },
      { source: 'nums', target: 'nums' },
      { source: 'remark', target: 'remark' },
      { source: 'status', target: 'status' },
      { source: 'update_dt', target: 'update_dt' },
      { source: 'create_dt', target: 'create_dt' },
      { source: 'volume_id', target: 'volume_id' },
      { source: 'file_path', target: 'file_path' },
      { source: 'ws_id', target: 'ws_id' },
      { source: 'type', target: 'type' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// 复合 PK: tbl_receipt_check (r_file_id, check_id)
async function dispatchReceiptCheck(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_receipt_checks', {
    sourceIdField: '__composite__',
    sourceIdTransform: (rec) => `${String((rec as Record<string, unknown>).r_file_id ?? '')}::${String((rec as Record<string, unknown>).check_id ?? '')}`,
    columns: [
      { source: 'r_file_id', target: 'r_file_id' },
      { source: 'check_id', target: 'check_id' },
      { source: 'result', target: 'result' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_receipt_file (id AUTO_INCREMENT)
async function dispatchReceiptFile(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_receipt_files', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_size', target: 'file_size' },
      { source: 'hash', target: 'hash' },
      { source: 'r_id', target: 'r_id' },
      { source: 'create_date', target: 'create_date' },
      { source: 'status', target: 'status' },
      { source: 'path', target: 'path' },
      { source: 'check_id', target: 'check_id' },
      { source: 'cmt', target: 'cmt' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// ============================================================
// R.83.2 stub dispatchers
// RBAC + 字典 + 日志 + 凭据 15 张
// 这些表已建 unified_* (Tasks 1+2), 但 dispatcher 暂为最小占位:
// - 仅同步主键 + 必要通用列
// - 不做复杂列映射 (后续 Sprint 按 source schema 演进)
// - 站点不上报时 inlineUpsert 接收 0 行,直接 success (不写入)
// ============================================================

async function dispatchRole(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_roles', {
    sourceIdField: 'role_id',
    columns: [
      { source: 'role_id', target: 'src_role_id' },
      { source: 'role_name', target: 'role_name' },
      { source: 'role_code', target: 'role_code' },
      { source: 'role_type', target: 'description' },
      { source: 'del_flag', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchRoleFuc(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_role_fucs', {
    sourceIdField: '__composite__',
    sourceIdTransform: (rec) => `${String((rec as Record<string, unknown>).role_id ?? '')}::${String((rec as Record<string, unknown>).fuc_id ?? '')}`,
    columns: [
      { source: 'role_id', target: 'role_id' },
      { source: 'fuc_id', target: 'fuc_id' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchFuc(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_fucs', {
    sourceIdField: 'fun_id',
    columns: [
      { source: 'fun_id', target: 'src_fuc_id' },
      { source: 'fun_name', target: 'fuc_name' },
      { source: 'fuc_code', target: 'fuc_code' },
      { source: 'parent_id', target: 'parent_id' },
      { source: 'fun_index', target: 'sort_order' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchDictCategory(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_dict_categories', {
    sourceIdField: 'category_id',
    columns: [
      { source: 'category_id', target: 'category_id' },
      { source: 'category_name', target: 'category_name' },
      { source: 'category_code', target: 'category_code' },
    ],
  })
}

async function dispatchDict(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_dicts', {
    sourceIdField: 'dict_id',
    columns: [
      { source: 'dict_id', target: 'dict_id' },
      { source: 'category_id', target: 'category_id' },
      { source: 'dict_name', target: 'dict_name' },
      { source: 'dict_code', target: 'dict_code' },
    ],
  })
}

async function dispatchDictItem(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_dict_items', {
    sourceIdField: 'item_id',
    columns: [
      { source: 'item_id', target: 'item_id' },
      { source: 'dict_id', target: 'dict_id' },
      { source: 'item_name', target: 'item_name' },
      { source: 'item_value', target: 'item_value' },
    ],
  })
}

async function dispatchSysLog(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_sys_logs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_log_id' },
      { source: 'type', target: 'log_level' },
      { source: 'operate_type', target: 'module' },
      { source: 'content', target: 'message' },
      { source: 'user_id', target: 'user_id' },
      { source: 'ip', target: 'ip_address' },
      { source: 'create_date', target: 'log_time' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchApiLog(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_api_logs', {
    sourceIdField: 'api_log_id',
    columns: [
      { source: 'api_log_id', target: 'api_log_id' },
      { source: 'user_id', target: 'user_id' },
      { source: 'api_path', target: 'api_path' },
      { source: 'api_time', target: 'api_time' },
    ],
  })
}

async function dispatchApiInterface(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_api_interfaces', {
    sourceIdField: 'interface_id',
    columns: [
      { source: 'interface_id', target: 'interface_id' },
      { source: 'interface_name', target: 'interface_name' },
      { source: 'interface_path', target: 'interface_path' },
      { source: 'interface_method', target: 'interface_method' },
    ],
  })
}

async function dispatchUserMfa(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_user_mfa', {
    sourceIdField: 'mfa_id',
    columns: [
      { source: 'mfa_id', target: 'mfa_id' },
      { source: 'user_id', target: 'user_id' },
      { source: 'mfa_type', target: 'mfa_type' },
      { source: 'mfa_enable', target: 'mfa_enable' },
    ],
  })
}

async function dispatchArchivesType(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_archives_types', {
    sourceIdField: 'archives_type_id',
    columns: [
      { source: 'archives_type_id', target: 'archives_type_id' },
      { source: 'archives_type_name', target: 'archives_type_name' },
      { source: 'archives_type_code', target: 'archives_type_code' },
    ],
  })
}

async function dispatchArchivesLevel(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_archives_levels', {
    sourceIdField: 'archives_level_id',
    columns: [
      { source: 'archives_level_id', target: 'archives_level_id' },
      { source: 'archives_level_name', target: 'archives_level_name' },
      { source: 'archives_level_code', target: 'archives_level_code' },
    ],
  })
}

async function dispatchPlatformType(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_platform_types', {
    sourceIdField: 'type_id',
    columns: [
      { source: 'type_id', target: 'src_platform_type_id' },
      { source: 'type_name', target: 'type_name' },
      { source: 'cmt', target: 'description' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchCredibleProve(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_credible_proves', {
    sourceIdField: 'prove_id',
    columns: [
      { source: 'prove_id', target: 'prove_id' },
      { source: 'user_id', target: 'user_id' },
      { source: 'prove_type', target: 'prove_type' },
      { source: 'prove_status', target: 'prove_status' },
    ],
  })
}

async function dispatchCredibleVerify(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_credible_verifies', {
    sourceIdField: 'verify_id',
    columns: [
      { source: 'verify_id', target: 'verify_id' },
      { source: 'prove_id', target: 'prove_id' },
      { source: 'verify_status', target: 'verify_status' },
      { source: 'verify_time', target: 'verify_time' },
    ],
  })
}

// ============================================================
// R.83.3 检查巡检族 15 张 — inline UPSERT
// 全部走 source_record_id 溯源
// ============================================================

// tbl_check_category (id)
async function dispatchCheckCategory(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_categories', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_category_id' },
      { source: 'category_code', target: 'category_code' },
      { source: 'category_name', target: 'category_name' },
      { source: 'parent_id', target: 'parent_id' },
      { source: 'sort_order', target: 'sort_order' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_sub_category (id)
async function dispatchCheckSubCategory(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_sub_categories', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_sub_category_id' },
      { source: 'category_id', target: 'category_id' },
      { source: 'sub_category_code', target: 'sub_category_code' },
      { source: 'sub_category_name', target: 'sub_category_name' },
      { source: 'sort_order', target: 'sort_order' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_item (id)
async function dispatchCheckItem(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_items', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_item_id' },
      { source: 'sub_category_id', target: 'sub_category_id' },
      { source: 'item_code', target: 'item_code' },
      { source: 'item_name', target: 'item_name' },
      { source: 'check_method', target: 'check_method' },
      { source: 'pass_criteria', target: 'pass_criteria' },
      { source: 'sort_order', target: 'sort_order' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_sector (id)
async function dispatchCheckSector(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_sectors', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_sector_id' },
      { source: 'sector_code', target: 'sector_code' },
      { source: 'sector_name', target: 'sector_name' },
      { source: 'description', target: 'description' },
      { source: 'sort_order', target: 'sort_order' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_template (id)
async function dispatchCheckTemplate(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_templates', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_template_id' },
      { source: 'template_code', target: 'template_code' },
      { source: 'template_name', target: 'template_name' },
      { source: 'category_id', target: 'category_id' },
      { source: 'description', target: 'description' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_task (id)
async function dispatchCheckTask(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_tasks', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_task_id' },
      { source: 'task_name', target: 'task_name' },
      { source: 'template_id', target: 'template_id' },
      { source: 'sector_id', target: 'sector_id' },
      { source: 'status', target: 'status' },
      { source: 'scheduled_at', target: 'scheduled_at' },
      { source: 'started_at', target: 'started_at' },
      { source: 'finished_at', target: 'finished_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_task_item (id)
async function dispatchCheckTaskItem(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_task_items', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_task_item_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'item_id', target: 'item_id' },
      { source: 'result', target: 'result' },
      { source: 'remark', target: 'remark' },
      { source: 'checked_at', target: 'checked_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_task_file (id)
async function dispatchCheckTaskFile(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_task_files', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_task_file_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_path', target: 'file_path' },
      { source: 'file_size', target: 'file_size' },
      { source: 'uploaded_at', target: 'uploaded_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_file (id, singular) → unified_check_file (clean name, no suffix)
async function dispatchCheckFile(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_file', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_check_file_id' },
      { source: 'check_id', target: 'check_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_path', target: 'file_path' },
      { source: 'file_size', target: 'file_size' },
      { source: 'uploaded_at', target: 'uploaded_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_files (id, plural) → unified_check_files (clean name)
async function dispatchCheckFiles(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_files', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_check_file_id' },
      { source: 'check_id', target: 'check_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_path', target: 'file_path' },
      { source: 'file_size', target: 'file_size' },
      { source: 'uploaded_at', target: 'uploaded_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_log (id)
async function dispatchCheckLog(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_logs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_log_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'log_level', target: 'log_level' },
      { source: 'message', target: 'message' },
      { source: 'logged_at', target: 'logged_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_patrol_strategy (id)
async function dispatchCheckPatrolStrategy(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_patrol_strategies', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_strategy_id' },
      { source: 'strategy_name', target: 'strategy_name' },
      { source: 'cron_expression', target: 'cron_expression' },
      { source: 'task_template_id', target: 'task_template_id' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_patrol_task (id)
async function dispatchCheckPatrolTask(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_patrol_tasks', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_patrol_task_id' },
      { source: 'strategy_id', target: 'strategy_id' },
      { source: 'task_name', target: 'task_name' },
      { source: 'status', target: 'status' },
      { source: 'scheduled_at', target: 'scheduled_at' },
      { source: 'started_at', target: 'started_at' },
      { source: 'finished_at', target: 'finished_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_patrol_task_item (id)
async function dispatchCheckPatrolTaskItem(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_patrol_task_items', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_patrol_task_item_id' },
      { source: 'patrol_task_id', target: 'patrol_task_id' },
      { source: 'sector_id', target: 'sector_id' },
      { source: 'result', target: 'result' },
      { source: 'remark', target: 'remark' },
      { source: 'checked_at', target: 'checked_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_check_patrol_log (id)
async function dispatchCheckPatrolLog(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_check_patrol_logs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_patrol_log_id' },
      { source: 'patrol_task_id', target: 'patrol_task_id' },
      { source: 'log_level', target: 'log_level' },
      { source: 'message', target: 'message' },
      { source: 'logged_at', target: 'logged_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// ============================================================
// R.83.4 存储卷 + 调度/接口 + 设备业务族 15 张 — inline UPSERT
// 全部走 source_record_id 溯源
// ============================================================

// tbl_volume_group (id)
async function dispatchVolumeGroup(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_volume_groups', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_group_id' },
      { source: 'group_name', target: 'group_name' },
      { source: 'description', target: 'description' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_volume_dataclass (id)
async function dispatchVolumeDataclass(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_volume_dataclasses', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_dataclass_id' },
      { source: 'class_name', target: 'class_name' },
      { source: 'retention_days', target: 'retention_days' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_volume_depa (id)
async function dispatchVolumeDepa(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_volume_depas', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_depa_id' },
      { source: 'volume_id', target: 'volume_id' },
      { source: 'depa_id', target: 'depa_id' },
      { source: 'permission', target: 'permission' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_volume_user (id)
async function dispatchVolumeUser(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_volume_users', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_user_id' },
      { source: 'volume_id', target: 'volume_id' },
      { source: 'user_id', target: 'user_id' },
      { source: 'permission', target: 'permission' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_volume_workspace (id)
async function dispatchVolumeWorkspace(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_volume_workspaces', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_workspace_id' },
      { source: 'volume_id', target: 'volume_id' },
      { source: 'workspace_id', target: 'workspace_id' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_schedule_job (id)
async function dispatchScheduleJob(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_schedule_jobs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_job_id' },
      { source: 'job_name', target: 'job_name' },
      { source: 'cron_expression', target: 'cron_expression' },
      { source: 'job_class', target: 'job_class' },
      { source: 'enabled', target: 'enabled' },
      { source: 'last_run_at', target: 'last_run_at' },
      { source: 'next_run_at', target: 'next_run_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_register_management (id)
async function dispatchRegisterManagement(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_register_managements', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_register_id' },
      { source: 'register_type', target: 'register_type' },
      { source: 'register_name', target: 'register_name' },
      { source: 'registered_at', target: 'registered_at' },
      { source: 'expires_at', target: 'expires_at' },
      { source: 'status', target: 'status' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_interface_task (id)
async function dispatchInterfaceTask(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_interface_tasks', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_task_id' },
      { source: 'interface_code', target: 'interface_code' },
      { source: 'task_type', target: 'task_type' },
      { source: 'request_payload', target: 'request_payload' },
      { source: 'response_payload', target: 'response_payload' },
      { source: 'status', target: 'status' },
      { source: 'started_at', target: 'started_at' },
      { source: 'finished_at', target: 'finished_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_hot_backup_record (id)
async function dispatchHotBackupRecord(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_hot_backup_records', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_record_id' },
      { source: 'target_volume_id', target: 'target_volume_id' },
      { source: 'backup_type', target: 'backup_type' },
      { source: 'status', target: 'status' },
      { source: 'started_at', target: 'started_at' },
      { source: 'finished_at', target: 'finished_at' },
      { source: 'file_count', target: 'file_count' },
      { source: 'total_size', target: 'total_size' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_hot_restore_record (id)
async function dispatchHotRestoreRecord(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_hot_restore_records', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_record_id' },
      { source: 'source_backup_id', target: 'source_backup_id' },
      { source: 'target_path', target: 'target_path' },
      { source: 'status', target: 'status' },
      { source: 'started_at', target: 'started_at' },
      { source: 'finished_at', target: 'finished_at' },
      { source: 'file_count', target: 'file_count' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_device_device (id)
async function dispatchDeviceDevice(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_device_devices', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_device_id' },
      { source: 'device_name', target: 'device_name' },
      { source: 'device_type', target: 'device_type' },
      { source: 'device_sn', target: 'device_sn' },
      { source: 'status', target: 'status' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_drivers (id)
async function dispatchDriver(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_drivers', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_driver_id' },
      { source: 'driver_name', target: 'driver_name' },
      { source: 'driver_version', target: 'driver_version' },
      { source: 'device_type', target: 'device_type' },
      { source: 'file_path', target: 'file_path' },
      { source: 'file_size', target: 'file_size' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_drivers_burn (id, plural)
async function dispatchDriverBurn(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_drivers_burns', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_burn_id' },
      { source: 'driver_id', target: 'driver_id' },
      { source: 'device_id', target: 'device_id' },
      { source: 'status', target: 'status' },
      { source: 'started_at', target: 'started_at' },
      { source: 'finished_at', target: 'finished_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_raid_group (id)
async function dispatchRaidGroup(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_raid_groups', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_raid_id' },
      { source: 'raid_level', target: 'raid_level' },
      { source: 'device_count', target: 'device_count' },
      { source: 'total_capacity', target: 'total_capacity' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_hd_manager (id)
async function dispatchHdManager(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_hd_managers', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_manager_id' },
      { source: 'manager_name', target: 'manager_name' },
      { source: 'device_count', target: 'device_count' },
      { source: 'total_capacity', target: 'total_capacity' },
      { source: 'used_capacity', target: 'used_capacity' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// ============================================================
// R.83.5 数据接收 + 告警 + 媒体族 15 张 — inline UPSERT
// 全部走 source_record_id 溯源
// ============================================================

async function dispatchDataReceiveList(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_data_receive_lists', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_list_id' },
      { source: 'list_name', target: 'list_name' },
      { source: 'description', target: 'description' },
      { source: 'total_count', target: 'total_count' },
      { source: 'status', target: 'status' },
      { source: 'received_at', target: 'received_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchDataReceiveLog(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_data_receive_logs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_log_id' },
      { source: 'list_id', target: 'list_id' },
      { source: 'log_level', target: 'log_level' },
      { source: 'message', target: 'message' },
      { source: 'logged_at', target: 'logged_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchDataReceiveTask(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_data_receive_tasks', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_task_id' },
      { source: 'list_id', target: 'list_id' },
      { source: 'task_type', target: 'task_type' },
      { source: 'status', target: 'status' },
      { source: 'started_at', target: 'started_at' },
      { source: 'finished_at', target: 'finished_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchDataClassification(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_data_classifications', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_classification_id' },
      { source: 'classification_code', target: 'classification_code' },
      { source: 'classification_name', target: 'classification_name' },
      { source: 'level', target: 'level' },
      { source: 'description', target: 'description' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchEarlyWarning(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_early_warnings', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_warning_id' },
      { source: 'warning_type', target: 'warning_type' },
      { source: 'warning_level', target: 'warning_level' },
      { source: 'message', target: 'message' },
      { source: 'triggered_at', target: 'triggered_at' },
      { source: 'resolved_at', target: 'resolved_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchEarlyWarningFeedback(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_early_warning_feedbacks', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_feedback_id' },
      { source: 'warning_id', target: 'warning_id' },
      { source: 'feedback_type', target: 'feedback_type' },
      { source: 'feedback_text', target: 'feedback_text' },
      { source: 'feedback_at', target: 'feedback_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchDiscPrint(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_disc_prints', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_print_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'print_status', target: 'print_status' },
      { source: 'printed_count', target: 'printed_count' },
      { source: 'printed_at', target: 'printed_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchDiscInspect(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_disc_inspects', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_inspect_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'inspect_status', target: 'inspect_status' },
      { source: 'inspect_result', target: 'inspect_result' },
      { source: 'inspected_at', target: 'inspected_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchDiscType(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_disc_types', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_type_id' },
      { source: 'type_code', target: 'type_code' },
      { source: 'type_name', target: 'type_name' },
      { source: 'capacity_mb', target: 'capacity_mb' },
      { source: 'description', target: 'description' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchEvidenceDetail(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_evidence_details', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_detail_id' },
      { source: 'evidence_type', target: 'evidence_type' },
      { source: 'detail_content', target: 'detail_content' },
      { source: 'detail_at', target: 'detail_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchEvidenceRecordDrp(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_evidence_record_drps', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_record_id' },
      { source: 'detail_id', target: 'detail_id' },
      { source: 'record_type', target: 'record_type' },
      { source: 'drp_status', target: 'drp_status' },
      { source: 'recorded_at', target: 'recorded_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchVerifyDetail(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_verify_details', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_verify_id' },
      { source: 'detail_content', target: 'detail_content' },
      { source: 'verify_result', target: 'verify_result' },
      { source: 'verified_at', target: 'verified_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchVerifyRecordDrp(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_verify_record_drps', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_record_id' },
      { source: 'verify_id', target: 'verify_id' },
      { source: 'drp_result', target: 'drp_result' },
      { source: 'recorded_at', target: 'recorded_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchDownloadRecord(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_download_records', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_record_id' },
      { source: 'user_id', target: 'user_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_size', target: 'file_size' },
      { source: 'downloaded_at', target: 'downloaded_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

async function dispatchUploadRecord(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_upload_records', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_record_id' },
      { source: 'user_id', target: 'user_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_size', target: 'file_size' },
      { source: 'uploaded_at', target: 'uploaded_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// ============================================================
// R.83.6 ISO + 元数据 + 系统族 15 张 — inline UPSERT
// 全部走 source_record_id 溯源
// ============================================================

// tbl_iso_location (id) → unified_iso_locations
async function dispatchIsoLocation(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_iso_locations', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_location_id' },
      { source: 'iso_path', target: 'iso_path' },
      { source: 'iso_size_mb', target: 'iso_size_mb' },
      { source: 'mounted_at', target: 'mounted_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_iso_task_sync (id) → unified_iso_task_syncs
async function dispatchIsoTaskSync(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_iso_task_syncs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_sync_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'iso_status', target: 'iso_status' },
      { source: 'sync_started_at', target: 'sync_started_at' },
      { source: 'sync_finished_at', target: 'sync_finished_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_meta_data (id) → unified_meta_datas
async function dispatchMetaData(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_meta_datas', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_meta_id' },
      { source: 'meta_key', target: 'meta_key' },
      { source: 'meta_value', target: 'meta_value' },
      { source: 'description', target: 'description' },
      { source: 'updated_at', target: 'updated_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_sys (id) → unified_sys_configs (使用 _configs 后缀避免与 R.83.2 unified_sys_logs 冲突)
async function dispatchSys(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_sys_configs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_sys_id' },
      { source: 'config_key', target: 'config_key' },
      { source: 'config_value', target: 'config_value' },
      { source: 'description', target: 'description' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_sys_env (id) → unified_sys_envs
async function dispatchSysEnv(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_sys_envs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_env_id' },
      { source: 'env_name', target: 'env_name' },
      { source: 'env_value', target: 'env_value' },
      { source: 'is_secret', target: 'is_secret' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_mount_dir (id) → unified_mount_dirs
async function dispatchMountDir(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_mount_dirs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_mount_id' },
      { source: 'mount_path', target: 'mount_path' },
      { source: 'device_id', target: 'device_id' },
      { source: 'mount_status', target: 'mount_status' },
      { source: 'mounted_at', target: 'mounted_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_buffer_dir (id) → unified_buffer_dirs
async function dispatchBufferDir(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_buffer_dirs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_buffer_id' },
      { source: 'buffer_path', target: 'buffer_path' },
      { source: 'buffer_size_mb', target: 'buffer_size_mb' },
      { source: 'buffer_used_mb', target: 'buffer_used_mb' },
      { source: 'buffer_status', target: 'buffer_status' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_cd_cabinet (id) → unified_cd_cabinets
async function dispatchCdCabinet(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_cd_cabinets', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_cabinet_id' },
      { source: 'cabinet_code', target: 'cabinet_code' },
      { source: 'cabinet_name', target: 'cabinet_name' },
      { source: 'location', target: 'location' },
      { source: 'total_slots', target: 'total_slots' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_film_operat (id) → unified_film_operats (irregular plural kept as "operats")
async function dispatchFilmOperat(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_film_operats', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_operat_id' },
      { source: 'film_code', target: 'film_code' },
      { source: 'film_name', target: 'film_name' },
      { source: 'operation_type', target: 'operation_type' },
      { source: 'operated_at', target: 'operated_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_ft_file (id) → unified_ft_files
async function dispatchFtFile(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_ft_files', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_file_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_path', target: 'file_path' },
      { source: 'file_size', target: 'file_size' },
      { source: 'transfer_status', target: 'transfer_status' },
      { source: 'transferred_at', target: 'transferred_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_ft_sys (id) → unified_ft_systems
async function dispatchFtSys(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_ft_systems', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_ft_sys_id' },
      { source: 'system_code', target: 'system_code' },
      { source: 'system_name', target: 'system_name' },
      { source: 'version', target: 'version' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_back_window (id) → unified_back_windows
async function dispatchBackWindow(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_back_windows', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_window_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'window_type', target: 'window_type' },
      { source: 'window_start_at', target: 'window_start_at' },
      { source: 'window_end_at', target: 'window_end_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_zip_file (id) → unified_zip_files
async function dispatchZipFile(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_zip_files', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_zip_id' },
      { source: 'zip_name', target: 'zip_name' },
      { source: 'zip_path', target: 'zip_path' },
      { source: 'zip_size', target: 'zip_size' },
      { source: 'zip_status', target: 'zip_status' },
      { source: 'created_at', target: 'created_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_temp_slots (id) → unified_temp_slots
async function dispatchTempSlots(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_temp_slots', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_slot_id' },
      { source: 'slot_code', target: 'slot_code' },
      { source: 'slot_status', target: 'slot_status' },
      { source: 'capacity_mb', target: 'capacity_mb' },
      { source: 'used_mb', target: 'used_mb' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_lib_group (id) → unified_lib_groups
async function dispatchLibGroup(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_lib_groups', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_group_id' },
      { source: 'group_code', target: 'group_code' },
      { source: 'group_name', target: 'group_name' },
      { source: 'description', target: 'description' },
      { source: 'sort_order', target: 'sort_order' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// ============================================================
// R.83.7 导入导出 + 监控 + 系统辅助族 15 张 dispatchers
// ============================================================

// tbl_csv_details (id) → unified_csv_details
async function dispatchCsvDetails(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_csv_details', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_csv_id' },
      { source: 'csv_name', target: 'csv_name' },
      { source: 'csv_path', target: 'csv_path' },
      { source: 'csv_size', target: 'csv_size' },
      { source: 'csv_status', target: 'csv_status' },
      { source: 'imported_at', target: 'imported_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_import_folder_data (id) → unified_import_folder_datas
async function dispatchImportFolderData(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_import_folder_datas', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_data_id' },
      { source: 'folder_id', target: 'folder_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_path', target: 'file_path' },
      { source: 'file_size', target: 'file_size' },
      { source: 'imported_at', target: 'imported_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_import_folder_log (id) → unified_import_folder_logs
async function dispatchImportFolderLog(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_import_folder_logs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_log_id' },
      { source: 'folder_id', target: 'folder_id' },
      { source: 'log_status', target: 'log_status' },
      { source: 'log_message', target: 'log_message' },
      { source: 'logged_at', target: 'logged_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_import_folder_title (id) → unified_import_folder_titles
async function dispatchImportFolderTitle(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_import_folder_titles', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_title_id' },
      { source: 'folder_id', target: 'folder_id' },
      { source: 'title_name', target: 'title_name' },
      { source: 'title_value', target: 'title_value' },
      { source: 'sort_order', target: 'sort_order' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_upload_details (id) → unified_upload_details
async function dispatchUploadDetails(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_upload_details', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_upload_id' },
      { source: 'upload_id', target: 'upload_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_path', target: 'file_path' },
      { source: 'file_size', target: 'file_size' },
      { source: 'uploaded_at', target: 'uploaded_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_download_details (id) → unified_download_details
async function dispatchDownloadDetails(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_download_details', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_download_id' },
      { source: 'download_id', target: 'download_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_path', target: 'file_path' },
      { source: 'file_size', target: 'file_size' },
      { source: 'downloaded_at', target: 'downloaded_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_export_info (id) → unified_export_infos
async function dispatchExportInfo(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_export_infos', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_export_id' },
      { source: 'export_name', target: 'export_name' },
      { source: 'export_path', target: 'export_path' },
      { source: 'export_format', target: 'export_format' },
      { source: 'exported_at', target: 'exported_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_error_rate (id) → unified_error_rates
async function dispatchErrorRate(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_error_rates', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_rate_id' },
      { source: 'rate_name', target: 'rate_name' },
      { source: 'error_count', target: 'error_count' },
      { source: 'total_count', target: 'total_count' },
      { source: 'rate_value', target: 'rate_value' },
      { source: 'measured_at', target: 'measured_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_escape (id) → unified_escapes
async function dispatchEscape(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_escapes', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_escape_id' },
      { source: 'escape_code', target: 'escape_code' },
      { source: 'escape_name', target: 'escape_name' },
      { source: 'escape_status', target: 'escape_status' },
      { source: 'triggered_at', target: 'triggered_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_remote_backup (id) → unified_remote_backups
async function dispatchRemoteBackup(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_remote_backups', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_backup_id' },
      { source: 'backup_name', target: 'backup_name' },
      { source: 'backup_path', target: 'backup_path' },
      { source: 'backup_size', target: 'backup_size' },
      { source: 'backup_status', target: 'backup_status' },
      { source: 'backed_up_at', target: 'backed_up_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_monitor_path (id) → unified_monitor_paths
async function dispatchMonitorPath(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_monitor_paths', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_path_id' },
      { source: 'monitor_path', target: 'monitor_path' },
      { source: 'path_status', target: 'path_status' },
      { source: 'interval_seconds', target: 'interval_seconds' },
      { source: 'last_checked_at', target: 'last_checked_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_platform_monitor (id) → unified_platform_monitors
async function dispatchPlatformMonitor(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_platform_monitors', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_monitor_id' },
      { source: 'platform_id', target: 'platform_id' },
      { source: 'monitor_metric', target: 'monitor_metric' },
      { source: 'metric_value', target: 'metric_value' },
      { source: 'monitored_at', target: 'monitored_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_site_monitor (id) → unified_site_monitors
async function dispatchSiteMonitor(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_site_monitors', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_site_monitor_id' },
      { source: 'site_id', target: 'site_id' },
      { source: 'monitor_metric', target: 'monitor_metric' },
      { source: 'metric_value', target: 'metric_value' },
      { source: 'monitored_at', target: 'monitored_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_project_monitor_files (id) → unified_project_monitor_files
async function dispatchProjectMonitorFile(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_project_monitor_files', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_file_id' },
      { source: 'project_id', target: 'project_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_path', target: 'file_path' },
      { source: 'monitor_status', target: 'monitor_status' },
      { source: 'monitored_at', target: 'monitored_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_task_folder (id) → unified_task_folders
async function dispatchTaskFolder(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_task_folders', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_folder_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'folder_path', target: 'folder_path' },
      { source: 'folder_name', target: 'folder_name' },
      { source: 'folder_status', target: 'folder_status' },
      { source: 'created_at', target: 'created_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// ============================================================
// R.83.8 任务详情 + 槽位管理族 15 张 dispatchers
// ============================================================

// tbl_task_items (id) → unified_task_items
async function dispatchTaskItems(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_task_items', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_task_item_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'root_path', target: 'root_path' },
      { source: 'original_path', target: 'original_path' },
      { source: 'item_name', target: 'item_name' },
      { source: 'volume_id', target: 'volume_id' },
      { source: 'lib_parent_folder', target: 'lib_parent_folder' },
      { source: 'is_folder', target: 'is_folder' },
      { source: 'slot_id', target: 'slot_id' },
      { source: 'status', target: 'status' },
      { source: 'project_id', target: 'project_id' },
      { source: 'cmt', target: 'cmt' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_task_print (id) → unified_task_prints
async function dispatchTaskPrint(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_task_prints', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_print_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'title', target: 'title' },
      { source: 'subtitle', target: 'subtitle' },
      { source: 'disc_tip', target: 'disc_tip' },
      { source: 'data_compare', target: 'data_compare' },
      { source: 'print_qrcode', target: 'print_qrcode' },
      { source: 'print_style', target: 'print_style' },
      { source: 'print_label', target: 'print_label' },
      { source: 'print_publisher', target: 'print_publisher' },
      { source: 'print_copies', target: 'print_copies' },
      { source: 'out_stacker', target: 'out_stacker' },
      { source: 'in_stacker', target: 'in_stacker' },
      { source: 'print_session', target: 'print_session' },
      { source: 'cmt', target: 'cmt' },
      { source: 'print_date', target: 'print_date' },
      { source: 'print_img', target: 'print_img' },
      { source: 'publisher_type', target: 'publisher_type' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_task_certif_status (id) → unified_task_certif_statuses
async function dispatchTaskCertifStatus(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_task_certif_statuses', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_status_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'task_item_id', target: 'task_item_id' },
      { source: 'task_type', target: 'task_type' },
      { source: 'task_mode', target: 'task_mode' },
      { source: 'status', target: 'status' },
      { source: 'create_time', target: 'create_time' },
      { source: 'update_time', target: 'update_time' },
      { source: 'cmt', target: 'cmt' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_slot_file_1000000 (id) → unified_slot_file_1000000
async function dispatchSlotFile1000000(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slot_file_1000000', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_file_id' },
      { source: 'uuid', target: 'uuid' },
      { source: 'folder_id', target: 'folder_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_disc_name', target: 'file_disc_name' },
      { source: 'file_size', target: 'file_size' },
      { source: 'hash', target: 'hash' },
      { source: 'task_id', target: 'task_id' },
      { source: 'items_id', target: 'items_id' },
      { source: 'create_date', target: 'create_date' },
      { source: 'status', target: 'status' },
      { source: 'slot_id', target: 'slot_id' },
      { source: 'content_type', target: 'content_type' },
      { source: 'storage_class', target: 'storage_class' },
      { source: 'thumbs', target: 'thumbs' },
      { source: 'meta_data', target: 'meta_data' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_slot_file_12 (id) → unified_slot_file_12
async function dispatchSlotFile12(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slot_file_12', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_file_id' },
      { source: 'uuid', target: 'uuid' },
      { source: 'folder_id', target: 'folder_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_disc_name', target: 'file_disc_name' },
      { source: 'file_size', target: 'file_size' },
      { source: 'hash', target: 'hash' },
      { source: 'task_id', target: 'task_id' },
      { source: 'items_id', target: 'items_id' },
      { source: 'create_date', target: 'create_date' },
      { source: 'status', target: 'status' },
      { source: 'slot_id', target: 'slot_id' },
      { source: 'content_type', target: 'content_type' },
      { source: 'storage_class', target: 'storage_class' },
      { source: 'thumbs', target: 'thumbs' },
      { source: 'meta_data', target: 'meta_data' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_slot_file_13 (id) → unified_slot_file_13
async function dispatchSlotFile13(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slot_file_13', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_file_id' },
      { source: 'uuid', target: 'uuid' },
      { source: 'folder_id', target: 'folder_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_disc_name', target: 'file_disc_name' },
      { source: 'file_size', target: 'file_size' },
      { source: 'hash', target: 'hash' },
      { source: 'task_id', target: 'task_id' },
      { source: 'items_id', target: 'items_id' },
      { source: 'create_date', target: 'create_date' },
      { source: 'status', target: 'status' },
      { source: 'slot_id', target: 'slot_id' },
      { source: 'content_type', target: 'content_type' },
      { source: 'storage_class', target: 'storage_class' },
      { source: 'thumbs', target: 'thumbs' },
      { source: 'meta_data', target: 'meta_data' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_slot_file_15 (id) → unified_slot_file_15
async function dispatchSlotFile15(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slot_file_15', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_file_id' },
      { source: 'uuid', target: 'uuid' },
      { source: 'folder_id', target: 'folder_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_disc_name', target: 'file_disc_name' },
      { source: 'file_size', target: 'file_size' },
      { source: 'hash', target: 'hash' },
      { source: 'task_id', target: 'task_id' },
      { source: 'items_id', target: 'items_id' },
      { source: 'create_date', target: 'create_date' },
      { source: 'status', target: 'status' },
      { source: 'slot_id', target: 'slot_id' },
      { source: 'content_type', target: 'content_type' },
      { source: 'storage_class', target: 'storage_class' },
      { source: 'thumbs', target: 'thumbs' },
      { source: 'meta_data', target: 'meta_data' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_slot_file_30 (id) → unified_slot_file_30
async function dispatchSlotFile30(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slot_file_30', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_file_id' },
      { source: 'uuid', target: 'uuid' },
      { source: 'folder_id', target: 'folder_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_disc_name', target: 'file_disc_name' },
      { source: 'file_size', target: 'file_size' },
      { source: 'hash', target: 'hash' },
      { source: 'task_id', target: 'task_id' },
      { source: 'items_id', target: 'items_id' },
      { source: 'create_date', target: 'create_date' },
      { source: 'status', target: 'status' },
      { source: 'slot_id', target: 'slot_id' },
      { source: 'content_type', target: 'content_type' },
      { source: 'storage_class', target: 'storage_class' },
      { source: 'thumbs', target: 'thumbs' },
      { source: 'meta_data', target: 'meta_data' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_slot_file_31 (id) → unified_slot_file_31
async function dispatchSlotFile31(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slot_file_31', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_file_id' },
      { source: 'uuid', target: 'uuid' },
      { source: 'folder_id', target: 'folder_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_disc_name', target: 'file_disc_name' },
      { source: 'file_size', target: 'file_size' },
      { source: 'hash', target: 'hash' },
      { source: 'task_id', target: 'task_id' },
      { source: 'items_id', target: 'items_id' },
      { source: 'create_date', target: 'create_date' },
      { source: 'status', target: 'status' },
      { source: 'slot_id', target: 'slot_id' },
      { source: 'content_type', target: 'content_type' },
      { source: 'storage_class', target: 'storage_class' },
      { source: 'thumbs', target: 'thumbs' },
      { source: 'meta_data', target: 'meta_data' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_slot_folder_1000000 (id) → unified_slot_folder_1000000
async function dispatchSlotFolder1000000(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slot_folder_1000000', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_folder_id' },
      { source: 'name', target: 'folder_name' },
      { source: 'folder_path', target: 'folder_path' },
      { source: 'disc_path', target: 'disc_path' },
      { source: 's_level', target: 's_level' },
      { source: 'parent', target: 'parent' },
      { source: 'sum_files', target: 'sum_files' },
      { source: 'files', target: 'files' },
      { source: 'subs', target: 'subs' },
      { source: 'slot_id', target: 'slot_id' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_slot_folder_12 (id) → unified_slot_folder_12
async function dispatchSlotFolder12(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slot_folder_12', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_folder_id' },
      { source: 'name', target: 'folder_name' },
      { source: 'folder_path', target: 'folder_path' },
      { source: 'disc_path', target: 'disc_path' },
      { source: 's_level', target: 's_level' },
      { source: 'parent', target: 'parent' },
      { source: 'sum_files', target: 'sum_files' },
      { source: 'files', target: 'files' },
      { source: 'subs', target: 'subs' },
      { source: 'slot_id', target: 'slot_id' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_slot_folder_13 (id) → unified_slot_folder_13
async function dispatchSlotFolder13(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slot_folder_13', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_folder_id' },
      { source: 'name', target: 'folder_name' },
      { source: 'folder_path', target: 'folder_path' },
      { source: 'disc_path', target: 'disc_path' },
      { source: 's_level', target: 's_level' },
      { source: 'parent', target: 'parent' },
      { source: 'sum_files', target: 'sum_files' },
      { source: 'files', target: 'files' },
      { source: 'subs', target: 'subs' },
      { source: 'slot_id', target: 'slot_id' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_slot_folder_15 (id) → unified_slot_folder_15
async function dispatchSlotFolder15(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slot_folder_15', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_folder_id' },
      { source: 'name', target: 'folder_name' },
      { source: 'folder_path', target: 'folder_path' },
      { source: 'disc_path', target: 'disc_path' },
      { source: 's_level', target: 's_level' },
      { source: 'parent', target: 'parent' },
      { source: 'sum_files', target: 'sum_files' },
      { source: 'files', target: 'files' },
      { source: 'subs', target: 'subs' },
      { source: 'slot_id', target: 'slot_id' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_slot_folder_30 (id) → unified_slot_folder_30
async function dispatchSlotFolder30(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slot_folder_30', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_folder_id' },
      { source: 'name', target: 'folder_name' },
      { source: 'folder_path', target: 'folder_path' },
      { source: 'disc_path', target: 'disc_path' },
      { source: 's_level', target: 's_level' },
      { source: 'parent', target: 'parent' },
      { source: 'sum_files', target: 'sum_files' },
      { source: 'files', target: 'files' },
      { source: 'subs', target: 'subs' },
      { source: 'slot_id', target: 'slot_id' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_slot_folder_31 (id) → unified_slot_folder_31
async function dispatchSlotFolder31(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slot_folder_31', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_folder_id' },
      { source: 'name', target: 'folder_name' },
      { source: 'folder_path', target: 'folder_path' },
      { source: 'disc_path', target: 'disc_path' },
      { source: 's_level', target: 's_level' },
      { source: 'parent', target: 'parent' },
      { source: 'sum_files', target: 'sum_files' },
      { source: 'files', target: 'files' },
      { source: 'subs', target: 'subs' },
      { source: 'slot_id', target: 'slot_id' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// ============================================================
// Sprint R.83.9 收尾 8 张 dispatcher handlers
// (备份辅助 + 磁盘/文件校验 + 硬盘 + 接收单明细 + 槽位分区 + 下载等待族)
// ============================================================

// tbl_backup_db (id) → unified_backup_dbs
async function dispatchBackupDb(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_backup_dbs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'create_dt', target: 'create_dt' },
      { source: 'backup_path', target: 'backup_path' },
      { source: 'status', target: 'status' },
      { source: 'progress', target: 'progress' },
      { source: 'task_id', target: 'task_id' },
      { source: 'cmt', target: 'cmt' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_disk_check (id) → unified_disk_checks
async function dispatchDiskCheck(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_disk_checks', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'hd_sn', target: 'hd_sn' },
      { source: 'volume_id', target: 'volume_id' },
      { source: 'check_mode', target: 'check_mode' },
      { source: 'cmt', target: 'cmt' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_diskfile_check (id) → unified_diskfile_checks
async function dispatchDiskfileCheck(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_diskfile_checks', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'volume_id', target: 'volume_id' },
      { source: 'file_path', target: 'file_path' },
      { source: 'cmt', target: 'cmt' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_hd_power (id) → unified_hd_powers
async function dispatchHdPower(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_hd_powers', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'task_id', target: 'task_id' },
      { source: 'lib_id', target: 'lib_id' },
      { source: 'mag_id', target: 'mag_id' },
      { source: 'slot_order', target: 'slot_order' },
      { source: 'serial_num', target: 'serial_num' },
      { source: 'duration', target: 'duration' },
      { source: 'up_dt', target: 'up_dt' },
      { source: 'down_dt', target: 'down_dt' },
      { source: 'status', target: 'status' },
      { source: 'smart', target: 'smart' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_receipt_file_detail (id) → unified_receipt_file_details
async function dispatchReceiptFileDetail(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_receipt_file_details', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'receipt_file_id', target: 'receipt_file_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'path', target: 'path' },
      { source: 'file_size', target: 'file_size' },
      { source: 'hash', target: 'hash' },
      { source: 'create_date', target: 'create_date' },
      { source: 'status', target: 'status' },
      { source: 'is_folder', target: 'is_folder' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_slots_part (part_id) → unified_slots_parts
async function dispatchSlotsPart(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_slots_parts', {
    sourceIdField: 'part_id',
    columns: [
      { source: 'part_id', target: 'src_part_id' },
      { source: 'serial_num', target: 'serial_num' },
      { source: 'part_name', target: 'part_name' },
      { source: 'file_sys', target: 'file_sys' },
      { source: 'max_cap', target: 'max_cap' },
      { source: 'rest_cap', target: 'rest_cap' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_wait_download_file (id) → unified_wait_download_files
async function dispatchWaitDownloadFile(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_wait_download_files', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_id' },
      { source: 'file_name', target: 'file_name' },
      { source: 'file_size', target: 'file_size' },
      { source: 'file_path', target: 'file_path' },
      { source: 'create_time', target: 'create_time' },
      { source: 'user_id', target: 'user_id' },
      { source: 'data_type', target: 'data_type' },
      { source: 'org_depa_id', target: 'org_depa_id' },
      { source: 'download_count', target: 'download_count' },
      { source: 'details_count', target: 'details_count' },
      { source: 'system_type', target: 'system_type' },
      { source: 'remark', target: 'remark' },
      { source: 'cmt', target: 'cmt' },
      { source: 'file_status', target: 'file_status' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_wait_download_file_task (composite wait_download_id+task_id) → unified_wait_download_file_tasks
async function dispatchWaitDownloadFileTask(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_wait_download_file_tasks', {
    sourceIdField: '__composite__',
    sourceIdTransform: (raw: unknown) => {
      const r = raw as Record<string, unknown>
      return `${r?.wait_download_id ?? ''}::${r?.task_id ?? ''}`
    },
    columns: [
      { source: 'wait_download_id', target: 'wait_download_id' },
      { source: 'task_id', target: 'task_id' },
    ],
    sourceIdColumn: 'source_record_id',
  })
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
  /**
   * R.83.1: 复合主键模式。
   * 当 sourceIdField === '__composite__' 时, 从 columns 中取同名 source 字段组合成 source_record_id (格式: a::b)
   * 此时 sourceIdTransform 必填 (接收 raw record,返回字符串)
   */
  skip?: boolean
  /**
   * R.83.1: 中心表用于溯源的主键列名。
   * - 'source_id' (默认): 既有 unified_* 表 (R.82 及以前)
   * - 'source_record_id': R.83.1 新增 15 张 unified_* 表的统一约定
   */
  sourceIdColumn?: 'source_id' | 'source_record_id'
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
  const sourceIdColumn = config.sourceIdColumn ?? 'source_id'
  const conflictColumns =
    sourceIdColumn === 'source_id'
      ? 'source_site_id, source_table, source_id'
      : 'source_site_id, source_record_id'

  let upserted = 0
  let inserted = 0
  let updated = 0
  let skipped = 0
  let failed = 0
  const errorMessages: string[] = []

  for (const record of input.records) {
    // 1. 解析 sourceId
    //    R.83.1 复合 PK 模式: sourceIdField === '__composite__',由 sourceIdTransform 自行从 record 取多列拼装
    let sourceId: string
    if (config.sourceIdField === '__composite__') {
      if (!config.sourceIdTransform) {
        throw new Error(`inlineUpsert(${targetTable}): sourceIdField='__composite__' requires sourceIdTransform`)
      }
      sourceId = config.sourceIdTransform(record)
    } else {
      const rawId = record[config.sourceIdField]
      sourceId = config.sourceIdTransform ? config.sourceIdTransform(rawId) : String(rawId ?? '')
    }

    if (!sourceId) {
      // Sprint 2H.2: 不再静默 continue, 计为 failed
      failed++
      const msg = `missing source id (mode=${config.sourceIdField === '__composite__' ? 'composite' : config.sourceIdField})`
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
      '$3', // source_id (or source_record_id for R.83.1+ tables)
      'NOW()', // synced_at
      ...targetCols.map((_, i) => `$${i + 4}`),
      '$' + (targetCols.length + 4) + '::jsonb', // raw_data
    ]

    const updateSet = [
      'synced_at = NOW()',
      ...targetCols.map((col) => `${col} = EXCLUDED.${col}`),
    ]

    const sql = `
      INSERT INTO ${targetTable} (
        source_site_id, source_table, ${sourceIdColumn}, synced_at,
        ${targetCols.join(', ')},
        raw_data
      ) VALUES (
        ${placeholders.join(', ')}
      )
      ON CONFLICT (${conflictColumns}) DO UPDATE SET
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
  // R.83.1 部门/项目/任务接收单 15 张
  tbl_user_role: dispatchUserRole,
  tbl_depa: dispatchDepa,
  tbl_workspace: dispatchWorkspace,
  tbl_workspace_user: dispatchWorkspaceUser,
  tbl_depa_user: dispatchDepaUser,
  tbl_depa_user_info: dispatchDepaUserInfo,
  tbl_project: dispatchProject,
  tbl_project_site: dispatchProjectSite,
  tbl_task_projects: dispatchTaskProject,
  tbl_task_receipts: dispatchTaskReceipt,
  tbl_task_files: dispatchTaskFile,
  tbl_task_check: dispatchTaskCheck,
  tbl_receipt: dispatchReceipt,
  tbl_receipt_check: dispatchReceiptCheck,
  tbl_receipt_file: dispatchReceiptFile,
  // R.83.2 RBAC + 字典 + 日志 + 凭据 15 张
  tbl_role: dispatchRole,
  tbl_role_fuc: dispatchRoleFuc,
  tbl_fuc: dispatchFuc,
  tbl_dict_category: dispatchDictCategory,
  tbl_dict: dispatchDict,
  tbl_dict_item: dispatchDictItem,
  tbl_sys_log: dispatchSysLog,
  tbl_api_log: dispatchApiLog,
  tbl_api_interface: dispatchApiInterface,
  tbl_user_mfa: dispatchUserMfa,
  tbl_archives_type: dispatchArchivesType,
  tbl_archives_level: dispatchArchivesLevel,
  tbl_platform_type: dispatchPlatformType,
  tbl_credible_prove: dispatchCredibleProve,
  tbl_credible_verify: dispatchCredibleVerify,
  // R.83.3 检查巡检族 15 张
  tbl_check_category: dispatchCheckCategory,
  tbl_check_sub_category: dispatchCheckSubCategory,
  tbl_check_item: dispatchCheckItem,
  tbl_check_sector: dispatchCheckSector,
  tbl_check_template: dispatchCheckTemplate,
  tbl_check_task: dispatchCheckTask,
  tbl_check_task_item: dispatchCheckTaskItem,
  tbl_check_task_file: dispatchCheckTaskFile,
  tbl_check_file: dispatchCheckFile,
  tbl_check_files: dispatchCheckFiles,
  tbl_check_log: dispatchCheckLog,
  tbl_check_patrol_strategy: dispatchCheckPatrolStrategy,
  tbl_check_patrol_task: dispatchCheckPatrolTask,
  tbl_check_patrol_task_item: dispatchCheckPatrolTaskItem,
  tbl_check_patrol_log: dispatchCheckPatrolLog,
  // R.83.4 存储卷 + 调度/接口 + 设备业务族 15 张
  tbl_volume_group: dispatchVolumeGroup,
  tbl_volume_dataclass: dispatchVolumeDataclass,
  tbl_volume_depa: dispatchVolumeDepa,
  tbl_volume_user: dispatchVolumeUser,
  tbl_volume_workspace: dispatchVolumeWorkspace,
  tbl_schedule_job: dispatchScheduleJob,
  tbl_register_management: dispatchRegisterManagement,
  tbl_interface_task: dispatchInterfaceTask,
  tbl_hot_backup_record: dispatchHotBackupRecord,
  tbl_hot_restore_record: dispatchHotRestoreRecord,
  tbl_device_device: dispatchDeviceDevice,
  tbl_drivers: dispatchDriver,
  tbl_drivers_burn: dispatchDriverBurn,
  tbl_raid_group: dispatchRaidGroup,
  tbl_hd_manager: dispatchHdManager,
  // R.83.5 数据接收 + 告警 + 媒体族 15 张
  tbl_data_receive_list: dispatchDataReceiveList,
  tbl_data_receive_log: dispatchDataReceiveLog,
  tbl_data_receive_tasks: dispatchDataReceiveTask,
  tbl_data_classification: dispatchDataClassification,
  tbl_early_warning: dispatchEarlyWarning,
  tbl_early_warning_feedback: dispatchEarlyWarningFeedback,
  tbl_disc_print: dispatchDiscPrint,
  tbl_disc_inspect: dispatchDiscInspect,
  tbl_disc_type: dispatchDiscType,
  tbl_evidence_details: dispatchEvidenceDetail,
  tbl_evidence_record_drp: dispatchEvidenceRecordDrp,
  tbl_verify_details: dispatchVerifyDetail,
  tbl_verify_record_drp: dispatchVerifyRecordDrp,
  tbl_download_record: dispatchDownloadRecord,
  tbl_upload_record: dispatchUploadRecord,
  // R.83.6 ISO + 元数据 + 系统族 15 张
  tbl_iso_location: dispatchIsoLocation,
  tbl_iso_task_sync: dispatchIsoTaskSync,
  tbl_meta_data: dispatchMetaData,
  tbl_sys: dispatchSys,
  tbl_sys_env: dispatchSysEnv,
  tbl_mount_dir: dispatchMountDir,
  tbl_buffer_dir: dispatchBufferDir,
  tbl_cd_cabinet: dispatchCdCabinet,
  tbl_film_operat: dispatchFilmOperat,
  tbl_ft_file: dispatchFtFile,
  tbl_ft_sys: dispatchFtSys,
  tbl_back_window: dispatchBackWindow,
  tbl_zip_file: dispatchZipFile,
  tbl_temp_slots: dispatchTempSlots,
  tbl_lib_group: dispatchLibGroup,
  // R.83.7 导入导出 + 监控 + 系统辅助族 15 张
  tbl_csv_details: dispatchCsvDetails,
  tbl_import_folder_data: dispatchImportFolderData,
  tbl_import_folder_log: dispatchImportFolderLog,
  tbl_import_folder_title: dispatchImportFolderTitle,
  tbl_upload_details: dispatchUploadDetails,
  tbl_download_details: dispatchDownloadDetails,
  tbl_export_info: dispatchExportInfo,
  tbl_error_rate: dispatchErrorRate,
  tbl_escape: dispatchEscape,
  tbl_remote_backup: dispatchRemoteBackup,
  tbl_monitor_path: dispatchMonitorPath,
  tbl_platform_monitor: dispatchPlatformMonitor,
  tbl_site_monitor: dispatchSiteMonitor,
  tbl_project_monitor_files: dispatchProjectMonitorFile,
  tbl_task_folder: dispatchTaskFolder,
  // R.83.8 任务详情 + 槽位管理族 15 张
  tbl_task_items: dispatchTaskItems,
  tbl_task_print: dispatchTaskPrint,
  tbl_task_certif_status: dispatchTaskCertifStatus,
  tbl_slot_file_1000000: dispatchSlotFile1000000,
  tbl_slot_file_12: dispatchSlotFile12,
  tbl_slot_file_13: dispatchSlotFile13,
  tbl_slot_file_15: dispatchSlotFile15,
  tbl_slot_file_30: dispatchSlotFile30,
  tbl_slot_file_31: dispatchSlotFile31,
  tbl_slot_folder_1000000: dispatchSlotFolder1000000,
  tbl_slot_folder_12: dispatchSlotFolder12,
  tbl_slot_folder_13: dispatchSlotFolder13,
  tbl_slot_folder_15: dispatchSlotFolder15,
  tbl_slot_folder_30: dispatchSlotFolder30,
  tbl_slot_folder_31: dispatchSlotFolder31,
  // R.83.9 收尾 8 张 (备份辅助 + 磁盘/文件校验 + 硬盘 + 接收单明细 + 槽位分区 + 下载等待族)
  tbl_backup_db: dispatchBackupDb,
  tbl_disk_check: dispatchDiskCheck,
  tbl_diskfile_check: dispatchDiskfileCheck,
  tbl_hd_power: dispatchHdPower,
  tbl_receipt_file_detail: dispatchReceiptFileDetail,
  tbl_slots_part: dispatchSlotsPart,
  tbl_wait_download_file: dispatchWaitDownloadFile,
  tbl_wait_download_file_task: dispatchWaitDownloadFileTask,
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
