/**
 * Test Sync Package 10 Tables
 * Sprint 2D.3 - 验证 10 张小表 package dispatch
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
const TEST_SITE = 'TEST_PKG10'
const BATCH_BASE = `PKG10-${TEST_SITE}-${Date.now()}`

function payload(tables: Array<{ tableName: string; record: Record<string, unknown> }>) {
  return {
    siteCode: TEST_SITE,
    batchId: `${BATCH_BASE}-${tables[0].tableName}`,
    snapshotAt: new Date().toISOString(),
    mode: 'full',
    version: '2D.3',
    tables: tables.map((t) => ({
      tableName: t.tableName,
      syncMode: 'full',
      recordCount: 1,
      records: [t.record],
    })),
  }
}

async function post(payload: unknown) {
  const res = await fetch(`${BASE_URL}/api/sync/package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return { status: res.status, body: await res.json() }
}

const SAMPLES: Array<{ tableName: string; record: Record<string, unknown> }> = [
  { tableName: 'tbl_task', record: { id: 9001, task_name: 'Pkg10-Task1', task_type: 1, status: 1, total_files: 10, total_size: 1024 } },
  { tableName: 'tbl_disc_lib', record: { lib_id: 9001, name: 'Pkg10-Dev1', type: 1, device_status: 1, ip: '10.0.0.1' } },
  { tableName: 'tbl_magzines', record: { id: 9001, magazine_id: 'MAG-9001', barcode: 'BC-9001', rfid: 'RFID-9001', device_id: 'DEV-9001', status: 'active', position: 'A1', slot_count: 50 } },
  { tableName: 'tbl_slots', record: { id: 9001, slot_id: 'SLOT-9001', slot_index: 1, device_id: 'DEV-9001', magazine_id: 'MAG-9001', status: 'occupied', occupied: true, media_id: 'MEDIA-9001', media_type: 'BD', capacity: '50GB' } },
  { tableName: 'tbl_hd_info', record: { slot_id: 9001, disk_id: 'HD-9001', device_id: 'DEV-9001', slot_index: 1, capacity: '4TB', model: 'ST4000', serial_no: 'SN9001', status: 'active', used_capacity: 1000, total_capacity: 4000, health_status: 'healthy' } },
  { tableName: 'tbl_lib_task', record: { task_id: 9001, lib_id: 9001, source_id_field: 'task_id' } }, // placeholder, skip
  { tableName: 'tbl_disc', record: { id: 9001, source_task_id: '9001', disc_num: 1, disc_label: 'Disc-9001', slot_id: 9001, device_id: 'DEV-9001', used_size: 100000, extra_size: 50000, iso_status: 1, iso_path: '/path/iso', burn_success: 1, burn_errors: 0, error_files: 0, stage: 2 } },
  { tableName: 'tbl_logical_volume', record: { id: 9001, volume_id: 'VOL-9001', volume_name: 'Pkg10-Vol1', volume_type: 'NFS', capacity: '10TB', used_capacity: 1000, file_count: 0, site_code: 'TEST_PKG10', device_id: 'DEV-9001', status: 'active', health_status: 'healthy' } },
  { tableName: 'tbl_volume_slot', record: { volume_id: 9001, source_id_field: 'volume_id' } }, // placeholder, skip
  { tableName: 'tbl_user_task', record: { task_id: 9001, source_id_field: 'task_id' } }, // placeholder, skip
]

async function main() {
  try {
    const h = await fetch(`${BASE_URL}/api/system/health`)
    if (!h.ok) throw new Error('server not healthy')
  } catch {
    console.error('Dev server not running. Start with: pnpm dev')
    process.exit(1)
  }

  let pass = 0
  let fail = 0

  for (const sample of SAMPLES) {
    const r = await post(payload([sample]))
    const ok = r.status === 200 && r.body.status !== 'failed'
    const tag = ok ? '✅' : '❌'
    console.log(`${tag} ${sample.tableName}: HTTP ${r.status}, code=${r.body.code}, status=${r.body.status}, tables=${JSON.stringify(r.body.tables ?? r.body.summary)}`)
    if (ok) pass++
    else {
      fail++
      console.log('  full body:', JSON.stringify(r.body, null, 2))
    }
  }

  console.log(`\n=== ${pass} pass / ${fail} fail ===`)

  // 重复 batchId 测试
  console.log('\n=== Duplicate batchId (期望 duplicated) ===')
  const dup = await post(payload([SAMPLES[0]]))
  console.log(`HTTP ${dup.status}, duplicated=${dup.body.duplicated}`)

  // 未知表
  console.log('\n=== Unknown table (期望 400) ===')
  const unk = await post({
    siteCode: TEST_SITE,
    batchId: `${BATCH_BASE}-UNKNOWN`,
    snapshotAt: new Date().toISOString(),
    mode: 'full',
    version: '2D.3',
    tables: [{ tableName: 'tbl_unknown', syncMode: 'full', recordCount: 0, records: [] }],
  })
  console.log(`HTTP ${unk.status}, code=${unk.body.code}`)

  // tbl_file 仍禁止
  console.log('\n=== tbl_file (期望 400) ===')
  const file = await post({
    siteCode: TEST_SITE,
    batchId: `${BATCH_BASE}-FILE`,
    snapshotAt: new Date().toISOString(),
    mode: 'full',
    version: '2D.3',
    tables: [{ tableName: 'tbl_file', syncMode: 'incremental', recordCount: 0, records: [] }],
  })
  console.log(`HTTP ${file.status}, code=${file.body.code}`)

  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('fatal:', err)
  process.exit(1)
})