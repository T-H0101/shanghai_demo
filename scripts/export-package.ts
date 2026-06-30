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
 *   2. 拉取白名单 7 张表全部记录
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

// Sprint 2H.1 范围: 7 张小表
const SPRINT_2H1_TABLES = [
  'tbl_task',
  'tbl_disc_lib',
  'tbl_magzines',
  'tbl_slots',
  'tbl_hd_info',
  'tbl_disc',
  'tbl_logical_volume',
] as const

const FORBIDDEN = ['tbl_file', 'tbl_folder']

const SOURCE_URL = process.env.SOURCE_DATABASE_URL ?? 'postgresql://localhost:5432/source_restore'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function newBatchId(siteCode: string): string {
  return `${siteCode}-${new Date().toISOString().replace(/[:.]/g, '-')}`
}

function parseArgs(): { siteCode: string; outRoot: string; tables: string[]; mode: string } {
  const args = process.argv.slice(2)
  const siteCode = args[0]
  if (!siteCode || siteCode.startsWith('--')) {
    throw new Error('用法: pnpm export:package <siteCode> [--out <dir>] [--tables t1,t2] [--mode full|incremental]')
  }
  let outRoot = resolve(process.cwd(), 'exports')
  let tables: string[] = [...SPRINT_2H1_TABLES]
  let mode = 'full'
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      outRoot = resolve(process.cwd(), args[i + 1])
      i++
    } else if (args[i] === '--tables' && args[i + 1]) {
      tables = args[i + 1].split(',').map(s => s.trim())
      i++
    } else if (args[i] === '--mode' && args[i + 1]) {
      mode = args[i + 1]
      i++
    }
  }
  return { siteCode, outRoot, tables, mode }
}

async function fetchTable(client: Client, table: string): Promise<Record<string, unknown>[]> {
  // 用 * 拉全部列, mapper/dispatcher 自己挑
  const r = await client.query(`SELECT * FROM ${table}`)
  return r.rows
}

async function main() {
  const { siteCode, outRoot, tables, mode } = parseArgs()

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

  const client = new Client({ connectionString: SOURCE_URL })
  await client.connect()
  try {
    // 1. 确认源端可达
    const db = await client.query<{ db: string; ver: string }>(
      `SELECT current_database() AS db, version() AS ver`
    )
    console.log(`[export-package] source=${db.rows[0].db}`)

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
