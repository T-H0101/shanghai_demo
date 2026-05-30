/**
 * 最小同步引擎
 * Sprint 2B.4 - 封装公共同步逻辑
 * 事务由 sync-engine 管理，upsertBatch 使用传入的 client
 */

import type { SyncObjectConfig } from './config'
import type { SyncResult } from './types'
import { transaction } from '@/lib/db'
import { getOrCreateProgress, updateProgressInTransaction, updateProgressFailed } from './sync-progress'
import { createJobLog, updateJobLogSuccess, updateJobLogSkipped, updateJobLogFailed } from './sync-job-log'

interface SyncInput<T> {
  config: SyncObjectConfig
  readSource: (lastId: number) => Promise<T[]>
  mapToTarget: (source: T) => Record<string, unknown>
  getSourceId: (source: T) => number
  upsertBatch: (
    records: Record<string, unknown>[],
    client: Parameters<typeof updateProgressInTransaction>[0]
  ) => Promise<{ rowsUpserted: number; maxSourceId: number }>
}

/**
 * 通用同步引擎
 * - sync-engine 负责事务
 * - upsertBatch 使用传入的 client 执行 UPSERT
 * - updateProgressInTransaction 使用同一 client
 */
export async function runSync<T>(input: SyncInput<T>): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  let jobId: string | null = null
  let lastSourceIdBefore = 0

  try {
    // 1. 获取 sync_progress
    const progress = await getOrCreateProgress(
      input.config.sourceSiteCode,
      input.config.sourceTable
    )
    lastSourceIdBefore = progress?.last_source_id ?? 0

    // 2. 写入 sync_job_log（状态: running）
    jobId = await createJobLog(input.config.sourceSiteCode, input.config.sourceTable)

    // 3. 读取源数据
    const sourceRecords = await input.readSource(lastSourceIdBefore)
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
    const mappedRecords = sourceRecords.map((source) => input.mapToTarget(source))

    // 6. 事务内执行 UPSERT + 更新游标
    const { rowsUpserted, maxSourceId } = await transaction(async (client) => {
      // 6.1 批量 UPSERT
      const result = await input.upsertBatch(mappedRecords, client)

      // 6.2 更新 sync_progress（同一事务）
      await updateProgressInTransaction(
        client,
        input.config.sourceSiteCode,
        input.config.sourceTable,
        result.maxSourceId,
        result.rowsUpserted
      )

      return result
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

    if (jobId) {
      await updateJobLogFailed(jobId, errorMessage)
    }

    await updateProgressFailed(
      input.config.sourceSiteCode,
      input.config.sourceTable,
      errorMessage
    )

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