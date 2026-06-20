/**
 * Sprint 2H.1R - Dispatcher 覆盖率 Reality Check
 *
 * 对每张 package 支持表 (13 张) 输出:
 *  - source_count (source_restore)
 *  - package_received (sync_table_log 聚合)
 *  - inserted/updated/skipped/failed
 *  - unified_count (unified_* 行数)
 *  - dispatcher_implementation (从代码 + 行为反推)
 *
 * 输出分类 A/B/C/D
 */

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

const SOURCE_URL = process.env.SOURCE_DATABASE_URL ?? 'postgresql://localhost:5432/source_restore'
const CENTER_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/unified_disc_platform'

const TABLES: { src: string; target: string | null }[] = [
  { src: 'tbl_task',           target: 'unified_tasks' },
  { src: 'tbl_disc_lib',       target: 'unified_devices' },
  { src: 'tbl_magzines',       target: 'unified_magazines' },
  { src: 'tbl_slots',          target: 'unified_slots' },
  { src: 'tbl_hd_info',        target: 'unified_hard_disks' },
  { src: 'tbl_lib_task',       target: null }, // 占位, 不直接落库
  { src: 'tbl_disc',           target: 'unified_disc_media' },
  { src: 'tbl_logical_volume', target: 'unified_volumes' },
  { src: 'tbl_volume_slot',    target: null }, // 占位
  { src: 'tbl_user_task',      target: null }, // 占位
  { src: 'tbl_user',           target: 'unified_users' },
  { src: 'tbl_site',           target: 'unified_sites' },
  { src: 'tbl_platform',       target: 'unified_platforms' },
]

async function main() {
  const src = new Client({ connectionString: SOURCE_URL })
  const ctr = new Client({ connectionString: CENTER_URL })
  await src.connect()
  await ctr.connect()

  // 1. 拿全部 sync_table_log 聚合 (最近 30 天)
  const stl = await ctr.query<{
    table_name: string
    received: string
    inserted: string
    updated: string
    skipped: string
    failed: string
    last_status: string
    last_run: Date
  }>(
    `SELECT table_name,
            SUM(processed_record_count)::text AS received,
            SUM(inserted_count)::text AS inserted,
            SUM(updated_count)::text AS updated,
            SUM(skipped_count)::text AS skipped,
            SUM(failed_count)::text AS failed,
            (array_agg(status ORDER BY started_at DESC))[1] AS last_status,
            MAX(started_at) AS last_run
     FROM sync_table_log
     GROUP BY table_name
     ORDER BY table_name`
  )
  const stlMap = new Map(stl.rows.map(r => [r.table_name, r]))

  console.log('=========================================')
  console.log('  Dispatcher 覆盖率 Reality Check')
  console.log('=========================================\n')

  const report: { src: string; target: string | null; cls: string; note: string }[] = []

  for (const t of TABLES) {
    let srcCount: number | null = null
    const srcExists = (await src.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [t.src]
    )).rows[0].c === '1'
    if (srcExists) {
      const r = await src.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM ${t.src}`)
      srcCount = parseInt(r.rows[0].c, 10)
    }

    let unifiedCount: number | null = null
    if (t.target) {
      const r = await ctr.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM ${t.target}`)
      unifiedCount = parseInt(r.rows[0].c, 10)
    }

    const stlRow = stlMap.get(t.src)
    const received = stlRow ? parseInt(stlRow.received, 10) : 0
    const inserted = stlRow ? parseInt(stlRow.inserted, 10) : 0
    const updated = stlRow ? parseInt(stlRow.updated, 10) : 0
    const skipped = stlRow ? parseInt(stlRow.skipped, 10) : 0
    const failed = stlRow ? parseInt(stlRow.failed, 10) : 0
    const lastStatus = stlRow?.last_status ?? '—'
    const lastRun = stlRow?.last_run?.toISOString() ?? '—'

    // 分类
    let cls = 'D'
    let note = ''
    if (t.src === 'tbl_lib_task' || t.src === 'tbl_volume_slot' || t.src === 'tbl_user_task') {
      cls = 'C'
      note = '占位 (skip: true, 不落库, 设计上由聚合器后置)'
    } else if (t.src === 'tbl_user' || t.src === 'tbl_site' || t.src === 'tbl_platform' || t.src === 'tbl_task' || t.src === 'tbl_disc_lib' || t.src === 'tbl_hd_info' || t.src === 'tbl_disc') {
      // 7 张表: 走完整 upsert
      if (received > 0 && inserted > 0) {
        cls = 'A'
        note = 'Fully Working (真实写入 unified_*)'
      } else if (received > 0 && inserted === 0) {
        cls = 'D'
        note = '有 package 但 inserted=0 (可能列名/source_id 错配)'
      } else {
        cls = 'C'
        note = '从未通过 package 推过 (仅 import:xxx 路线)'
      }
    } else {
      // tbl_magzines / tbl_slots / tbl_logical_volume - inline upsert
      if (received > 0 && inserted > 0) {
        cls = 'A'
        note = 'Fully Working'
      } else if (received > 0 && inserted === 0) {
        cls = 'D'
        note = '有 package 但 inserted=0 (源表 schema 与 dispatcher 期望的列名不匹配)'
      } else {
        cls = 'C'
        note = '从未通过 package 推过'
      }
    }

    report.push({ src: t.src, target: t.target, cls, note })

    console.log(`[${cls}] ${t.src.padEnd(20)} → ${(t.target ?? '∅').padEnd(22)}`)
    console.log(`  source_count:      ${srcCount ?? 'N/A (不存在)'}`)
    console.log(`  package_received:  ${received}`)
    console.log(`  inserted:          ${inserted}`)
    console.log(`  updated:           ${updated}`)
    console.log(`  skipped:           ${skipped}`)
    console.log(`  failed:            ${failed}`)
    console.log(`  last_status:       ${lastStatus}`)
    console.log(`  last_run:          ${lastRun}`)
    console.log(`  unified_count:     ${unifiedCount ?? 'N/A'}`)
    console.log(`  → ${note}`)
    console.log('')
  }

  console.log('=========================================')
  console.log('  分类汇总')
  console.log('=========================================\n')
  const buckets: Record<string, string[]> = { A: [], B: [], C: [], D: [] }
  for (const r of report) buckets[r.cls].push(r.src)
  for (const k of ['A', 'B', 'C', 'D'] as const) {
    console.log(`  ${k} (${countLabel(k)}): ${buckets[k].length} 张 — ${buckets[k].join(', ') || '∅'}`)
  }

  function countLabel(cls: string): string {
    switch (cls) {
      case 'A': return 'Fully Working'
      case 'B': return 'Partial'
      case 'C': return 'Placeholder'
      case 'D': return 'Broken'
      default: return cls
    }
  }

  await src.end()
  await ctr.end()
}
main().catch(e => { console.error(e); process.exitCode = 1 })
