/**
 * Volume Slot Aggregator
 * Sprint 2H.3 (autonomous) - 把 tbl_volume_slot 关系表聚合到 unified_volumes
 *
 * 背景:
 *   - tbl_logical_volume 走 dispatcher 已经写入 unified_volumes (Sprint 2H.2)
 *   - tbl_volume_slot 是"逻辑卷-盘位" 关系, 共 161 条记录
 *   - 聚合目标: 算每个 volume 下的 slot 数量, 把这个统计写到一个新字段 (或 raw_data)
 *   - 由于 unified_volumes 没有 slot_count 字段, 我们用 raw_data 里追加 _aggregate 字段
 *
 * 设计:
 *   - 不直接改统一表 schema (禁止)
 *   - 把聚合结果写进 unified_volumes.raw_data._aggregate.slot_count / slot_total_cap
 *   - 这样 /api/volumes 调用方可以读 raw_data._aggregate 看到真实数据, 不破坏 schema
 */

import { sourceQuery } from '@/lib/db/source-pool'
import { query } from '@/lib/db'

export interface VolumeSlotAggregateResult {
  readCount: number                // tbl_volume_slot 总行数
  distinctVolumes: number          // 不同 volume_id 数量
  unifiedRowsUpdated: number       // 写回的 unified_volumes 行数
  durationMs: number
  sample?: Array<{ volumeId: string; slotCount: number; online: number; offline: number }>
}

interface VolumeSlotRow {
  volume_id: string | number | null
  slot_id: string | number | null
  on_line: number | null
}

interface VolumeAggRow {
  volume_id: string
  slot_count: string
  total_cap: string | null
}

/**
 * 读 tbl_volume_slot, 按 volume_id 聚合 slot_count 和 total_cap (累加 cap 列)
 * 然后写回 unified_volumes.raw_data._aggregate
 */
export async function aggregateVolumeSlots(siteCode: string = 'SH01'): Promise<VolumeSlotAggregateResult> {
  const start = Date.now()

  // 1. 读源表
  // 实际列: volume_id, slot_id, on_line (无 cap 列, Sprint 2H.3 验证)
  const { rows } = await sourceQuery<VolumeSlotRow>(
    `SELECT volume_id, slot_id, on_line FROM tbl_volume_slot WHERE volume_id IS NOT NULL`
  )

  if (rows.length === 0) {
    return {
      readCount: 0,
      distinctVolumes: 0,
      unifiedRowsUpdated: 0,
      durationMs: Date.now() - start,
    }
  }

  // 2. 聚合: 按 volume_id 统计 slot_count + on_line 分布
  const agg = new Map<string, { slotCount: number; onlineCount: number; offlineCount: number }>()
  for (const r of rows) {
    if (r.volume_id == null) continue
    const volKey = String(r.volume_id)
    const a = agg.get(volKey) ?? { slotCount: 0, onlineCount: 0, offlineCount: 0 }
    a.slotCount += 1
    if (r.on_line === 1) a.onlineCount += 1
    else if (r.on_line === 2) a.offlineCount += 1
    agg.set(volKey, a)
  }

  // 3. 写回 unified_volumes.raw_data._aggregate
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
         AND source_id = $5`,
      [v.slotCount, v.onlineCount, v.offlineCount, siteCode, volumeId]
    )
    updated += r.rowCount ?? 0
  }

  const sample = Array.from(agg.entries())
    .slice(0, 5)
    .map(([volumeId, v]) => ({ volumeId, slotCount: v.slotCount, online: v.onlineCount, offline: v.offlineCount }))

  return {
    readCount: rows.length,
    distinctVolumes: agg.size,
    unifiedRowsUpdated: updated,
    durationMs: Date.now() - start,
    sample,
  }
}
