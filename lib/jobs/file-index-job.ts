/**
 * lib/jobs/file-index-job.ts
 * R.86 — file_index_jobs repository (中心库 PG 读写)
 *
 * 仓储层契约; UI / indexer / scheduler 只允许调用这里, 不允许直接拼 SQL。
 *
 * 边界:
 *   - 单库中心库 (unified_disc_platform); 不允许连站点库。
 *   - 站点侧拉取由 SiteAgentPort (R.88) 负责, 与本仓储正交。
 *   - 一切状态转换走 lib/jobs/file-index-job-state.ts, 不允许字符串硬编码。
 */

import { Pool } from "pg"
import {
  canTransition,
  decideAfterFailure,
  type FileIndexJobStatus,
  type FileIndexWatermarkColumn,
} from "@/lib/jobs/file-index-job-state"

export type FileIndexJobRow = {
  id: string
  source_site_id: string
  source_table: string
  last_watermark_column: FileIndexWatermarkColumn
  last_watermark_value: string | null
  status: FileIndexJobStatus
  retry_count: number
  max_retries: number
  next_retry_at: Date | null
  last_error: string | null
  last_run_at: Date | null
  last_run_duration_ms: number | null
  last_scanned: number | null
  last_indexed: number | null
  last_failed: number | null
  last_tombstoned: number | null
  total_runs: number
  total_indexed: number
  total_failed: number
  is_enabled: boolean
  schedule_interval_seconds: number
  created_at: Date
  updated_at: Date
}

const SELECT_COLUMNS = `
  id, source_site_id, source_table, last_watermark_column,
  last_watermark_value, status, retry_count, max_retries,
  next_retry_at, last_error,
  last_run_at, last_run_duration_ms,
  last_scanned, last_indexed, last_failed, last_tombstoned,
  total_runs, total_indexed, total_failed,
  is_enabled, schedule_interval_seconds,
  created_at, updated_at
`

export function createFileIndexJobRepository(pool: Pool) {
  return {
    /** 全量读取; 用于初始化 R.86 indexer, 给 29 张表各自插一行 */
    async listAll(): Promise<FileIndexJobRow[]> {
      const r = await pool.query<{ row: FileIndexJobRow }>(
        `SELECT ${SELECT_COLUMNS} FROM file_index_jobs ORDER BY source_site_id, source_table`
      )
      // pg driver returns flat columns already; this wrapper stays for future shaping
      return r.rows.map((row) => row as unknown as FileIndexJobRow)
    },

    async findBySiteTable(
      siteId: string,
      table: string
    ): Promise<FileIndexJobRow | null> {
      const r = await pool.query<FileIndexJobRow>(
        `SELECT ${SELECT_COLUMNS}
         FROM file_index_jobs
         WHERE source_site_id = $1 AND source_table = $2`,
        [siteId, table]
      )
      return r.rows[0] ?? null
    },

    /**
     * 初始化: 给 R.84 file_index_es 29 张表插默认行。
     * 已存在则跳过 (idempotent)。
     */
    async ensureSeedRows(
      siteId: string,
      tables: readonly string[],
      watermarkColumn: FileIndexWatermarkColumn = "id"
    ): Promise<{ inserted: number; skipped: number }> {
      let inserted = 0
      let skipped = 0
      for (const table of tables) {
        const exists = await this.findBySiteTable(siteId, table)
        if (exists) {
          skipped++
          continue
        }
        await pool.query(
          `INSERT INTO file_index_jobs
             (source_site_id, source_table, last_watermark_column, status, is_enabled)
           VALUES ($1, $2, $3, 'pending', TRUE)
           ON CONFLICT (source_site_id, source_table) DO NOTHING`,
          [siteId, table, watermarkColumn]
        )
        inserted++
      }
      return { inserted, skipped }
    },

    /**
     * Worker 抢锁: pending / due failed / due succeeded -> running, 原子更新。
     * failed 与 succeeded 必须等待 next_retry_at 到期, 避免紧密重跑。
     */
    async claimForRun(siteId: string, table: string): Promise<FileIndexJobRow | null> {
      const r = await pool.query<FileIndexJobRow>(
        `UPDATE file_index_jobs
         SET status = 'running'::varchar,
             updated_at = NOW()
         WHERE source_site_id = $1
           AND source_table = $2
           AND (
             status = 'pending'
             OR (status = 'failed' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
             OR (status = 'succeeded' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
           )
           AND is_enabled = TRUE
         RETURNING ${SELECT_COLUMNS}`,
        [siteId, table]
      )
      return r.rows[0] ?? null
    },

    /**
     * 报告运行结果 (成功 / 失败 / 死信 / tombstone).
     * 调用方传入 next status + 累计 watermark + 累计指标; 内部按状态机校验。
     */
    async reportRun(
      siteId: string,
      table: string,
      outcome: {
        newStatus: FileIndexJobStatus
        nextWatermark: string | null
        scanned: number
        indexed: number
        failed: number
        tombstoned: number
        durationMs: number
        error: string | null
        retryCount: number
      }
    ): Promise<FileIndexJobRow | null> {
      const existing = await this.findBySiteTable(siteId, table)
      if (!existing) return null
      if (!canTransition(existing.status, outcome.newStatus)) {
        throw new Error(
          `invalid file_index_jobs transition: ${existing.status} -> ${outcome.newStatus}`
        )
      }
      const r = await pool.query<FileIndexJobRow>(
        `UPDATE file_index_jobs
         SET status = $3::varchar,
             last_watermark_value = $4,
             last_run_at = NOW(),
             last_run_duration_ms = $5,
             last_scanned = $6::integer,
             last_indexed = $7::integer,
             last_failed = $8::integer,
             last_tombstoned = $9::integer,
             last_error = $10,
             retry_count = $11,
             total_runs = total_runs + 1,
             total_indexed = total_indexed + $7::bigint,
             total_failed = total_failed + $8::bigint,
             next_retry_at = CASE
               WHEN $3 = 'failed' THEN NOW() + INTERVAL '60 seconds'
               WHEN $3 = 'dead_letter' THEN NULL
               WHEN $3 = 'succeeded' THEN NOW() + (schedule_interval_seconds * INTERVAL '1 second')
               ELSE next_retry_at
             END,
             updated_at = NOW()
         WHERE source_site_id = $1
           AND source_table = $2
         RETURNING ${SELECT_COLUMNS}`,
        [
          siteId,
          table,
          outcome.newStatus,
          outcome.nextWatermark,
          outcome.durationMs,
          outcome.scanned,
          outcome.indexed,
          outcome.failed,
          outcome.tombstoned,
          outcome.error,
          outcome.retryCount,
        ]
      )
      return r.rows[0] ?? null
    },

    /**
     * 失败判定: 把 retry_count + 1 后, 走 decideAfterFailure 决定是 failed 还是 dead_letter。
     * 由 worker 调用, 避免散落判定逻辑。
     */
    async reportFailure(
      siteId: string,
      table: string,
      scanned: number,
      indexed: number,
      failed: number,
      tombstoned: number,
      durationMs: number,
      error: string
    ): Promise<FileIndexJobRow | null> {
      const existing = await this.findBySiteTable(siteId, table)
      if (!existing) return null
      const newStatus = decideAfterFailure(existing.retry_count, existing.max_retries)
      return this.reportRun(siteId, table, {
        newStatus,
        nextWatermark: existing.last_watermark_value,
        scanned,
        indexed,
        failed,
        tombstoned,
        durationMs,
        error,
        retryCount: existing.retry_count + 1,
      })
    },

    /** 人工解锁死信: dead_letter -> pending, retry_count 清零 */
    async resetDeadLetter(siteId: string, table: string): Promise<boolean> {
      const r = await pool.query(
        `UPDATE file_index_jobs
         SET status = 'pending'::varchar,
             retry_count = 0,
             last_error = NULL,
             next_retry_at = NOW(),
             updated_at = NOW()
         WHERE source_site_id = $1
           AND source_table = $2
           AND status = 'dead_letter'`,
        [siteId, table]
      )
      return (r.rowCount ?? 0) > 0
    },

    /** 标记源表下线 (R.89 inventory 使用) */
    async tombstone(siteId: string, table: string, reason: string): Promise<boolean> {
      const existing = await this.findBySiteTable(siteId, table)
      if (!existing) return false
      if (!canTransition(existing.status, "tombstoned")) {
        throw new Error(
          `invalid file_index_jobs transition: ${existing.status} -> tombstoned`
        )
      }
      const r = await pool.query(
        `UPDATE file_index_jobs
         SET status = 'tombstoned'::varchar,
             is_enabled = FALSE,
             last_error = $3,
             updated_at = NOW()
         WHERE source_site_id = $1
           AND source_table = $2`,
        [siteId, table, `tombstoned: ${reason}`]
      )
      return (r.rowCount ?? 0) > 0
    },
  }
}
