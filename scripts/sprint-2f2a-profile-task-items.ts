/**
 * Sprint 2F.2A - tbl_task_items 画像探查 (read-only)
 *
 * 目标：检查 source_restore + isolated test DB 中 tbl_task_items 的存在性、规模、字段结构、数据分布
 * 严格只读：SELECT / EXPLAIN / ANALYZE
 * 不写、不建、不删
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

async function inspectTable(label: string, connectionString: string | undefined) {
  if (!connectionString) {
    console.log(`\n[${label}] -- NO CONNECTION STRING --`)
    return
  }
  const pool = new Pool({ connectionString, max: 2 })
  try {
    // 1. 存在性
    const exists = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'tbl_task_items'
       ) as exists`
    )
    const has = exists.rows[0]?.exists
    console.log(`\n========== ${label} ==========`)
    console.log(`tbl_task_items exists: ${has}`)
    if (!has) return

    // 2. 行数
    const cnt = await pool.query<{ count: string }>(`SELECT count(*)::text as count FROM tbl_task_items`)
    console.log(`count: ${cnt.rows[0]?.count}`)

    // 3. 字段结构
    const cols = await pool.query<{ column_name: string; data_type: string; is_nullable: string }>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name='tbl_task_items'
       ORDER BY ordinal_position`
    )
    console.log(`columns (${cols.rows.length}):`)
    for (const c of cols.rows) {
      console.log(`  - ${c.column_name} : ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`)
    }

    // 4. 主键
    const pk = await pool.query<{ column_name: string; constraint_name: string }>(
      `SELECT kcu.column_name, tc.constraint_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema='public' AND tc.table_name='tbl_task_items'
         AND tc.constraint_type='PRIMARY KEY'
       ORDER BY kcu.ordinal_position`
    )
    console.log(`primary key: ${pk.rows.length === 0 ? '(none)' : pk.rows.map(r => r.column_name).join(', ')}`)

    // 5. 索引
    const idx = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname='public' AND tablename='tbl_task_items'
       ORDER BY indexname`
    )
    console.log(`indexes (${idx.rows.length}):`)
    for (const i of idx.rows) console.log(`  - ${i.indexname}: ${i.indexdef}`)

    // 6. 行数 > 0 才查分布
    if (parseInt(cnt.rows[0]?.count ?? '0') === 0) {
      console.log('(empty table, skip distribution)')
      return
    }

    // 7. 关键字段非空比例 + 路径/状态/路径长度
    const distribution = await pool.query(`
      SELECT
        count(*)                                                as total,
        count(DISTINCT task_id)                                 as distinct_task_id,
        count(*) FILTER (WHERE task_id IS NULL)                 as null_task_id,
        avg(1.0) FILTER (WHERE task_id IS NOT NULL)             as avg_dummy, -- placeholder
        max(per_task.cnt)                                       as max_per_task,
        (SELECT avg(cnt)::numeric(10,2) FROM (
           SELECT count(*) cnt FROM tbl_task_items GROUP BY task_id
         ) per_task)                                            as avg_per_task
      FROM tbl_task_items, LATERAL (
        SELECT 1
      ) dummy
    `).catch(() => null)

    // 上述 CTE 不稳，改成简单版
    const dist2 = await pool.query(`
      SELECT
        (SELECT count(*) FROM tbl_task_items)                                                    as total,
        (SELECT count(DISTINCT task_id) FROM tbl_task_items)                                     as distinct_task_id,
        (SELECT count(*) FROM tbl_task_items WHERE task_id IS NULL)                               as null_task_id
    `)
    const dt = dist2.rows[0]
    console.log(`distribution:`)
    console.log(`  total:               ${dt.total}`)
    console.log(`  distinct task_id:    ${dt.distinct_task_id}`)
    console.log(`  null task_id count:  ${dt.null_task_id}`)

    // 每 task_id 行数分布
    const perTask = await pool.query<{ cnt: string }>(
      `SELECT count(*)::text as cnt FROM tbl_task_items GROUP BY task_id`
    )
    const counts = perTask.rows.map(r => parseInt(r.cnt))
    const maxPer = counts.length ? Math.max(...counts) : 0
    const avgPer = counts.length ? (counts.reduce((a, b) => a + b, 0) / counts.length) : 0
    const sortedDesc = [...counts].sort((a, b) => b - a)
    const top10 = sortedDesc.slice(0, 10)
    console.log(`  per-task rows: avg=${avgPer.toFixed(2)}, max=${maxPer}`)
    console.log(`  per-task rows top10: [${top10.join(', ')}]`)
    if (sortedDesc.length > 10) console.log(`    (其余 ${sortedDesc.length - 10} 个 task 已被截断)`)

    // 关键字段非空比例
    const colNames = cols.rows.map(c => c.column_name)
    const nullableChecks: string[] = []
    if (colNames.includes('volume_id'))     nullableChecks.push(`count(volume_id)    as vol_nn,  round(100.0*count(volume_id)/count(*), 1)   as vol_pct`)
    if (colNames.includes('source_path'))   nullableChecks.push(`count(source_path)  as sp_nn,   round(100.0*count(source_path)/count(*), 1) as sp_pct`)
    if (colNames.includes('package_path'))  nullableChecks.push(`count(package_path) as pp_nn,   round(100.0*count(package_path)/count(*), 1) as pp_pct`)
    if (colNames.includes('file_path'))     nullableChecks.push(`count(file_path)    as fp_nn,   round(100.0*count(file_path)/count(*), 1)    as fp_pct`)
    if (colNames.includes('file_count'))    nullableChecks.push(`count(file_count)   as fc_nn,   round(100.0*count(file_count)/count(*), 1)   as fc_pct`)
    if (colNames.includes('file_size'))     nullableChecks.push(`count(file_size)    as fs_nn,   round(100.0*count(file_size)/count(*), 1)    as fs_pct`)
    if (colNames.includes('status'))        nullableChecks.push(`count(status)       as st_nn,   round(100.0*count(status)/count(*), 1)       as st_pct`)
    if (colNames.includes('create_dt'))     nullableChecks.push(`count(create_dt)    as cd_nn,   round(100.0*count(create_dt)/count(*), 1)    as cd_pct`)
    if (colNames.includes('update_dt'))     nullableChecks.push(`count(update_dt)    as ud_nn,   round(100.0*count(update_dt)/count(*), 1)    as ud_pct`)

    if (nullableChecks.length > 0) {
      const nullDist = await pool.query(`SELECT ${nullableChecks.join(', ')} FROM tbl_task_items`)
      console.log(`nullable distribution:`)
      const obj = nullDist.rows[0]
      for (const k of Object.keys(obj)) {
        console.log(`  ${k}: ${obj[k]}`)
      }
    }

    // 路径字段长度样本 (评估是否可能存大段内容)
    if (colNames.includes('source_path')) {
      const pathLen = await pool.query<{ min: number | null; max: number | null; avg: string | null }>(
        `SELECT min(length(source_path)) as min, max(length(source_path)) as max, avg(length(source_path))::numeric(10,1) as avg FROM tbl_task_items WHERE source_path IS NOT NULL`
      )
      console.log(`source_path length: min=${pathLen.rows[0]?.min}, max=${pathLen.rows[0]?.max}, avg=${pathLen.rows[0]?.avg}`)
    }
    if (colNames.includes('package_path')) {
      const pathLen = await pool.query<{ min: number | null; max: number | null; avg: string | null }>(
        `SELECT min(length(package_path)) as min, max(length(package_path)) as max, avg(length(package_path))::numeric(10,1) as avg FROM tbl_task_items WHERE package_path IS NOT NULL`
      )
      console.log(`package_path length: min=${pathLen.rows[0]?.min}, max=${pathLen.rows[0]?.max}, avg=${pathLen.rows[0]?.avg}`)
    }

    // 状态分布 (如有)
    if (colNames.includes('status')) {
      const st = await pool.query<{ status: number | string; cnt: string }>(
        `SELECT status, count(*)::text cnt FROM tbl_task_items GROUP BY status ORDER BY count(*) DESC LIMIT 10`
      )
      console.log(`status distribution (top 10):`)
      for (const r of st.rows) console.log(`  status=${r.status}: ${r.cnt}`)
    }

    // 样本 5 行
    const sample = await pool.query(`SELECT * FROM tbl_task_items LIMIT 5`)
    console.log(`sample 5 rows:`)
    for (const r of sample.rows) console.log(`  ${JSON.stringify(r).slice(0, 500)}`)

  } finally {
    await pool.end()
  }
}

async function main() {
  // 1. source_restore (生产镜像)
  await inspectTable('source_restore (production mirror)', process.env.SOURCE_DATABASE_URL)
  // 2. isolated test DB (如果有 env)
  await inspectTable('file_test (isolated test)', process.env.SOURCE_DATABASE_URL_FILE_TEST)
  await inspectTable('pg_restore_test (isolated test)', process.env.SOURCE_DATABASE_URL_TEST)
}

main().catch(e => { console.error(e); process.exit(1) })
