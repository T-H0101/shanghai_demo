/**
 * Sprint 2G.3 - Step 2 + 3: 表画像 + 抽样
 *
 * 输出每张表:
 *  - 是否存在
 *  - 行数
 *  - 是否有数据
 *  - 主键 (通过 information_schema 或 pg_index 推断)
 *  - 是否有 task_id
 *  - 是否有进度/错误/时间/状态字段
 *  - 抽样前 5 行
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
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

const SOURCE_URL = process.env.SOURCE_DATABASE_URL ?? 'postgresql://localhost:5432/source_restore'

const TABLES = ['tbl_task', 'tbl_lib_task', 'tbl_user_task']

const PROGRESS_KEYWORDS = ['progress', 'percent', 'ratio', 'ratio_', 'pct', 'step', 'phase']
const ERROR_KEYWORDS = ['error', 'err', 'fail', 'message', 'reason']
const TIME_KEYWORDS = ['time', 'date', 'at_', '_at', 'stamp', 'timestamp']
const STATUS_KEYWORDS = ['status', 'state', 'phase', 'step']

function matchAny(name: string, kws: string[]): boolean {
  const lower = name.toLowerCase()
  return kws.some(k => lower.includes(k))
}

interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
}

async function describe(client: Client, table: string) {
  const cols = await client.query<ColumnInfo>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1
     ORDER BY ordinal_position`,
    [table]
  )
  return cols.rows
}

async function primaryKey(client: Client, table: string): Promise<string[]> {
  const r = await client.query<{ column_name: string }>(
    `SELECT a.attname AS column_name
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = ($1)::regclass AND i.indisprimary`,
    [table]
  )
  return r.rows.map(x => x.column_name)
}

async function count(client: Client, table: string): Promise<number> {
  const r = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`)
  return parseInt(r.rows[0].count, 10)
}

async function sample(client: Client, table: string, n = 5) {
  const r = await client.query(`SELECT * FROM ${table} LIMIT ${n}`)
  return r.rows
}

async function main() {
  const client = new Client({ connectionString: SOURCE_URL })
  await client.connect()
  try {
    for (const t of TABLES) {
      console.log('\n========================================')
      console.log(`TABLE: ${t}`)
      console.log('========================================')

      const exists = (await client.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
        [t]
      )).rows[0].c === '1'
      if (!exists) {
        console.log('  ❌ DOES NOT EXIST')
        continue
      }

      const rowCount = await count(client, t)
      const cols = await describe(client, t)
      const pk = await primaryKey(client, t)

      console.log(`  rows: ${rowCount}`)
      console.log(`  hasData: ${rowCount > 0 ? '✅' : '❌ empty'}`)
      console.log(`  pk: [${pk.join(', ')}]`)
      console.log(`  column count: ${cols.length}`)

      const colNames = cols.map(c => c.column_name)
      const hasTaskId = colNames.some(c => /^id$|task_id|taskid/i.test(c))
      const hasProgress = colNames.some(c => matchAny(c, PROGRESS_KEYWORDS))
      const hasError = colNames.some(c => matchAny(c, ERROR_KEYWORDS))
      const hasTime = colNames.some(c => matchAny(c, TIME_KEYWORDS))
      const hasStatus = colNames.some(c => matchAny(c, STATUS_KEYWORDS))

      console.log(`  task_id-like: ${hasTaskId ? '✅' : '—'} (${colNames.filter(c => /^id$|task_id|taskid/i.test(c)).join(', ') || 'none'})`)
      console.log(`  progress-like: ${hasProgress ? '✅' : '—'}`)
      console.log(`  error-like: ${hasError ? '✅' : '—'}`)
      console.log(`  time-like: ${hasTime ? '✅' : '—'}`)
      console.log(`  status-like: ${hasStatus ? '✅' : '—'}`)

      console.log(`  --- columns ---`)
      cols.forEach(c => console.log(`    ${c.column_name} : ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`))

      if (rowCount > 0) {
        console.log(`  --- sample 5 rows ---`)
        const rows = await sample(client, t, 5)
        rows.forEach((r, i) => {
          console.log(`    [${i + 1}]`, JSON.stringify(r))
        })
      }
    }
  } finally {
    await client.end()
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
