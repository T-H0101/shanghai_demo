/**
 * User Task Aggregator
 * Sprint 2H.3 (autonomous) - 检查 tbl_user_task 是否可用
 *
 * 背景 (来自 Sprint 2G.3 盘点):
 *   - tbl_user_task 有 user_id + task_id 联合主键, 28 条记录
 *   - 但 user_stage_acting / user_stage_failedcount / user_stage_faileddate 全部 NULL
 *   - 源端 schema 是占位, 没有真实数据
 *
 * 决策:
 *   - 不写 unified_tasks.user_id (因为源端 user_id 字段为 NULL, 写出来是假数据)
 *   - 但 tbl_user_task.task_id 是真实存在的, 可以作为"任务被哪个用户看到" 的关联记录
 *   - 用 raw_data 写 _aggregate.user_task_count, 标识"该任务有 N 个 user_task 关联记录"
 *
 * 容错: 全空时 0 命中, 静默成功
 */

import { sourceQuery } from '@/lib/db/source-pool'
import { query } from '@/lib/db'

export interface UserTaskAggregateResult {
  readCount: number
  distinctTasks: number
  userIds: number      // 唯一 user_id 数量
  unifiedRowsUpdated: number
  durationMs: number
  note: string         // 提示 "all NULL" 等
}

interface UserTaskRow {
  task_id: string | null
  user_id: string | null
}

/**
 * 聚合 tbl_user_task → unified_tasks.raw_data._aggregate.user_task_count
 * 不写 user_id 字段, 因为源端 user_id 在 user_task 关系表里是有效值,
 * 而 unified_tasks.user_id 业务上指 "执行人", 源端没明确字段, 不混用
 */
export async function aggregateUserTasks(siteCode: string = 'SH01'): Promise<UserTaskAggregateResult> {
  const start = Date.now()

  const { rows } = await sourceQuery<UserTaskRow>(
    `SELECT task_id::text AS task_id, user_id::text AS user_id FROM tbl_user_task`
  )

  const distinctTasks = new Set<string>()
  const distinctUsers = new Set<string>()
  for (const r of rows) {
    if (r.task_id) distinctTasks.add(r.task_id)
    if (r.user_id) distinctUsers.add(r.user_id)
  }

  if (distinctTasks.size === 0) {
    return {
      readCount: rows.length,
      distinctTasks: 0,
      userIds: 0,
      unifiedRowsUpdated: 0,
      durationMs: Date.now() - start,
      note: 'tbl_user_task 全空, 无可聚合数据',
    }
  }

  // 按 task_id 聚合 count
  const counts = new Map<string, { count: number; users: Set<string> }>()
  for (const r of rows) {
    if (!r.task_id) continue
    const c = counts.get(r.task_id) ?? { count: 0, users: new Set<string>() }
    c.count += 1
    if (r.user_id) c.users.add(r.user_id)
    counts.set(r.task_id, c)
  }

  let updated = 0
  for (const [taskId, c] of counts.entries()) {
    const r = await query(
      `UPDATE unified_tasks
       SET raw_data = COALESCE(raw_data, '{}'::jsonb)
                          || jsonb_build_object(
                               '_aggregate',
                               COALESCE(raw_data->'_aggregate', '{}'::jsonb)
                               || jsonb_build_object(
                                    'user_task_count', $1::int,
                                    'user_id_count', $2::int,
                                    'user_task_source', 'tbl_user_task',
                                    'user_task_aggregated_at', NOW()::text
                                  )
                             ),
           synced_at = NOW()
       WHERE source_site_id = $3
         AND source_table = 'tbl_task'
         AND source_id = $4`,
      [c.count, c.users.size, siteCode, taskId]
    )
    updated += r.rowCount ?? 0
  }

  return {
    readCount: rows.length,
    distinctTasks: distinctTasks.size,
    userIds: distinctUsers.size,
    unifiedRowsUpdated: updated,
    durationMs: Date.now() - start,
    note: '仅写 raw_data._aggregate.user_task_count, 不写 user_id 字段 (源端 user_id NULL)',
  }
}
