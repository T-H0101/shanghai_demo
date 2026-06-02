/**
 * UPSERT 操作封装
 * Sprint 2B - 同步模块
 * Sprint 2B.4 - 修改为 client 参数传入，不再自己开启事务
 */

import { query, transaction } from '@/lib/db'
import type { UnifiedTaskRecord, UnifiedDeviceRecord } from './types'
import type { updateProgressInTransaction } from './sync-progress'

/**
 * UPSERT 单条记录到 unified_tasks
 */
export async function upsertTask(record: UnifiedTaskRecord): Promise<number> {
  const sql = `
    INSERT INTO unified_tasks (
      source_site_id, source_table, source_id, synced_at,
      task_no, task_name, task_type, status, phase, priority,
      data_classification, archive_name, source_path, package_path,
      operator, department, total_files, total_size, raw_data
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19
    )
    ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
      synced_at = EXCLUDED.synced_at,
      task_no = EXCLUDED.task_no,
      task_name = EXCLUDED.task_name,
      task_type = EXCLUDED.task_type,
      status = EXCLUDED.status,
      phase = EXCLUDED.phase,
      priority = EXCLUDED.priority,
      data_classification = EXCLUDED.data_classification,
      archive_name = EXCLUDED.archive_name,
      source_path = EXCLUDED.source_path,
      package_path = EXCLUDED.package_path,
      operator = EXCLUDED.operator,
      department = EXCLUDED.department,
      total_files = EXCLUDED.total_files,
      total_size = EXCLUDED.total_size,
      raw_data = EXCLUDED.raw_data,
      updated_at = NOW()
    RETURNING id
  `

  const result = await query(sql, [
    record.source_site_id,
    record.source_table,
    record.source_id,
    record.synced_at,
    record.task_no,
    record.task_name,
    record.task_type,
    record.status,
    record.phase,
    record.priority,
    record.data_classification,
    record.archive_name,
    record.source_path,
    record.package_path,
    record.operator,
    record.department,
    record.total_files,
    record.total_size,
    JSON.stringify(record.raw_data),
  ])

  return result.rowCount ?? 0
}

/**
 * 批量 UPSERT（事务内）
 * 不自己开启 transaction，由 sync-engine 管理事务
 */
export async function upsertTasksInTransaction(
  records: UnifiedTaskRecord[],
  client: Parameters<typeof updateProgressInTransaction>[0]
): Promise<{ rowsUpserted: number; maxSourceId: number }> {
  if (records.length === 0) {
    return { rowsUpserted: 0, maxSourceId: 0 }
  }

  let rowsUpserted = 0
  let maxSourceId = 0

  for (const record of records) {
    const sql = `
      INSERT INTO unified_tasks (
        source_site_id, source_table, source_id, synced_at,
        task_no, task_name, task_type, status, phase, priority,
        data_classification, archive_name, source_path, package_path,
        operator, department, total_files, total_size, raw_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
        synced_at = EXCLUDED.synced_at,
        task_no = EXCLUDED.task_no,
        task_name = EXCLUDED.task_name,
        task_type = EXCLUDED.task_type,
        status = EXCLUDED.status,
        phase = EXCLUDED.phase,
        priority = EXCLUDED.priority,
        data_classification = EXCLUDED.data_classification,
        archive_name = EXCLUDED.archive_name,
        source_path = EXCLUDED.source_path,
        package_path = EXCLUDED.package_path,
        operator = EXCLUDED.operator,
        department = EXCLUDED.department,
        total_files = EXCLUDED.total_files,
        total_size = EXCLUDED.total_size,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
      RETURNING id
    `

    const res = await client.query(sql, [
      record.source_site_id,
      record.source_table,
      record.source_id,
      record.synced_at,
      record.task_no,
      record.task_name,
      record.task_type,
      record.status,
      record.phase,
      record.priority,
      record.data_classification,
      record.archive_name,
      record.source_path,
      record.package_path,
      record.operator,
      record.department,
      record.total_files,
      record.total_size,
      JSON.stringify(record.raw_data),
    ])

    if (res.rowCount && res.rowCount > 0) {
      rowsUpserted += res.rowCount
    }

    // 计算最大 source_id
    const sourceIdNum = parseInt(record.source_id, 10)
    if (sourceIdNum > maxSourceId) {
      maxSourceId = sourceIdNum
    }
  }

  // 不再调用 onProgressUpdate，由 sync-engine 在同一事务内更新
  return { rowsUpserted, maxSourceId }
}

/**
 * UPSERT 单条记录到 unified_devices
 */
export async function upsertDevice(record: UnifiedDeviceRecord): Promise<number> {
  const sql = `
    INSERT INTO unified_devices (
      source_site_id, source_table, source_id, synced_at,
      device_id, device_name, device_type, status,
      ip_address, location, room, floor,
      total_capacity, used_capacity,
      raw_data
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
    )
    ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
      synced_at = EXCLUDED.synced_at,
      device_id = EXCLUDED.device_id,
      device_name = EXCLUDED.device_name,
      device_type = EXCLUDED.device_type,
      status = EXCLUDED.status,
      ip_address = EXCLUDED.ip_address,
      location = EXCLUDED.location,
      room = EXCLUDED.room,
      floor = EXCLUDED.floor,
      total_capacity = EXCLUDED.total_capacity,
      used_capacity = EXCLUDED.used_capacity,
      raw_data = EXCLUDED.raw_data,
      updated_at = NOW()
    RETURNING id
  `

  const result = await query(sql, [
    record.source_site_id,
    record.source_table,
    record.source_id,
    record.synced_at,
    record.device_id,
    record.device_name,
    record.device_type,
    record.status,
    record.ip_address,
    record.location,
    record.room,
    record.floor,
    record.total_capacity,
    record.used_capacity,
    JSON.stringify(record.raw_data),
  ])

  return result.rowCount ?? 0
}

/**
 * 批量 UPSERT 到 unified_devices（事务内）
 * Sprint 2B.12: 新增 model, manufacturer, serial_no, slot_count, cage_count, use_status, site_code
 * 使用 COALESCE 保证旧调用方传 null 时不会覆盖已有值
 */
export async function upsertDevicesInTransaction(
  records: UnifiedDeviceRecord[],
  client: Parameters<typeof updateProgressInTransaction>[0]
): Promise<{ rowsUpserted: number; maxSourceId: number }> {
  if (records.length === 0) {
    return { rowsUpserted: 0, maxSourceId: 0 }
  }

  let rowsUpserted = 0
  let maxSourceId = 0

  for (const record of records) {
    const sql = `
      INSERT INTO unified_devices (
        source_site_id, source_table, source_id, synced_at,
        device_id, device_name, device_type, status,
        ip_address, location, room, floor,
        total_capacity, used_capacity,
        model, manufacturer, serial_no, slot_count, cage_count, use_status, site_code,
        raw_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      )
      ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
        synced_at = EXCLUDED.synced_at,
        device_id = EXCLUDED.device_id,
        device_name = EXCLUDED.device_name,
        device_type = EXCLUDED.device_type,
        status = EXCLUDED.status,
        ip_address = EXCLUDED.ip_address,
        location = EXCLUDED.location,
        room = EXCLUDED.room,
        floor = EXCLUDED.floor,
        total_capacity = EXCLUDED.total_capacity,
        used_capacity = EXCLUDED.used_capacity,
        model = COALESCE(EXCLUDED.model, unified_devices.model),
        manufacturer = COALESCE(EXCLUDED.manufacturer, unified_devices.manufacturer),
        serial_no = COALESCE(EXCLUDED.serial_no, unified_devices.serial_no),
        slot_count = COALESCE(EXCLUDED.slot_count, unified_devices.slot_count),
        cage_count = COALESCE(EXCLUDED.cage_count, unified_devices.cage_count),
        use_status = COALESCE(EXCLUDED.use_status, unified_devices.use_status),
        site_code = COALESCE(EXCLUDED.site_code, unified_devices.site_code),
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
      RETURNING id
    `

    const res = await client.query(sql, [
      record.source_site_id,
      record.source_table,
      record.source_id,
      record.synced_at,
      record.device_id,
      record.device_name,
      record.device_type,
      record.status,
      record.ip_address,
      record.location,
      record.room,
      record.floor,
      record.total_capacity,
      record.used_capacity,
      record.model ?? null,
      record.manufacturer ?? null,
      record.serial_no ?? null,
      record.slot_count ?? null,
      record.cage_count ?? null,
      record.use_status ?? null,
      record.site_code ?? null,
      JSON.stringify(record.raw_data),
    ])

    if (res.rowCount && res.rowCount > 0) {
      rowsUpserted += res.rowCount
    }

    // 计算最大 source_id
    const sourceIdNum = parseInt(String(record.source_id), 10)
    if (sourceIdNum > maxSourceId) {
      maxSourceId = sourceIdNum
    }
  }

  return { rowsUpserted, maxSourceId }
}