/**
 * sync-scheduler.ts
 * Sprint R.8 — 每小时自动同步与一致性校验调度器
 *
 * 执行链路:
 *   1. export package (生成 package.json)
 *   2. push package (HMAC 签名推送到总控)
 *   3. check-sync-consistency (一致性校验)
 *   4. 写 sync_scheduler_log
 *
 * 用法:
 *   pnpm scheduler:sync:once -- SH01           # 单次
 *   pnpm scheduler:sync -- --siteCode SH01     # 每小时循环
 *   pnpm scheduler:sync:once -- SH01 --dry-run # 干跑
 *
 * 严禁: tbl_file/tbl_folder 全量
 */

import { execSync } from 'child_process'
import { randomUUID } from 'crypto'
import { query } from '@/lib/db/postgres'
import { parseSchedulerArgs } from '@/lib/sync/scheduler-args'

const schedulerArgs = parseSchedulerArgs(process.argv.slice(2))
const SITE_CODE = schedulerArgs.siteCode
const INTERVAL = schedulerArgs.intervalSeconds
const ONCE = schedulerArgs.once
const DRY_RUN = schedulerArgs.dryRun

function log(msg: string) {
  console.log(`[scheduler ${new Date().toISOString()}] ${msg}`)
}

function runScript(cmd: string): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout: 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    })
    return { ok: true, output }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return { ok: false, output: (e.stdout ?? '') + '\n' + (e.stderr ?? e.message ?? '') }
  }
}

interface RunResult {
  runId: string
  siteCode: string
  startedAt: string
  finishedAt: string
  status: 'success' | 'partial' | 'failed'
  exportStatus: 'pending' | 'success' | 'failed' | 'skipped'
  pushStatus: 'pending' | 'success' | 'failed' | 'skipped'
  consistencyStatus: 'pending' | 'matched' | 'mismatched' | 'failed' | 'skipped'
  packageBatchId: string | null
  errorMessage: string | null
  resultJson: Record<string, unknown>
}

async function runOnce(siteCode: string): Promise<RunResult> {
  const runId = `SCHED-${siteCode}-${Date.now()}-${randomUUID().slice(0, 8)}`
  const startedAt = new Date().toISOString()
  let exportStatus: RunResult['exportStatus'] = 'pending'
  let pushStatus: RunResult['pushStatus'] = 'pending'
  let consistencyStatus: RunResult['consistencyStatus'] = 'pending'
  let packageBatchId: string | null = null
  const errors: string[] = []

  // 1. Export
  log(`[${runId}] Step 1: export package`)
  if (DRY_RUN) {
    exportStatus = 'skipped'
    log('  dry-run: skip export')
  } else {
    const exportOut = runScript(`npx tsx scripts/export-package.ts ${siteCode} --out exports/${siteCode}`)
    if (exportOut.ok) {
      exportStatus = 'success'
      const batchMatch = exportOut.output.match(/batchId:\s*(\S+)/)
      packageBatchId = batchMatch?.[1] ?? null
      log(`  export ok: batchId=${packageBatchId}`)
    } else {
      exportStatus = 'failed'
      errors.push(`export: ${exportOut.output.slice(0, 200)}`)
      log(`  export failed: ${exportOut.output.slice(0, 100)}`)
    }
  }

  // 2. Push
  log(`[${runId}] Step 2: push package`)
  if (DRY_RUN) {
    pushStatus = 'skipped'
    log('  dry-run: skip push')
  } else if (exportStatus !== 'success') {
    pushStatus = 'skipped'
    log('  skip push (export failed)')
  } else {
    const pkgPath = `exports/${siteCode}/package.json`
    const pushOut = runScript(`npx tsx scripts/push-package.ts ${pkgPath}`)
    if (pushOut.ok && pushOut.output.includes('HTTP 200')) {
      if (pushOut.output.includes('duplicated')) {
        pushStatus = 'skipped'
        log('  push skipped (batch duplicated)')
      } else {
        pushStatus = 'success'
        log('  push ok')
      }
    } else {
      pushStatus = 'failed'
      errors.push(`push: ${pushOut.output.slice(0, 200)}`)
      log(`  push failed: ${pushOut.output.slice(0, 100)}`)
    }
  }

  // 3. Consistency check
  log(`[${runId}] Step 3: consistency check`)
  if (DRY_RUN) {
    consistencyStatus = 'skipped'
    log('  dry-run: skip consistency')
  } else {
    const conOut = runScript(`npx tsx scripts/check-sync-consistency.ts -- --siteCode=${siteCode}`)
    if (conOut.ok) {
      consistencyStatus = 'matched'
      log('  consistency: matched')
    } else {
      if (conOut.output.includes('mismatched')) {
        consistencyStatus = 'mismatched'
        log('  consistency: mismatched')
      } else {
        consistencyStatus = 'failed'
        errors.push(`consistency: ${conOut.output.slice(0, 200)}`)
        log('  consistency: failed')
      }
    }
  }

  const finishedAt = new Date().toISOString()
  const hasError = errors.length > 0
  const allSuccess = exportStatus === 'success' && pushStatus === 'success' && consistencyStatus === 'matched'
  const status: RunResult['status'] = hasError ? 'failed' : allSuccess ? 'success' : 'partial'

  return {
    runId,
    siteCode,
    startedAt,
    finishedAt,
    status,
    exportStatus,
    pushStatus,
    consistencyStatus,
    packageBatchId,
    errorMessage: errors.length > 0 ? errors.join(' | ') : null,
    resultJson: {
      dryRun: DRY_RUN,
      export: { status: exportStatus, batchId: packageBatchId },
      push: { status: pushStatus },
      consistency: { status: consistencyStatus },
      errors,
      durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    },
  }
}

async function writeLog(result: RunResult) {
  try {
    await query(
      `INSERT INTO sync_scheduler_log
        (site_code, run_id, started_at, finished_at, status,
         export_status, push_status, consistency_status,
         package_batch_id, error_message, result_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        result.siteCode, result.runId, result.startedAt, result.finishedAt, result.status,
        result.exportStatus, result.pushStatus, result.consistencyStatus,
        result.packageBatchId, result.errorMessage,
        JSON.stringify(result.resultJson),
      ]
    )
    log(`[${result.runId}] log written to sync_scheduler_log`)
  } catch (err) {
    console.error(`[${result.runId}] failed to write log:`, err)
  }
}

function printResult(result: RunResult) {
  console.log()
  console.log(`=== Scheduler Run Result ===`)
  console.log(`  runId:        ${result.runId}`)
  console.log(`  siteCode:     ${result.siteCode}`)
  console.log(`  status:       ${result.status}`)
  console.log(`  export:       ${result.exportStatus}`)
  console.log(`  push:         ${result.pushStatus}`)
  console.log(`  consistency:  ${result.consistencyStatus}`)
  console.log(`  batchId:      ${result.packageBatchId ?? 'N/A'}`)
  console.log(`  error:        ${result.errorMessage ?? 'none'}`)
  console.log(`  dryRun:       ${DRY_RUN}`)
  console.log(`  duration:     ${result.resultJson.durationMs}ms`)
}

async function main() {
  log(`Starting scheduler: siteCode=${SITE_CODE} interval=${INTERVAL}s once=${ONCE} dryRun=${DRY_RUN}`)

  if (ONCE) {
    const result = await runOnce(SITE_CODE)
    await writeLog(result)
    printResult(result)
    process.exit(result.status === 'failed' ? 1 : 0)
    return
  }

  // Loop mode
  log(`Loop mode: running every ${INTERVAL}s. Ctrl+C to stop.`)
  while (true) {
    const result = await runOnce(SITE_CODE)
    await writeLog(result)
    printResult(result)
    log(`Next run in ${INTERVAL}s...`)
    await new Promise((resolve) => setTimeout(resolve, INTERVAL * 1000))
  }
}

main().catch((err) => {
  console.error('Scheduler crashed:', err)
  process.exit(2)
})
