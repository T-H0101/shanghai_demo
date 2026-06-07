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

const SOURCE_URL = process.env.SOURCE_DATABASE_URL ?? 'postgresql://user:password@localhost:5432/source_restore'

async function main() {
  const c = new Client({ connectionString: SOURCE_URL })
  await c.connect()
  try {
    for (const t of ['tbl_magzines', 'tbl_slots', 'tbl_logical_volume', 'tbl_hd_info', 'tbl_disc']) {
      console.log(`\n=== ${t} ===`)
      const cols = await c.query<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
        [t]
      )
      cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`))

      const pk = await c.query<{ column_name: string }>(
        `SELECT a.attname AS column_name
         FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
         WHERE i.indrelid = ($1)::regclass AND i.indisprimary`,
        [t]
      )
      console.log(`  PK: [${pk.rows.map(r => r.column_name).join(', ') || 'none'}]`)
    }
  } finally { await c.end() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
