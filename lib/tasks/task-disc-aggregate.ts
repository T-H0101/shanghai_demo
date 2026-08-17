/**
 * 从中心库 unified_disc_media 聚合任务盘统计，对齐业务列表/详情：
 * - packageCount: COUNT(*)（总盘数 / 总封包数语义）
 * - successCount: burn_success = 1 的盘数
 * - errorCount: burn_success < 0 的盘数
 *
 * 用于 package 同步回写 unified_tasks，以及任务同步时附带聚合。
 */

import { query } from '@/lib/db'
import type { DiscAggregate } from '@/lib/import/task-runtime-aggregator'

export type { DiscAggregate }

interface DiscAggRow {
  source_task_id: string
  package_count: number
  success_count: number
  error_count: number
  avg_progress: number | null
  current_phase: number | null
}

function emptyAggregate(): DiscAggregate {
  return {
    packageCount: null,
    successCount: null,
    errorCount: null,
    progress: null,
    currentPhase: null,
  }
}

function rowToAggregate(row: DiscAggRow): DiscAggregate {
  return {
    packageCount: row.package_count,
    successCount: row.success_count,
    errorCount: row.error_count,
    progress: row.avg_progress != null ? Math.round(Number(row.avg_progress)) : null,
    currentPhase: row.current_phase != null ? String(row.current_phase) : null,
  }
}

/** 把盘聚合合并到任务行（仅补空字段，不覆盖已有非 null） */
export function mergeDiscAggregateIntoTaskRow<
  T extends {
    package_count: number | null
    success_count: number | null
    error_count: number | null
    progress: number | null
    current_phase: string | null
    status?: string
  }
>(row: T, agg: DiscAggregate | undefined): T {
  if (!agg) return row
  return {
    ...row,
    package_count: row.package_count ?? agg.packageCount,
    success_count: row.success_count ?? agg.successCount,
    error_count: row.error_count ?? agg.errorCount,
    progress:
      row.status === 'completed'
        ? 100
        : (row.progress ?? agg.progress),
    current_phase: row.current_phase ?? agg.currentPhase,
  }
}

/**
 * 批量从 unified_disc_media 聚合（按 site + task source_id）
 */
export async function loadUnifiedDiscAggregates(
  siteCode: string,
  taskIds: Array<string | number>
): Promise<Map<string, DiscAggregate>> {
  const map = new Map<string, DiscAggregate>()
  const ids = [...new Set(taskIds.map((id) => String(id)).filter(Boolean))]
  if (!siteCode || ids.length === 0) return map

  const { rows } = await query<DiscAggRow>(
    `
    SELECT
      source_task_id::text AS source_task_id,
      COUNT(*)::int AS package_count,
      COUNT(*) FILTER (WHERE burn_success = 1)::int AS success_count,
      COUNT(*) FILTER (WHERE burn_success < 0)::int AS error_count,
      AVG(disc_progress)::float AS avg_progress,
      MAX(stage) AS current_phase
    FROM unified_disc_media
    WHERE source_site_id = $1
      AND source_task_id IS NOT NULL
      AND source_task_id::text = ANY($2::text[])
    GROUP BY source_task_id
    `,
    [siteCode, ids]
  )

  for (const row of rows) {
    if (!row.source_task_id) continue
    map.set(String(row.source_task_id), rowToAggregate(row))
  }
  return map
}

/**
 * 多站点批量聚合（列表页用）：key = `${siteCode}::${sourceTaskId}`
 */
export async function loadUnifiedDiscAggregatesMultiSite(
  keys: Array<{ siteCode: string; taskId: string | number }>
): Promise<Map<string, DiscAggregate>> {
  const map = new Map<string, DiscAggregate>()
  if (keys.length === 0) return map

  const bySite = new Map<string, string[]>()
  for (const k of keys) {
    const tid = String(k.taskId)
    if (!k.siteCode || !tid) continue
    const list = bySite.get(k.siteCode) ?? []
    list.push(tid)
    bySite.set(k.siteCode, list)
  }

  await Promise.all(
    [...bySite.entries()].map(async ([siteCode, taskIds]) => {
      const siteMap = await loadUnifiedDiscAggregates(siteCode, taskIds)
      for (const [taskId, agg] of siteMap) {
        map.set(`${siteCode}::${taskId}`, agg)
      }
    })
  )
  return map
}

/**
 * 将 disc 聚合写回 unified_tasks（仅更新计数字段，不碰 total_files/size）
 */
export async function backfillTaskDiscCounts(
  siteCode: string,
  taskIds?: Array<string | number>
): Promise<{ updated: number }> {
  if (!siteCode) return { updated: 0 }

  const ids =
    taskIds != null
      ? [...new Set(taskIds.map((id) => String(id)).filter(Boolean))]
      : null

  if (ids && ids.length === 0) return { updated: 0 }

  const params: unknown[] = [siteCode]
  let taskFilter = ''
  if (ids) {
    params.push(ids)
    taskFilter = ` AND source_task_id::text = ANY($${params.length}::text[])`
  }

  const result = await query(
    `
    WITH agg AS (
      SELECT
        source_task_id::text AS source_task_id,
        COUNT(*)::int AS package_count,
        COUNT(*) FILTER (WHERE burn_success = 1)::int AS success_count,
        COUNT(*) FILTER (WHERE burn_success < 0)::int AS error_count,
        AVG(disc_progress)::float AS avg_progress,
        MAX(stage) AS current_phase
      FROM unified_disc_media
      WHERE source_site_id = $1
        AND source_task_id IS NOT NULL
        ${taskFilter}
      GROUP BY source_task_id
    )
    UPDATE unified_tasks t
    SET
      package_count = a.package_count,
      success_count = a.success_count,
      error_count = a.error_count,
      progress = CASE
        WHEN t.status = 'completed' THEN 100
        WHEN a.avg_progress IS NOT NULL THEN ROUND(a.avg_progress)::int
        ELSE t.progress
      END,
      current_phase = COALESCE(a.current_phase::text, t.current_phase),
      updated_at = NOW()
    FROM agg a
    WHERE t.source_site_id = $1
      AND t.source_table = 'tbl_task'
      AND t.source_id = a.source_task_id
    `,
    params
  )

  return { updated: result.rowCount ?? 0 }
}

/** 单任务聚合（无数据时返回空聚合） */
export async function aggregateUnifiedDiscMedia(
  siteCode: string,
  taskId: string | number
): Promise<DiscAggregate> {
  const map = await loadUnifiedDiscAggregates(siteCode, [taskId])
  return map.get(String(taskId)) ?? emptyAggregate()
}
