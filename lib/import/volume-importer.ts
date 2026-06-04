/**
 * Volume Importer
 * Sprint 2C.10 - 从 source_restore 读取 tbl_logical_volume + tbl_volume_slot
 * 写入 unified_volumes
 */

import { sourceQuery } from '@/lib/db/source-pool'
import { query } from '@/lib/db'

interface VolumeRow {
  volume_id: number
  name: string | null
  type: number | null
  total_cap: number | null
  used_cap: number | null
  free_cap: number | null
  create_time: Date | null
  update_time: Date | null
  remark: string | null
  del_flag: number | null
  group_id: number | null
  uuid: string | null
  mount_id: number | null
  max_file_id: number | null
  create_user: string | null
  update_user: string | null
}

const VOLUME_TYPE_MAP: Record<number, string> = {
  1: 'optical',
  2: 'magnetic',
  3: 'hard_disk',
}

export async function importVolumes(siteCode: string): Promise<void> {
  const startTime = Date.now()

  console.log(`[Import] Starting volumes import from source_restore...`)
  console.log(`[Import] Site: ${siteCode}`)

  // 1. 读取 tbl_logical_volume
  const { rows: volumeRows } = await sourceQuery<VolumeRow>(
    'SELECT * FROM tbl_logical_volume ORDER BY volume_id'
  )
  console.log(`[Import] Found ${volumeRows.length} volumes`)

  // 2. 聚合 tbl_volume_slot → slot_count per volume
  const { rows: slotCounts } = await sourceQuery<{ volume_id: number; slot_count: number }>(
    'SELECT volume_id, COUNT(*)::int as slot_count FROM tbl_volume_slot GROUP BY volume_id'
  )
  const slotCountMap = new Map<number, number>()
  for (const row of slotCounts) {
    slotCountMap.set(row.volume_id, row.slot_count)
  }
  console.log(`[Import] Found slot counts for ${slotCountMap.size} volumes`)

  // 3. UPSERT
  let upserted = 0
  for (const row of volumeRows) {
    const slotCount = slotCountMap.get(row.volume_id) ?? 0
    const volumeType = row.type != null ? (VOLUME_TYPE_MAP[row.type] ?? `unknown_${row.type}`) : 'unknown'

    await query(
      `INSERT INTO unified_volumes (
        source_site_id, source_table, source_id, synced_at,
        volume_id, volume_name, volume_type,
        capacity, used_capacity,
        file_count, site_code, device_id,
        status, health_status, raw_data
      ) VALUES (
        $1, $2, $3, NOW(),
        $4, $5, $6,
        $7, $8,
        $9, $10, $11,
        $12, $13, $14
      )
      ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
        synced_at = NOW(),
        volume_id = EXCLUDED.volume_id,
        volume_name = EXCLUDED.volume_name,
        volume_type = EXCLUDED.volume_type,
        capacity = EXCLUDED.capacity,
        used_capacity = EXCLUDED.used_capacity,
        file_count = EXCLUDED.file_count,
        site_code = EXCLUDED.site_code,
        device_id = EXCLUDED.device_id,
        status = EXCLUDED.status,
        health_status = EXCLUDED.health_status,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()`,
      [
        siteCode,
        'tbl_logical_volume',
        String(row.volume_id),
        String(row.volume_id),
        row.name,
        volumeType,
        row.total_cap ? String(row.total_cap) : null,
        row.used_cap ?? null,
        slotCount,
        siteCode,
        null, // device_id 需要通过 volume_slot → slot → mag → lib 关联，暂不实现
        row.del_flag === 0 ? 'active' : 'deleted',
        null,
        JSON.stringify({ ...row, slot_count: slotCount }),
      ]
    )
    upserted++
  }

  const duration = Date.now() - startTime
  console.log(`[Import] Done: ${upserted} volumes upserted`)
  console.log(`[Import] Duration: ${duration}ms`)
}
