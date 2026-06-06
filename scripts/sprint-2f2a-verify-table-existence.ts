/**
 * Sprint 2F.2A - 验证 tbl_task_items 是否存在
 * 1. source_restore (生产镜像)
 * 2. unified_disc_platform (中心库)
 * 3. 列出所有 schema 名称，验证是否有非 public schema
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

async function listAllSchemasAndTables(label: string, connStr: string | undefined) {
  if (!connStr) { console.log(`[${label}] no conn`); return }
  const pool = new Pool({ connectionString: connStr, max: 2 })
  try {
    console.log(`\n========== ${label} ==========`)
    // 1. 所有 schema
    const schemas = await pool.query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
       ORDER BY schema_name`
    )
    console.log(`Schemas: ${schemas.rows.map(r => r.schema_name).join(', ')}`)

    // 2. 在每个 schema 查 tbl_task_items
    for (const sc of schemas.rows) {
      const t = await pool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_name ILIKE '%task_item%'`,
        [sc.schema_name]
      )
      if (t.rows.length > 0) {
        console.log(`  schema '${sc.schema_name}' has task_item tables: ${t.rows.map(r => r.table_name).join(', ')}`)
      }
    }

    // 3. fuzzy match (可能命名略不同)
    const fuzzy = await pool.query<{ table_schema: string; table_name: string }>(
      `SELECT table_schema, table_name FROM information_schema.tables
       WHERE table_schema NOT IN ('pg_catalog','information_schema')
         AND (table_name ILIKE '%task%item%'
           OR table_name ILIKE '%item%task%'
           OR table_name = 'tbl_task_folder'
           OR table_name = 'tbl_task_files')`
    )
    console.log(`Fuzzy match (tbl_task_items variants):`)
    if (fuzzy.rows.length === 0) {
      console.log(`  (none found)`)
    } else {
      for (const r of fuzzy.rows) console.log(`  ${r.table_schema}.${r.table_name}`)
    }
  } finally {
    await pool.end()
  }
}

async function main() {
  await listAllSchemasAndTables('source_restore', process.env.SOURCE_DATABASE_URL)
  await listAllSchemasAndTables('unified_disc_platform (central)', process.env.DATABASE_URL)
}

main().catch(e => { console.error(e); process.exit(1) })
