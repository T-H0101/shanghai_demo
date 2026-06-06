/**
 * Sprint 2F.3 - verify SH01 disc data and tasks progress
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

async function main() {
  const source = new Pool({ connectionString: process.env.SOURCE_DATABASE_URL, max: 2 })
  const target = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  console.log('--- source.tbl_task ---')
  const srcTask = await source.query(`SELECT count(*) as cnt FROM tbl_task`)
  console.log(`  count: ${srcTask.rows[0]?.cnt}`)

  const srcCols = await source.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tbl_task' ORDER BY ordinal_position`)
  console.log(`  columns: ${srcCols.rows.map(r => r.column_name).join(', ')}`)

  const srcTask2 = await source.query(`SELECT * FROM tbl_task ORDER BY id LIMIT 3`)
  for (const r of srcTask2.rows) console.log(`  ${JSON.stringify(r).slice(0, 300)}`)

  console.log('--- source.tbl_disc ---')
  const srcDisc = await source.query(`SELECT count(*) as cnt FROM tbl_disc`)
  console.log(`  count: ${srcDisc.rows[0]?.cnt}`)

  const srcDiscCols = await source.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tbl_disc' ORDER BY ordinal_position`)
  console.log(`  columns: ${srcDiscCols.rows.map(r => r.column_name).join(', ')}`)

  const srcDisc2 = await source.query(`SELECT * FROM tbl_disc ORDER BY task_id LIMIT 5`)
  for (const r of srcDisc2.rows) console.log(`  ${JSON.stringify(r).slice(0, 300)}`)

  console.log('--- target.unified_tasks (first 3) ---')
  const tgt = await target.query(`SELECT source_id, task_no, source_site_id, runtime_seconds, package_count, success_count, error_count, progress, current_phase, task_mode, error_message FROM unified_tasks WHERE source_site_id='SH01' ORDER BY source_id LIMIT 5`)
  for (const r of tgt.rows) console.log(`  ${JSON.stringify(r)}`)

  await source.end()
  await target.end()
}

main().catch(e => { console.error(e); process.exit(1) })
