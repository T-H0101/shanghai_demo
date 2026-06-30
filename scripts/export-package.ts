/**
 * Sprint 2H.1 - 站点 Package Exporter (模拟)
 *
 * 用法:
 *   pnpm export:package SH01
 *   pnpm export:package TEST_CLEAN
 *   pnpm export:package SH01 --out exports/SH01
 *   pnpm export:package SH01 --tables tbl_task,tbl_disc_lib
 *
 * 行为:
 *   1. 连接 source_restore (源站库, 模拟)
 *   2. 拉取核心验收表全部记录
 *   3. 组装 package.json (含 batchId/snapshotAt/version/tables)
 *   4. 写入 exports/<siteCode>/package.json
 *
 * 严禁导出 tbl_file / tbl_folder
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { ALLOWED_PACKAGE_TABLES } from '../lib/sync/package-schema'
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

// R.94 本地开发验收范围: 核心页面需要的 10 张小/中表
const CORE_ACCEPTANCE_TABLES = [
  'tbl_task',
  'tbl_disc_lib',
  'tbl_magzines',
  'tbl_slots',
  'tbl_hd_info',
  'tbl_disc',
  'tbl_logical_volume',
  'tbl_user',
  'tbl_site',
  'tbl_platform',
] as const

// R.94 补丁: 全量 141 张白名单表 (用于 --all 模式全量同步验证)
const ALL_ALLOWED_TABLES = [...ALLOWED_PACKAGE_TABLES] as string[]

const FORBIDDEN = ['tbl_file', 'tbl_folder']

const SOURCE_URL = process.env.SOURCE_DATABASE_URL?.trim() ?? ''
const SITE_URL = process.env.SITE_DATABASE_URL?.trim() ?? ''

interface TableEntry {
  tableName: string
  syncMode: string
  recordCount: number
  records: Record<string, unknown>[]
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function newBatchId(siteCode: string): string {
  return `${siteCode}-${new Date().toISOString().replace(/[:.]/g, '-')}`
}

async function connectSourceClient(): Promise<{ client: Client; label: string } | null> {
  const explicitUrl = SOURCE_URL || SITE_URL
  if (explicitUrl) {
    const client = new Client({ connectionString: explicitUrl })
    await client.connect()
    return { client, label: SOURCE_URL ? 'SOURCE_DATABASE_URL' : 'SITE_DATABASE_URL' }
  }

  const client = new Client({
    host: process.env.SITE_DB_HOST ?? 'localhost',
    port: parseInt(process.env.SITE_DB_PORT ?? '5434', 10),
    database: process.env.SITE_DB_NAME ?? 'star_storage_db',
    user: process.env.SITE_DB_USER ?? 'starxdb',
    password: process.env.SITE_DB_PASSWORD || undefined,
  })
  try {
    await client.connect()
    return { client, label: 'SITE_DB_* default' }
  } catch {
    await client.end().catch(() => undefined)
    return null
  }
}

function localFixtureTables(siteCode: string, mode: string): TableEntry[] {
  const baseOffset = siteCode === 'BJ02' ? 10000 : 0
  const taskId = 17 + baseOffset
  const deviceId = 2 + baseOffset
  const magazineId = 5 + baseOffset
  const slotId = 101 + baseOffset
  const volumeId = 1 + baseOffset
  const userId = 9001 + baseOffset
  const now = new Date().toISOString()
  const records: Record<string, Record<string, unknown>[]> = {
    tbl_task: [
      {
        id: taskId,
        task_type: 0,
        create_dt: now,
        update_dt: now,
        status: 7,
        burn_status: 0,
        task_name: `${siteCode} 本地验收任务`,
        task_mode: 0,
        total_files: 12,
        total_size: 104857600,
        ret_msg: null,
      },
    ],
    tbl_disc_lib: [
      {
        lib_id: deviceId,
        device_status: 1,
        name: `${siteCode} 光盘库`,
        type: 6,
        disc_type: 1,
        ip: '127.0.0.1',
        port: '2002',
        vendor: 'STARSHINE',
        model: 'local-fixture',
        sn: `${siteCode}-LIB-${deviceId}`,
        mags: 1,
        slots: 2,
        slots_per_mag: 2,
        use_status: 0,
        lib_pwd: null,
      },
    ],
    tbl_magzines: [
      {
        mag_id: magazineId,
        lib_id: deviceId,
        rfid: `${siteCode}-MAG-${magazineId}`,
        disc_type: 1,
        mag_order: 1,
        door_status: 0,
      },
    ],
    tbl_slots: [
      {
        slot_id: slotId,
        mag_id: magazineId,
        slot_order: 1,
        disc_type: 1,
        serial_num: `${siteCode}-DISC-${slotId}`,
        max_cap: '107374182400',
        rest_cap: '53687091200',
        disc_side: 0,
        hd_type: 1,
      },
      {
        slot_id: slotId + 1,
        mag_id: magazineId,
        slot_order: 2,
        disc_type: 0,
        serial_num: `${siteCode}-EMPTY-${slotId + 1}`,
        max_cap: '107374182400',
        rest_cap: '107374182400',
        disc_side: 0,
        hd_type: 0,
      },
    ],
    tbl_hd_info: [
      {
        slot_id: slotId,
        serial_num: `${siteCode}-HD-${slotId}`,
        name: `${siteCode} 本地硬盘`,
        model: 'fixture-disk',
        create_dt: now,
        health: 100,
        hd_status: 1,
        hd_online: 1,
      },
    ],
    tbl_disc: [
      {
        id: 30 + baseOffset,
        task_id: String(taskId),
        disc_num: 1,
        slot_id: slotId,
        burn_success: 1,
        copy_success: 1,
        disc_label: `${siteCode}-DISC-001`,
        used_size: '53687091200',
        extra_size: '0',
        serial_num: `${siteCode}-DISC-${slotId}`,
        disc_progress: 100,
        stage: 2,
        burn_errors: null,
        error_files: 0,
        iso_status: 3,
        create_dt: now,
        update_dt: now,
      },
    ],
    tbl_logical_volume: [
      {
        volume_id: volumeId,
        group_id: 0,
        type: 3,
        name: `${siteCode} 本地存储卷`,
        total_cap: '107374182400',
        used_cap: '53687091200',
        free_cap: '53687091200',
        create_time: now,
        update_time: now,
        remark: 'local acceptance fixture',
        del_flag: 0,
      },
    ],
    tbl_user: [
      {
        user_id: userId,
        name: `${siteCode.toLowerCase()}_operator`,
        display_name: `${siteCode} 管理员`,
        role_id: 1,
        login_status: 0,
        department: `${siteCode} 运维组`,
        phone: null,
        email: null,
        pwd: null,
      },
    ],
    tbl_site: [
      {
        site_id: siteCode,
        site_name: `${siteCode} 本地验收站点`,
        s_level: 1,
        parent: null,
        cmt: 'local acceptance fixture',
      },
    ],
    tbl_platform: [
      {
        plat_id: 1 + baseOffset,
        type_id: 1,
        plat_name: `${siteCode} 站点平台`,
        ip: '127.0.0.1',
        port: '3000',
        user_name: null,
        pwd: null,
        cmt: 'local acceptance fixture',
      },
    ],
  }

  return Object.entries(records).map(([tableName, rows]) => ({
    tableName,
    syncMode: mode,
    recordCount: rows.length,
    records: rows,
  }))
}

function parseArgs(): { siteCode: string; outRoot: string; tables: string[]; mode: string; explicitTables: boolean } {
  const args = process.argv.slice(2)
  const siteCode = args[0]
  if (!siteCode || siteCode.startsWith('--')) {
    throw new Error('用法: pnpm export:package <siteCode> [--out <dir>] [--tables t1,t2] [--mode full|incremental] [--all]')
  }
  let outRoot = resolve(process.cwd(), 'exports')
  let tables: string[] = [...CORE_ACCEPTANCE_TABLES]
  let mode = 'full'
  let explicitTables = false
  const allMode = args.includes('--all')
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      outRoot = resolve(process.cwd(), args[i + 1])
      i++
    } else if (args[i] === '--tables' && args[i + 1]) {
      tables = args[i + 1].split(',').map(s => s.trim())
      explicitTables = true
      i++
    } else if (args[i] === '--mode' && args[i + 1]) {
      mode = args[i + 1]
      i++
    } else if (args[i] === '--all') {
      // already captured above
    }
  }
  if (allMode) {
    tables = [...ALL_ALLOWED_TABLES]
    explicitTables = false
  }
  return { siteCode, outRoot, tables, mode, explicitTables }
}

async function fetchTable(client: Client, table: string): Promise<Record<string, unknown>[]> {
  // 用 * 拉全部列, mapper/dispatcher 自己挑
  const r = await client.query(`SELECT * FROM ${table}`)
  return r.rows
}

async function main() {
  const { siteCode, outRoot, tables, mode, explicitTables } = parseArgs()

  // 守门: 严禁 tbl_file / tbl_folder
  for (const t of tables) {
    if (FORBIDDEN.includes(t)) {
      throw new Error(`拒绝导出: ${t} 在 FORBIDDEN 列表`)
    }
  }
  // 守门: 必须属于 141 张白名单 (R.92.1 扩展自原 7 张 Sprint 2H.1 白名单)
  for (const t of tables) {
    if (!(ALLOWED_PACKAGE_TABLES as readonly string[]).includes(t)) {
      throw new Error(`拒绝导出: ${t} 不在 ALLOWED_PACKAGE_TABLES 白名单`)
    }
  }

  console.log(`[export-package] siteCode=${siteCode}`)
  console.log(`[export-package] out=${outRoot}/${siteCode}`)
  console.log(`[export-package] tables=${tables.length}`)

  const sourceConnection = await connectSourceClient()
  if (!sourceConnection) {
    const requested = explicitTables ? new Set(tables) : null
    const tableEntries = localFixtureTables(siteCode, mode)
      .filter((entry) => !requested || requested.has(entry.tableName))
    if (tableEntries.length === 0) {
      throw new Error(`本地 fixture 未包含请求表: ${tables.join(',')}`)
    }
    const pkg = {
      siteCode,
      batchId: newBatchId(siteCode),
      snapshotAt: new Date().toISOString(),
      version: 'r94-local-fixture',
      mode,
      checksum: null,
      tables: tableEntries,
    }
    const outDir = resolve(outRoot, siteCode)
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
    const outFile = resolve(outDir, 'package.json')
    writeFileSync(outFile, JSON.stringify(pkg, null, 2), 'utf8')
    console.log('[export-package] source=local fixture (no source/site DB configured or reachable)')
    for (const t of tableEntries) console.log(`[export-package]   ${t.tableName}: ${t.recordCount} records`)
    console.log('\n=== EXPORT DONE ===')
    console.log(`  siteCode:     ${pkg.siteCode}`)
    console.log(`  batchId:      ${pkg.batchId}`)
    console.log(`  snapshotAt:   ${pkg.snapshotAt}`)
    console.log(`  version:      ${pkg.version}`)
    console.log(`  mode:         ${pkg.mode}`)
    console.log(`  tableCount:   ${tableEntries.length}`)
    console.log(`  totalRecords: ${tableEntries.reduce((sum, t) => sum + t.recordCount, 0)}`)
    console.log(`  output:       ${outFile}`)
    return
  }

  const { client, label } = sourceConnection
  try {
    // 1. 确认源端可达
    const db = await client.query<{ db: string; ver: string }>(
      `SELECT current_database() AS db, version() AS ver`
    )
    console.log(`[export-package] source=${db.rows[0].db} (${label})`)

    // 2. 拉每张表
    const tableEntries: Array<{
      tableName: string
      syncMode: string
      recordCount: number
      records: Record<string, unknown>[]
    }> = []
    let totalRecords = 0
    for (const t of tables) {
      const exists = await client.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM information_schema.tables
         WHERE table_schema='public' AND table_name=$1`,
        [t]
      )
      if (exists.rows[0].c !== '1') {
        console.warn(`[export-package] ⚠️ ${t} 在 source 不存在, 跳过 (records=0)`)
        tableEntries.push({ tableName: t, syncMode: mode, recordCount: 0, records: [] })
        continue
      }
      const records = await fetchTable(client, t)
      tableEntries.push({ tableName: t, syncMode: mode, recordCount: records.length, records })
      totalRecords += records.length
      console.log(`[export-package]   ${t}: ${records.length} records`)
    }

    // 3. 组装 package
    const pkg = {
      siteCode,
      batchId: newBatchId(siteCode),
      snapshotAt: new Date().toISOString(),
      version: '2H.1-exporter',
      mode,
      checksum: null,
      tables: tableEntries,
    }

    // 4. 写盘
    const outDir = resolve(outRoot, siteCode)
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
    const outFile = resolve(outDir, 'package.json')
    writeFileSync(outFile, JSON.stringify(pkg, null, 2), 'utf8')

    console.log('\n=== EXPORT DONE ===')
    console.log(`  siteCode:     ${pkg.siteCode}`)
    console.log(`  batchId:      ${pkg.batchId}`)
    console.log(`  snapshotAt:   ${pkg.snapshotAt}`)
    console.log(`  version:      ${pkg.version}`)
    console.log(`  mode:         ${pkg.mode}`)
    console.log(`  tableCount:   ${tableEntries.length}`)
    console.log(`  totalRecords: ${totalRecords}`)
    console.log(`  output:       ${outFile}`)
  } finally {
    await client.end()
  }
}

main().catch(e => {
  console.error('[export-package] failed:', e instanceof Error ? e.message : e)
  process.exitCode = 1
})
