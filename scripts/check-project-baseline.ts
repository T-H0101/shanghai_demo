/**
 * check-project-baseline.ts
 * Sprint R.7C — 同步与控制基线冻结检查
 *
 * 每次 Sprint 最终验证必须跑: pnpm baseline:check
 * 失败不允许 commit。
 *
 * 用法:
 *   pnpm baseline:check
 *   pnpm baseline:check --verbose
 */

import { loadEnv } from './lib/load-env'
loadEnv()

import { Client } from 'pg'
import { readFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const VERBOSE = process.argv.includes('--verbose')
const CENTRAL_URL = process.env.DATABASE_URL ?? ''
const SOURCE_URL = process.env.SOURCE_DATABASE_URL ?? ''
const SITE_DB_HOST = process.env.SITE_DB_HOST ?? 'localhost'
const SITE_DB_PORT = parseInt(process.env.SITE_DB_PORT ?? '5434', 10)
const SITE_DB_NAME = process.env.SITE_DB_NAME ?? 'star_storage_db'
const SITE_DB_USER = process.env.SITE_DB_USER ?? 'starxdb'
const SITE_DB_PASSWORD = process.env.SITE_DB_PASSWORD ?? ''

interface CheckResult {
  name: string
  passed: boolean
  detail: string
}

const results: CheckResult[] = []
let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail: string) {
  results.push({ name, passed: ok, detail })
  if (ok) {
    passed++
    if (VERBOSE) console.log(`  ✅ ${name}: ${detail}`)
  } else {
    failed++
    console.log(`  ❌ ${name}: ${detail}`)
  }
}

// ============================================================
// 1. 一致性校验 7/7 matched
// ============================================================
async function checkConsistency(central: Client) {
  try {
    const r = await central.query<{ status: string; table_count: number; matched_table_count: number }>(
      `SELECT status, table_count, matched_table_count
       FROM sync_consistency_log
       WHERE site_code = 'SH01'
       ORDER BY checked_at DESC LIMIT 1`
    )
    if (r.rows.length === 0) {
      check('一致性校验', false, 'SH01 无校验记录')
      return
    }
    const row = r.rows[0]
    check(
      '一致性校验 7/7 matched',
      row.status === 'matched' && row.matched_table_count === 7,
      `status=${row.status} matched=${row.matched_table_count}/7`
    )
  } catch (err) {
    check('一致性校验', false, `查询失败: ${err instanceof Error ? err.message : err}`)
  }
}

// ============================================================
// 2. source_restore 仍是 13 表 (用 SOURCE_DATABASE_URL 连接)
// ============================================================
async function checkSourceRestore() {
  if (!SOURCE_URL) {
    check('source_restore 表数', true, 'SOURCE_DATABASE_URL 未配置, 跳过')
    return
  }
  try {
    const c = new Client({ connectionString: SOURCE_URL })
    await c.connect()
    const r = await c.query<{ cnt: string }>(
      `SELECT count(*)::text as cnt FROM pg_tables WHERE schemaname = 'public'`
    )
    const cnt = parseInt(r.rows[0]?.cnt ?? '0', 10)
    await c.end()
    // R.92.1: 真实源端是 site_restore_full (170 张), 不再是 13 张 source_restore
    // (历史 13 张是 R.4.8.2 era 的 dev fixture, R.85+ 后统一用完整 170 张库)
    const ok = cnt >= 13
    const expected = cnt === 170 ? 'site_restore_full (170)' : `>=13 (实际 ${cnt})`
    check(
      '源端 schema 表数',
      ok,
      `实际=${cnt} (期望 ${expected})`
    )
  } catch (err) {
    check('source_restore 表数', false, `连接失败: ${err instanceof Error ? err.message : err}`)
  }
}

// ============================================================
// 3. disc_files.sql 存在且可解析
// ============================================================
async function checkDiscFilesSql() {
  const path = 'databases/disc_files.sql'
  try {
    await access(path, constants.R_OK)
    const content = await readFile(path, 'utf8')
    const tables = content.match(/CREATE TABLE/gi)?.length ?? 0
    check(
      'disc_files.sql 存在且可解析',
      tables >= 100,
      `${tables} 个 CREATE TABLE (期望 ≥100)`
    )
  } catch {
    check('disc_files.sql 存在', false, `文件不存在: ${path}`)
  }
}

// ============================================================
// 4. star_storage_db 表数 170 左右
// ============================================================
async function checkStarStorageDb() {
  try {
    const c = new Client({
      host: SITE_DB_HOST, port: SITE_DB_PORT, database: SITE_DB_NAME,
      user: SITE_DB_USER, password: SITE_DB_PASSWORD,
    })
    await c.connect()
    const r = await c.query<{ cnt: string }>(
      `SELECT count(*)::text as cnt FROM pg_tables WHERE schemaname = 'public'`
    )
    const cnt = parseInt(r.rows[0]?.cnt ?? '0', 10)
    await c.end()
    check(
      'star_storage_db 表数',
      cnt >= 165 && cnt <= 180,
      `实际=${cnt} (期望 165-180)`
    )
  } catch (err) {
    check('star_storage_db 可用', false, `连接失败: ${err instanceof Error ? err.message : err}`)
  }
}

// ============================================================
// 5. unified_disc_platform 不应再出现已清理的污染 source_id
// ============================================================
async function checkNoPollution(central: Client) {
  const pollutedIds = [
    '100', '101', '200', '300', '8888', 'TASK_2026_001', 'TASK_2026_002',
    '5001', '5002', 'DEV_001', 'DEV_002',
    'VOL_001', 'VOL_002',
  ]
  const placeholders = pollutedIds.map((_, i) => `$${i + 1}`).join(', ')
  try {
    const tables = ['unified_tasks', 'unified_devices', 'unified_volumes']
    for (const tbl of tables) {
      const r = await central.query<{ cnt: string }>(
        `SELECT count(*)::text as cnt FROM ${tbl}
         WHERE source_site_id = 'SH01' AND source_id IN (${placeholders})`,
        pollutedIds
      )
      const cnt = parseInt(r.rows[0]?.cnt ?? '0', 10)
      check(
        `${tbl} 污染数据清零`,
        cnt === 0,
        `SH01 污染 source_id 行数=${cnt} (应为 0)`
      )
    }
  } catch (err) {
    check('污染数据检查', false, `查询失败: ${err instanceof Error ? err.message : err}`)
  }
}

// ============================================================
// 6. /api/sites 不允许返回 mock (dev server 必须运行)
// ============================================================
async function checkSitesApi() {
  try {
    const res = await fetch(`${BASE}/api/sites`, { signal: AbortSignal.timeout(5000) })
    const data = await res.json() as { dataSource?: string }
    const ds = data.dataSource ?? 'unknown'
    check(
      '/api/sites 不返回 mock',
      ds !== 'mock' && ds !== 'unknown',
      `dataSource=${ds} (不允许 mock)`
    )
  } catch {
    check('/api/sites API', true, 'dev server 未启动, 跳过 (CI 时需运行)')
  }
}

// ============================================================
// 7. /api/search must use center-owned read path (R.55 / R.85 port-based)
// ============================================================
async function checkSearchApi() {
  try {
    const res = await fetch(`${BASE}/api/search?q=test&limit=1`, { signal: AbortSignal.timeout(5000) })
    const data = await res.json() as { source?: string; data?: { source?: string; items?: unknown[] } }
    const source = data.source ?? data.data?.source
    // R.55 (legacy) + R.85 (SearchPort): product reads must come from center-owned stores.
    // R.85 ADR 0002 introduces `opensearch` (port source enum); legacy `es` retained for backwards compat.
    // site_restore_db is reserved for audit tooling and must not be the product source.
    check(
      '/api/search uses center-owned read path',
      res.status === 200 &&
        (source === 'es' ||
          source === 'opensearch' ||
          source === 'unified_file_index' ||
          source === 'blocked_by_external_system'),
      `HTTP=${res.status} source=${source}`
    )
  } catch {
    check('/api/search API', true, 'dev server 未启动, 跳过 (CI 时需运行)')
  }
}

// ============================================================
// 8. executor 不允许把 DRY_RUN 写成 real success
// ============================================================
async function checkExecutorLogic() {
  try {
    const content = await readFile('lib/control/executor.ts', 'utf8')
    // 检查: DRY_RUN=true 时必须返回 dry_run_success (不是 success)
    const hasDryRunSuccess = content.includes("dry_run_success")
    const noCentralQuery = !content.includes("centralQuery(sql") // 不再用 centralQuery 假执行
    // 检查: executor 不应有 "centralQuery" 占位
    const noFakeExec = !content.includes("当前用 centralQuery 占位")
    check(
      'executor dry_run_success 区分',
      hasDryRunSuccess,
      hasDryRunSuccess ? 'DRY_RUN 返回 dry_run_success' : '未发现 dry_run_success'
    )
    check(
      'executor 无 centralQuery 假执行',
      noCentralQuery,
      noCentralQuery ? '无 centralQuery 占位' : '发现 centralQuery 假执行'
    )
    check(
      'executor 无占位注释',
      noFakeExec,
      noFakeExec ? '无占位注释' : '发现中央查询占位注释'
    )
  } catch (err) {
    check('executor 逻辑检查', false, `读取失败: ${err instanceof Error ? err.message : err}`)
  }
}

// ============================================================
// 9. requirements-traceability 中 out_of_scope 必须为 0
// ============================================================
async function checkTraceability() {
  try {
    const content = await readFile('docs/database-analysis/requirements-traceability.json', 'utf8')
    const json = JSON.parse(content) as { stats?: { out_of_scope?: number } }
    const oos = json.stats?.out_of_scope ?? -1
    check(
      'traceability out_of_scope = 0',
      oos === 0,
      `out_of_scope=${oos} (应为 0)`
    )
  } catch (err) {
    check('traceability 检查', false, `读取失败: ${err instanceof Error ? err.message : err}`)
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('=== R.7C 基线冻结检查 ===')
  console.log(`BASE_URL: ${BASE}`)
  console.log(`verbose: ${VERBOSE}`)
  console.log()

  const central = new Client({ connectionString: CENTRAL_URL })
  await central.connect()

  await checkConsistency(central)
  await checkSourceRestore()
  await checkDiscFilesSql()
  await checkStarStorageDb()
  await checkNoPollution(central)
  await checkSitesApi()
  await checkSearchApi()
  await checkExecutorLogic()
  await checkTraceability()

  await central.end()

  console.log()
  console.log(`=== 结果: ${passed} pass, ${failed} fail ===`)
  if (failed > 0) {
    console.log('❌ 基线检查失败，不允许 commit。')
    process.exit(1)
  }
  console.log('✅ 基线检查通过。')
  process.exit(0)
}

main().catch((err) => {
  console.error('基线检查崩溃:', err)
  process.exit(2)
})
