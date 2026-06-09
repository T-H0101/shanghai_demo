/**
 * Sprint 4.8 - Site Worker 主进程
 *
 * 设计:
 *   - 3 个并发循环 (poll / exec / health)
 *   - pollLoop: 1s 间隔拉 control_command pending
 *   - execLoop: 处理拉到的命令, 调 executor.executeCommand
 *   - healthLoop: 60s 写心跳到控制台 (生产可换写入表)
 *
 * 安全:
 *   - SELECT FOR UPDATE SKIP LOCKED (HA 模式 multi)
 *   - 单 worker 模式 (default) 不用 SKIP LOCKED, 简化
 *   - 优雅退出 (SIGINT/SIGTERM)
 *
 * 部署:
 *   - pnpm worker:site
 *   - 生产: PM2 / systemd / Docker sidecar
 *
 * 链路:
 *   control_command (status=pending) → worker poll → mark pulled →
 *   executor.executeCommand → mark success/failed → audit_log
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

// ============================================================
// env 加载 (复用 smoke-sync 的转义规则)
// ============================================================
function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const sep = trimmed.indexOf('=')
    if (sep < 1) continue
    const key = trimmed.slice(0, sep).trim()
    const rawValue = trimmed.slice(sep + 1).trim()
    const value = rawValue.replace(/\\\$/g, '$')
    if (!process.env[key]) process.env[key] = value
  }
}
loadEnvLocal()

// ============================================================
// imports (在 env 加载后)
// ============================================================
import { query as centralQuery, closePool } from '@/lib/db/postgres'
import { sourceQuery, closeSourcePool } from '@/lib/db/source-pool'
import { executeCommand, DRY_RUN, ExecResult } from '@/lib/control/executor'
import type { ControlCommandRow } from '@/lib/control/control-command'

// ============================================================
// 配置
// ============================================================
const SITE_CODE = process.env.SITE_WORKER_SITE_CODE ?? 'SH01'
const POLL_INTERVAL_MS = parseInt(process.env.SITE_WORKER_POLL_INTERVAL_MS ?? '1000')
const HA_MODE = (process.env.SITE_WORKER_HA_MODE ?? 'single').toLowerCase() // single | multi
const HEALTH_PORT = parseInt(process.env.SITE_WORKER_HEALTH_PORT ?? '3001')
const POLL_LIMIT = 20
const SHUTDOWN_TIMEOUT_MS = 10000

// ============================================================
// 状态
// ============================================================
let running = true
let inFlight = 0
let lastHealthAt = new Date().toISOString()
let lastPollAt: string | null = null
let lastExecAt: string | null = null
let lastExecResult: ExecResult | null = null
let totalExecuted = 0
let totalFailed = 0

// ============================================================
// 优雅退出
// ============================================================
function setupShutdown(): void {
  const handler = async (signal: string) => {
    if (!running) return
    console.log(`[worker-site] ${signal} received, draining (in-flight: ${inFlight})...`)
    running = false
    const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS
    while (inFlight > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100))
    }
    if (inFlight > 0) {
      console.warn(`[worker-site] forced exit with ${inFlight} in-flight`)
    }
    await cleanup()
    process.exit(0)
  }
  process.on('SIGINT', () => handler('SIGINT'))
  process.on('SIGTERM', () => handler('SIGTERM'))
}

async function cleanup(): Promise<void> {
  await closePool().catch(() => {})
  await closeSourcePool().catch(() => {})
  console.log('[worker-site] pools closed')
}

// ============================================================
// pollLoop - 拉 pending 命令
// ============================================================
async function pollLoop(): Promise<void> {
  while (running) {
    try {
      const cmds = await fetchPendingCommands(SITE_CODE, POLL_LIMIT)
      lastPollAt = new Date().toISOString()
      if (cmds.length > 0) {
        console.log(`[worker-site] polled ${cmds.length} pending commands`)
        for (const cmd of cmds) {
          // mark pulled (atomic, SKIP LOCKED in HA 模式)
          const updated = await markPulled(cmd.id)
          if (!updated) {
            // 别的 worker 抢到了 (HA multi 模式)
            continue
          }
          // execLoop 处理 (避免阻塞 poll)
          execOne(updated).catch((e) => console.error('[worker-site] exec error:', e))
        }
      }
    } catch (err) {
      console.error('[worker-site] poll error:', err instanceof Error ? err.message : err)
    }
    await sleep(POLL_INTERVAL_MS)
  }
}

/**
 * 拉 pending 命令 (HA 模式: SELECT FOR UPDATE SKIP LOCKED)
 */
async function fetchPendingCommands(siteCode: string, limit: number): Promise<ControlCommandRow[]> {
  if (HA_MODE === 'multi') {
    // HA: 用 SKIP LOCKED, 多个 worker 不会抢同一行
    const r = await centralQuery<RawCmdRow>(
      `SELECT id, command_no, source_site_id, command_type, target_type, target_id,
              payload, status, requested_by, requested_ip, requested_at, pulled_at,
              completed_at, result, error_message, created_at, updated_at
       FROM control_command
       WHERE source_site_id = $1 AND status = 'pending'
       ORDER BY requested_at ASC
       LIMIT $2
       FOR UPDATE SKIP LOCKED`,
      [siteCode, limit]
    )
    return r.rows.map(rowToCmd)
  }
  // single worker: 普通 SELECT, markPulled 原子改
  const r = await centralQuery<RawCmdRow>(
    `SELECT id, command_no, source_site_id, command_type, target_type, target_id,
            payload, status, requested_by, requested_ip, requested_at, pulled_at,
            completed_at, result, error_message, created_at, updated_at
     FROM control_command
     WHERE source_site_id = $1 AND status = 'pending'
     ORDER BY requested_at ASC
     LIMIT $2`,
    [siteCode, limit]
  )
  return r.rows.map(rowToCmd)
}

/**
 * 标记 pulled (原子)
 * 返回: 更新后的 row, 或 null (被其他 worker 抢了)
 */
async function markPulled(id: string): Promise<ControlCommandRow | null> {
  const r = await centralQuery<RawCmdRow>(
    `UPDATE control_command
     SET status = 'pulled', pulled_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, command_no, source_site_id, command_type, target_type, target_id,
               payload, status, requested_by, requested_ip, requested_at, pulled_at,
               completed_at, result, error_message, created_at, updated_at`,
    [id]
  )
  if (r.rows.length === 0) return null
  return rowToCmd(r.rows[0])
}

// ============================================================
// execOne - 调 executor
// ============================================================
async function execOne(cmd: ControlCommandRow): Promise<void> {
  inFlight++
  try {
    lastExecAt = new Date().toISOString()
    const execResult = await executeCommand(cmd)
    lastExecResult = execResult
    if (execResult.status === 'success') totalExecuted++
    else totalFailed++

    // mark 终态
    await markResult(cmd.id, execResult)
    console.log(
      `[worker-site] ${cmd.commandType} ${cmd.targetId} → ${execResult.status} (${execResult.durationMs}ms)${DRY_RUN ? ' [DRY_RUN]' : ''}`
    )
  } catch (err) {
    console.error(`[worker-site] execOne ${cmd.id} crashed:`, err)
    await markResult(cmd.id, {
      commandNo: cmd.commandNo,
      status: 'failed',
      result: { affectedRows: 0, dryRun: DRY_RUN, targetTable: 'tbl_task', targetId: cmd.targetId, before: null, after: null },
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs: 0,
    })
    totalFailed++
  } finally {
    inFlight--
  }
}

async function markResult(id: string, result: ExecResult): Promise<void> {
  await centralQuery(
    `UPDATE control_command
     SET status = $1,
         completed_at = NOW(),
         result = $2::jsonb,
         error_message = $3,
         updated_at = NOW()
     WHERE id = $4 AND status IN ('pulled', 'running')`,
    [result.status, JSON.stringify(result.result), result.errorMessage, id]
  )
}

// ============================================================
// healthLoop - 写心跳
// ============================================================
async function healthLoop(): Promise<void> {
  while (running) {
    lastHealthAt = new Date().toISOString()
    const summary = `[worker-site] health: running=${running} inFlight=${inFlight} totalExec=${totalExecuted} failed=${totalFailed} dryRun=${DRY_RUN} siteCode=${SITE_CODE} haMode=${HA_MODE}`
    if (Date.now() % 60000 < 60000) {
      // 每 60s 打一次
      console.log(summary)
    }
    await sleep(60000)
  }
}

// ============================================================
// row mapper
// ============================================================
interface RawCmdRow {
  id: string
  command_no: string
  source_site_id: string
  command_type: string
  target_type: string
  target_id: string
  payload: Record<string, unknown> | null
  status: string
  requested_by: string | null
  requested_ip: string | null
  requested_at: string | Date
  pulled_at: string | Date | null
  completed_at: string | Date | null
  result: Record<string, unknown> | null
  error_message: string | null
  created_at: string | Date
  updated_at: string | Date
}

function rowToCmd(r: RawCmdRow): ControlCommandRow {
  return {
    id: r.id,
    commandNo: r.command_no,
    sourceSiteId: r.source_site_id,
    commandType: r.command_type as ControlCommandRow['commandType'],
    targetType: r.target_type as ControlCommandRow['targetType'],
    targetId: r.target_id,
    payload: r.payload ?? {},
    status: r.status as ControlCommandRow['status'],
    requestedBy: r.requested_by,
    requestedIp: r.requested_ip,
    requestedAt: typeof r.requested_at === 'string' ? r.requested_at : r.requested_at.toISOString(),
    pulledAt: r.pulled_at ? (typeof r.pulled_at === 'string' ? r.pulled_at : r.pulled_at.toISOString()) : null,
    completedAt: r.completed_at ? (typeof r.completed_at === 'string' ? r.completed_at : r.completed_at.toISOString()) : null,
    result: r.result,
    errorMessage: r.error_message,
    createdAt: typeof r.created_at === 'string' ? r.created_at : r.created_at.toISOString(),
    updatedAt: typeof r.updated_at === 'string' ? r.updated_at : r.updated_at.toISOString(),
  }
}

// ============================================================
// utils
// ============================================================
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ============================================================
// 入口
// ============================================================
async function main(): Promise<void> {
  setupShutdown()
  console.log(
    `[worker-site] starting: siteCode=${SITE_CODE} dryRun=${DRY_RUN} haMode=${HA_MODE} pollIntervalMs=${POLL_INTERVAL_MS} healthPort=${HEALTH_PORT}`
  )

  // 启动健康检查 (生产可换 http server)
  // 简化为 console, 不开 HTTP server (留 TODO: 后续接 /health endpoint)

  // 并发 3 循环
  await Promise.all([pollLoop(), healthLoop()])
}

main().catch(async (e) => {
  console.error('[worker-site] fatal:', e)
  await cleanup()
  process.exit(1)
})
