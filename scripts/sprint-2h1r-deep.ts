/**
 * Sprint 2H.1R - Step 3: 验证 sourceId 解析是否真错配
 *
 * 3 张 inline upsert 表 (magzines/slots/logical_volume):
 *   - dispatcher 用 sourceIdField: 'id'
 *   - 但 source_restore 表的 id 是 bigint, 中心表 source_id 是 text
 *   - 如果 source 表里同一个 id 多次出现, ON CONFLICT 会跳过
 *   - 实际 inserted_count 反映的是 "新增 vs 已存在"
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

const SOURCE_URL = process.env.SOURCE_DATABASE_URL ?? 'postgresql://user:password@localhost:5432/source_restore'
const CENTER_URL = process.env.DATABASE_URL ?? 'postgresql://unified:password@localhost:5432/unified_disc_platform'

async function main() {
  const src = new Client({ connectionString: SOURCE_URL })
  const ctr = new Client({ connectionString: CENTER_URL })
  await src.connect()
  await ctr.connect()
  try {
    for (const t of [
      { src: 'tbl_magzines', target: 'unified_magazines' },
      { src: 'tbl_slots', target: 'unified_slots' },
      { src: 'tbl_logical_volume', target: 'unified_volumes' },
      { src: 'tbl_hd_info', target: 'unified_hard_disks' },
      { src: 'tbl_disc', target: 'unified_disc_media' },
    ]) {
      console.log(`\n=== ${t.src} → ${t.target} ===`)
      // 1. 源表 id 分布 (唯一 vs 重复)
      const dup = await src.query<{ uniq_id: string; total: string; rows: string }>(
        `SELECT COUNT(DISTINCT id)::text AS uniq_id, COUNT(*)::text AS total,
                (COUNT(*) - COUNT(DISTINCT id))::text AS rows
         FROM ${t.src}`
      )
      console.log(`  src.id distinct: ${dup.rows[0].uniq_id} / total: ${dup.rows[0].total} (重复 ${dup.rows[0].rows})`)

      // 2. 中心表 (source_table = this) 行数
      const u = await ctr.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM ${t.target} WHERE source_table = $1`,
        [t.src]
      )
      console.log(`  unified_*.source_table='${t.src}' rows: ${u.rows[0].c}`)

      // 3. 中心表 source_id 唯一性
      const uu = await ctr.query<{ uniq: string; total: string }>(
        `SELECT COUNT(DISTINCT source_id)::text AS uniq, COUNT(*)::text AS total
         FROM ${t.target} WHERE source_table = $1`,
        [t.src]
      )
      console.log(`  unified_*.source_id distinct: ${uu.rows[0].uniq} / total: ${uu.rows[0].total}`)

      // 4. 抽样中心表 source_id
      const sample = await ctr.query<{ source_id: string }>(
        `SELECT source_id FROM ${t.target} WHERE source_table = $1 LIMIT 5`,
        [t.src]
      )
      console.log(`  unified_*.source_id sample: ${sample.rows.map(r => r.source_id).join(', ')}`)
    }
  } finally {
    await src.end()
    await ctr.end()
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
