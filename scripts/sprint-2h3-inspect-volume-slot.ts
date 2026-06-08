/**
 * Sprint 2H.3 - inspect tbl_volume_slot actual columns
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnvLocal()

import { sourceQuery } from '../lib/db/source-pool'
import { closeSourcePool } from '../lib/db/source-pool'

async function main() {
  const cols = await sourceQuery<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='tbl_volume_slot'
     ORDER BY ordinal_position`
  )
  console.log('=== tbl_volume_slot columns ===')
  cols.rows.forEach((c) => console.log(`  ${c.column_name}: ${c.data_type}`))

  const count = await sourceQuery<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tbl_volume_slot`)
  console.log(`\nrows: ${count.rows[0].count}`)

  const sample = await sourceQuery(`SELECT * FROM tbl_volume_slot LIMIT 3`)
  console.log('\nsample:')
  sample.rows.forEach((r, i) => {
    console.log(`  [${i}]`, JSON.stringify(r))
  })

  await closeSourcePool()
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
