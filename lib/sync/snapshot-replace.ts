/**
 * Full snapshot replace for syncMode === 'full'
 * DELETE site+table rows, then INSERT package records (transactional).
 */

import type { PoolClient } from 'pg'
import type { TableSyncMode } from './package-schema'

/** 聚合表: 不做 1:1 镜像, 跳过先删后增 */
export const AGGREGATE_SYNC_TABLES = new Set([
  'tbl_lib_task',
  'tbl_volume_slot',
  'tbl_user_task',
])

export function shouldFullSnapshotReplace(
  tableName: string,
  syncMode?: TableSyncMode
): boolean {
  if (syncMode !== 'full') return false
  if (AGGREGATE_SYNC_TABLES.has(tableName)) return false
  return true
}

const UNIFIED_TABLE_PATTERN = /^unified_[a-z0-9_]+$/

export async function deleteSiteTableSnapshot(
  client: PoolClient,
  targetTable: string,
  siteCode: string,
  sourceTable: string
): Promise<number> {
  if (!UNIFIED_TABLE_PATTERN.test(targetTable)) {
    throw new Error(`Invalid target table for snapshot delete: ${targetTable}`)
  }
  const result = await client.query(
    `DELETE FROM ${targetTable} WHERE source_site_id = $1 AND source_table = $2`,
    [siteCode, sourceTable]
  )
  return result.rowCount ?? 0
}
