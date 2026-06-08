/**
 * Lib Task Aggregator
 * Sprint 2H.3 (autonomous) - 把 tbl_lib_task 关系表聚合为 unified_tasks.runtime_seconds
 *
 * 背景:
 *   - tbl_task 自带的 update_dt-create_dt 是"总存活时间", 不是真实运行耗时
 *   - tbl_lib_task 记录了每个 command 的 start_dt/end_dt (3 个 command 阶段: CopyHdDrive /
 *     StartOneMakeIso / BurnOneDrive), 跨阶段求最大跨度 = 真实 runtime
 *   - 源表数据: 86 条 lib_task 记录, 覆盖 21 个 task_id
 *   - 字段映射:
 *       source: tbl_lib_task.task_id → unified_tasks.source_id (按 source_site_id+source_id 命中)
 *       target field: runtime_seconds (numeric seconds)
 *
 * 设计:
 *   - 只在 unified_tasks.runtime_seconds IS NULL 或被标记为"待聚合" 时更新, 避免覆盖更准的业务值
 *   - 不创建新行 (UPSERT 改 0 行或 N 行)
 *   - 容错: lib_task 全空 / start_dt 全空 / end_dt 全空 → 0 命中
 *   - 单一事务批量更新 (避免 N+1)
 */

import { sourceQuery } from '@/lib/db/source-pool'
import { query } from '@/lib/db'

export interface LibTaskAggregateResult {
  readCount: number           // tbl_lib_task 总行数
  distinctTasks: number       // 不同 task_id 数量
  tasksWithRuntime: number    // 有 start_dt 和 end_dt 的 task 数
  unifiedRowsUpdated: number  // unified_tasks 命中行数
  unifiedRowsScanned: number  // 中心表扫描行数 (UPDATE ... FROM ... 的扫描)
  durationMs: number
  perTaskRuntime?: Array<{ taskId: string; runtimeSeconds: number; commandCount: number }>
}

interface LibTaskRow {
  task_id: string
  command: string | null
  start_dt: Date | string | null
  end_dt: Date | string | null
}

interface TaskRuntimeRow {
  task_id: string
  runtime_seconds: string | number
  command_count: string | number
}

/**
 * 推算每个 task 的 runtime (秒):
 *   - start = MIN(start_dt) (跨所有 command)
 *   - end   = MAX(end_dt)   (跨所有 command)
 *   - runtime_seconds = floor((end - start) / 1000)  当 start/end 都非空
 */
export function computeTaskRuntime(rows: LibTaskRow[]): Map<string, { runtime: number; commandCount: number }> {
  const groups = new Map<string, { startMin: number | null; endMax: number | null; cmds: Set<string> }>()
  for (const r of rows) {
    if (r.start_dt == null || r.end_dt == null) continue
    const start = typeof r.start_dt === 'string' ? new Date(r.start_dt).getTime() : r.start_dt.getTime()
    const end = typeof r.end_dt === 'string' ? new Date(r.end_dt).getTime() : r.end_dt.getTime()
    if (isNaN(start) || isNaN(end) || end < start) continue
    const g = groups.get(r.task_id) ?? { startMin: null, endMax: null, cmds: new Set<string>() }
    if (g.startMin === null || start < g.startMin) g.startMin = start
    if (g.endMax === null || end > g.endMax) g.endMax = end
    if (r.command) g.cmds.add(r.command)
    groups.set(r.task_id, g)
  }
  const out = new Map<string, { runtime: number; commandCount: number }>()
  for (const [taskId, g] of groups.entries()) {
    if (g.startMin == null || g.endMax == null) continue
    out.set(taskId, {
      runtime: Math.floor((g.endMax - g.startMin) / 1000),
      commandCount: g.cmds.size,
    })
  }
  return out
}

/**
 * 推算并写回 unified_tasks.runtime_seconds
 *
 * 不传 siteCode 时, 默认 SH01 (与现有 importer 一致); 真实场景下 pkg endpoint 传入 siteCode。
 * 该函数会扫描 unified_tasks 中 source_table='tbl_task' 的所有行, 匹配 source_id = tbl_lib_task.task_id
 */
export async function aggregateLibTaskRuntimes(siteCode: string = 'SH01'): Promise<LibTaskAggregateResult> {
  const start = Date.now()

  // 1. 读源表
  const { rows: libRows } = await sourceQuery<LibTaskRow>(
    `SELECT task_id::text AS task_id, command, start_dt, end_dt FROM tbl_lib_task`
  )
  if (libRows.length === 0) {
    return {
      readCount: 0,
      distinctTasks: 0,
      tasksWithRuntime: 0,
      unifiedRowsUpdated: 0,
      unifiedRowsScanned: 0,
      durationMs: Date.now() - start,
    }
  }

  // 2. 推算 runtime
  const runtimeMap = computeTaskRuntime(libRows)
  const distinctIds = new Set(libRows.map((r) => r.task_id))

  // 3. 写回 unified_tasks (按 site + source_id 命中)
  let updated = 0
  let scanned = 0
  for (const [taskId, { runtime }] of runtimeMap.entries()) {
    const r = await query(
      `UPDATE unified_tasks
       SET runtime_seconds = $1,
           updated_at = NOW()
       WHERE source_site_id = $2
         AND source_table = 'tbl_task'
         AND source_id = $3
         AND (runtime_seconds IS NULL OR runtime_seconds = 0)`,
      [runtime, siteCode, taskId]
    )
    scanned += 1
    updated += r.rowCount ?? 0
  }

  return {
    readCount: libRows.length,
    distinctTasks: distinctIds.size,
    tasksWithRuntime: runtimeMap.size,
    unifiedRowsUpdated: updated,
    unifiedRowsScanned: scanned,
    durationMs: Date.now() - start,
    perTaskRuntime: Array.from(runtimeMap.entries())
      .slice(0, 10)
      .map(([taskId, v]) => ({ taskId, runtimeSeconds: v.runtime, commandCount: v.commandCount })),
  }
}
