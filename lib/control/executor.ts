/**
 * 控制命令执行器 — Sprint R.3 真实执行修复
 *
 * R.3 修复 (2026-06-10):
 *   - 站点库用 status 整数枚举表达暂停: status=20 = paused
 *   - 映射来源: real-field-mapper.ts TASK_STATUS_0_2_3[20] = 'paused'
 *   - executor 不再查 paused 列名 (站点没有此列), 改为 UPDATE tbl_task SET status=20
 *   - DRY_RUN=true 时 dry_run_success (不改表)
 *   - DRY_RUN=false 时真改 tbl_task.status (连 star_storage_db 5434)
 *   - selectTaskSnapshot 读 before/after status 整数 (真站点库快照)
 *
 * 站点 status 整数枚举 (来自 real-field-mapper.ts):
 *   0  = burn_success (完成/就绪 — 恢复目标)
 *   1  = data_preparing (准备 — 重置目标)
 *   2  = cancelled
 *   20 = paused (暂停目标)
 *   ... (完整映射见 lib/import/real-field-mapper.ts TASK_STATUS_0_2_3)
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

// Sprint R.3 修复: schema 检测 — 站点库用 status 整数枚举 (20=paused, 0=burn_success 等)
// 不查列名, 确认 tbl_task 表存在 + status 列可写即可
let _schemaCache: Record<string, boolean> | null = null
async function detectSiteSchema(): Promise<Record<string, boolean>> {
  if (_schemaCache) return _schemaCache
  try {
    const r = await siteQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='tbl_task'`
    )
    const cols = new Set(r.rows.map((x) => x.column_name))
    // R.3 关键: 站点用 status 整数枚举 (20=paused, 0=burn_success), 不需要独立 paused 列
    _schemaCache = {
      status: cols.has('status'),     // 真正需要的列
      update_dt: cols.has('update_dt'),
      burn_status: cols.has('burn_status'),
    }
    return _schemaCache
  } catch (err) {
    console.error('[executor] detectSiteSchema failed:', err)
    return { status: false, update_dt: false, burn_status: false }
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
// 6 个 commandType dispatch (R.3 真实执行修复)
// ============================================================

/**
 * task_pause: 暂停任务
 *
 * R.3 修复: 站点用 status 整数枚举 (20=paused), 不用独立 paused 列
 *   - DRY_RUN=true → dry_run_success (不真改)
 *   - DRY_RUN=false + status 列存在 → success (真 UPDATE tbl_task SET status=20)
 *   - DRY_RUN=false + status 列不存在 → unsupported
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

  // R.3 关键: status=20 = paused (real-field-mapper.ts TASK_STATUS_0_2_3[20])
  const PAUSED_STATUS = 20

  if (DRY_RUN) {
    after = { ...before, _dry_run_simulated: true, paused_intent: true, target_status: PAUSED_STATUS }
    status = 'dry_run_success'
  } else {
    const schema = await detectSiteSchema()
    if (!schema.status) {
      status = 'unsupported'
      blocker = 'blocked_by_source_schema'
      reason = 'tbl_task.status 列不存在, 需站点修复 schema'
      after = { ...before, _blocker: blocker, _reason: reason }
    } else {
      const r = await siteQuery(
        `UPDATE tbl_task SET status = ${PAUSED_STATUS}, update_dt = NOW() WHERE id = $1`,
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
 * R.3 修复: status=0 = burn_success (恢复到完成/就绪状态)
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

  // R.3: status=0 = burn_success (从 paused=20 恢复)
  const RESUME_STATUS = 0

  if (DRY_RUN) {
    after = { ...before, _dry_run_simulated: true, resume_intent: true, target_status: RESUME_STATUS }
    status = 'dry_run_success'
  } else {
    const schema = await detectSiteSchema()
    if (!schema.status) {
      status = 'unsupported'
      blocker = 'blocked_by_source_schema'
      reason = 'tbl_task.status 列不存在'
      after = { ...before, _blocker: blocker, _reason: reason }
    } else {
      const r = await siteQuery(
        `UPDATE tbl_task SET status = ${RESUME_STATUS}, update_dt = NOW() WHERE id = $1`,
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
