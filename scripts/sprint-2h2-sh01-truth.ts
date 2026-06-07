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
  const c = new Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()
  try {
    console.log('=== SH01 push 后中心表行数 ===')
    for (const t of [
      { name: 'unified_tasks',       where: `source_site_id='SH01' AND source_table='tbl_task'` },
      { name: 'unified_devices',     where: `source_site_id='SH01' AND source_table='tbl_disc_lib'` },
      { name: 'unified_magazines',   where: `source_site_id='SH01' AND source_table='tbl_magzines'` },
      { name: 'unified_slots',       where: `source_site_id='SH01' AND source_table='tbl_slots'` },
      { name: 'unified_hard_disks',  where: `source_site_id='SH01' AND source_table='tbl_hd_info'` },
      { name: 'unified_disc_media',  where: `source_site_id='SH01' AND source_table='tbl_disc'` },
      { name: 'unified_volumes',     where: `source_site_id='SH01' AND source_table='tbl_logical_volume'` },
    ]) {
      const r = await c.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM ${t.name} WHERE ${t.where}`)
      console.log(`  ${t.name.padEnd(20)} (${t.where}): ${r.rows[0].c}`)
    }
  } finally { await c.end() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
