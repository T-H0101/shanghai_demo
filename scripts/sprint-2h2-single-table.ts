/**
 * Sprint 2H.2 - 单表 package 验证脚本
 *
 * 用法:
 *   pnpm tsx scripts/sprint-2h2-single-table.ts
 *
 * 行为:
 *   1. 从 source_restore 拉 tbl_magzines / tbl_slots / tbl_logical_volume 真实数据
 *   2. 构造 3 个独立 package (各自只含 1 张表)
 *   3. 推送到 /api/sync/package
 *   4. 验证 table_log status + unified_* count 增加
 *   5. 重复 batchId 验证 duplicated
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { createHmac, randomBytes } from 'crypto'
import { Client } from 'pg'

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnvLocal()

const SECRET = process.env.SYNC_PACKAGE_SECRET
if (!SECRET) {
  console.error('缺少 SYNC_PACKAGE_SECRET')
  process.exit(1)
}
const URL = process.env.SYNC_CONTROL_URL ?? 'http://localhost:3000'
const SOURCE_URL = process.env.SOURCE_DATABASE_URL ?? 'postgresql://user:password@localhost:5432/source_restore'
const CENTER_URL = process.env.DATABASE_URL ?? 'postgresql://unified:password@localhost:5432/unified_disc_platform'

async function signAndPost(payload: unknown, label: string): Promise<{ status: number; body: any }> {
  const rawBody = JSON.stringify(payload)
  const ts = Date.now()
  const nonce = randomBytes(8).toString('hex')
  const sig = createHmac('sha256', SECRET!).update(`${ts}.${nonce}.${rawBody}`, 'utf8').digest('hex')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-site-code': (payload as any).siteCode,
    'x-timestamp': String(ts),
    'x-nonce': nonce,
    'x-signature': sig,
  }
  console.log(`\n=== ${label} ===`)
  console.log(`  POST ${URL}/api/sync/package (${rawBody.length} bytes)`)
  const res = await fetch(`${URL}/api/sync/package`, { method: 'POST', headers, body: rawBody })
  const body = await res.json()
  console.log(`  HTTP ${res.status}`)
  console.log(`  status: ${body.status}, duplicated: ${body.duplicated}`)
  if (body.summary) {
    console.log(`  summary: ${JSON.stringify(body.summary)}`)
  }
  if (body.tables) {
    body.tables.forEach((t: any) => {
      console.log(`    ${t.tableName}: received=${t.received} upserted=${t.upserted} failed=${t.failed} status=${t.status}`)
    })
  }
  return { status: res.status, body }
}

async function getUnifiedCount(c: Client, table: string, site: string, src: string): Promise<number> {
  const r = await c.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM ${table} WHERE source_site_id=$1 AND source_table=$2`,
    [site, src]
  )
  return parseInt(r.rows[0].c, 10)
}

async function main() {
  const src = new Client({ connectionString: SOURCE_URL })
  const ctr = new Client({ connectionString: CENTER_URL })
  await src.connect()
  await ctr.connect()

  const siteCode = 'TEST_H2'
  const batchId = `H2-${siteCode}-${Date.now()}`

  try {
    // 准备输出目录
    const outDir = resolve(process.cwd(), 'exports', 'TEST_H2')
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

    // ===== 表 1: tbl_magzines =====
    const mag = await src.query(`SELECT * FROM tbl_magzines`)
    const magBase = await getUnifiedCount(ctr, 'unified_magazines', siteCode, 'tbl_magzines')
    const magPkg1 = {
      siteCode,
      batchId: `${batchId}-MAG`,
      snapshotAt: new Date().toISOString(),
      mode: 'full',
      version: '2H.2-test',
      tables: [{
        tableName: 'tbl_magzines',
        syncMode: 'full',
        recordCount: mag.rows.length,
        records: mag.rows,
      }],
    }
    writeFileSync(resolve(outDir, 'package-mag.json'), JSON.stringify(magPkg1, null, 2))
    const r1 = await signAndPost(magPkg1, `1. tbl_magzines 首次推送 (${mag.rows.length} 条)`)
    if (r1.status !== 200) throw new Error(`mag push failed: ${r1.status}`)
    if (r1.body.tables[0].upserted !== mag.rows.length) {
      throw new Error(`expected upserted=${mag.rows.length}, got ${r1.body.tables[0].upserted}`)
    }
    const magAfter = await getUnifiedCount(ctr, 'unified_magazines', siteCode, 'tbl_magzines')
    console.log(`  unified_magazines SH=TEST_H2 source=tbl_magzines: ${magBase} → ${magAfter} (diff=${magAfter - magBase})`)
    if (magAfter - magBase !== mag.rows.length) {
      throw new Error(`expected +${mag.rows.length} rows, got +${magAfter - magBase}`)
    }
    // 重复 batchId
    const r1Dup = await signAndPost(magPkg1, `1b. tbl_magzines 重复 batchId (期望 duplicated)`)
    if (!r1Dup.body.duplicated) throw new Error('expected duplicated=true')

    // ===== 表 2: tbl_slots =====
    const slot = await src.query(`SELECT * FROM tbl_slots LIMIT 50`) // 限 50 防 push 太大
    const slotBase = await getUnifiedCount(ctr, 'unified_slots', siteCode, 'tbl_slots')
    const slotPkg = {
      siteCode,
      batchId: `${batchId}-SLOT`,
      snapshotAt: new Date().toISOString(),
      mode: 'full',
      version: '2H.2-test',
      tables: [{
        tableName: 'tbl_slots',
        syncMode: 'full',
        recordCount: slot.rows.length,
        records: slot.rows,
      }],
    }
    writeFileSync(resolve(outDir, 'package-slot.json'), JSON.stringify(slotPkg, null, 2))
    const r2 = await signAndPost(slotPkg, `2. tbl_slots 推送 (${slot.rows.length} 条, 限制 50)`)
    if (r2.status !== 200) throw new Error(`slot push failed: ${r2.status}`)
    if (r2.body.tables[0].upserted !== slot.rows.length) {
      throw new Error(`expected upserted=${slot.rows.length}, got ${r2.body.tables[0].upserted}`)
    }
    const slotAfter = await getUnifiedCount(ctr, 'unified_slots', siteCode, 'tbl_slots')
    console.log(`  unified_slots SH=TEST_H2 source=tbl_slots: ${slotBase} → ${slotAfter} (diff=${slotAfter - slotBase})`)
    if (slotAfter - slotBase !== slot.rows.length) {
      throw new Error(`expected +${slot.rows.length} rows, got +${slotAfter - slotBase}`)
    }

    // ===== 表 3: tbl_logical_volume =====
    const vol = await src.query(`SELECT * FROM tbl_logical_volume`)
    const volBase = await getUnifiedCount(ctr, 'unified_volumes', siteCode, 'tbl_logical_volume')
    const volPkg = {
      siteCode,
      batchId: `${batchId}-VOL`,
      snapshotAt: new Date().toISOString(),
      mode: 'full',
      version: '2H.2-test',
      tables: [{
        tableName: 'tbl_logical_volume',
        syncMode: 'full',
        recordCount: vol.rows.length,
        records: vol.rows,
      }],
    }
    writeFileSync(resolve(outDir, 'package-vol.json'), JSON.stringify(volPkg, null, 2))
    const r3 = await signAndPost(volPkg, `3. tbl_logical_volume 推送 (${vol.rows.length} 条)`)
    if (r3.status !== 200) throw new Error(`vol push failed: ${r3.status}`)
    if (r3.body.tables[0].upserted !== vol.rows.length) {
      throw new Error(`expected upserted=${vol.rows.length}, got ${r3.body.tables[0].upserted}`)
    }
    const volAfter = await getUnifiedCount(ctr, 'unified_volumes', siteCode, 'tbl_logical_volume')
    console.log(`  unified_volumes SH=TEST_H2 source=tbl_logical_volume: ${volBase} → ${volAfter} (diff=${volAfter - volBase})`)
    if (volAfter - volBase !== vol.rows.length) {
      throw new Error(`expected +${vol.rows.length} rows, got +${volAfter - volBase}`)
    }

    console.log('\n✅ 单表验证全部通过')
    console.log(`  3 张表都真实入库: +${mag.rows.length} magazines, +${slot.rows.length} slots, +${vol.rows.length} volumes`)
  } finally {
    await src.end()
    await ctr.end()
  }
}
main().catch(e => {
  console.error('❌', e instanceof Error ? e.message : e)
  process.exitCode = 1
})
