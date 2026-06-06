/**
 * Sprint 2F.2A - 列出 source_restore 中所有 tbl_task* 表 + 测试表
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
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvLocal()

import { Pool } from 'pg'

async function listTables(label: string, connStr: string | undefined) {
  if (!connStr) { console.log(`[${label}] no conn`); return }
  const pool = new Pool({ connectionString: connStr, max: 2 })
  try {
    console.log(`\n========== ${label} ==========`)
    const r = await pool.query<{ table_name: string; size: string }>(
      `SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
       FROM information_schema.tables
       WHERE table_schema='public' AND table_name LIKE 'tbl_task%'
       ORDER BY table_name`
    )
    for (const t of r.rows) console.log(`  ${t.table_name}  ${t.size}`)

    const all = await pool.query<{ table_name: string; size: string }>(
      `SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
       FROM information_schema.tables
       WHERE table_schema='public' AND table_name LIKE 'tbl%'
       ORDER BY table_name`
    )
    console.log(`\nAll tbl* tables in ${label}:`)
    for (const t of all.rows) console.log(`  ${t.table_name}  ${t.size}`)
  } finally {
    await pool.end()
  }
}

async function main() {
  await listTables('source_restore', process.env.SOURCE_DATABASE_URL)
}

main().catch(e => { console.error(e); process.exit(1) })
