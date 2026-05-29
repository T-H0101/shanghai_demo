// lib/sync/sync-progress.ts

import { query } from '@/lib/db'
import type { SyncProgress } from './types'

const SITE_CODE = 'SH01'
const SOURCE_TABLE = 'tbl_task'

/**
 * 获取同步进度
 */
export async function getProgress(): Promise<SyncProgress | null> {
  const sql = `
    SELECT id, source_site_id, source_table, last_sync_time,
           last_source_id, last_status, synced_rows, last_error,
           created_at, updated_at
    FROM sync_progress
    WHERE source_site_id = $1 AND source_table = $2
  `

  const result = await query(sql, [SITE_CODE, SOURCE_TABLE])
  return (result.rows[0] as SyncProgress) ?? null
}

/**
 * 获取或创建同步进度（如果不存在）
 */
export async function getOrCreateProgress(): Promise<SyncProgress> {
  let progress = await getProgress()

  if (!progress) {
    // 创建初始记录
    const sql = `
      INSERT INTO sync_progress (source_site_id, source_table, last_source_id, last_status)
      VALUES ($1, $2, 0, 'idle')
      ON CONFLICT (source_site_id, source_table) DO NOTHING
      RETURNING id, source_site_id, source_table, last_sync_time,
                last_source_id, last_status, synced_rows, last_error,
                created_at, updated_at
    `
    const result = await query(sql, [SITE_CODE, SOURCE_TABLE])
    progress = result.rows[0] as SyncProgress
  }

  return progress
}

/**
 * 更新同步进度（在事务内调用）
 */
export async function updateProgressInTransaction(
  client: any,
  newSourceId: number,
  syncedRows: number
): Promise<void> {
  const sql = `
    UPDATE sync_progress
    SET last_source_id = $1,
        last_sync_time = NOW(),
        last_status = 'success',
        synced_rows = $2,
        last_error = NULL,
        updated_at = NOW()
    WHERE source_site_id = $3 AND source_table = $4
  `

  await client.query(sql, [newSourceId, syncedRows, SITE_CODE, SOURCE_TABLE])
}

/**
 * 更新同步状态为失败
 */
export async function updateProgressFailed(error: string): Promise<void> {
  const sql = `
    UPDATE sync_progress
    SET last_status = 'failed',
        last_error = $1,
        updated_at = NOW()
    WHERE source_site_id = $2 AND source_table = $3
  `

  await query(sql, [error, SITE_CODE, SOURCE_TABLE])
}