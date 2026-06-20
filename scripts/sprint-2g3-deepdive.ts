/**
 * Sprint 2G.3 - Step 3 (深入): 抽样 tbl_task.json_path 的可解析性
 *
 * 关注:
 *  - json_path 是否真的包含 volume_id / paths / task_type / split_rules
 *  - burn_status 数值含义
 *  - status 数值含义
 *  - ret_value / ret_msg 是否有真实信息
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

async function main() {
  const client = new Client({ connectionString: SOURCE_URL })
  await client.connect()
  try {
    // 1. status 取值分布
    const status = await client.query<{ status: number; n: string }>(
      `SELECT status, COUNT(*)::text AS n FROM tbl_task GROUP BY status ORDER BY status`
    )
    console.log('=== tbl_task.status 取值分布 ===')
    status.rows.forEach(r => console.log(`  status=${r.status}: ${r.n} 条`))

    // 2. burn_status 取值分布
    const burn = await client.query<{ burn_status: number; n: string }>(
      `SELECT burn_status, COUNT(*)::text AS n FROM tbl_task GROUP BY burn_status ORDER BY burn_status`
    )
    console.log('\n=== tbl_task.burn_status 取值分布 ===')
    burn.rows.forEach(r => console.log(`  burn_status=${r.burn_status}: ${r.n} 条`))

    // 3. ret_msg 取值分布
    const ret = await client.query<{ ret_msg: string; n: string }>(
      `SELECT COALESCE(ret_msg, '<NULL>') AS ret_msg, COUNT(*)::text AS n
       FROM tbl_task GROUP BY ret_msg ORDER BY n DESC LIMIT 20`
    )
    console.log('\n=== tbl_task.ret_msg Top 20 ===')
    ret.rows.forEach(r => console.log(`  ret_msg="${r.ret_msg.slice(0, 80)}": ${r.n} 条`))

    // 4. json_path 非 NULL 的条数
    const jsonCount = await client.query<{ with_json: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE json_path IS NOT NULL)::text AS with_json,
              COUNT(*)::text AS total FROM tbl_task`
    )
    console.log('\n=== json_path 可用性 ===')
    console.log(`  with_json_path: ${jsonCount.rows[0].with_json} / ${jsonCount.rows[0].total}`)

    // 5. 抽 3 条非空 json_path 看结构
    const jsons = await client.query<{ id: string; json_path: string }>(
      `SELECT id::text, json_path FROM tbl_task WHERE json_path IS NOT NULL LIMIT 3`
    )
    console.log('\n=== json_path 样本 (raw) ===')
    jsons.rows.forEach(r => {
      console.log(`\n--- id=${r.id} ---`)
      console.log(r.json_path)
    })

    // 6. tbl_lib_task.task_status 分布
    const lt = await client.query<{ task_status: number; n: string }>(
      `SELECT task_status, COUNT(*)::text AS n FROM tbl_lib_task GROUP BY task_status ORDER BY task_status`
    )
    console.log('\n=== tbl_lib_task.task_status 取值分布 ===')
    lt.rows.forEach(r => console.log(`  task_status=${r.task_status}: ${r.n} 条`))

    // 7. tbl_lib_task 命令 (command) 取值
    const cmd = await client.query<{ command: string; n: string }>(
      `SELECT command, COUNT(*)::text AS n FROM tbl_lib_task GROUP BY command ORDER BY n DESC LIMIT 15`
    )
    console.log('\n=== tbl_lib_task.command Top 15 ===')
    cmd.rows.forEach(r => console.log(`  ${r.command}: ${r.n} 条`))

    // 8. runtime 推算可能性: lib_task 聚合
    const runtime = await client.query<{ task_id: string; command: string; start: Date; end: Date; dur_ms: string }>(
      `SELECT task_id::text, command, MIN(start_dt) AS start, MAX(end_dt) AS end,
              (EXTRACT(EPOCH FROM (MAX(end_dt) - MIN(start_dt))) * 1000)::text AS dur_ms
       FROM tbl_lib_task
       WHERE start_dt IS NOT NULL AND end_dt IS NOT NULL
       GROUP BY task_id, command
       ORDER BY dur_ms DESC NULLS LAST
       LIMIT 5`
    )
    console.log('\n=== tbl_lib_task 推算 runtime (按 task_id+command 聚合) ===')
    runtime.rows.forEach(r => {
      console.log(`  task_id=${r.task_id} cmd=${r.command} dur=${r.dur_ms}ms start=${r.start?.toISOString()} end=${r.end?.toISOString()}`)
    })

    // 9. user_stage_failed 取值
    const usf = await client.query<{ acting: string; failed_count: string; n: string }>(
      `SELECT user_stage_acting AS acting, user_stage_failedcount::text AS failed_count, COUNT(*)::text AS n
       FROM tbl_user_task GROUP BY user_stage_acting, user_stage_failedcount ORDER BY n DESC LIMIT 10`
    )
    console.log('\n=== tbl_user_stage_acting / failedcount (用户阶段) ===')
    usf.rows.forEach(r => console.log(`  acting=${r.acting} failed=${r.failed_count}: ${r.n} 条`))
  } finally {
    await client.end()
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
