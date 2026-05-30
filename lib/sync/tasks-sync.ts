/**
 * Tasks 同步逻辑
 * Sprint 2B.4 - 重构使用 sync-engine
 */

import type { SyncResult } from './types'
import { TASK_SYNC_CONFIG } from './config'
import { readSourceRecords } from './source-reader'
import { mapTask } from './field-mapper'
import { upsertTasksInTransaction } from './upsert'
import { runSync } from './sync-engine'
import type { updateProgressInTransaction } from './sync-progress'

/**
 * 同步 tasks 数据
 */
export async function syncTasks(): Promise<SyncResult> {
  return runSync({
    config: TASK_SYNC_CONFIG,
    readSource: readSourceRecords,
    mapToTarget: mapTask as unknown as (source: unknown) => Record<string, unknown>,
    getSourceId: (source) => (source as { id: number }).id,
    upsertBatch: upsertTasksInTransaction as unknown as (
      records: Record<string, unknown>[],
      client: Parameters<typeof updateProgressInTransaction>[0]
    ) => Promise<{ rowsUpserted: number; maxSourceId: number }>,
  })
}