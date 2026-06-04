/**
 * 真实源表字段映射
 * Sprint 2B.12 - 真实 source_restore Import 试点
 * Sprint 2C.3 - task status 组合映射（task_type + status）
 *
 * 从 source_restore 的 tbl_task / tbl_disc_lib 映射到
 * unified_tasks / unified_devices 的 UnifiedTaskRecord / UnifiedDeviceRecord。
 */

import type { UnifiedTaskRecord, UnifiedDeviceRecord } from '@/lib/sync/types'

// ============================================================
// Task 枚举映射
// ============================================================

const TASK_TYPE_MAP: Record<number, string> = {
  0: 'backup',
  1: 'restore',
  2: 'burn_and_seal',
  3: 'epson_api',
  4: 'scan',
  5: 'optical_copy',
  6: 'volume_copy',
  7: 's3',
  8: 'package',
  9: 'evidence',
  10: 'power_on',
}

function mapTaskType(value: number | null): string {
  if (value === null || value === undefined) return 'unknown_type_null'
  return TASK_TYPE_MAP[value] ?? `unknown_type_${value}`
}

// task_type=0/2/3 共享状态映射
const TASK_STATUS_0_2_3: Record<number, string> = {
  0: 'burn_success',
  1: 'data_preparing',
  2: 'cancelled',
  3: 'restful_ready',
  4: 'video_project_added',
  5: 'video_download_ready',
  6: 'ready',
  7: 'remote_backup_created',
  10: 'burn_failed',
  13: 's3_data_preparing',
  19: 'make_task_done_backup_running',
  20: 'paused',
  21: 'no_file_changed',
  22: 'make_task_scan_started',
  23: 'make_task_scan_unfinished',
  29: 'jdf_generated',
}

// task_type=1 恢复任务状态映射
const TASK_STATUS_1: Record<number, string> = {
  0: 'download_success',
  1: 'restore_started',
  3: 'restful_ready',
  6: 'read_from_disc_done',
  7: 'read_from_disc_failed',
  9: 'reading_from_disc',
  10: 'read_failed',
  11: 'restore_warning',
  20: 'paused',
}

function mapTaskStatus(taskType: number | null, status: number | null): string {
  if (status === null || status === undefined) return 'unknown_status_null'
  if (taskType === 0 || taskType === 2 || taskType === 3) {
    return TASK_STATUS_0_2_3[status] ?? `unknown_${taskType}_${status}`
  }
  if (taskType === 1) {
    return TASK_STATUS_1[status] ?? `unknown_${taskType}_${status}`
  }
  return `unknown_${taskType}_${status}`
}

// ============================================================
// Device 枚举映射
// ============================================================

const DEVICE_TYPE_MAP: Record<number, string> = {
  1: 'gen2_library',
  2: 'gen2_offline',
  3: 'gen1_legacy',
  4: 'gen1_new',
  5: 'gen1_offline',
  6: 'gen3_library',
  7: 'publisher',
  8: 'hdd_library',
  9: 'tape_library',
  10: 'tape_drive',
  11: 'sas_hdd_library',
  12: 'film_library',
  13: 'nas',
  14: 'alarm',
  15: 'gen4_library',
}

function mapDeviceType(value: number | null): string | null {
  if (value === null || value === undefined) return null
  return DEVICE_TYPE_MAP[value] ?? `unknown_type_${value}`
}

const DEVICE_STATUS_MAP: Record<number, string> = {
  0: 'offline',
  1: 'online',
  2: 'deleted',
  3: 'warning',
  4: 'error',
}

function mapDeviceStatus(value: number | null): string | null {
  if (value === null || value === undefined) return null
  return DEVICE_STATUS_MAP[value] ?? `unknown_status_${value}`
}

// ============================================================
// raw_data 构建（脱敏）
// ============================================================

function buildTaskRawData(source: Record<string, unknown>): Record<string, unknown> {
  return {
    ...source,
    encrypt: source.encrypt ? '[REDACTED]' : null,
  }
}

function buildDeviceRawData(source: Record<string, unknown>): Record<string, unknown> {
  return {
    ...source,
    lib_pwd: source.lib_pwd ? '[REDACTED]' : null,
  }
}

// ============================================================
// 真实 Task Mapper
// ============================================================

export function mapRealTask(
  source: Record<string, unknown>,
  siteCode: string,
  sourceTable: string = 'tbl_task'
): UnifiedTaskRecord {
  const taskType = source.task_type as number
  return {
    source_site_id: siteCode,
    source_table: sourceTable,
    source_id: String(source.id),
    synced_at: new Date(),
    task_no: `${siteCode}-${source.id}`,
    task_name: source.task_name ? String(source.task_name) : null,
    task_type: mapTaskType(taskType),
    status: mapTaskStatus(taskType, source.status as number),
    phase: null,
    priority: null,
    data_classification: null,
    archive_name: null,
    source_path: null,
    package_path: null,
    operator: null,
    department: null,
    total_files: (source.total_files as number) ?? 0,
    total_size: (source.total_size as number) ?? 0,
    raw_data: buildTaskRawData(source) as unknown as import('@/lib/sync/types').TaskSourceRecord,
  }
}

// ============================================================
// 真实 Device Mapper
// ============================================================

export function mapRealDevice(
  source: Record<string, unknown>,
  siteCode: string,
  sourceTable: string = 'tbl_disc_lib'
): UnifiedDeviceRecord {
  return {
    source_site_id: siteCode,
    source_table: sourceTable,
    source_id: String(source.lib_id),
    synced_at: new Date(),
    device_id: String(source.lib_id),
    device_name: (source.name as string) ?? null,
    device_type: mapDeviceType(source.type as number) ?? 'unknown',
    status: mapDeviceStatus(source.device_status as number) ?? 'unknown',
    ip_address: (source.ip as string) ?? null,
    location: null,
    room: null,
    floor: null,
    total_capacity: null,
    used_capacity: null,
    raw_data: buildDeviceRawData(source) as unknown as import('@/lib/sync/types').DeviceSourceRecord,
    model: (source.model as string) ?? null,
    manufacturer: (source.vendor as string) ?? null,
    serial_no: (source.sn as string) ?? null,
    slot_count: (source.slots as number) ?? null,
    cage_count: (source.mags as number) ?? null,
    use_status: (source.use_status as number) ?? null,
    site_code: siteCode,
  }
}
