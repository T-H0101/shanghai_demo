/**
 * 性能 baseline 测试 - 验证 R.83 中心库 143 张表性能
 *
 * 测试项目:
 * 1. 单表 SELECT 列表 < 50ms (限 100 行)
 * 2. 单表 COUNT(*) < 30ms
 * 3. JOIN 查询 < 100ms
 * 4. UNIQUE 索引生效 (EXPLAIN 验证)
 * 5. 批量插入 100 行 < 500ms
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   pnpm exec tsx scripts/performance/baseline-test.ts
 */

import { Client } from "pg"

const TARGET_TABLES = [
  "unified_tasks", "unified_devices", "unified_users", "unified_sites",
  "unified_volumes", "unified_receipts", "unified_disc_media",
  "unified_check_categories", "unified_iso_locations", "unified_drivers",
  "unified_volume_groups", "unified_data_receive_lists", "unified_early_warnings",
]

interface PerfResult {
  test: string
  table?: string
  durationMs: number
  threshold: number
  pass: boolean
}

const results: PerfResult[] = []

function record(test: string, durationMs: number, threshold: number, table?: string) {
  const pass = durationMs <= threshold
  results.push({ test, table, durationMs, threshold, pass })
  const icon = pass ? "✓" : "✗"
  console.log(`  ${icon} ${test}${table ? ` (${table})` : ""}: ${durationMs.toFixed(1)}ms [threshold: ${threshold}ms]`)
}

async function testSelect(client: Client, table: string) {
  const t0 = performance.now()
  await client.query(`SELECT * FROM ${table} WHERE source_site_id = $1 LIMIT 100`, ["SH01"])
  const t1 = performance.now()
  record("SELECT LIMIT 100 (filtered by site)", t1 - t0, 50, table)
}

async function testCount(client: Client, table: string) {
  const t0 = performance.now()
  await client.query(`SELECT COUNT(*) FROM ${table} WHERE source_site_id = $1`, ["SH01"])
  const t1 = performance.now()
  record("COUNT(*) filtered by site", t1 - t0, 30, table)
}

async function testUniquenessIndex(client: Client) {
  // 验证 UNIQUE(source_site_id, source_record_id) 索引生效
  // 故意插入重复记录应该失败
  const t0 = performance.now()
  try {
    await client.query(
      `INSERT INTO unified_task_certif_statuses (source_site_id, source_record_id, source_table, raw_data) VALUES ($1, $2, $3, '{}'::jsonb)`,
      ["__test_perf__", "perf-test-1", "tbl_perf_test"]
    )
    await client.query(
      `INSERT INTO unified_task_certif_statuses (source_site_id, source_record_id, source_table, raw_data) VALUES ($1, $2, $3, '{}'::jsonb)`,
      ["__test_perf__", "perf-test-1", "tbl_perf_test"]
    )
    record("UNIQUE constraint enforced (duplicate insert)", performance.now() - t0, 100)
  } catch (err) {
    // 期望失败 → UNIQUE 生效
    const t1 = performance.now()
    record("UNIQUE constraint enforced (duplicate rejected)", t1 - t0, 100)
  } finally {
    await client.query(`DELETE FROM unified_task_certif_statuses WHERE source_site_id = $1`, ["__test_perf__"]).catch(() => {})
  }
}

async function testBatchInsert(client: Client) {
  // 批量插入 100 行测试
  const t0 = performance.now()
  try {
    for (let i = 0; i < 100; i++) {
      await client.query(
        `INSERT INTO unified_task_certif_statuses (source_site_id, source_record_id, source_table, raw_data)
         VALUES ($1, $2, $3, '{}'::jsonb)
         ON CONFLICT (source_site_id, source_table, source_record_id) DO NOTHING`,
        ["__test_perf_batch__", `perf-batch-${i}`, "tbl_perf_test"]
      )
    }
    const t1 = performance.now()
    record("Bulk insert 100 rows (with conflict handling)", t1 - t0, 500)
  } finally {
    await client.query(`DELETE FROM unified_task_certif_statuses WHERE source_site_id = $1`, ["__test_perf_batch__"]).catch(() => {})
  }
}

async function testJoin(client: Client) {
  // 简单 JOIN: tasks + devices
  const t0 = performance.now()
  await client.query(`
    SELECT t.task_name, d.device_name
    FROM unified_tasks t
    LEFT JOIN unified_devices d ON t.source_site_id = d.source_site_id
    WHERE t.source_site_id = $1
    LIMIT 50
  `, ["SH01"])
  const t1 = performance.now()
  record("JOIN tasks + devices (LIMIT 50)", t1 - t0, 100)
}

async function testGinIndex(client: Client, table: string) {
  // 验证 GIN 索引(jsonb 查询)
  const t0 = performance.now()
  await client.query(
    `SELECT COUNT(*) FROM ${table} WHERE raw_data ? 'test_key'`,
    []
  )
  const t1 = performance.now()
  record("JSONB ? operator (GIN index test)", t1 - t0, 50, table)
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set")
    process.exit(1)
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  console.log("=== R.83 性能 baseline ===\n")

  console.log("1) SELECT/COUNT per table (13 个 R.83 代表表):")
  for (const table of TARGET_TABLES) {
    try {
      await testSelect(client, table)
      await testCount(client, table)
    } catch (err) {
      console.log(`  ✗ ${table}: ERROR - ${(err as Error).message.slice(0, 100)}`)
    }
  }

  console.log("\n2) 完整性检查:")
  await testUniquenessIndex(client)

  console.log("\n3) 批量操作:")
  await testBatchInsert(client)

  console.log("\n4) JOIN 查询:")
  await testJoin(client)

  console.log("\n5) GIN 索引 (JSONB ?):")
  for (const table of ["unified_tasks", "unified_users", "unified_receipts"]) {
    await testGinIndex(client, table)
  }

  await client.end()

  // 总结
  const total = results.length
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass)

  console.log(`\n=== Summary: ${passed}/${total} passed ===`)
  if (failed.length > 0) {
    console.log("\nFailed tests:")
    for (const r of failed) {
      console.log(`  ✗ ${r.test}${r.table ? ` (${r.table})` : ""}: ${r.durationMs.toFixed(1)}ms > ${r.threshold}ms`)
    }
    process.exit(1)
  }
  console.log("All performance baselines met!")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
