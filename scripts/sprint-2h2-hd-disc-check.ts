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
async function m() {
  const c = new Client({ connectionString: process.env.SOURCE_DATABASE_URL })
  await c.connect()
  for (const t of ['tbl_hd_info', 'tbl_disc']) {
    const r = await c.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [t])
    console.log(t + ':', r.rows.map(x=>x.column_name).join(', '))
  }
  await c.end()
}
m().catch(console.error)
