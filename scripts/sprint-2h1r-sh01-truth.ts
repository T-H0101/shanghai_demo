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

const CENTER_URL = process.env.DATABASE_URL ?? 'postgresql://unified:password@localhost:5432/unified_disc_platform'

async function main() {
  const c = new Client({ connectionString: CENTER_URL })
  await c.connect()
  try {
    // 最近 SH01 push
    const pkg = await c.query<{ id: string; batch_id: string }>(
      `SELECT id, batch_id FROM sync_package_log
       WHERE site_code = 'SH01' AND batch_id LIKE 'SH01-2026-%'
       ORDER BY started_at DESC LIMIT 1`
    )
    if (pkg.rows.length === 0) { console.log('no SH01 push found'); return }
    const pkgId = pkg.rows[0].id
    console.log(`SH01 push: ${pkg.rows[0].batch_id} (${pkgId})`)

    // 对应每张表的 table_log
    const stl = await c.query<{
      table_name: string
      processed_record_count: number
      inserted_count: number
      updated_count: number
      skipped_count: number
      failed_count: number
    }>(
      `SELECT table_name, processed_record_count, inserted_count, updated_count, skipped_count, failed_count
       FROM sync_table_log WHERE package_log_id = $1 ORDER BY id`,
      [pkgId]
    )
    console.log('\n=== SH01-2026 最近 push 的 7 张 table_log ===')
    stl.rows.forEach(r => console.log(' ', JSON.stringify(r)))

    // 中心表 SH01 行数
    console.log('\n=== 中心表 SH01 行数 (验证实际落库) ===')
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
