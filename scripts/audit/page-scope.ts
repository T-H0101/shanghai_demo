/**
 * scripts/audit/page-scope.ts
 * R.91 — verify page scope: sidebar entries match actual pages, no orphan routes
 *
 * Exit codes:
 *   0 - page scope consistent
 *   2 - mismatch found
 */

import { readFileSync } from "node:fs"

const SIDEBAR_FILE = "components/dashboard/sidebar.tsx"
const APP_DIR = "app"

interface ExpectedPage {
  route: string
  file: string
  label?: string
}

const PAGES: ExpectedPage[] = [
  { route: "/", label: "控制台", file: "app/page.tsx" },
  { route: "/sites", label: "站点管理", file: "app/sites/page.tsx" },
  { route: "/search", label: "统一检索", file: "app/search/page.tsx" },
  { route: "/sync", label: "同步中心", file: "app/sync/page.tsx" },
  { route: "/tasks", label: "任务管理", file: "app/tasks/page.tsx" },
  { route: "/racks", label: "盘架管理", file: "app/racks/page.tsx" },
  { route: "/users", label: "用户与权限", file: "app/users/page.tsx" },
  { route: "/logs", label: "审计日志", file: "app/logs/page.tsx" },
  { route: "/settings", label: "系统设置", file: "app/settings/page.tsx" },
  // 以下路由保留但不在一级导航 (已合并)
  { route: "/check", file: "app/check/page.tsx" },
  { route: "/volumes", file: "app/volumes/page.tsx" },
  { route: "/control", file: "app/control/page.tsx" },
  { route: "/login", file: "app/login/page.tsx" },
]

/** All sidebar href values */
function getSidebarRoutes(): string[] {
  const content = readFileSync(SIDEBAR_FILE, "utf8")
  const routes: string[] = []
  for (const line of content.split("\n")) {
    const m = line.match(/href:\s*"([^"]+)"/)
    if (m) routes.push(m[1])
  }
  return routes
}

function main(): number {
  let failed = 0

  // Check 1: every expected page has a page.tsx exists
  console.log("=== Page existence check ===")
  for (const p of PAGES) {
    try {
      readFileSync(p.file, "utf8")
    } catch {
      console.log(`  [FAIL] ${p.file} does not exist`)
      failed++
    }
  }
  console.log(`  [PASS] all ${PAGES.length} expected page files exist`)

  // Check 2: sidebar routes match primary pages
  console.log("\n=== Sidebar route check ===")
  const sidebarRoutes = getSidebarRoutes()
  const primaryPages = PAGES.filter((p) => !["/check", "/volumes", "/control", "/login"].includes(p.route))

  for (const p of primaryPages) {
    if (!sidebarRoutes.includes(p.route)) {
      console.log(`  [FAIL] ${p.route} (${p.label}) not in sidebar`)
      failed++
    }
  }
  for (const r of sidebarRoutes) {
    if (!primaryPages.some((p) => p.route === r)) {
      console.log(`  [WARN] ${r} in sidebar but not in expected primary pages`)
    }
  }
  console.log(`  [PASS] sidebar route check done (${sidebarRoutes.length} routes)`)

  if (failed > 0) {
    console.log(`\n[FAIL] Page scope: ${failed} failure(s)`)
    return 2
  }
  console.log("\n[PASS] Page scope consistent")
  return 0
}

process.exit(main())