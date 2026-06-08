/**
 * Sprint 2H.6 - 验证 inserted/updated 区分 (RETURNING xmax = 0)
 *
 * 用法:
 *   1. 先 push 一份 records (新建 source_id) → 期望 inserted = N
 *   2. 再 push 同样的 records (相同 source_id) → 期望 updated = N
 *
 * 用 unified_disc_media 测试 (dispatchDiscMedia, inlineUpsert 路径)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { createHmac, randomBytes } from 'crypto'

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
  const res = await fetch(`${URL}/api/sync/package`, { method: 'POST', headers, body: rawBody })
  const body = await res.json()
  console.log(`  HTTP ${res.status}, packageStatus=${body.status}`)
  if (body.tables) {
    body.tables.forEach((t: any) => {
      console.log(
        `    ${t.tableName}: received=${t.received} upserted=${t.upserted} inserted=${t.inserted} updated=${t.updated} failed=${t.failed} status=${t.status}`
      )
    })
  }
  return { status: res.status, body }
}

async function main() {
  const siteCode = 'TEST_H6'
  const batchId1 = `H6-${siteCode}-${Date.now()}-1`
  const batchId2 = `H6-${siteCode}-${Date.now()}-2`

  // 准备 records: 5 个 disc, 都用 siteCode+source_id 区分
  // 注: unified_disc_media.iso_status 是 integer, 不是 string
  const records = [
    { id: 9001, task_id: 1, slot_id: 100, disc_num: 1, disc_label: 'H6-D1', used_size: 1000, extra_size: 100, iso_status: 0, stage: 1 },
    { id: 9002, task_id: 1, slot_id: 101, disc_num: 2, disc_label: 'H6-D2', used_size: 2000, extra_size: 100, iso_status: 0, stage: 1 },
    { id: 9003, task_id: 1, slot_id: 102, disc_num: 3, disc_label: 'H6-D3', used_size: 3000, extra_size: 100, iso_status: 0, stage: 1 },
    { id: 9004, task_id: 1, slot_id: 103, disc_num: 4, disc_label: 'H6-D4', used_size: 4000, extra_size: 100, iso_status: 0, stage: 1 },
    { id: 9005, task_id: 1, slot_id: 104, disc_num: 5, disc_label: 'H6-D5', used_size: 5000, extra_size: 100, iso_status: 0, stage: 1 },
  ]

  // 1. 首次 push → 期望 inserted=5, updated=0
  const pkg1 = {
    siteCode,
    batchId: batchId1,
    snapshotAt: new Date().toISOString(),
    mode: 'full',
    version: '2H.6-test',
    tables: [{
      tableName: 'tbl_disc',
      syncMode: 'full',
      recordCount: records.length,
      records,
    }],
  }

  const outDir = resolve(process.cwd(), 'exports', siteCode)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'package-insert.json'), JSON.stringify(pkg1, null, 2))

  const r1 = await signAndPost(pkg1, `首次 push (期望 inserted=5)`)
  if (r1.status !== 200 && r1.status !== 207) throw new Error(`1st push failed: ${r1.status}`)
  const t1 = r1.body.tables[0]
  if (t1.inserted !== records.length) {
    console.log(`  ⚠️  期望 inserted=${records.length}, 实际 inserted=${t1.inserted}`)
  } else {
    console.log(`  ✅ inserted=${t1.inserted} 正确`)
  }

  // 2. 第二次 push (相同 records, 改 disc_label) → 期望 inserted=0, updated=5
  const records2 = records.map((r, i) => ({ ...r, disc_label: `H6-D${i + 1}-UPDATED`, used_size: r.used_size + 100 }))
  const pkg2 = {
    siteCode,
    batchId: batchId2,
    snapshotAt: new Date().toISOString(),
    mode: 'full',
    version: '2H.6-test',
    tables: [{
      tableName: 'tbl_disc',
      syncMode: 'full',
      recordCount: records2.length,
      records: records2,
    }],
  }
  writeFileSync(resolve(outDir, 'package-update.json'), JSON.stringify(pkg2, null, 2))

  const r2 = await signAndPost(pkg2, `第二次 push (期望 inserted=0, updated=5)`)
  if (r2.status !== 200 && r2.status !== 207) throw new Error(`2nd push failed: ${r2.status}`)
  const t2 = r2.body.tables[0]
  if (t2.updated === records.length && t2.inserted === 0) {
    console.log(`  ✅ inserted=${t2.inserted}, updated=${t2.updated} 正确 (Sprint 2H.6 RETURNING xmax=0 区分成功)`)
  } else {
    console.log(`  ⚠️  期望 inserted=0, updated=${records.length}, 实际 inserted=${t2.inserted}, updated=${t2.updated}`)
  }
}
main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e)
  process.exitCode = 1
})
