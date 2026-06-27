/**
 * Sprint R.83.6 Task 3 — /check page UI self-check (extends R.83.5)
 *
 * Verifies:
 *   - /check page renders 11 tab triggers
 *     (概览/检查分类/检查任务/巡检策略/日志/存储卷/调度运维/数据接收/告警媒体/系统配置/ISO与文件/导入导出/监控运维)
 *   - 6 check API endpoints return 200 with envelope { code: 0, data: { items, total, sourceTables } }
 *   - 4 R.83.4 + R.83.5 API endpoints return 200 with same envelope
 *   - 3 R.83.6 API endpoints return 200 with same envelope
 *   - 3 forbidden patterns are absent from components/check/:
 *       SOURCE_DATABASE_URL, SITE_DATABASE_URL, site_restore_full
 *   - 5 misleading copy terms are absent from components/check/:
 *       已禁用 / 已暂停 / 已修复 / 控制成功 / 暂停成功
 *
 * Total checks (≥27):
 *   a) HTML content / tab label present (10)
 *   b) API smoke (9 endpoints)
 *   c) Tab structure (11 tab labels)
 *   d) No restore DB refs (3)
 *   e) No misleading copy (5)
 *                                                  = 38
 *
 * Usage:
 *   pnpm exec tsx components/check/__tests__/self-check.ts
 */

import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "playwright"

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000"
const REPO_ROOT = process.env.REPO_ROOT ?? process.cwd()

interface CheckResult {
  name: string
  ok: boolean
  detail?: string
}

const results: CheckResult[] = []

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail })
  const tag = ok ? "PASS" : "FAIL"
  const suffix = detail ? `  (${detail})` : ""
  console.log(`  [${tag}] ${name}${suffix}`)
}

async function httpJson(
  method: string,
  path: string,
): Promise<{ status: number; body: any }> {
  const url = new URL(path, BASE)
  const res = await fetch(url.toString(), { method, cache: "no-store" })
  let body: any = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body }
}

async function ensureDevServer(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/`)
    if (r.ok) return true
  } catch {
    // not up
  }
  console.log("Dev server not detected; spawning `pnpm dev` ...")
  const child = spawn("pnpm", ["dev"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: process.env,
  })
  child.unref()

  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    try {
      const r = await fetch(`${BASE}/`)
      if (r.ok) return true
    } catch {
      // retry
    }
  }
  try {
    const r = await fetch(`${BASE}/`)
    return r.ok
  } catch {
    return false
  }
}

function collectFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of entries) {
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      collectFiles(full, acc)
    } else if (st.isFile()) {
      acc.push(full)
    }
  }
  return acc
}

function grepCount(file: string, pattern: string): number {
  try {
    const content = readFileSync(file, "utf8")
    return content.split(pattern).length - 1
  } catch {
    return 0
  }
}

function expectEnvelope(name: string, body: any): void {
  const ok =
    body?.code === 0 &&
    Array.isArray(body?.data?.items) &&
    typeof body?.data?.total === "number" &&
    Array.isArray(body?.data?.sourceTables)
  record(name, ok, ok ? `total=${body.data.total}` : `shape mismatch`)
}

async function main() {
  const up = await ensureDevServer()
  if (!up) {
    console.error("Dev server failed to start")
    process.exit(2)
  }

  console.log(`\n=== a + c) Browser-rendered /check page (10 + 11 = 21 checks) ===`)
  // /check page is auth-gated by RouteGuard (AppShell wrapper). Login first.
  const browser = await chromium.launch({ headless: true })
  try {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    const loginRes = await page.request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin", siteCode: "SH01" },
    })
    if (!loginRes.ok()) {
      console.error("Login failed:", loginRes.status(), await loginRes.text())
      process.exit(2)
    }

    const response = await page.goto(`${BASE}/check`, { waitUntil: "domcontentloaded" })
    const status = response?.status() ?? 0
    record("GET /check status=200", status === 200, `status=${status}`)

    // Wait for tabs to render (Radix Tabs renders TabsTriggers as buttons).
    try {
      await page.waitForSelector('button[role="tab"]:has-text("概览")', { timeout: 10000 })
    } catch {
      // continue; checks below will fail
    }

    // a) HTML content / tab label present (12 — add R.83.7)
    const requiredLabels = [
      "检查分类",
      "检查任务",
      "巡检策略",
      "日志",
      "存储卷",
      "调度运维",
      "数据接收",
      "告警媒体",
      "系统配置",
      "ISO 与文件",
      "导入导出",
      "监控运维",
    ]
    for (const label of requiredLabels) {
      const found = await page.locator(`button[role="tab"]:has-text("${label}")`).count()
      record(`HTML contains ${label}`, found > 0, `count=${found}`)
    }

    // c) Tab structure (13 tab labels — 7 from R.83.4 + 2 R.83.5 + 2 R.83.6 + 2 R.83.7)
    const requiredTabs = [
      "概览",
      "检查分类",
      "检查任务",
      "巡检策略",
      "日志",
      "存储卷",
      "调度运维",
      "数据接收",
      "告警媒体",
      "系统配置",
      "ISO 与文件",
      "导入导出",
      "监控运维",
    ]
// Check for tab text "ISO 与文件" — its label is rendered with non-breaking spaces; use a partial match.
    for (const t of requiredTabs) {
      const selector = t === "ISO 与文件"
        ? 'button[role="tab"] >> text=/ISO.*文件/'
        : `button[role="tab"]:has-text("${t}")`
      const found = await page.locator(selector).count()
      record(`Tab text present: ${t}`, found > 0, `count=${found}`)
    }
  } finally {
    await browser.close()
  }

  console.log(`\n=== b) API smoke (9 checks) ===`)
  for (const resource of [
    "check/inspections",
    "check/patrols",
    "volume/storage",
    "schedule/ops",
    "data/receive",
    "early-warning",
    "system-config",
    "iso",
    "file-ops",
    "import-export",
    "monitor",
    "system-aux",
  ]) {
    const r = await httpJson("GET", `/api/${resource}`)
    if (r.status !== 200) {
      record(`[${resource}] API 200`, false, `status=${r.status}`)
      continue
    }
    expectEnvelope(`[${resource}] envelope shape`, r.body)
  }

  console.log(`\n=== d) No restore DB refs (3 checks) ===`)
  // Exclude the test file itself (it contains the forbidden strings as test data).
  const checkDir = join(REPO_ROOT, "components", "check")
  const checkFiles = collectFiles(checkDir).filter(
    (f) => !f.includes(`${join("check", "__tests__")}`),
  )
  for (const forbidden of ["SOURCE_DATABASE_URL", "SITE_DATABASE_URL", "site_restore_full"]) {
    let totalHits = 0
    for (const f of checkFiles) {
      totalHits += grepCount(f, forbidden)
    }
    record(
      `No "${forbidden}" in components/check/`,
      totalHits === 0,
      `hits=${totalHits} files=${checkFiles.length}`,
    )
  }

  console.log(`\n=== e) No misleading copy (5 checks) ===`)
  for (const forbidden of ["已禁用", "已暂停", "已修复", "控制成功", "暂停成功"]) {
    let totalHits = 0
    for (const f of checkFiles) {
      totalHits += grepCount(f, forbidden)
    }
    record(
      `No "${forbidden}" in components/check/`,
      totalHits === 0,
      `hits=${totalHits} files=${checkFiles.length}`,
    )
  }

  const failed = results.filter((r) => !r.ok)
  const passed = results.length - failed.length
  console.log(`\nSummary: ${passed}/${results.length} PASS, ${failed.length} FAIL`)

  if (failed.length > 0) {
    console.log("\nFailures:")
    for (const f of failed) {
      console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`)
    }
    process.exit(1)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error("Self-check crashed:", e)
  process.exit(1)
})
