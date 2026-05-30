// lib/sync/field-mapper.ts

import type { DeviceSourceRecord, TaskSourceRecord, UnifiedDeviceRecord, UnifiedTaskRecord } from './types'
import { DEFAULT_SITE_CODE, DEVICE_SYNC_CONFIG, TASK_SYNC_CONFIG } from './config'

/**
 * 将源数据映射到统一表结构
 */
export function mapTask(source: TaskSourceRecord): UnifiedTaskRecord {
  return {
    source_site_id: DEFAULT_SITE_CODE,
    source_table: TASK_SYNC_CONFIG.sourceTable,
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
 * 批量映射
 */
export function mapTasks(sources: TaskSourceRecord[]): UnifiedTaskRecord[] {
  return sources.map(mapTask)
}

/**
 * 映射 disc_lib 源数据到 unified_devices 目标
 */
export function mapDiscLibToTarget(source: DeviceSourceRecord): Record<string, unknown> {
  // 扩展字段存入 raw_data
  const rawData = {
    device_status: source.device_status,
    last_heartbeat: source.last_heartbeat,
    operator: source.operator,
  }

  return {
    source_site_id: DEFAULT_SITE_CODE,
    source_table: DEVICE_SYNC_CONFIG.sourceTable,
    source_id: String(source.id),
    synced_at: new Date(),
    device_id: source.device_id,
    device_name: source.device_name,
    device_type: source.device_type,
    status: source.device_status,
    ip_address: source.ip_address,
    location: source.location,
    room: source.room,
    floor: source.floor,
    total_capacity: source.total_capacity,
    used_capacity: source.used_capacity,
    raw_data: rawData,
  }
}

/**
 * 批量映射 disc_lib
 */
export function mapDiscLibTargets(sources: DeviceSourceRecord[]): Record<string, unknown>[] {
  return sources.map(mapDiscLibToTarget)
}