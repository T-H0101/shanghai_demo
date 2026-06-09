/**
 * Sprint 2D.5 - 站点数据包同步 smoke test
 *
 * 直接调用 package route/service 链路，不依赖浏览器或 dev server。
 * 仅写入 TEST_SMOKE 的固定测试记录，不触碰 tbl_file/tbl_folder。
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { createHmac, randomBytes } from 'crypto'

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 1) continue
    const key = trimmed.slice(0, separator).trim()
    // 处理 Next.js dotenv-expand 的转义: \$ → $ (用于含 $ 的密码)
    const rawValue = trimmed.slice(separator + 1).trim()
    const value = rawValue.replace(/\\\$/g, '$')
    if (!process.env[key]) process.env[key] = value
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

/** Sprint 2G.1: 为 smoke 请求加 HMAC 签名 (strict 模式需要) */
function buildAuthHeaders(rawBody: string, siteCode: string): Record<string, string> {
  const mode = (process.env.SYNC_PACKAGE_AUTH_MODE ?? 'strict').toLowerCase()
  if (mode === 'dev') {
    // dev 模式可无签名, 但仍带签名以测试 strict 路径
  }
  const secret = process.env.SYNC_PACKAGE_SECRET ?? 'TEST_SYNC_SECRET'
  const ts = Date.now()
  const nonce = randomBytes(8).toString('hex')
  const signingString = `${ts}.${nonce}.${rawBody}`
  const sig = createHmac('sha256', secret).update(signingString, 'utf8').digest('hex')
  return {
    'Content-Type': 'application/json',
    'x-site-code': siteCode,
    'x-timestamp': String(ts),
    'x-nonce': nonce,
    'x-signature': sig,
  }
}

async function main(): Promise<void> {
  loadEnvLocal()

  const [{ NextRequest }, { POST }, db] = await Promise.all([
    import('next/server'),
    import('../app/api/sync/package/route'),
    import('../lib/db/postgres'),
  ])

  const { query, closePool } = db
  const siteCode = 'TEST_SMOKE'
  const batchId = `TEST_SMOKE-${Date.now()}`
  const taskSourceId = '910001'
  const deviceSourceId = '910001'
  const payload = {
    siteCode,
    batchId,
    snapshotAt: new Date().toISOString(),
    mode: 'full',
    version: '2D.5-smoke',
    tables: [
      {
        tableName: 'tbl_task',
        syncMode: 'full',
        recordCount: 1,
        records: [{
          id: Number(taskSourceId),
          task_name: '同步链路 Smoke 任务',
          task_type: 0,
          status: 6,
          total_files: 1,
          total_size: 1024,
        }],
      },
      {
        tableName: 'tbl_disc_lib',
        syncMode: 'full',
        recordCount: 1,
        records: [{
          lib_id: Number(deviceSourceId),
          name: '同步链路 Smoke 设备',
          type: 1,
          device_status: 1,
          ip: '127.0.0.1',
        }],
      },
    ],
  }

  try {
    const database = await query<{ current_database: string }>('SELECT current_database()')
    assert(
      database.rows[0]?.current_database === 'unified_disc_platform',
      `中心库错误: ${database.rows[0]?.current_database ?? 'unknown'}`
    )

    const tables = await query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [['unified_tasks', 'unified_devices', 'sync_package_log', 'sync_table_log']]
    )
    assert(tables.rowCount === 4, '核心表检查失败')

    const post = async () => {
      const rawBody = JSON.stringify(payload)
      const request = new NextRequest('http://localhost/api/sync/package', {
        method: 'POST',
        headers: buildAuthHeaders(rawBody, siteCode),
        body: rawBody,
      })
      const response = await POST(request)
      return {
        status: response.status,
        body: await response.json() as {
          status: string
          duplicated: boolean
          summary: { successTableCount: number }
        },
      }
    }

    const first = await post()
    assert(first.status === 200, `首次 package 请求失败: HTTP ${first.status}`)
    assert(first.body.status === 'success', `首次 package 状态异常: ${first.body.status}`)
    assert(first.body.summary.successTableCount === 2, '表级成功数量应为 2')

    const second = await post()
    assert(second.status === 200, `重复 package 请求失败: HTTP ${second.status}`)
    assert(second.body.duplicated === true, '重复 batchId 未返回 duplicated')

    const packageLog = await query<{ id: string; status: string }>(
      `SELECT id, status
       FROM sync_package_log
       WHERE site_code = $1 AND batch_id = $2`,
      [siteCode, batchId]
    )
    assert(packageLog.rowCount === 1, 'package log 数量应为 1')
    assert(packageLog.rows[0].status === 'success', 'package log 状态应为 success')

    const tableLogs = await query<{ table_name: string; status: string }>(
      `SELECT table_name, status
       FROM sync_table_log
       WHERE package_log_id = $1`,
      [packageLog.rows[0].id]
    )
    assert(tableLogs.rowCount === 2, 'table log 数量应为 2')
    assert(tableLogs.rows.every((row) => row.status === 'success'), 'table log 状态应全部成功')

    const task = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM unified_tasks
       WHERE source_site_id = $1 AND source_table = 'tbl_task' AND source_id = $2`,
      [siteCode, taskSourceId]
    )
    const device = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM unified_devices
       WHERE source_site_id = $1 AND source_table = 'tbl_disc_lib' AND source_id = $2`,
      [siteCode, deviceSourceId]
    )
    assert(task.rows[0]?.count === '1', 'TEST_SMOKE 任务记录不存在')
    assert(device.rows[0]?.count === '1', 'TEST_SMOKE 设备记录不存在')

    console.log('Sync smoke passed')
    console.table({
      database: database.rows[0].current_database,
      batchId,
      packageStatus: first.body.status,
      duplicateDetected: second.body.duplicated,
      packageLogs: packageLog.rowCount,
      tableLogs: tableLogs.rowCount,
      taskRecords: task.rows[0].count,
      deviceRecords: device.rows[0].count,
    })
  } finally {
    await closePool()
  }
}

main().catch((error) => {
  console.error('[smoke:sync] failed:', error)
  process.exitCode = 1
})
