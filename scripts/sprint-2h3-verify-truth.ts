/**
 * Sprint 2H.3 - 验证 3 张占位表聚合后的真实落库
 *
 * 输出:
 *  1. unified_tasks.runtime_seconds 真实分布
 *  2. unified_volumes.raw_data._aggregate (来自 volume_slot) 真实分布
 *  3. unified_tasks.raw_data._aggregate.user_task_count 真实分布
 *  4. 覆盖率 A 类再统计
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

import { query } from '../lib/db'
import { closePool } from '../lib/db'

async function main() {
  const siteCode = 'SH01'

  console.log('=== unified_tasks.runtime_seconds (来自 tbl_lib_task 聚合) ===')
  const rt = await query<{
    total: string
    with_runtime: string
    null_runtime: string
    avg_runtime: string | null
    max_runtime: string | null
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE runtime_seconds IS NOT NULL AND runtime_seconds > 0)::text AS with_runtime,
       COUNT(*) FILTER (WHERE runtime_seconds IS NULL OR runtime_seconds = 0)::text AS null_runtime,
       AVG(runtime_seconds)::int::text AS avg_runtime,
       MAX(runtime_seconds)::text AS max_runtime
     FROM unified_tasks
     WHERE source_site_id=$1 AND source_table='tbl_task'`,
    [siteCode]
  )
  console.log('  ', rt.rows[0])

  console.log('\n=== unified_volumes.raw_data._aggregate (来自 tbl_volume_slot 聚合) ===')
  const vol = await query<{
    total: string
    with_agg: string
    sample: string
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE raw_data->'_aggregate'->>'source_table' = 'tbl_volume_slot')::text AS with_agg,
       COALESCE(json_agg(t) FILTER (WHERE t.rn <= 3), '[]')::text AS sample
     FROM unified_volumes v
     LEFT JOIN LATERAL (
       SELECT source_id, raw_data->'_aggregate' AS agg, ROW_NUMBER() OVER () AS rn
       FROM unified_volumes
       WHERE source_site_id=$1 AND source_table='tbl_logical_volume'
     ) t ON true
     WHERE source_site_id=$1 AND source_table='tbl_logical_volume'
     GROUP BY () LIMIT 1`,
    [siteCode]
  )
  console.log('  ', vol.rows[0])

  console.log('\n=== unified_tasks.raw_data._aggregate.user_task_count (来自 tbl_user_task) ===')
  const ut = await query<{
    total: string
    with_ut: string
    sample: string
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE raw_data->'_aggregate'->>'user_task_count' IS NOT NULL)::text AS with_ut,
       COALESCE(json_agg(t) FILTER (WHERE t.rn <= 3), '[]')::text AS sample
     FROM unified_tasks v
     LEFT JOIN LATERAL (
       SELECT source_id, raw_data->'_aggregate' AS agg, ROW_NUMBER() OVER () AS rn
       FROM unified_tasks
       WHERE source_site_id=$1 AND source_table='tbl_task'
     ) t ON true
     WHERE source_site_id=$1 AND source_table='tbl_task'
     GROUP BY () LIMIT 1`,
    [siteCode]
  )
  console.log('  ', ut.rows[0])

  console.log('\n=== sync_table_log 最近 12 条 (按 finished_at 排) ===')
  const log = await query<{ table_name: string; status: string; processed_record_count: number; inserted_count: number; updated_count: number; finished_at: Date | string }>(
    `SELECT table_name, status, processed_record_count, inserted_count, updated_count, finished_at
     FROM sync_table_log
     WHERE finished_at IS NOT NULL
     ORDER BY finished_at DESC
     LIMIT 12`
  )
  log.rows.forEach((r) => {
    const t = typeof r.finished_at === 'string' ? r.finished_at : r.finished_at?.toISOString()
    console.log(
      `  ${r.table_name.padEnd(20)} status=${r.status.padEnd(8)} processed=${r.processed_record_count} ins=${r.inserted_count} upd=${r.updated_count}  ${t}`
    )
  })

  await closePool()
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
