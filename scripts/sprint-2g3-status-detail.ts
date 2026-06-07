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

async function main() {
  const c = new Client({ connectionString: process.env.SOURCE_DATABASE_URL })
  await c.connect()
  try {
    const r = await c.query<{ id: string; status: number; burn_status: number; task_type: number; ret_value: number; ret_msg: string; create_dt: string; update_dt: string; dur: string }>(`
      SELECT id::text, status, burn_status, task_type, ret_value, ret_msg,
             create_dt::text, update_dt::text,
             (update_dt - create_dt)::text AS dur
      FROM tbl_task
      ORDER BY status, burn_status, id
    `)
    console.log('=== status x burn_status x task_type 完整画像 (37 行) ===')
    r.rows.forEach(row => {
      console.log(`  id=${row.id} status=${row.status} burn=${row.burn_status} type=${row.task_type} ret_v=${row.ret_value} ret="${row.ret_msg}" dur=${row.dur}`)
    })
  } finally { await c.end() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
