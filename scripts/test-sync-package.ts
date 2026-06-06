/**
 * Test Sync Package (with HMAC auth)
 * Sprint 2D.2 - 测试 /api/sync/package 接口
 * Sprint 2G.1 - 增加 HMAC 鉴权测试
 *
 * 用法:
 *   pnpm tsx scripts/test-sync-package.ts
 *
 * 验证场景:
 *   1. 合法 package + 正确签名 (200)
 *   2. 重复 batchId (duplicated)
 *   3. 未知表 (400)
 *   4. tbl_file (400 forbidden)
 *   5. recordCount 不匹配 (400)
 *   6. 缺 siteCode (400)
 *   -- HMAC 鉴权负例 --
 *   7. 无签名 strict mode (401 MISSING_SIGNATURE)
 *   8. 错签名 (401 INVALID_SIGNATURE)
 *   9. 过期 timestamp (401 EXPIRED_TIMESTAMP)
 *  10. siteCode mismatch (401 SITE_CODE_MISMATCH)
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { randomBytes } from 'crypto'

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}
loadEnvLocal()

const BASE_URL = 'http://localhost:3000'

const TEST_SITE = 'TEST_PKG'
const BATCH_BASE = `PKG-${TEST_SITE}-${Date.now()}`
const AUTH_MODE = (process.env.SYNC_PACKAGE_AUTH_MODE ?? 'strict').toLowerCase()
const SECRET = process.env.SYNC_PACKAGE_SECRET ?? 'TEST_SYNC_SECRET'

function buildPayload(opts: {
  batchId: string
  tables: Array<{
    tableName: string
    syncMode: string
    recordCount: number
    records: Record<string, unknown>[]
  }>
  checksum?: string
}) {
  return {
    siteCode: TEST_SITE,
    batchId: opts.batchId,
    snapshotAt: new Date().toISOString(),
    mode: 'full',
    version: '2D.2-test',
    checksum: opts.checksum,
    tables: opts.tables,
  }
}

const SAMPLE_TASK = {
  id: 9001,
  task_name: 'TestPackage-Task1',
  task_type: 1,
  status: 1,
  total_files: 10,
  total_size: 1024,
}

const SAMPLE_DEVICE = {
  lib_id: 9001,
  name: 'TestPackage-Dev1',
  type: 1,
  device_status: 1,
  ip: '10.0.0.1',
}

interface SignOpts {
  siteCode: string
  rawBody: string
  timestamp?: number
  nonce?: string
  secret?: string
}

function signPackage(opts: SignOpts) {
  const ts = opts.timestamp ?? Date.now()
  const nonce = opts.nonce ?? randomBytes(8).toString('hex')
  const secret = opts.secret ?? SECRET
  const signingString = `${ts}.${nonce}.${opts.rawBody}`
  const sig = (() => {
    // 内联实现: 仅测试用, 与 lib/sync/package-auth.ts 保持算法一致
    const { createHmac } = require('crypto') as typeof import('crypto')
    return createHmac('sha256', secret).update(signingString, 'utf8').digest('hex')
  })()
  return {
    'Content-Type': 'application/json',
    'x-site-code': opts.siteCode,
    'x-timestamp': String(ts),
    'x-nonce': nonce,
    'x-signature': sig,
  }
}

async function postSigned(payload: unknown, opts?: { signSiteCode?: string; signTimestamp?: number; signNonce?: string; signSecret?: string; skipAuth?: boolean; signRawBody?: string }) {
  const rawBody = opts?.signRawBody ?? JSON.stringify(payload)
  const siteCode = opts?.signSiteCode ?? (payload as any)?.siteCode ?? TEST_SITE
  let headers: Record<string, string>
  if (opts?.skipAuth) {
    headers = { 'Content-Type': 'application/json' }
  } else {
    headers = signPackage({
      siteCode,
      rawBody,
      timestamp: opts?.signTimestamp,
      nonce: opts?.signNonce,
      secret: opts?.signSecret,
    })
  }
  const res = await fetch(`${BASE_URL}/api/sync/package`, {
    method: 'POST',
    headers,
    body: rawBody,
  })
  return { status: res.status, body: await res.json() }
}

function divider(title: string) {
  console.log('\n' + '='.repeat(60))
  console.log(`  ${title}`)
  console.log('='.repeat(60))
}

async function main() {
  console.log(`[Config] auth mode: ${AUTH_MODE}`)
  console.log(`[Config] secret: ${SECRET ? '***set***' : '!!! NOT SET !!!'}`)

  // 0. 检查服务
  try {
    const health = await fetch(`${BASE_URL}/api/system/health`)
    if (!health.ok) throw new Error('server not healthy')
  } catch {
    console.error('[Test] Dev server not running. Start with: pnpm dev')
    process.exit(1)
  }

  // 1. 合法 package + 正确签名
  divider(`1. 合法 package + 正确签名 (期望 200, mode=${AUTH_MODE})`)
  const batch1 = `${BATCH_BASE}-VALID`
  const r1 = await postSigned(
    buildPayload({
      batchId: batch1,
      tables: [
        { tableName: 'tbl_task', syncMode: 'full', recordCount: 1, records: [SAMPLE_TASK] },
        { tableName: 'tbl_disc_lib', syncMode: 'full', recordCount: 1, records: [SAMPLE_DEVICE] },
      ],
    })
  )
  console.log(`HTTP ${r1.status}:`, JSON.stringify(r1.body, null, 2))

  // 2. 重复 batchId
  divider('2. 重复 batchId (期望 duplicated)')
  const r2 = await postSigned(
    buildPayload({
      batchId: batch1,
      tables: [{ tableName: 'tbl_task', syncMode: 'full', recordCount: 1, records: [SAMPLE_TASK] }],
    })
  )
  console.log(`HTTP ${r2.status}:`, JSON.stringify(r2.body, null, 2))

  // 3. 未知表
  divider('3. 未知表 tbl_unknown (期望 400)')
  const r3 = await postSigned(
    buildPayload({
      batchId: `${BATCH_BASE}-UNKNOWN`,
      tables: [{ tableName: 'tbl_unknown', syncMode: 'full', recordCount: 0, records: [] }],
    })
  )
  console.log(`HTTP ${r3.status}:`, JSON.stringify(r3.body, null, 2))

  // 4. tbl_file 禁止
  divider('4. tbl_file (期望 400 forbidden)')
  const r4 = await postSigned(
    buildPayload({
      batchId: `${BATCH_BASE}-FILE`,
      tables: [{ tableName: 'tbl_file', syncMode: 'incremental', recordCount: 0, records: [] }],
    })
  )
  console.log(`HTTP ${r4.status}:`, JSON.stringify(r4.body, null, 2))

  // 5. recordCount 不匹配
  divider('5. recordCount 不匹配 (期望 400)')
  const r5 = await postSigned(
    buildPayload({
      batchId: `${BATCH_BASE}-MISMATCH`,
      tables: [{ tableName: 'tbl_task', syncMode: 'full', recordCount: 5, records: [SAMPLE_TASK, SAMPLE_TASK] }],
    })
  )
  console.log(`HTTP ${r5.status}:`, JSON.stringify(r5.body, null, 2))

  // 6. 缺 siteCode
  divider('6. 缺 siteCode (期望 400)')
  // 需要先用合法 site 签, 否则 401 优先
  const noSitePayload = {
    batchId: `${BATCH_BASE}-NOSITE`,
    snapshotAt: new Date().toISOString(),
    mode: 'full',
    version: '1',
    tables: [],
  }
  const r6 = await postSigned(noSitePayload, { signSiteCode: TEST_SITE })
  console.log(`HTTP ${r6.status}:`, JSON.stringify(r6.body, null, 2))

  // -- HMAC 鉴权负例 (strict 模式下) --
  if (AUTH_MODE === 'strict') {
    // 7. 无签名
    divider('7. 无签名 strict mode (期望 401 MISSING_SIGNATURE)')
    const r7 = await postSigned(
      buildPayload({
        batchId: `${BATCH_BASE}-NOSIG`,
        tables: [{ tableName: 'tbl_task', syncMode: 'full', recordCount: 1, records: [SAMPLE_TASK] }],
      }),
      { skipAuth: true }
    )
    console.log(`HTTP ${r7.status}:`, JSON.stringify(r7.body, null, 2))

    // 8. 错签名
    divider('8. 错签名 (期望 401 INVALID_SIGNATURE)')
    const r8 = await postSigned(
      buildPayload({
        batchId: `${BATCH_BASE}-BADSIG`,
        tables: [{ tableName: 'tbl_task', syncMode: 'full', recordCount: 1, records: [SAMPLE_TASK] }],
      }),
      { signSecret: 'WRONG_SECRET_HERE' }
    )
    console.log(`HTTP ${r8.status}:`, JSON.stringify(r8.body, null, 2))

    // 9. 过期 timestamp (10 分钟前)
    divider('9. 过期 timestamp (期望 401 EXPIRED_TIMESTAMP)')
    const r9 = await postSigned(
      buildPayload({
        batchId: `${BATCH_BASE}-EXPIRED`,
        tables: [{ tableName: 'tbl_task', syncMode: 'full', recordCount: 1, records: [SAMPLE_TASK] }],
      }),
      { signTimestamp: Date.now() - 10 * 60 * 1000 }
    )
    console.log(`HTTP ${r9.status}:`, JSON.stringify(r9.body, null, 2))

    // 10. siteCode mismatch (header 说 SH01, payload 是 TEST_PKG)
    divider('10. siteCode mismatch (期望 401 SITE_CODE_MISMATCH)')
    const r10 = await postSigned(
      buildPayload({
        batchId: `${BATCH_BASE}-MISMATCH-SC`,
        tables: [{ tableName: 'tbl_task', syncMode: 'full', recordCount: 1, records: [SAMPLE_TASK] }],
      }),
      { signSiteCode: 'SH01' }
    )
    console.log(`HTTP ${r10.status}:`, JSON.stringify(r10.body, null, 2))
  } else {
    console.log('\n[Skip] HMAC 鉴权负例仅在 strict 模式下运行')
  }

  console.log('\n=== ALL TESTS DONE ===')
}

main().catch((err) => {
  console.error('[Test] fatal:', err)
  process.exit(1)
})
