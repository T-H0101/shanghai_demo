// lib/sync/field-mapper.ts

import type { TaskSourceRecord, UnifiedTaskRecord } from './types'

const SITE_CODE = 'SH01'
const SOURCE_TABLE = 'tbl_task'

/**
 * 将源数据映射到统一表结构
 */
export function mapTask(source: TaskSourceRecord): UnifiedTaskRecord {
  return {
    source_site_id: SITE_CODE,
    source_table: SOURCE_TABLE,
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