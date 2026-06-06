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
  console.log('--- SQL 对账 (vs API 响应) ---')

  // 对照: taskCount = unified_tasks count
  const expected = await query<any>(`
    SELECT
      (SELECT COUNT(*)::int FROM unified_tasks) AS task,
      (SELECT COUNT(*)::int FROM unified_devices) AS dev,
      (SELECT COUNT(*)::int FROM unified_volumes) AS vol,
      (SELECT COUNT(*)::int FROM unified_users) AS usr,
      (SELECT COUNT(*)::int FROM sync_package_log) AS pkg,
      (SELECT COUNT(*)::int FROM sync_package_log WHERE status='failed') AS fail,
      (SELECT COUNT(DISTINCT site_code)::int FROM sync_package_log) AS sites
  `)
  const ex = expected.rows[0]
  console.log('Expected (raw SQL):', ex)

  const apiRes = await fetch('http://localhost:3000/api/dashboard/summary')
  const api = (await apiRes.json()) as any
  console.log('API:                ', api.data)
  console.log()

  const checks = [
    ['taskCount', ex.task, api.data.taskCount],
    ['deviceCount', ex.dev, api.data.deviceCount],
    ['volumeCount', ex.vol, api.data.volumeCount],
    ['userCount', ex.usr, api.data.userCount],
    ['packageCount', ex.pkg, api.data.packageCount],
    ['failedPackageCount', ex.fail, api.data.failedPackageCount],
    ['siteCount', ex.sites, api.data.siteCount],
  ] as const
  let allOk = true
  for (const [k, e, a] of checks) {
    const ok = e === a
    console.log(`  ${ok ? '✅' : '❌'} ${k}: sql=${e} api=${a}`)
    if (!ok) allOk = false
  }
  console.log(allOk ? '\nAll match.' : '\nMISMATCH detected.')

  // 单站点对账
  console.log('\n--- SQL 对账 (SH01) ---')
  const sh01 = await query<any>(`
    SELECT
      (SELECT COUNT(*)::int FROM unified_tasks WHERE source_site_id='SH01') AS task,
      (SELECT COUNT(*)::int FROM unified_devices WHERE source_site_id='SH01') AS dev,
      (SELECT COUNT(*)::int FROM unified_volumes WHERE source_site_id='SH01') AS vol,
      (SELECT COUNT(*)::int FROM sync_package_log WHERE site_code='SH01') AS pkg,
      (SELECT COUNT(*)::int FROM sync_package_log WHERE site_code='SH01' AND status='failed') AS fail
  `)
  const sh01Ex = sh01.rows[0]
  const sh01Api = await (await fetch('http://localhost:3000/api/dashboard/summary?siteCode=SH01')).json() as any
  console.log('Expected:', sh01Ex, 'API:', sh01Api.data)
}
main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => closePool())
