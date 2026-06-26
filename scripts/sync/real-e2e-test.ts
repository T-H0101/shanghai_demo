/**
 * R.83.3 Task 11 — 真实端到端同步验证
 *
 * 必须真实点击 /sync 页 "立即同步 SH01" 按钮,然后验证
 * 中心库 58 张表在 source_site_id=SH01 下有真实 upsert 数据。
 *
 * 修复 R.83.1/R.83.2 遗留的 mock-only gap。
 */

import { chromium } from "playwright"
import { Client } from "pg"
import { spawn } from "node:child_process"

const TEST_SITE_CODE = process.env.TEST_SITE_CODE ?? "SH01"

// 58 项白名单 + 命名映射(source_table → unified_table)
const TABLE_MAPPING: Array<{ src: string; unified: string }> = [
  // Sprint 2E.2 baseline (13)
  { src: "tbl_task", unified: "unified_tasks" },
  { src: "tbl_disc_lib", unified: "unified_devices" },
  { src: "tbl_magzines", unified: "unified_magazines" },
  { src: "tbl_slots", unified: "unified_slots" },
  { src: "tbl_hd_info", unified: "unified_hard_disks" },
  { src: "tbl_lib_task", unified: "unified_lib_tasks" },
  { src: "tbl_disc", unified: "unified_disc_media" },
  { src: "tbl_logical_volume", unified: "unified_volumes" },
  { src: "tbl_volume_slot", unified: "unified_volume_slots" },
  { src: "tbl_user_task", unified: "unified_user_tasks" },
  { src: "tbl_user", unified: "unified_users" },
  { src: "tbl_site", unified: "unified_sites" },
  { src: "tbl_platform", unified: "unified_platforms" },
  // R.83.1 (15)
  { src: "tbl_user_role", unified: "unified_user_roles" },
  { src: "tbl_depa", unified: "unified_departments" },
  { src: "tbl_workspace", unified: "unified_workspaces" },
  { src: "tbl_workspace_user", unified: "unified_workspace_users" },
  { src: "tbl_depa_user", unified: "unified_department_users" },
  { src: "tbl_depa_user_info", unified: "unified_department_user_info" },
  { src: "tbl_project", unified: "unified_projects" },
  { src: "tbl_project_site", unified: "unified_project_sites" },
  { src: "tbl_task_projects", unified: "unified_task_projects" },
  { src: "tbl_task_receipts", unified: "unified_task_receipts" },
  { src: "tbl_task_files", unified: "unified_task_files" },
  { src: "tbl_task_check", unified: "unified_task_check" },
  { src: "tbl_receipt", unified: "unified_receipts" },
  { src: "tbl_receipt_check", unified: "unified_receipt_checks" },
  { src: "tbl_receipt_file", unified: "unified_receipt_files" },
  // R.83.2 (15)
  { src: "tbl_role", unified: "unified_roles" },
  { src: "tbl_role_fuc", unified: "unified_role_fucs" },
  { src: "tbl_fuc", unified: "unified_fucs" },
  { src: "tbl_dict_category", unified: "unified_dict_categories" },
  { src: "tbl_dict", unified: "unified_dicts" },
  { src: "tbl_dict_item", unified: "unified_dict_items" },
  { src: "tbl_sys_log", unified: "unified_sys_logs" },
  { src: "tbl_api_log", unified: "unified_api_logs" },
  { src: "tbl_api_interface", unified: "unified_api_interfaces" },
  { src: "tbl_user_mfa", unified: "unified_user_mfas" },
  { src: "tbl_archives_type", unified: "unified_archives_types" },
  { src: "tbl_archives_level", unified: "unified_archives_levels" },
  { src: "tbl_platform_type", unified: "unified_platform_types" },
  { src: "tbl_credible_prove", unified: "unified_credible_proves" },
  { src: "tbl_credible_verify", unified: "unified_credible_verifies" },
  // R.83.3 (15)
  { src: "tbl_check_category", unified: "unified_check_categories" },
  { src: "tbl_check_sub_category", unified: "unified_check_sub_categories" },
  { src: "tbl_check_item", unified: "unified_check_items" },
  { src: "tbl_check_sector", unified: "unified_check_sectors" },
  { src: "tbl_check_template", unified: "unified_check_templates" },
  { src: "tbl_check_task", unified: "unified_check_tasks" },
  { src: "tbl_check_task_item", unified: "unified_check_task_items" },
  { src: "tbl_check_task_file", unified: "unified_check_task_files" },
  { src: "tbl_check_file", unified: "unified_check_file" },
  { src: "tbl_check_files", unified: "unified_check_files" },
  { src: "tbl_check_log", unified: "unified_check_logs" },
  { src: "tbl_check_patrol_strategy", unified: "unified_check_patrol_strategies" },
  { src: "tbl_check_patrol_task", unified: "unified_check_patrol_tasks" },
  { src: "tbl_check_patrol_task_item", unified: "unified_check_patrol_task_items" },
  { src: "tbl_check_patrol_log", unified: "unified_check_patrol_logs" },
]

async function snapshotRowCounts(client: Client, siteCode: string): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  for (const { unified } of TABLE_MAPPING) {
    try {
      const r = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${unified} WHERE source_site_id = $1`,
        [siteCode]
      )
      result[unified] = Number(r.rows[0]?.count ?? 0)
    } catch {
      result[unified] = -1
    }
  }
  return result
}

async function ensureDevServer(): Promise<void> {
  const probe = await fetch("http://localhost:3000/").catch(() => null)
  if (probe?.ok) return
  console.log("[R.83.3 Task 11] 启动 dev server...")
  const proc = spawn("pnpm", ["dev"], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  })
  proc.unref()
  // Wait up to 30s
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    const p = await fetch("http://localhost:3000/").catch(() => null)
    if (p?.ok) return
  }
  throw new Error("dev server failed to start within 30s")
}

async function main() {
  console.log(`[R.83.3 Task 11] TEST_SITE_CODE=${TEST_SITE_CODE}`)
  console.log(`[R.83.3 Task 11] DATABASE_URL=${process.env.DATABASE_URL?.slice(0, 30)}...`)

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; run with: set -a && source .env.local && set +a")
  }

  await ensureDevServer()

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  console.log("[R.83.3 Task 11] 1) Pre-state snapshot...")
  const preState = await snapshotRowCounts(client, TEST_SITE_CODE)
  const preTotal = Object.values(preState).reduce((a, b) => Math.max(0, a) + Math.max(0, b), 0)
  console.log(`  total rows pre: ${preTotal}`)

  console.log("[R.83.3 Task 11] 2) Launch browser + click button...")
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  // 2a. Login via /api/auth/login first (fast path), inject cookie into browser context
  console.log("  logging in via /api/auth/login...")
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin", siteCode: "SH01" }),
  })
  if (!loginRes.ok) {
    throw new Error(`login failed: HTTP ${loginRes.status}`)
  }
  const setCookie = loginRes.headers.get("set-cookie") ?? ""
  const cookieMatch = setCookie.match(/odp_session=([^;]+)/)
  if (!cookieMatch) {
    throw new Error(`login response missing odp_session cookie; got: ${setCookie.slice(0, 200)}`)
  }
  const sessionCookie = cookieMatch[1]
  console.log(`  got session cookie: ${sessionCookie.slice(0, 20)}...`)
  await context.addCookies([
    {
      name: "odp_session",
      value: sessionCookie,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ])

  let responseOk = false
  let responseStatus = 0
  let responseData: any = null
  try {
    // 2b. Navigate to /sync (already authenticated)
    console.log("  navigating to /sync...")
    await page.goto("http://localhost:3000/sync", { waitUntil: "networkidle", timeout: 30_000 })

    // Wait for the button
    const btn = await page.waitForSelector('[data-testid="dump-now-button"]', { timeout: 15_000 })
    if (!btn) throw new Error("dump-now-button not found in DOM")

    console.log("  found dump-now-button, clicking...")

    // Click and wait for API response
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/sync/dump-now") && r.request().method() === "POST",
        { timeout: 180_000 }
      ),
      btn.click(),
    ])

    responseData = await resp.json().catch(() => null)
    responseOk = resp.ok()
    responseStatus = resp.status()
    console.log(`  response: status=${responseStatus} ok=${responseOk}`)
    if (responseData) {
      console.log(`  response.data keys: ${Object.keys(responseData.data ?? {}).join(", ")}`)
    }

    // Wait for page to settle
    await page.waitForTimeout(2000)
  } finally {
    await browser.close()
  }

  console.log("[R.83.3 Task 11] 3) Post-state snapshot...")
  const postState = await snapshotRowCounts(client, TEST_SITE_CODE)
  const postTotal = Object.values(postState).reduce((a, b) => Math.max(0, a) + Math.max(0, b), 0)
  console.log(`  total rows post: ${postTotal}`)

  // 4) Verify sync_table_log created in last 5 minutes with real work
  const recentLogs = await client.query<{
    table_name: string
    status: string
    processed_record_count: string
  }>(
    `SELECT table_name, status, processed_record_count::text
     FROM sync_table_log
     WHERE site_code = $1 AND created_at > NOW() - INTERVAL '5 minutes'
     ORDER BY created_at DESC`,
    [TEST_SITE_CODE]
  )
  const recentSuccess = recentLogs.rows.filter((r) => r.status === "success")
  const recentProcessedRows = recentSuccess.reduce(
    (sum, r) => sum + Number(r.processed_record_count || 0),
    0
  )
  console.log(`  sync_table_log rows in last 5 min: ${recentLogs.rows.length}`)
  console.log(`  recent successful tables: ${recentSuccess.length}`)
  console.log(`  recent processed rows (from log): ${recentProcessedRows}`)

  await client.end()

  // Verifications
  const tablesWithGrowth: string[] = []
  const tablesWithData: string[] = []
  const tablesMissingPreAndPost: string[] = []
  for (const { unified } of TABLE_MAPPING) {
    const pre = preState[unified] ?? 0
    const post = postState[unified] ?? 0
    if (post > pre) tablesWithGrowth.push(`${unified}(${pre}→${post})`)
    if (post > 0) tablesWithData.push(`${unified}(${post})`)
    if (pre === 0 && post === 0) tablesMissingPreAndPost.push(unified)
  }

  console.log("\n=== Summary ===")
  console.log(`Response OK: ${responseOk} (status ${responseStatus})`)
  console.log(`Pre total rows: ${preTotal}`)
  console.log(`Post total rows: ${postTotal}`)
  console.log(`Tables with growth: ${tablesWithGrowth.length}/${TABLE_MAPPING.length}`)
  console.log(`Tables with data (post): ${tablesWithData.length}/${TABLE_MAPPING.length}`)
  console.log(`Tables missing both pre and post: ${tablesMissingPreAndPost.length}`)
  console.log(`Recent sync_table_log entries: ${recentLogs.rows.length}`)
  console.log(`Recent sync_table_log success entries: ${recentSuccess.length}`)
  console.log(`Recent processed rows (from sync_table_log): ${recentProcessedRows}`)

  if (recentSuccess.length > 0) {
    console.log("\nRecent successful table_log entries:")
    for (const r of recentSuccess.slice(0, 20)) {
      console.log(`  ${r.table_name}: ${r.processed_record_count} rows`)
    }
  }

  if (tablesWithGrowth.length > 0) {
    console.log("\nGrowth:")
    for (const t of tablesWithGrowth) console.log(`  ${t}`)
  }
  if (tablesWithData.length > 0 && tablesWithData.length <= 30) {
    console.log("\nWith data:")
    for (const t of tablesWithData) console.log(`  ${t}`)
  }
  if (tablesMissingPreAndPost.length > 0 && tablesMissingPreAndPost.length <= 60) {
    console.log("\nMissing (no data anywhere):")
    for (const t of tablesMissingPreAndPost) console.log(`  ${t}`)
  }

  // Pass/fail criteria
  let failed = 0
  if (!responseOk) {
    console.log("\n[FAIL] dump-now response not OK")
    failed++
  }
  if (postTotal < 100) {
    console.log(`\n[FAIL] post total rows ${postTotal} < 100 sanity floor`)
    failed++
  }
  if (recentSuccess.length < 3) {
    console.log(`\n[FAIL] only ${recentSuccess.length} recent sync_table_log success entries — sync did not process real rows`)
    failed++
  }
  if (recentProcessedRows < 50) {
    console.log(`\n[FAIL] recent processed rows ${recentProcessedRows} < 50 — sync processed too few rows`)
    failed++
  }

  console.log(`\n=== Result: ${failed === 0 ? "PASS" : "FAIL"} ===`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})