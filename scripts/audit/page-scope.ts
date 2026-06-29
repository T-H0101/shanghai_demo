/**
 * scripts/audit/page-scope.ts
 * R.91.1 — verify page scope: sidebar entries match actual pages, no orphan routes,
 *           command palette consistency, /check and /volumes are redirects.
 *
 * Exit codes:
 *   0 - page scope consistent
 *   2 - mismatch found
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const SIDEBAR_FILE = "components/dashboard/sidebar.tsx"
const COMMAND_PALETTE_FILE = "components/shared/command-palette.tsx"
const APP_DIR = "app"

interface ExpectedPage {
  route: string
  file: string
  label?: string
  note?: string // e.g. "redirect to /racks?view=inspection"
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
  // 以下路由保留但不在一级导航 (已合并为 redirect)
  { route: "/check", file: "app/check/page.tsx", note: "redirect to /racks?view=inspection" },
  { route: "/volumes", file: "app/volumes/page.tsx", note: "redirect to /racks?view=volumes" },
  { route: "/control", file: "app/control/page.tsx", note: "redirect to /tasks?view=commands" },
  { route: "/login", file: "app/login/page.tsx" },
]

/** Routes considered non-primary (redirects, auth-only) */
const NON_PRIMARY_ROUTES = new Set(["/check", "/volumes", "/control", "/login"])

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

/**
 * Extract navigation routes from the command palette.
 * Looks for router.push("/...") patterns inside perform functions.
 */
function getCommandPaletteRoutes(): string[] {
  let content: string
  try {
    content = readFileSync(COMMAND_PALETTE_FILE, "utf8")
  } catch {
    return [] // file not found, skip
  }
  const routes: string[] = []
  for (const line of content.split("\n")) {
    const m = line.match(/router\.push\(\s*"([^"]+)"\s*\)/)
    if (m) {
      // Strip query params for comparison
      const route = m[1].split("?")[0]
      if (!routes.includes(route)) routes.push(route)
    }
  }
  return routes
}

/**
 * Discover all page.tsx files under app/ directory.
 */
function discoverRoutes(): string[] {
  const routes: string[] = []
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".") || entry === "node_modules") continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
      } else if (entry === "page.tsx") {
        // Convert absolute path to route
        const prefix = process.cwd().replace(/\/+$/, "") + "/app/"
        const rel = full.startsWith(prefix) ? full.slice(prefix.length) : full
        const route = rel === "page.tsx" ? "/" : "/" + rel.replace(/\/page\.tsx$/, "")
        routes.push(route)
      }
    }
  }
  walk(join(process.cwd(), APP_DIR))
  return routes.sort()
}

/**
 * Check if /check/page.tsx is a simple redirect (NOT a multi-tab page).
 * Returns number of TabsTrigger/Tabs components found (> 3 = multi-tab).
 */
function checkCheckPageIsRedirect(): number {
  try {
    const content = readFileSync("app/check/page.tsx", "utf8")
    const lines = content.split("\n")
    let tabCount = 0
    for (const line of lines) {
      // Count both <Tabs and <TabsTrigger
      const tabsMatches = line.match(/<Tabs[^T]/g)
      const triggerMatches = line.match(/<TabsTrigger/g)
      tabCount += (tabsMatches?.length ?? 0) + (triggerMatches?.length ?? 0)
    }
    return tabCount
  } catch {
    return 0 // file doesn't exist
  }
}

/**
 * Check if /volumes/page.tsx is a simple redirect.
 * Returns the file's line count.
 */
function checkVolumesPageIsRedirect(): number {
  try {
    const content = readFileSync("app/volumes/page.tsx", "utf8")
    return content.split("\n").length
  } catch {
    return 0 // file doesn't exist
  }
}

function main(): number {
  let failed = 0
  const globalPassMessages: string[] = []
  const globalWarnMessages: string[] = []

  // ── Check 1: every expected page has a page.tsx ──
  console.log("=== Check 1: Page file existence ===")
  for (const p of PAGES) {
    try {
      readFileSync(p.file, "utf8")
    } catch {
      console.log(`  [FAIL] ${p.file} does not exist`)
      failed++
    }
  }
  globalPassMessages.push(`all ${PAGES.length} expected page files exist`)

  // ── Check 2: sidebar routes match primary pages ──
  console.log("\n=== Check 2: Sidebar route match ===")
  const sidebarRoutes = getSidebarRoutes()
  const primaryPages = PAGES.filter((p) => !NON_PRIMARY_ROUTES.has(p.route))

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
  globalPassMessages.push(`sidebar route check done (${sidebarRoutes.length} routes)`)

  // ── Check 3: Command palette navigation routes ──
  console.log("\n=== Check 3: Command palette navigation routes ===")
  const paletteRoutes = getCommandPaletteRoutes()
  if (paletteRoutes.length === 0) {
    console.log("  [SKIP] command-palette.tsx not found or empty")
  } else {
    for (const pr of paletteRoutes) {
      // /tasks/... sub-routes from palette filters are fine
      if (pr.startsWith("/tasks")) continue
      if (!PAGES.some((p) => p.route === pr)) {
        console.log(`  [FAIL] Command palette route "${pr}" does not match any expected page`)
        failed++
      } else {
        const page = PAGES.find((p) => p.route === pr)
        if (page && NON_PRIMARY_ROUTES.has(page.route)) {
          console.log(`  [WARN] Command palette points to non-primary route "${pr}" (${page.note ?? "no note"})`)
        }
      }
    }
    globalPassMessages.push(`command palette: ${paletteRoutes.length} navigation routes checked`)
  }

  // ── Check 4: Route auto-discovery (orphan detection) ──
  console.log("\n=== Check 4: Route auto-discovery ===")
  const discoveredRoutes = discoverRoutes()
  const expectedRoutes = new Set(PAGES.map((p) => p.route))
  for (const dr of discoveredRoutes) {
    if (!expectedRoutes.has(dr)) {
      console.log(`  [WARN] Orphan route "${dr}" has page.tsx but is not in PAGES list`)
    }
  }
  for (const p of PAGES) {
    if (!discoveredRoutes.includes(p.route)) {
      console.log(`  [FAIL] Expected route "${p.route}" (${p.file}) not found in app/ directory`)
      failed++
    }
  }
  globalPassMessages.push(`route auto-discovery: ${discoveredRoutes.length} routes found`)

  // ── Check 5: /check page multi-tab fail gate ──
  console.log("\n=== Check 5: /check page redirect gate ===")
  const checkTabCount = checkCheckPageIsRedirect()
  if (checkTabCount > 3) {
    console.log(`  [FAIL] /check/page.tsx has ${checkTabCount} TabsTrigger/Tabs components — should be a simple redirect`)
    failed++
  } else {
    globalPassMessages.push(`/check/page.tsx is a redirect (${checkTabCount} tab triggers, threshold >3)`)
  }

  // ── Check 6: /volumes standalone fail gate ──
  console.log("\n=== Check 6: /volumes page redirect gate ===")
  const volumesLineCount = checkVolumesPageIsRedirect()
  if (volumesLineCount > 10) {
    console.log(`  [FAIL] /volumes/page.tsx has ${volumesLineCount} lines — may not be a simple redirect`)
    failed++
  } else {
    globalPassMessages.push(`/volumes/page.tsx is a redirect (${volumesLineCount} lines, threshold >10)`)
  }

  // ── Summary ──
  if (failed > 0) {
    console.log(`\n[FAIL] Page scope: ${failed} failure(s)`)
    return 2
  }
  console.log("\n[PASS] Page scope consistent")
  for (const msg of globalPassMessages) {
    console.log(`  - ${msg}`)
  }
  return 0
}

process.exit(main())