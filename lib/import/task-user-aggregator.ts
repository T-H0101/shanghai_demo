/**
 * Task-User Aggregator
 * Sprint 2C.11 - 从 source_restore 聚合任务-用户关联
 *
 * 数据来源：tbl_user_task (task_id, user_id, user_name)
 * 当前数据：28 条记录，全部 user_id=1 (admin)
 *
 * 聚合规则：取每个 task 的第一条 user_task 的 user_name
 * user_name 为空时跳过，不写入 operator
 */

import { sourceQuery } from '@/lib/db/source-pool'

export interface TaskUserMapping {
  task_id: number
  user_id: number
  user_name: string | null
  os_hostname: string | null
  os_platform: string | null
}

/**
 * 聚合每个 task 关联的操作员（取第一条记录）
 */
export async function aggregateTaskUsers(): Promise<Map<number, TaskUserMapping>> {
  const { rows } = await sourceQuery<TaskUserMapping>(`
    SELECT DISTINCT ON (task_id)
      task_id, user_id, user_name, os_hostname, os_platform
    FROM tbl_user_task
    ORDER BY task_id, user_id
  `)

  const map = new Map<number, TaskUserMapping>()
  for (const row of rows) {
    // 只记录有有效 user_name 的映射
    if (row.user_name && row.user_name.trim() !== '') {
      map.set(row.task_id, row)
    }
  }
  return map
}
