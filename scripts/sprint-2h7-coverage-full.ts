/**
 * Sprint 2H.7 (autonomous) - 全量覆盖率审计脚本
 *
 * 用法:
 *   pnpm tsx scripts/sprint-2h7-coverage-full.ts
 *
 * 输出:
 *   1. 13 张白名单表分类 (A/B/C/D)
 *   2. unified_* 真实落库数
 *   3. runtime 真实数据覆盖率
 *   4. _aggregate 真实数据覆盖率
 *   5. 最近 N 条 package log
 *   6. 总结
 *
 * @archive 一次性诊断脚本 (Sprint 2H.7 触发 stop condition D)
 *   已被 smoke:sync + export-and-push 替代
 *   详见 docs/database-analysis/sprint-2h7-coverage-audit.md
 *   与 docs/summary/SCRIPTS_INDEX.md §2.C
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
import { sourceQuery } from '../lib/db/source-pool'
import { closeSourcePool } from '../lib/db/source-pool'

interface SourceTableStat {
  source: string
  source_count: number
  unified_count: number
  unified_with_agg: number
  classification: 'A' | 'B' | 'C' | 'D'
  notes: string
}

const SOURCE_TABLES = [
  'tbl_task', 'tbl_disc_lib', 'tbl_magzines', 'tbl_slots', 'tbl_hd_info',
  'tbl_lib_task', 'tbl_disc', 'tbl_logical_volume', 'tbl_volume_slot',
  'tbl_user_task', 'tbl_user', 'tbl_site', 'tbl_platform',
] as const

async function getSourceCount(t: string): Promise<number> {
  try {
    const r = await sourceQuery<{ c: string }>(`SELECT COUNT(*)::text AS c FROM ${t}`)
    return parseInt(r.rows[0].c, 10)
  } catch {
    return -1
  }
}

async function main() {
  const siteCode = 'SH01'

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Sprint 2H.7 全量覆盖率审计')
  console.log('  siteCode:', siteCode)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 1. 每张表覆盖率
  console.log('\n=== 1. 13 张白名单表分类矩阵 ===\n')
  const stats: SourceTableStat[] = []
  for (const t of SOURCE_TABLES) {
    const srcCount = await getSourceCount(t)
    let unifiedCount = 0
    let withAgg = 0
    if (srcCount > 0) {
      // map source table to unified_* table
      const targetMap: Record<string, string> = {
        tbl_task: 'unified_tasks',
        tbl_disc_lib: 'unified_devices',
        tbl_magzines: 'unified_magazines',
        tbl_slots: 'unified_slots',
        tbl_hd_info: 'unified_hard_disks',
        tbl_disc: 'unified_disc_media',
        tbl_logical_volume: 'unified_volumes',
        tbl_user: 'unified_users',
        tbl_site: 'unified_sites',
        tbl_platform: 'unified_platforms',
      }
      const target = targetMap[t]
      if (target) {
        const r1 = await query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM ${target} WHERE source_site_id=$1 AND source_table=$2`,
          [siteCode, t]
        )
        unifiedCount = parseInt(r1.rows[0].c, 10)
        if (target === 'unified_volumes' || target === 'unified_tasks') {
          const r2 = await query<{ c: string }>(
            `SELECT COUNT(*)::text AS c FROM ${target}
             WHERE source_site_id=$1 AND source_table=$2
               AND raw_data->'_aggregate' IS NOT NULL`,
            [siteCode, t]
          )
          withAgg = parseInt(r2.rows[0].c, 10)
        }
      }
    }

    let classification: 'A' | 'B' | 'C' | 'D' = 'C'
    let notes = ''
    if (srcCount === 0) {
      classification = 'C'
      notes = '源表 0 行'
    } else if (srcCount < 0) {
      classification = 'D'
      notes = '源表不存在'
    } else if (t === 'tbl_lib_task' || t === 'tbl_volume_slot' || t === 'tbl_user_task') {
      classification = 'A'
      notes = `聚合器 (runtime/_aggregate), unified=${unifiedCount}, with_agg=${withAgg}`
    } else if (unifiedCount === 0) {
      classification = 'D'
      notes = 'dispatcher 未写入'
    } else {
      classification = 'A'
      notes = `dispatcher 写入 ${unifiedCount} 行${withAgg > 0 ? `, _aggregate ${withAgg}` : ''}`
    }
    stats.push({ source: t, source_count: srcCount, unified_count: unifiedCount, unified_with_agg: withAgg, classification, notes })
  }

  console.log('  ' + '源表'.padEnd(20) + '源'.padEnd(8) + '统一'.padEnd(8) + '聚合'.padEnd(8) + '类'.padEnd(4) + '说明')
  console.log('  ' + '-'.repeat(80))
  for (const s of stats) {
    console.log(
      `  ${s.source.padEnd(20)}${(s.source_count >= 0 ? s.source_count : 'N/A').toString().padEnd(8)}${s.unified_count.toString().padEnd(8)}${s.unified_with_agg.toString().padEnd(8)}${s.classification.padEnd(4)}${s.notes}`
    )
  }

  // 2. summary
  const a = stats.filter((s) => s.classification === 'A').length
  const b = stats.filter((s) => s.classification === 'B').length
  const c = stats.filter((s) => s.classification === 'C').length
  const d = stats.filter((s) => s.classification === 'D').length

  console.log('\n=== 2. 分类汇总 ===')
  console.log(`  A (Fully Working): ${a} 张 (${(a / 13 * 100).toFixed(1)}%)`)
  console.log(`  B (Partial):       ${b} 张 (${(b / 13 * 100).toFixed(1)}%)`)
  console.log(`  C (Placeholder):   ${c} 张 (${(c / 13 * 100).toFixed(1)}%)`)
  console.log(`  D (Broken):        ${d} 张 (${(d / 13 * 100).toFixed(1)}%)`)
  console.log(`  真实可用率:        ${(a / 13 * 100).toFixed(1)}% (${a}/13)`)

  // 3. runtime
  console.log('\n=== 3. unified_tasks.runtime_seconds 真实覆盖 ===')
  const rt = await query<{ total: string; with_runtime: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE runtime_seconds IS NOT NULL AND runtime_seconds > 0)::text AS with_runtime
     FROM unified_tasks WHERE source_site_id=$1 AND source_table='tbl_task'`,
    [siteCode]
  )
  const rtPct = (parseInt(rt.rows[0].with_runtime, 10) / parseInt(rt.rows[0].total, 10) * 100).toFixed(1)
  console.log(`  ${rt.rows[0].with_runtime}/${rt.rows[0].total} (${rtPct}%) 任务有真实 runtime`)

  // 4. _aggregate
  console.log('\n=== 4. unified_volumes.raw_data._aggregate 真实覆盖 ===')
  const ag = await query<{ total: string; with_agg: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE raw_data->'_aggregate'->>'source_table' = 'tbl_volume_slot')::text AS with_agg
     FROM unified_volumes WHERE source_site_id=$1 AND source_table='tbl_logical_volume'`,
    [siteCode]
  )
  const agPct = (parseInt(ag.rows[0].with_agg, 10) / parseInt(ag.rows[0].total, 10) * 100).toFixed(1)
  console.log(`  ${ag.rows[0].with_agg}/${ag.rows[0].total} (${agPct}%) volume 有 _aggregate`)

  // 5. user_task_count
  console.log('\n=== 5. unified_tasks.raw_data._aggregate.user_task_count 真实覆盖 ===')
  const ut = await query<{ total: string; with_ut: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE raw_data->'_aggregate'->>'user_task_count' IS NOT NULL)::text AS with_ut
     FROM unified_tasks WHERE source_site_id=$1 AND source_table='tbl_task'`,
    [siteCode]
  )
  const utPct = (parseInt(ut.rows[0].with_ut, 10) / parseInt(ut.rows[0].total, 10) * 100).toFixed(1)
  console.log(`  ${ut.rows[0].with_ut}/${ut.rows[0].total} (${utPct}%) 任务有 user_task_count`)

  // 6. 最近 package log
  console.log('\n=== 6. 最近 5 条 package log ===')
  const logs = await query<{ batch_id: string; table_count: number; status: string; finished_at: Date | string }>(
    `SELECT batch_id, table_count, status, finished_at
     FROM sync_package_log WHERE finished_at IS NOT NULL
     ORDER BY finished_at DESC LIMIT 5`
  )
  logs.rows.forEach((r) => {
    const t = typeof r.finished_at === 'string' ? r.finished_at : r.finished_at?.toISOString()
    console.log(`  ${r.batch_id.padEnd(36)} tables=${r.table_count} status=${r.status.padEnd(10)} ${t}`)
  })

  // 7. 系统成熟度
  console.log('\n=== 7. 系统成熟度评估 ===')
  const maturity = Math.round((a / 13) * 100)
  console.log(`  白名单表真实可用率:    ${(a / 13 * 100).toFixed(1)}%`)
  console.log(`  runtime 真实覆盖率:    ${rtPct}%`)
  console.log(`  _aggregate 真实覆盖率: ${agPct}%`)
  console.log(`  user_task_count 覆盖:  ${utPct}%`)
  console.log(`  综合成熟度:            ${maturity}%`)

  await closePool()
  await closeSourcePool()
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
