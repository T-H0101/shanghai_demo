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
const CENTER_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/unified_disc_platform'

async function main() {
  const src = new Client({ connectionString: SOURCE_URL })
  const ctr = new Client({ connectionString: CENTER_URL })
  await src.connect()
  await ctr.connect()
  try {
    for (const t of [
      { src: 'tbl_magzines', ctr: 'unified_magazines' },
      { src: 'tbl_slots', ctr: 'unified_slots' },
      { src: 'tbl_logical_volume', ctr: 'unified_volumes' },
    ]) {
      console.log(`\n=== ${t.src} (source) → ${t.ctr} (center) ===`)
      const sc = await src.query<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
        [t.src]
      )
      console.log('  src columns:')
      sc.rows.forEach(r => console.log(`    ${r.column_name} (${r.data_type})`))

      const cc = await ctr.query<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
        [t.ctr]
      )
      console.log('  ctr columns:')
      cc.rows.forEach(r => console.log(`    ${r.column_name} (${r.data_type})`))
    }
  } finally {
    await src.end()
    await ctr.end()
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
