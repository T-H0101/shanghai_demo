/**
 * Sprint 2G.3 - Step 1: 扫描任务域相关表
 *
 * 目标:
 * 1. 列出 source_restore 中所有 tbl_* 表
 * 2. 筛选名称含 task / job / backup / certif / progress 的表
 * 3. 验证白名单 7 张表存在性
 * 4. 输出每张表的 schema (列名 + 类型)
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

// 直接连 source_restore (用于盘点, 不写入)
const SOURCE_URL = process.env.SOURCE_DATABASE_URL ?? 'postgresql://user:password@localhost:5432/source_restore'

const KEYWORDS = ['task', 'job', 'backup', 'certif', 'progress']

async function main() {
  const client = new Client({ connectionString: SOURCE_URL })
  await client.connect()
  try {
    // 1. 全部 tbl_* 表
    const allTables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE 'tbl\\_%' ESCAPE '\\'
       ORDER BY table_name`
    )
    console.log('=== ALL tbl_* tables ===')
    console.log(`Total: ${allTables.rows.length}`)
    allTables.rows.forEach(r => console.log(`  ${r.table_name}`))

    // 2. 关键词匹配
    const matched = allTables.rows.filter(r => {
      const lower = r.table_name.toLowerCase()
      return KEYWORDS.some(kw => lower.includes(kw))
    })
    console.log(`\n=== Tables matching ${JSON.stringify(KEYWORDS)} (${matched.length}) ===`)
    matched.forEach(r => console.log(`  ${r.table_name}`))

    // 3. 白名单存在性
    const whitelist = [
      'tbl_interface_task',
      'tbl_task_check',
      'tbl_task_certif_status',
      'tbl_task_history',
      'tbl_task_log',
      'tbl_hot_backup_record',
      'tbl_task_result',
    ]
    console.log(`\n=== Whitelist existence ===`)
    for (const t of whitelist) {
      const r = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM information_schema.tables
         WHERE table_schema='public' AND table_name=$1`,
        [t]
      )
      const exists = r.rows[0].count === '1'
      console.log(`  ${exists ? '✅' : '❌'} ${t}`)
    }

    // 4. 顺便列出 unified_* 已有表 (中心库) - 改连中心库
    const CENTER_URL = process.env.DATABASE_URL ?? 'postgresql://unified:password@localhost:5432/unified_disc_platform'
    const center = new Client({ connectionString: CENTER_URL })
    await center.connect()
    try {
      const unified = await center.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name LIKE 'unified\\_%' ESCAPE '\\'
         ORDER BY table_name`
      )
      console.log(`\n=== unified_* tables (中心库) ===`)
      console.log(`Total: ${unified.rows.length}`)
      unified.rows.forEach(r => console.log(`  ${r.table_name}`))
    } finally {
      await center.end()
    }
  } finally {
    await client.end()
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
