/**
 * Volume Slot Aggregator
 * Sprint 2H.3 — 把 tbl_volume_slot 关系聚合到 unified_volumes.raw_data._aggregate
 *
 * 数据来源：站点推包 records（不连 SOURCE_DATABASE_URL / 站点库）。
 * on_line：与 disc_files.sql 一致 — 在线 >=1，借出或离线 =0。
 * 回写键：source_site_id + source_table=tbl_logical_volume +
 *   (source_record_id | volume_id | source_id) = volume_id
 */

import { query } from '@/lib/db'

export interface VolumeSlotAggregateResult {
  readCount: number
  distinctVolumes: number
  unifiedRowsUpdated: number
  durationMs: number
  sample?: Array<{ volumeId: string; slotCount: number; online: number; offline: number }>
}

function pickVolumeId(record: Record<string, unknown>): string | null {
  const raw = record.volume_id ?? record.volumeId
  if (raw == null || raw === '') return null
  return String(raw)
}

function pickOnLine(record: Record<string, unknown>): number | null {
  const raw = record.on_line ?? record.onLine
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * 用推包中的 tbl_volume_slot 行，按 volume_id 聚合后写回 unified_volumes。
 */
export async function aggregateVolumeSlots(
  siteCode: string,
  records: Array<Record<string, unknown>>,
): Promise<VolumeSlotAggregateResult> {
  const start = Date.now()

  if (!records.length) {
    return {
      readCount: 0,
      distinctVolumes: 0,
      unifiedRowsUpdated: 0,
      durationMs: Date.now() - start,
    }
  }

  const agg = new Map<string, { slotCount: number; onlineCount: number; offlineCount: number }>()
  let readCount = 0
  for (const record of records) {
    const volKey = pickVolumeId(record)
    if (!volKey) continue
    readCount += 1
    const a = agg.get(volKey) ?? { slotCount: 0, onlineCount: 0, offlineCount: 0 }
    a.slotCount += 1
    const onLine = pickOnLine(record)
    // disc_files: 在线为>=1，借出或离线为0
    if (onLine != null && onLine >= 1) a.onlineCount += 1
    else if (onLine === 0) a.offlineCount += 1
    agg.set(volKey, a)
  }

  if (agg.size === 0) {
    return {
      readCount,
      distinctVolumes: 0,
      unifiedRowsUpdated: 0,
      durationMs: Date.now() - start,
    }
  }

  let updated = 0
  for (const [volumeId, v] of agg.entries()) {
    const r = await query(
      `UPDATE unified_volumes
       SET raw_data = COALESCE(raw_data, '{}'::jsonb)
                          || jsonb_build_object(
                               '_aggregate',
                               COALESCE(raw_data->'_aggregate', '{}'::jsonb)
                               || jsonb_build_object(
                                    'source_table', 'tbl_volume_slot',
                                    'slot_count', $1::int,
                                    'online_slot_count', $2::int,
                                    'offline_slot_count', $3::int,
                                    'aggregated_at', NOW()::text
                                  )
                             ),
           synced_at = NOW()
       WHERE source_site_id = $4
         AND source_table = 'tbl_logical_volume'
         AND (
           source_record_id = $5
           OR volume_id = $5
           OR source_id = $5
         )`,
      [v.slotCount, v.onlineCount, v.offlineCount, siteCode, volumeId],
    )
    updated += r.rowCount ?? 0
  }

  const sample = Array.from(agg.entries())
    .slice(0, 5)
    .map(([volumeId, v]) => ({
      volumeId,
      slotCount: v.slotCount,
      online: v.onlineCount,
      offline: v.offlineCount,
    }))

  return {
    readCount,
    distinctVolumes: agg.size,
    unifiedRowsUpdated: updated,
    durationMs: Date.now() - start,
    sample,
  }
}
