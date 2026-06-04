/**
 * Hard Disk Importer
 * Sprint 2C.12 - 从 source_restore 读取 tbl_hd_info，写入 unified_hard_disks
 *
 * 注意：tbl_hd_info.slot_id (1000000+) 是硬盘库专用 ID，
 * 与 tbl_slots.slot_id (1-396) 不同系，无法直接关联设备。
 * 设备关联需后续通过 serial_num 匹配 tbl_slots.serial_num 间接实现。
 */

import { sourceQuery } from '@/lib/db/source-pool'
import { query } from '@/lib/db'

interface HdInfoRow {
  slot_id: number
  serial_num: string | null
  name: string | null
  model: string | null
  asset_num: string | null
  file_sys: string | null
  file_path: string | null
  create_dt: Date | null
  health: number | null
  hd_status: number | null
  hd_online: number | null
  read_only: number | null
  smart: string | null
  raid_type: string | null
  raid_vid: number | null
  full_check_set: number | null
  last_fullcheck_dt: Date | null
  select_check_set: number | null
  last_selectcheck_dt: Date | null
  power_set: number | null
  last_power_dt: Date | null
  last_mount_dt: Date | null
  last_online_dt: Date | null
}

function mapHdStatus(value: number | null): string {
  if (value === null) return 'unknown'
  const map: Record<number, string> = { 0: 'inactive', 1: 'active' }
  return map[value] ?? `unknown_${value}`
}

function mapHealthStatus(value: number | null): string {
  if (value === null) return 'unknown'
  if (value >= 80) return 'healthy'
  if (value >= 50) return 'warning'
  return 'critical'
}

export async function importHardDisks(siteCode: string): Promise<void> {
  const startTime = Date.now()

  console.log(`[Import] Starting hard disks import from source_restore...`)
  console.log(`[Import] Site: ${siteCode}`)

  const { rows: sourceRows } = await sourceQuery<HdInfoRow>(
    'SELECT * FROM tbl_hd_info ORDER BY slot_id'
  )
  console.log(`[Import] Found ${sourceRows.length} hard disks`)

  let upserted = 0
  for (const row of sourceRows) {
    await query(
      `INSERT INTO unified_hard_disks (
        source_site_id, source_table, source_id, synced_at,
        disk_id, device_id, slot_index,
        model, serial_no, status, health_status,
        raw_data
      ) VALUES (
        $1, $2, $3, NOW(),
        $4, $5, $6,
        $7, $8, $9, $10,
        $11
      )
      ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
        synced_at = NOW(),
        disk_id = EXCLUDED.disk_id,
        device_id = EXCLUDED.device_id,
        slot_index = EXCLUDED.slot_index,
        model = EXCLUDED.model,
        serial_no = EXCLUDED.serial_no,
        status = EXCLUDED.status,
        health_status = EXCLUDED.health_status,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()`,
      [
        siteCode,
        'tbl_hd_info',
        String(row.slot_id),
        row.serial_num ?? String(row.slot_id),
        null, // device_id 无法通过 slot_id 关联
        row.slot_id - 1000000, // slot_index = 相对位置
        row.model,
        row.serial_num,
        mapHdStatus(row.hd_status),
        mapHealthStatus(row.health),
        JSON.stringify(row),
      ]
    )
    upserted++
  }

  const duration = Date.now() - startTime
  console.log(`[Import] Done: ${upserted} hard disks upserted`)
  console.log(`[Import] Duration: ${duration}ms`)
}
