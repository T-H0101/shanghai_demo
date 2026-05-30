/**
 * Devices 同步逻辑
 * Sprint 2B.4 - 第二个同步对象
 */

import type { SyncResult } from './types'
import { DEVICE_SYNC_CONFIG } from './config'
import { readDiscLibSource } from './source-reader'
import { mapDiscLibToTarget } from './field-mapper'
import { upsertDevicesInTransaction } from './upsert'
import { runSync } from './sync-engine'
import type { updateProgressInTransaction } from './sync-progress'

/**
 * 同步 devices 数据
 */
export async function syncDevices(): Promise<SyncResult> {
  return runSync({
    config: DEVICE_SYNC_CONFIG,
    readSource: readDiscLibSource,
    mapToTarget: mapDiscLibToTarget as (source: unknown) => Record<string, unknown>,
    getSourceId: (source) => (source as { id: number }).id,
    upsertBatch: upsertDevicesInTransaction as unknown as (
      records: Record<string, unknown>[],
      client: Parameters<typeof updateProgressInTransaction>[0]
    ) => Promise<{ rowsUpserted: number; maxSourceId: number }>,
  })
}