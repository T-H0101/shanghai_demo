import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { query, closePool } from '../lib/db/postgres'

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
  // 1. 最新一条 package log
  const pkg = await query<any>(
    `SELECT id, site_code, batch_id, status, table_count, total_record_count, success_table_count, failed_table_count
     FROM sync_package_log
     WHERE batch_id LIKE 'SH01-%'
     ORDER BY finished_at DESC NULLS LAST
     LIMIT 3`
  )
  console.log('=== sync_package_log (SH01-*, 最近 3 条) ===')
  pkg.rows.forEach(r => console.log(' ', JSON.stringify(r)))

  // 2. 对应 table logs
  for (const row of pkg.rows) {
    const tables = await query<any>(
      `SELECT table_name, status, processed_record_count, inserted_count, updated_count, failed_count
       FROM sync_table_log WHERE package_log_id = $1 ORDER BY id`,
      [row.id]
    )
    console.log(`\n=== sync_table_log for package ${row.id} ===`)
    tables.rows.forEach(t => console.log(' ', JSON.stringify(t)))
  }

  // 3. 中心库统一表 SH01 行数
  console.log('\n=== 中心库 SH01 行数 (验证 7 张表全部入库) ===')
  for (const t of [
    { t: 'unified_tasks', where: `source_site_id='SH01' AND source_table='tbl_task'` },
    { t: 'unified_devices', where: `source_site_id='SH01' AND source_table='tbl_disc_lib'` },
    { t: 'unified_magazines', where: `source_site_id='SH01' AND source_table='tbl_magzines'` },
    { t: 'unified_slots', where: `source_site_id='SH01' AND source_table='tbl_slots'` },
    { t: 'unified_hard_disks', where: `source_site_id='SH01' AND source_table='tbl_hd_info'` },
    { t: 'unified_disc_media', where: `source_site_id='SH01' AND source_table='tbl_disc'` },
    { t: 'unified_volumes', where: `source_site_id='SH01' AND source_table='tbl_logical_volume'` },
  ]) {
    const r = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM ${t.t} WHERE ${t.where}`)
    console.log(`  ${t.t.padEnd(20)} (${t.where}): ${r.rows[0].c}`)
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => closePool())
