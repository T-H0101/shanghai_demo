// lib/sync/sync-job-log.ts

import { query } from '@/lib/db'
import type { SyncJobLog } from './types'

const SITE_CODE = 'SH01'
const SOURCE_TABLE = 'tbl_task'

/**
 * 创建同步任务日志（状态: running）
 */
export async function createJobLog(): Promise<string> {
  const jobId = `sync-${SOURCE_TABLE}-${Date.now()}`
  const sql = `
    INSERT INTO sync_job_log (job_id, source_site_id, source_table, status)
    VALUES ($1, $2, $3, 'running')
    RETURNING id
  `

  await query(sql, [jobId, SITE_CODE, SOURCE_TABLE])
  return jobId
}

/**
 * 更新同步任务日志（成功）
 */
export async function updateJobLogSuccess(
  jobId: string,
  rowsRead: number,
  rowsUpserted: number,
  rowsSkipped: number
): Promise<void> {
  const sql = `
    UPDATE sync_job_log
    SET finished_at = NOW(),
        status = 'success',
        rows_read = $2,
        rows_upserted = $3,
        rows_skipped = $4
    WHERE job_id = $1
  `

  await query(sql, [jobId, rowsRead, rowsUpserted, rowsSkipped])
}

/**
 * 更新同步任务日志（失败）
 */
export async function updateJobLogFailed(
  jobId: string,
  errorMessage: string,
  rowsRead: number = 0
): Promise<void> {
  const sql = `
    UPDATE sync_job_log
    SET finished_at = NOW(),
        status = 'failed',
        rows_read = $2,
        rows_upserted = 0,
        rows_skipped = 0,
        error_message = $3
    WHERE job_id = $1
  `

  await query(sql, [jobId, rowsRead, errorMessage])
}

/**
 * 更新同步任务日志（跳过，无新数据）
 */
export async function updateJobLogSkipped(jobId: string): Promise<void> {
  const sql = `
    UPDATE sync_job_log
    SET finished_at = NOW(),
        status = 'skipped',
        rows_read = 0,
        rows_upserted = 0,
        rows_skipped = 0
    WHERE job_id = $1
  `

  await query(sql, [jobId])
}

/**
 * 获取最近的同步日志
 */
export async function getLatestJobLog(): Promise<SyncJobLog | null> {
  const sql = `
    SELECT id, job_id, source_site_id, source_table, started_at,
           finished_at, status, rows_read, rows_upserted, rows_skipped,
           error_message, created_at
    FROM sync_job_log
    WHERE source_table = $1
    ORDER BY created_at DESC
    LIMIT 1
  `

  const result = await query(sql, [SOURCE_TABLE])
  return (result.rows[0] as SyncJobLog) ?? null
}
