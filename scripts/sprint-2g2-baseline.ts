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

async function main() {
  loadEnvLocal()
  // 总览基线
  const all = await query<any>(`
    SELECT
      (SELECT COUNT(*)::int FROM unified_tasks) AS task_count,
      (SELECT COUNT(*)::int FROM unified_devices) AS device_count,
      (SELECT COUNT(*)::int FROM unified_volumes) AS volume_count,
      (SELECT COUNT(*)::int FROM unified_users) AS user_count,
      (SELECT COUNT(*)::int FROM sync_package_log) AS package_count,
      (SELECT COUNT(*)::int FROM sync_package_log WHERE status='failed') AS failed_count,
      (SELECT MAX(finished_at) FROM sync_package_log) AS last_sync,
      (SELECT COUNT(DISTINCT site_code)::int FROM sync_package_log) AS site_count
  `)
  console.log('All sites:', all.rows[0])

  // 按 site 分组基线
  for (const s of ['SH01', 'TEST_CLEAN', 'TEST_PKG', 'TEST_SMOKE']) {
    const r = await query<any>(`
      SELECT
        (SELECT COUNT(*)::int FROM unified_tasks WHERE source_site_id=$1) AS task,
        (SELECT COUNT(*)::int FROM unified_devices WHERE source_site_id=$1) AS device,
        (SELECT COUNT(*)::int FROM unified_volumes WHERE source_site_id=$1) AS vol,
        (SELECT COUNT(*)::int FROM sync_package_log WHERE site_code=$1) AS pkg,
        (SELECT COUNT(*)::int FROM sync_package_log WHERE site_code=$1 AND status='failed') AS pkg_fail
    `, [s])
    console.log(s, r.rows[0])
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => closePool())
