/**
 * Disc Media Importer
 * Sprint 2C.9 - 从 source_restore 读取 tbl_disc，写入 unified_disc_media
 */

import { sourceQuery } from '@/lib/db/source-pool'
import { query } from '@/lib/db'

interface DiscRow {
  id: number
  task_id: number | null
  disc_num: number | null
  slot_id: number | null
  disc_label: string | null
  used_size: number | null
  extra_size: number | null
  iso_status: number | null
  iso_path: string | null
  burn_success: number | null
  burn_errors: number | null
  error_files: number | null
  stage: number | null
  disc_progress: number | null
  serial_num: string | null
  create_dt: Date | null
  update_dt: Date | null
  verify_dt: Date | null
  cmt: string | null
  src_slot: number | null
  burn_device: string | null
  copy_success: number | null
  prepare_seconds: number | null
  ret_msg: string | null
  ret_value: number | null
}

interface DeviceMapping {
  lib_id: number
  device_name: string | null
}

export async function importDiscMedia(siteCode: string): Promise<void> {
  const startTime = Date.now()

  console.log(`[Import] Starting disc media import from source_restore...`)
  console.log(`[Import] Site: ${siteCode}`)

  // 1. 读取源表
  const { rows: sourceRows } = await sourceQuery<DiscRow>(
    'SELECT * FROM tbl_disc ORDER BY task_id, disc_num'
  )
  console.log(`[Import] Found ${sourceRows.length} discs`)

  // 2. 读取 slot → device 映射（用于关联设备）
  const { rows: slotDeviceRows } = await sourceQuery<{ slot_id: number; lib_id: number; device_name: string | null }>(`
    SELECT s.slot_id, m.lib_id, dl.name as device_name
    FROM tbl_slots s
    JOIN tbl_magzines m ON s.mag_id = m.mag_id
    JOIN tbl_disc_lib dl ON m.lib_id = dl.lib_id
  `)
  const slotDeviceMap = new Map<number, DeviceMapping>()
  for (const row of slotDeviceRows) {
    slotDeviceMap.set(row.slot_id, { lib_id: row.lib_id, device_name: row.device_name })
  }
  console.log(`[Import] Built slot→device mapping for ${slotDeviceMap.size} slots`)

  // 3. 读取 task_no 映射
  const { rows: taskRows } = await sourceQuery<{ id: number }>('SELECT id FROM tbl_task')
  const taskIds = new Set(taskRows.map(r => r.id))

  // 4. UPSERT
  let upserted = 0
  for (const row of sourceRows) {
    const deviceMapping = row.slot_id ? slotDeviceMap.get(row.slot_id) : undefined
    const taskNo = row.task_id && taskIds.has(row.task_id) ? `${siteCode}-${row.task_id}` : null

    await query(
      `INSERT INTO unified_disc_media (
        source_site_id, source_table, source_id, synced_at,
        source_task_id, task_no,
        disc_num, disc_label, slot_id, device_id, device_name,
        used_size, extra_size,
        iso_status, iso_path, burn_success, burn_errors, error_files,
        stage, disc_progress, serial_num,
        create_dt, update_dt, verify_dt,
        raw_data
      ) VALUES (
        $1, $2, $3, NOW(),
        $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20,
        $21, $22, $23,
        $24
      )
      ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
        synced_at = NOW(),
        source_task_id = EXCLUDED.source_task_id,
        task_no = EXCLUDED.task_no,
        disc_num = EXCLUDED.disc_num,
        disc_label = EXCLUDED.disc_label,
        slot_id = EXCLUDED.slot_id,
        device_id = EXCLUDED.device_id,
        device_name = EXCLUDED.device_name,
        used_size = EXCLUDED.used_size,
        extra_size = EXCLUDED.extra_size,
        iso_status = EXCLUDED.iso_status,
        iso_path = EXCLUDED.iso_path,
        burn_success = EXCLUDED.burn_success,
        burn_errors = EXCLUDED.burn_errors,
        error_files = EXCLUDED.error_files,
        stage = EXCLUDED.stage,
        disc_progress = EXCLUDED.disc_progress,
        serial_num = EXCLUDED.serial_num,
        create_dt = EXCLUDED.create_dt,
        update_dt = EXCLUDED.update_dt,
        verify_dt = EXCLUDED.verify_dt,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()`,
      [
        siteCode,
        'tbl_disc',
        String(row.id),
        row.task_id ? String(row.task_id) : null,
        taskNo,
        row.disc_num,
        row.disc_label,
        row.slot_id,
        deviceMapping ? String(deviceMapping.lib_id) : null,
        deviceMapping?.device_name ?? null,
        row.used_size,
        row.extra_size,
        row.iso_status,
        row.iso_path,
        row.burn_success,
        row.burn_errors,
        row.error_files,
        row.stage,
        row.disc_progress,
        row.serial_num,
        row.create_dt,
        row.update_dt,
        row.verify_dt,
        JSON.stringify(row),
      ]
    )
    upserted++
  }

  const duration = Date.now() - startTime
  console.log(`[Import] Done: ${upserted} discs upserted`)
  console.log(`[Import] Duration: ${duration}ms`)
}
