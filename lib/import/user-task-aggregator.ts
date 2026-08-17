/**
 * User Task Aggregator
 * Sprint 2H.3 — 把 tbl_user_task 关联聚合到 unified_tasks.raw_data._aggregate
 *
 * 数据来源：站点推包 records（不连 SOURCE_DATABASE_URL / 站点库）。
 * 不写 unified_tasks.user_id（源端语义不清，避免混用）。
 */

import { query } from '@/lib/db'

export interface UserTaskAggregateResult {
  readCount: number
  distinctTasks: number
  userIds: number
  unifiedRowsUpdated: number
  durationMs: number
  note: string
}

/**
 * 用推包中的 tbl_user_task 行，按 task_id 聚合后写回 unified_tasks。
 */
export async function aggregateUserTasks(
  siteCode: string,
  records: Array<Record<string, unknown>>,
): Promise<UserTaskAggregateResult> {
  const start = Date.now()

  if (!records.length) {
    return {
      readCount: 0,
      distinctTasks: 0,
      userIds: 0,
      unifiedRowsUpdated: 0,
      durationMs: Date.now() - start,
      note: '推包无 tbl_user_task 行，跳过聚合',
    }
  }

  const distinctTasks = new Set<string>()
  const distinctUsers = new Set<string>()
  const counts = new Map<string, { count: number; users: Set<string> }>()

  for (const record of records) {
    const taskId = record.task_id != null && record.task_id !== '' ? String(record.task_id) : ''
    const userId = record.user_id != null && record.user_id !== '' ? String(record.user_id) : ''
    if (!taskId) continue
    distinctTasks.add(taskId)
    if (userId) distinctUsers.add(userId)
    const c = counts.get(taskId) ?? { count: 0, users: new Set<string>() }
    c.count += 1
    if (userId) c.users.add(userId)
    counts.set(taskId, c)
  }

  if (counts.size === 0) {
    return {
      readCount: records.length,
      distinctTasks: 0,
      userIds: 0,
      unifiedRowsUpdated: 0,
      durationMs: Date.now() - start,
      note: '推包行缺少 task_id，无可聚合数据',
    }
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
      [c.count, c.users.size, siteCode, taskId],
    )
    updated += r.rowCount ?? 0
  }

  return {
    readCount: records.length,
    distinctTasks: distinctTasks.size,
    userIds: distinctUsers.size,
    unifiedRowsUpdated: updated,
    durationMs: Date.now() - start,
    note: '仅写 raw_data._aggregate.user_task_count, 不写 user_id 字段',
  }
}
