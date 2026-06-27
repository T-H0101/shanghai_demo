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
