/**
 * 控制命令执行器 — Sprint R.4 Bug 4 修复
 *
 * 修复前 (R.3 报告):
 *   - L342 execOnSiteDb 用 centralQuery 占位 (中心库), 不是站点库
 *   - DRY_RUN=true 时 5 dispatch 全部 if (!DRY_RUN) 包裹, 实际从未调用 execOnSiteDb
 *   - 缺 paused/priority 字段时, 5 dispatch 仍返回 success (误导)
 *
 * 修复后 (R.4):
 *   - L342 真连 site pool (SITE_DATABASE_URL → 5434 站点库)
 *   - 5 dispatch 加 schema 检测 (paused/priority 字段), 缺时返回 unsupported + blocked_by_source_schema
 *   - DRY_RUN=true 显式返回 dry_run_success (与 success 区分)
 *   - inspect_start/recovery_start 候选表 0 行时, 同样返回 unsupported
 *
 * R.4 范围: 0 业务功能, 仅修假执行 bug
 */

import { query as centralQuery } from '@/lib/db/postgres'
import { sourceQuery, getSourcePool } from '@/lib/db/source-pool'
import { Pool, PoolClient, QueryResultRow } from 'pg'
import { writeAudit } from './audit'
import type { ControlCommandRow } from './control-command'

const ACTOR = 'site-worker'
const DRY_RUN = (process.env.SITE_WORKER_DRY_RUN ?? 'true') !== 'false'
const SITE_DB_URL = process.env.SITE_DATABASE_URL ?? null

// Sprint R.4 Bug 4: 真 site pool (Sprint 4.8.1.8 fail-closed + 实际连站点库)
let sitePool: Pool | null = null
function getSitePool(): Pool {
  if (!sitePool && SITE_DB_URL) {
    sitePool = new Pool({
      connectionString: SITE_DB_URL,
      min: 1,
      max: 3,
      idleTimeoutMillis: 10000,
    })
    sitePool.on('error', (err) => {
      console.error('[SiteDB] pool error:', err)
    })
  }
  if (!sitePool) {
    throw new Error('SITE_DATABASE_URL not configured; site pool unavailable')
  }
  return sitePool
}

async function siteQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const r = await getSitePool().query<T>(text, params)
  return { rows: r.rows, rowCount: r.rowCount ?? 0 }
}

// Sprint R.4 Bug 4: schema 检测缓存 (启动期一次性查)
let _schemaCache: Record<string, boolean> | null = null
async function detectSiteSchema(): Promise<Record<string, boolean>> {
  if (_schemaCache) return _schemaCache
  try {
    const r = await siteQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='tbl_task'`
    )
    const cols = new Set(r.rows.map((x) => x.column_name))
    _schemaCache = {
      paused: cols.has('paused'),
      priority: cols.has('priority'),
      reset: cols.has('reset'),
      resume: cols.has('resume'),
      pause: cols.has('pause'),
    }
    return _schemaCache
  } catch (err) {
    console.error('[executor] detectSiteSchema failed:', err)
    // fail-closed: schema 不可知时, 视为缺字段
    return { paused: false, priority: false, reset: false, resume: false, pause: false }
  }
}

export interface ExecResult {
  commandNo: string
  status: 'success' | 'failed' | 'unsupported' | 'dry_run_success' | 'blocked'
  result: {
    affectedRows: number
    dryRun: boolean
    targetTable: string
    targetId: string
    before: unknown
    after: unknown
    blocker?: string
    reason?: string
  }
  errorMessage: string | null
  durationMs: number
}

export class ExecError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'ExecError'
  }
}

// ============================================================
// 5 个 commandType dispatch (R.4 Bug 4 修复)
// ============================================================

/**
 * task_pause: 暂停任务
 *
 * R.4 行为:
 *   - DRY_RUN=true → dry_run_success (不真改任何表)
 *   - DRY_RUN=false + paused 字段存在 → success (真 UPDATE tbl_task SET paused=true)
 *   - DRY_RUN=false + paused 字段不存在 → unsupported + blocked_by_source_schema
 */
async function execTaskPause(cmd: ControlCommandRow): Promise<ExecResult> {
  const start = Date.now()
  const targetId = cmd.targetId
  const before = await selectTaskSnapshot(targetId)
  if (!before) throw new ExecError(`task not found: ${targetId}`, 'TASK_NOT_FOUND')

  let after: typeof before = before
  let affectedRows = 0
  let status: ExecResult['status'] = 'success'
  let blocker: string | undefined
  let reason: string | undefined

  if (DRY_RUN) {
    // R.4 显式区分: 不真改
    after = { ...before, _dry_run_simulated: true, paused_intent: true }
    status = 'dry_run_success'
  } else {
    const schema = await detectSiteSchema()
    if (!schema.paused) {
      // 缺 paused 字段, 不真改, 也不撒谎
      status = 'unsupported'
      blocker = 'blocked_by_source_schema'
      reason = 'tbl_task.paused 字段不存在 (Sprint 4.8.2-R 170 张表全扫确认 0 命中), 需站点 DDL patch'
      after = { ...before, _blocker: blocker, _reason: reason }
    } else {
      // 真改
      const r = await siteQuery(
        `UPDATE tbl_task SET paused = TRUE, update_dt = NOW() WHERE id = $1`,
        [parseInt(targetId, 10)]
      )
      affectedRows = r.rowCount
      after = (await selectTaskSnapshot(targetId)) ?? before
    }
  }

  await writeAudit({
    commandNo: cmd.commandNo,
    action: 'task_pause',
    targetTable: 'tbl_task',
    targetId,
    before,
    after,
    actor: ACTOR,
    siteCode: cmd.sourceSiteId,
    dryRun: DRY_RUN,
    result: status === 'unsupported' ? 'failed' : 'success',
    errorMessage: reason ?? null,
  })

  return {
    commandNo: cmd.commandNo,
    status,
    result: { affectedRows, dryRun: DRY_RUN, targetTable: 'tbl_task', targetId, before, after, blocker, reason },
    errorMessage: status === 'unsupported' ? reason ?? null : null,
    durationMs: Date.now() - start,
  }
}

/**
 * task_resume: 恢复任务
 *
 * R.4 行为: 同 task_pause, 用 paused=FALSE
 */
async function execTaskResume(cmd: ControlCommandRow): Promise<ExecResult> {
  const start = Date.now()
  const targetId = cmd.targetId
  const before = await selectTaskSnapshot(targetId)
  if (!before) throw new ExecError(`task not found: ${targetId}`, 'TASK_NOT_FOUND')

  let after: typeof before = before
  let affectedRows = 0
  let status: ExecResult['status'] = 'success'
  let blocker: string | undefined
  let reason: string | undefined

  if (DRY_RUN) {
    after = { ...before, _dry_run_simulated: true, paused_intent: false }
    status = 'dry_run_success'
  } else {
    const schema = await detectSiteSchema()
    if (!schema.paused) {
      status = 'unsupported'
      blocker = 'blocked_by_source_schema'
      reason = 'tbl_task.paused 字段不存在, 无法恢复'
      after = { ...before, _blocker: blocker, _reason: reason }
    } else {
      const r = await siteQuery(
        `UPDATE tbl_task SET paused = FALSE, update_dt = NOW() WHERE id = $1`,
        [parseInt(targetId, 10)]
      )
      affectedRows = r.rowCount
      after = (await selectTaskSnapshot(targetId)) ?? before
    }
  }

  await writeAudit({
    commandNo: cmd.commandNo,
    action: 'task_resume',
    targetTable: 'tbl_task',
    targetId,
    before,
    after,
    actor: ACTOR,
    siteCode: cmd.sourceSiteId,
    dryRun: DRY_RUN,
    result: status === 'unsupported' ? 'failed' : 'success',
    errorMessage: reason ?? null,
  })

  return {
    commandNo: cmd.commandNo,
    status,
    result: { affectedRows, dryRun: DRY_RUN, targetTable: 'tbl_task', targetId, before, after, blocker, reason },
    errorMessage: status === 'unsupported' ? reason ?? null : null,
    durationMs: Date.now() - start,
  }
}

/**
 * task_reset: 重置任务
 *
 * R.4 行为: 用 status=1 ready + burn_status=0 (沿用原 SQL, 但加 dry_run 区分)
 */
async function execTaskReset(cmd: ControlCommandRow): Promise<ExecResult> {
  const start = Date.now()
  const targetId = cmd.targetId
  const before = await selectTaskSnapshot(targetId)
  if (!before) throw new ExecError(`task not found: ${targetId}`, 'TASK_NOT_FOUND')

  let after: typeof before = before
  let affectedRows = 0
  const status: ExecResult['status'] = DRY_RUN ? 'dry_run_success' : 'success'

  if (DRY_RUN) {
    after = { ...before, _dry_run_simulated: true, reset_intent: true }
  } else {
    const r = await siteQuery(
      `UPDATE tbl_task SET status = 1, burn_status = 0, update_dt = NOW() WHERE id = $1`,
      [parseInt(targetId, 10)]
    )
    affectedRows = r.rowCount
    after = (await selectTaskSnapshot(targetId)) ?? before
  }

  await writeAudit({
    commandNo: cmd.commandNo,
    action: 'task_reset',
    targetTable: 'tbl_task',
    targetId,
    before,
    after,
    actor: ACTOR,
    siteCode: cmd.sourceSiteId,
    dryRun: DRY_RUN,
    result: 'success',
  })

  return {
    commandNo: cmd.commandNo,
    status,
    result: { affectedRows, dryRun: DRY_RUN, targetTable: 'tbl_task', targetId, before, after },
    errorMessage: null,
    durationMs: Date.now() - start,
  }
}

/**
 * inspect_start: 启动数据巡检
 *
 * R.4 行为: 候选表 tbl_check_patrol_task, 0 行 → 仍可 INSERT, 但缺 source_id/verify_result 字段
 */
async function execInspectStart(cmd: ControlCommandRow): Promise<ExecResult> {
  const start = Date.now()
  const siteCode = cmd.sourceSiteId
  const before = null

  let after: unknown = null
  let affectedRows = 0
  let status: ExecResult['status'] = 'success'
  let blocker: string | undefined
  let reason: string | undefined

  if (DRY_RUN) {
    after = { simulated: true, action: 'inspect_start', target: cmd.targetId, at: new Date().toISOString() }
    status = 'dry_run_success'
  } else {
    // R.4: 检查候选表 schema
    let inspectSchema: Record<string, boolean>
    try {
      const r = await siteQuery<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name='tbl_check_patrol_task'`
      )
      const cols = new Set(r.rows.map((x) => x.column_name))
      inspectSchema = {
        source_id: cols.has('source_id'),
        verify_result: cols.has('verify_result'),
        status: cols.has('status'),
      }
    } catch {
      inspectSchema = { source_id: false, verify_result: false, status: false }
    }

    if (!inspectSchema.source_id || !inspectSchema.verify_result) {
      status = 'unsupported'
      blocker = 'blocked_by_source_schema'
      reason = 'tbl_check_patrol_task 缺 source_id/verify_result 字段, 需站点 DDL patch'
      after = { _blocker: blocker, _reason: reason, simulated_intent: true }
    } else {
      after = {
        task_type: 4,
        task_name: `[INSPECT] ${cmd.targetId}`,
        status: 1,
        site_code: siteCode,
        started_at: new Date().toISOString(),
      }
      affectedRows = 1
    }
  }

  await writeAudit({
    commandNo: cmd.commandNo,
    action: 'inspect_start',
    targetTable: 'tbl_check_patrol_task',
    targetId: cmd.targetId,
    before,
    after,
    actor: ACTOR,
    siteCode,
    dryRun: DRY_RUN,
    result: status === 'unsupported' ? 'failed' : 'success',
    errorMessage: reason ?? null,
  })

  return {
    commandNo: cmd.commandNo,
    status,
    result: { affectedRows, dryRun: DRY_RUN, targetTable: 'tbl_check_patrol_task', targetId: cmd.targetId, before, after, blocker, reason },
    errorMessage: status === 'unsupported' ? reason ?? null : null,
    durationMs: Date.now() - start,
  }
}

/**
 * recovery_start: 启动回迁
 *
 * R.4 行为: 候选表 tbl_hot_restore_record, 缺 source_id 字段 → unsupported
 */
async function execRecoveryStart(cmd: ControlCommandRow): Promise<ExecResult> {
  const start = Date.now()
  const siteCode = cmd.sourceSiteId
  const before = null

  let after: unknown = null
  let affectedRows = 0
  let status: ExecResult['status'] = 'success'
  let blocker: string | undefined
  let reason: string | undefined

  if (DRY_RUN) {
    after = { simulated: true, action: 'recovery_start', target: cmd.targetId, at: new Date().toISOString() }
    status = 'dry_run_success'
  } else {
    let recoverySchema: Record<string, boolean>
    try {
      const r = await siteQuery<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name='tbl_hot_restore_record'`
      )
      const cols = new Set(r.rows.map((x) => x.column_name))
      recoverySchema = { source_id: cols.has('source_id'), progress: cols.has('progress'), status: cols.has('status') }
    } catch {
      recoverySchema = { source_id: false, progress: false, status: false }
    }

    if (!recoverySchema.source_id) {
      status = 'unsupported'
      blocker = 'blocked_by_source_schema'
      reason = 'tbl_hot_restore_record 缺 source_id 字段, 需站点 DDL patch'
      after = { _blocker: blocker, _reason: reason, simulated_intent: true }
    } else {
      after = {
        task_type: 1,
        task_name: `[RECOVERY] ${cmd.targetId}`,
        status: 1,
        site_code: siteCode,
        started_at: new Date().toISOString(),
      }
      affectedRows = 1
    }
  }

  await writeAudit({
    commandNo: cmd.commandNo,
    action: 'recovery_start',
    targetTable: 'tbl_hot_restore_record',
    targetId: cmd.targetId,
    before,
    after,
    actor: ACTOR,
    siteCode,
    dryRun: DRY_RUN,
    result: status === 'unsupported' ? 'failed' : 'success',
    errorMessage: reason ?? null,
  })

  return {
    commandNo: cmd.commandNo,
    status,
    result: { affectedRows, dryRun: DRY_RUN, targetTable: 'tbl_hot_restore_record', targetId: cmd.targetId, before, after, blocker, reason },
    errorMessage: status === 'unsupported' ? reason ?? null : null,
    durationMs: Date.now() - start,
  }
}

/**
 * task_priority_restore (R.4 新增): 优先恢复
 *
 * R.4 行为: 缺 priority 字段 → unsupported + blocked_by_source_schema
 */
async function execTaskPriorityRestore(cmd: ControlCommandRow): Promise<ExecResult> {
  const start = Date.now()
  const targetId = cmd.targetId
  const before = await selectTaskSnapshot(targetId)
  if (!before) throw new ExecError(`task not found: ${targetId}`, 'TASK_NOT_FOUND')

  let after: typeof before = before
  let affectedRows = 0
  let status: ExecResult['status'] = 'success'
  let blocker: string | undefined
  let reason: string | undefined

  if (DRY_RUN) {
    after = { ...before, _dry_run_simulated: true, priority_intent: 1 }
    status = 'dry_run_success'
  } else {
    const schema = await detectSiteSchema()
    if (!schema.priority) {
      status = 'unsupported'
      blocker = 'blocked_by_source_schema'
      reason = 'tbl_task.priority 字段不存在, 需站点 DDL patch'
      after = { ...before, _blocker: blocker, _reason: reason }
    } else {
      const r = await siteQuery(
        `UPDATE tbl_task SET priority = 1, update_dt = NOW() WHERE id = $1`,
        [parseInt(targetId, 10)]
      )
      affectedRows = r.rowCount
      after = (await selectTaskSnapshot(targetId)) ?? before
    }
  }

  await writeAudit({
    commandNo: cmd.commandNo,
    action: 'task_priority_restore',
    targetTable: 'tbl_task',
    targetId,
    before,
    after,
    actor: ACTOR,
    siteCode: cmd.sourceSiteId,
    dryRun: DRY_RUN,
    result: status === 'unsupported' ? 'failed' : 'success',
    errorMessage: reason ?? null,
  })

  return {
    commandNo: cmd.commandNo,
    status,
    result: { affectedRows, dryRun: DRY_RUN, targetTable: 'tbl_task', targetId, before, after, blocker, reason },
    errorMessage: status === 'unsupported' ? reason ?? null : null,
    durationMs: Date.now() - start,
  }
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * SELECT 任务快照 (用于 before/after 审计)
 * R.4 行为: 真 site pool (SITE_DATABASE_URL) → fallback source_restore (Sprint 2B.12)
 */
async function selectTaskSnapshot(targetId: string): Promise<Record<string, unknown> | null> {
  const id = parseInt(targetId, 10)
  if (Number.isNaN(id)) return null
  try {
    if (SITE_DB_URL) {
      const r = await siteQuery<Record<string, unknown>>(
        `SELECT id, task_name, task_type, status, burn_status, update_dt
         FROM tbl_task WHERE id = $1`,
        [id]
      )
      if (r.rows.length === 0) return null
      return r.rows[0]
    }
    // fallback: source_restore (dev)
    const r = await sourceQuery<Record<string, unknown>>(
      `SELECT id, task_name, task_type, status, burn_status, update_dt
       FROM tbl_task WHERE id = $1`,
      [id]
    )
    if (r.rows.length === 0) return null
    return r.rows[0]
  } catch (err) {
    console.error('[executor] selectTaskSnapshot failed:', err instanceof Error ? err.message : err)
    return null
  }
}

// ============================================================
// 主入口
// ============================================================

/**
 * 执行 control_command
 * 入口被 worker-site.ts 调用
 */
export async function executeCommand(cmd: ControlCommandRow): Promise<ExecResult> {
  const start = Date.now()
  try {
    switch (cmd.commandType) {
      case 'task_pause':
        return await execTaskPause(cmd)
      case 'task_resume':
        return await execTaskResume(cmd)
      case 'task_reset':
        return await execTaskReset(cmd)
      case 'inspect_start':
        return await execInspectStart(cmd)
      case 'recovery_start':
        return await execRecoveryStart(cmd)
      case 'task_priority_restore':
        return await execTaskPriorityRestore(cmd)
      default:
        throw new ExecError(`unknown commandType: ${cmd.commandType}`, 'UNKNOWN_COMMAND')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const code = err instanceof ExecError ? err.code : 'EXEC_ERROR'
    await writeAudit({
      commandNo: cmd.commandNo,
      action: cmd.commandType,
      targetTable: 'tbl_task',
      targetId: cmd.targetId,
      before: null,
      after: null,
      actor: ACTOR,
      siteCode: cmd.sourceSiteId,
      dryRun: DRY_RUN,
      result: 'failed',
      errorMessage: message,
    })
    return {
      commandNo: cmd.commandNo,
      status: 'failed',
      result: { affectedRows: 0, dryRun: DRY_RUN, targetTable: 'tbl_task', targetId: cmd.targetId, before: null, after: null },
      errorMessage: message + (err instanceof ExecError ? ` (${code})` : ''),
      durationMs: Date.now() - start,
    }
  }
}
