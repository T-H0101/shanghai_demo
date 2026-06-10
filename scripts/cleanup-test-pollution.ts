/**
 * cleanup-test-pollution.ts
 * Sprint R.7B — 清理中心库历史测试污染数据
 *
 * 清理 unified_disc_platform 中 SH01 站点下，源站点库不存在的 source_id。
 *
 * 用法:
 *   pnpm tsx scripts/cleanup-test-pollution.ts              # dry-run (默认)
 *   pnpm tsx scripts/cleanup-test-pollution.ts --execute    # 真删
 *
 * 安全:
 *   - 只删 SH01 + 确认污染 source_id
 *   - 事务执行
 *   - 干删前打印 row count
 *   - 不删 source_restore / star_storage_db
 *   - 不按 name 模糊删除
 */

import { query, transaction } from '@/lib/db/postgres'

const DRY_RUN = !process.argv.includes('--execute')

// R.7A 确认的污染 source_id (不在 star_storage_db 对应源表中)
const POLLUTION: Record<string, { table: string; column: string; ids: string[] }> = {
  unified_tasks: {
    table: 'unified_tasks',
    column: 'source_id',
    ids: ['100', '101', '200', '300', '8888', 'TASK_2026_001', 'TASK_2026_002'],
  },
  unified_devices: {
    table: 'unified_devices',
    column: 'source_id',
    ids: ['5001', '5002', 'DEV_001', 'DEV_002'],
  },
  unified_volumes: {
    table: 'unified_volumes',
    column: 'source_id',
    ids: ['VOL_001', 'VOL_002'],
  },
}

async function main() {
  console.log(`=== R.7B 清理中心库污染数据 ===`)
  console.log(`模式: ${DRY_RUN ? 'DRY-RUN (--execute 才真删)' : 'EXECUTE (真删)'}`)
  console.log(`站点: SH01`)
  console.log()

  // 1. 打印候选行
  for (const [tbl, cfg] of Object.entries(POLLUTION)) {
    const placeholders = cfg.ids.map((_, i) => `$${i + 2}`).join(', ')
    const rows = await query<{ source_id: string; created_at: string }>(
      `SELECT source_id, created_at::text
       FROM ${tbl}
       WHERE source_site_id = $1 AND ${cfg.column} IN (${placeholders})
       ORDER BY source_id`,
      ['SH01', ...cfg.ids]
    )
    console.log(`[${tbl}] 候选删除: ${rows.rows.length} 行`)
    for (const r of rows.rows) {
      console.log(`  ${r.source_id} (created: ${r.created_at})`)
    }
  }

  console.log()

  if (DRY_RUN) {
    console.log('DRY-RUN 完成。加 --execute 真删。')
    return
  }

  // 2. 事务删除
  const result = await transaction(async (client) => {
    const deleted: Record<string, number> = {}
    for (const [tbl, cfg] of Object.entries(POLLUTION)) {
      const placeholders = cfg.ids.map((_, i) => `$${i + 2}`).join(', ')
      const r = await client.query(
        `DELETE FROM ${tbl}
         WHERE source_site_id = $1 AND ${cfg.column} IN (${placeholders})`,
        ['SH01', ...cfg.ids]
      )
      deleted[tbl] = r.rowCount ?? 0
    }
    return deleted
  })

  console.log('删除完成:')
  for (const [tbl, count] of Object.entries(result)) {
    console.log(`  ${tbl}: ${count} 行`)
  }

  // 3. 验证
  console.log()
  console.log('验证 (删除后):')
  for (const [tbl, cfg] of Object.entries(POLLUTION)) {
    const placeholders = cfg.ids.map((_, i) => `$${i + 2}`).join(', ')
    const r = await query<{ cnt: string }>(
      `SELECT count(*)::text as cnt FROM ${tbl}
       WHERE source_site_id = $1 AND ${cfg.column} IN (${placeholders})`,
      ['SH01', ...cfg.ids]
    )
    console.log(`  ${tbl}: ${r.rows[0].cnt} 行 (应为 0)`)
  }

  console.log()
  console.log('清理完成。运行 pnpm check:sync-consistency -- SH01 验证一致性。')
}

main().catch((err) => {
  console.error('清理失败:', err)
  process.exit(1)
})
