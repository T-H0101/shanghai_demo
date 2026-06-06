/**
 * Task Runtime Aggregator
 * Sprint 2F.1 - 从 tbl_disc 聚合任务运行时统计
 *
 * 输出:
 * - packageCount: COUNT(*) FROM tbl_disc WHERE task_id = ?
 * - successCount: SUM(burn_success) FROM tbl_disc WHERE task_id = ?
 * - errorCount: SUM(error_files) FROM tbl_disc WHERE task_id = ?
 * - progress: AVG(disc_progress) FROM tbl_disc WHERE task_id = ? (0-100)
 * - currentPhase: tbl_disc.stage (任一 disc)
 * - runtimeSeconds: update_dt - create_dt (从 tbl_task 计算, 由 mapper 处理)
 *
 * 注意: 不引入 sourceQuery() 的批量调用, 每次为单任务查询, 避免大表扫描。
 */

import { sourceQuery } from '@/lib/db/source-pool'

export interface DiscAggregate {
  packageCount: number | null
  successCount: number | null
  errorCount: number | null
  progress: number | null
  currentPhase: string | null
}

/**
 * 聚合单个 task 的 tbl_disc 统计
 * @param taskId 任务 ID
 */
export async function aggregateTaskDisc(taskId: string | number): Promise<DiscAggregate> {
  if (taskId == null) {
    return emptyAggregate()
  }

  const sql = `
    SELECT
      COUNT(*)::int AS package_count,
      COALESCE(SUM(burn_success), 0)::int AS success_count,
      COALESCE(SUM(error_files), 0)::int AS error_count,
      AVG(disc_progress)::int AS avg_progress,
      MAX(stage) AS current_phase
    FROM tbl_disc
    WHERE task_id = $1
  `

  try {
    const { rows } = await sourceQuery<{
      package_count: number
      success_count: number
      error_count: number
      avg_progress: number | null
      current_phase: number | null
    }>(sql, [taskId])

    if (rows.length === 0 || rows[0].package_count === 0) {
      return emptyAggregate()
    }

    const row = rows[0]
    return {
      packageCount: row.package_count,
      successCount: row.success_count,
      errorCount: row.error_count,
      progress: row.avg_progress != null ? Math.round(row.avg_progress) : null,
      currentPhase: row.current_phase != null ? String(row.current_phase) : null,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[TaskRuntimeAggregator] task_id=${taskId} failed: ${msg}`)
    return emptyAggregate()
  }
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

/**
 * 计算 runtime 秒数
 * @param createDt 创建时间
 * @param updateDt 更新时间
 */
export function computeRuntimeSeconds(
  createDt: Date | string | null | undefined,
  updateDt: Date | string | null | undefined
): number | null {
  if (!createDt || !updateDt) return null
  const create = typeof createDt === 'string' ? new Date(createDt) : createDt
  const update = typeof updateDt === 'string' ? new Date(updateDt) : updateDt
  if (isNaN(create.getTime()) || isNaN(update.getTime())) return null
  const diffMs = update.getTime() - create.getTime()
  if (diffMs < 0) return null
  return Math.floor(diffMs / 1000)
}
