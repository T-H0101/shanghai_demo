/**
 * Tasks 同步逻辑
 * Sprint 2B.0 - 主同步模块
 */

import type { SyncResult } from './types'
import { readSourceRecords } from './source-reader'
import { mapTasks } from './field-mapper'
import {
  createJobLog,
  updateJobLogSuccess,
  updateJobLogFailed,
  updateJobLogSkipped,
} from './sync-job-log'
import { getOrCreateProgress, updateProgressFailed } from './sync-progress'
import { transaction } from '@/lib/db'

const SITE_CODE = 'SH01'
const SOURCE_TABLE = 'tbl_task'

/**
 * 同步 tasks 数据
 * 1. 读取源数据（ID > last_source_id）
 * 2. 字段映射
 * 3. UPSERT 到 unified_tasks（事务）
 * 4. 更新 sync_progress（事务内）
 * 5. 更新 sync_job_log
 */
export async function syncTasks(): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  let jobId: string | null = null
  let lastSourceIdBefore = 0

  try {
    // 1. 获取 sync_progress
    const progress = await getOrCreateProgress()
    lastSourceIdBefore = progress?.last_source_id ?? 0

    // 2. 写入 sync_job_log（状态: running）
    jobId = await createJobLog()

    // 3. 读取源数据
    const sourceRecords = await readSourceRecords(lastSourceIdBefore)
    const rowsRead = sourceRecords.length

    // 4. 如果无新记录，返回 skipped
    if (rowsRead === 0) {
      if (jobId) {
        await updateJobLogSkipped(jobId)
      }
      return {
        status: 'skipped',
        rowsRead: 0,
        rowsUpserted: 0,
        rowsSkipped: 0,
        startedAt,
        finishedAt: new Date().toISOString(),
        lastSourceIdBefore,
        lastSourceIdAfter: lastSourceIdBefore,
        message: 'No new records to sync',
      }
    }

    // 5. 字段映射
    const mappedRecords = mapTasks(sourceRecords)

    // 6. UPSERT + 更新游标（事务）
    const { rowsUpserted, maxSourceId } = await transaction(async (client) => {
      let rowsUpserted = 0
      let maxSourceId = lastSourceIdBefore

      for (const record of mappedRecords) {
        const sql = `
          INSERT INTO unified_tasks (
            source_site_id, source_table, source_id, synced_at,
            task_no, task_name, task_type, status, phase, priority,
            data_classification, archive_name, source_path, package_path,
            operator, department, total_files, total_size, raw_data
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19
          )
          ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
            synced_at = EXCLUDED.synced_at,
            task_no = EXCLUDED.task_no,
            task_name = EXCLUDED.task_name,
            status = EXCLUDED.status,
            phase = EXCLUDED.phase,
            updated_at = NOW()
          RETURNING id
        `

        const res = await client.query(sql, [
          record.source_site_id,
          record.source_table,
          record.source_id,
          record.synced_at,
          record.task_no,
          record.task_name,
          record.task_type,
          record.status,
          record.phase,
          record.priority,
          record.data_classification,
          record.archive_name,
          record.source_path,
          record.package_path,
          record.operator,
          record.department,
          record.total_files,
          record.total_size,
          JSON.stringify(record.raw_data),
        ])

        if (res.rowCount && res.rowCount > 0) {
          rowsUpserted += res.rowCount
        }

        const sourceIdNum = parseInt(record.source_id, 10)
        if (sourceIdNum > maxSourceId) {
          maxSourceId = sourceIdNum
        }
      }

      // 更新 sync_progress（事务内）
      const updateProgressSql = `
        UPDATE sync_progress
        SET last_source_id = $1,
            last_sync_time = NOW(),
            last_status = 'success',
            synced_rows = $2,
            last_error = NULL,
            updated_at = NOW()
        WHERE source_site_id = $3 AND source_table = $4
      `
      await client.query(updateProgressSql, [maxSourceId, rowsUpserted, SITE_CODE, SOURCE_TABLE])

      return { rowsUpserted, maxSourceId }
    })

    // 7. 更新 sync_job_log（事务外）
    await updateJobLogSuccess(jobId, rowsRead, rowsUpserted, 0)

    return {
      status: 'success',
      rowsRead,
      rowsUpserted,
      rowsSkipped: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      lastSourceIdBefore,
      lastSourceIdAfter: maxSourceId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // 回滚已经在 transaction 内自动处理

    // 更新 job_log 为失败
    if (jobId) {
      await updateJobLogFailed(jobId, errorMessage)
    }

    // 更新 sync_progress 为失败（不更新游标）
    await updateProgressFailed(errorMessage)

    return {
      status: 'failed',
      rowsRead: 0,
      rowsUpserted: 0,
      rowsSkipped: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      lastSourceIdBefore,
      lastSourceIdAfter: lastSourceIdBefore,
      error: errorMessage,
    }
  }
}