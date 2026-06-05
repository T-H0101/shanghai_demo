/**
 * Test Sync Package
 * Sprint 2D.2 - 测试 /api/sync/package 接口
 *
 * 用法:
 *   pnpm tsx scripts/test-sync-package.ts
 *
 * 验证场景:
 *   1. 合法 package (tbl_task + tbl_disc_lib)
 *   2. 重复 batchId (duplicated)
 *   3. 未知表 (400)
 *   4. tbl_file (400 forbidden)
 *   5. recordCount 不匹配 (400)
 *   6. checksum 冲突 (TODO 暂未实现)
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

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

async function postPackage(payload: unknown) {
  const res = await fetch(`${BASE_URL}/api/sync/package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return {
    status: res.status,
    body: await res.json(),
  }
}

function divider(title: string) {
  console.log('\n' + '='.repeat(60))
  console.log(`  ${title}`)
  console.log('='.repeat(60))
}

async function main() {
  // 0. 检查服务
  try {
    const health = await fetch(`${BASE_URL}/api/system/health`)
    if (!health.ok) throw new Error('server not healthy')
  } catch (err) {
    console.error('[Test] Dev server not running. Start with: pnpm dev')
    process.exit(1)
  }

  // 1. 合法 package
  divider('1. 合法 package (tbl_task + tbl_disc_lib)')
  const batch1 = `${BATCH_BASE}-VALID`
  const r1 = await postPackage(
    buildPayload({
      batchId: batch1,
      tables: [
        {
          tableName: 'tbl_task',
          syncMode: 'full',
          recordCount: 1,
          records: [SAMPLE_TASK],
        },
        {
          tableName: 'tbl_disc_lib',
          syncMode: 'full',
          recordCount: 1,
          records: [SAMPLE_DEVICE],
        },
      ],
    })
  )
  console.log(`HTTP ${r1.status}:`, JSON.stringify(r1.body, null, 2))

  // 2. 重复 batchId
  divider('2. 重复 batchId (期望 duplicated)')
  const r2 = await postPackage(
    buildPayload({
      batchId: batch1,
      tables: [
        {
          tableName: 'tbl_task',
          syncMode: 'full',
          recordCount: 1,
          records: [SAMPLE_TASK],
        },
      ],
    })
  )
  console.log(`HTTP ${r2.status}:`, JSON.stringify(r2.body, null, 2))

  // 3. 未知表
  divider('3. 未知表 tbl_unknown (期望 400)')
  const r3 = await postPackage(
    buildPayload({
      batchId: `${BATCH_BASE}-UNKNOWN`,
      tables: [
        {
          tableName: 'tbl_unknown',
          syncMode: 'full',
          recordCount: 0,
          records: [],
        },
      ],
    })
  )
  console.log(`HTTP ${r3.status}:`, JSON.stringify(r3.body, null, 2))

  // 4. tbl_file 禁止
  divider('4. tbl_file (期望 400 forbidden)')
  const r4 = await postPackage(
    buildPayload({
      batchId: `${BATCH_BASE}-FILE`,
      tables: [
        {
          tableName: 'tbl_file',
          syncMode: 'incremental',
          recordCount: 0,
          records: [],
        },
      ],
    })
  )
  console.log(`HTTP ${r4.status}:`, JSON.stringify(r4.body, null, 2))

  // 5. recordCount 不匹配
  divider('5. recordCount 不匹配 (期望 400)')
  const r5 = await postPackage(
    buildPayload({
      batchId: `${BATCH_BASE}-MISMATCH`,
      tables: [
        {
          tableName: 'tbl_task',
          syncMode: 'full',
          recordCount: 5, // 声称 5 条
          records: [SAMPLE_TASK, SAMPLE_TASK], // 实际 2 条
        },
      ],
    })
  )
  console.log(`HTTP ${r5.status}:`, JSON.stringify(r5.body, null, 2))

  // 6. 缺 siteCode
  divider('6. 缺 siteCode (期望 400)')
  const r6 = await fetch(`${BASE_URL}/api/sync/package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batchId: 'X',
      snapshotAt: new Date().toISOString(),
      mode: 'full',
      version: '1',
      tables: [],
    }),
  })
  console.log(`HTTP ${r6.status}:`, JSON.stringify(await r6.json(), null, 2))

  console.log('\n=== ALL TESTS DONE ===')
}

main().catch((err) => {
  console.error('[Test] fatal:', err)
  process.exit(1)
})