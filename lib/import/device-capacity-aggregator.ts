/**
 * Device Capacity Aggregator
 * Sprint 2C.2 - 从 source_restore 聚合设备盘位/容量数据
 *
 * 数据来源：
 *   tbl_slots (slot_id, mag_id, max_cap, rest_cap)
 *   tbl_magzines (mag_id, lib_id)
 *
 * 聚合目标：lib_id → total_slots, used_slots, total_capacity, used_capacity
 */

import { sourceQuery } from '@/lib/db/source-pool'

export interface DeviceCapacityData {
  lib_id: number
  total_slots: number
  used_slots: number
  total_capacity: number
  used_capacity: number
  remaining_capacity: number
}

export interface DeviceCageData {
  lib_id: number
  cage_count: number
}

/**
 * 按 lib_id 聚合盘位容量
 * used_slots = COUNT(*) WHERE max_cap > rest_cap（容量被使用过的 slot）
 */
export async function aggregateCapacity(): Promise<DeviceCapacityData[]> {
  const { rows } = await sourceQuery<DeviceCapacityData>(`
    SELECT m.lib_id,
           COUNT(*)::int as total_slots,
           COUNT(*) FILTER (WHERE s.max_cap > s.rest_cap)::int as used_slots,
           COALESCE(SUM(s.max_cap), 0)::bigint as total_capacity,
           COALESCE(SUM(s.max_cap - s.rest_cap), 0)::bigint as used_capacity,
           COALESCE(SUM(s.rest_cap), 0)::bigint as remaining_capacity
    FROM tbl_slots s
    JOIN tbl_magzines m ON s.mag_id = m.mag_id
    GROUP BY m.lib_id
    ORDER BY m.lib_id
  `)
  return rows
}

/**
 * 按 lib_id 聚合盘笼数
 */
export async function aggregateCages(): Promise<DeviceCageData[]> {
  const { rows } = await sourceQuery<DeviceCageData>(`
    SELECT lib_id,
           COUNT(*)::int as cage_count
    FROM tbl_magzines
    GROUP BY lib_id
    ORDER BY lib_id
  `)
  return rows
}

export interface DeviceCapacityMap {
  [libId: string]: {
    total_slots: number
    used_slots: number
    total_capacity: number
    used_capacity: number
    remaining_capacity: number
    cage_count: number
  }
}

/**
 * 聚合所有设备容量数据，按 lib_id 索引
 */
export async function aggregateAllCapacity(): Promise<DeviceCapacityMap> {
  const [capData, cageData] = await Promise.all([
    aggregateCapacity(),
    aggregateCages(),
  ])

  const map: DeviceCapacityMap = {}

  for (const row of capData) {
    map[String(row.lib_id)] = {
      total_slots: row.total_slots,
      used_slots: row.used_slots,
      total_capacity: row.total_capacity,
      used_capacity: row.used_capacity,
      remaining_capacity: row.remaining_capacity,
      cage_count: 0,
    }
  }

  for (const row of cageData) {
    const key = String(row.lib_id)
    if (map[key]) {
      map[key].cage_count = row.cage_count
    }
  }

  return map
}
