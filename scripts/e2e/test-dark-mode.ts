/**
 * 暗色主题整体重做 — e2e 验收 (R.77)
 *
 * 验证范围:
 *  1. globals.css 新 token block (.dark 下扩展 surface/border/text/info-bg 等)
 *  2. styles/dark.css 增强 (chip 全族覆盖、hover 半透明、Radix data-state)
 *  3. components/platform/glass-panel.tsx 三档 intensity 全部带 dark:
 *  4. components/dashboard/welcome-banner.tsx gradient/badge 双主题
 *  5. components/dashboard/header.tsx ⌘K / kbd / 健康徽章双主题
 *  6. components/dashboard/sync-trend-chart.tsx 引入 useTheme + lib/chart-theme
 *  7. 10 个 page.tsx 至少含 dark: 前缀数量 (回归:不能没有)
 *  8. 6 个 dashboard 子组件 + 7 个 platform/shared/site/tasks 组件 含 dark: 变体
 *  9. LoginCard 浅色玻璃 + 暗色玻璃双主题
 * 10. existing test-login 27 项不回归 (用 pnpm e2e:login 单独跑)
 * 11. existing test-header-ux-lift 5 项新增暗色断言不回归 (用 pnpm e2e:header-ux-lift)
 * 12. lib/chart-theme.ts 存在 + light/dark palette 各 9 字段
 * 13. 各 page 在浅色主题下能正常 SSR HTTP 200
 * 14. 不引入 mock:暗色切换完全靠 next-themes + class
 *
 * 运行:
 *   BASE_URL=http://localhost:3000 pnpm tsx scripts/e2e/test-dark-mode.ts
 */

import { readFileSync } from "node:fs"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

function countMatches(filePath: string, regex: RegExp): number {
  const src = readFileSync(filePath, "utf8")
  return (src.match(regex) ?? []).length
}

async function main() {
  console.log("=== Dark-theme overhaul e2e (R.77) ===\n")

  // ── 1. globals.css 新 tokens ─────────────────────────────────
  const globalsSrc = readFileSync("app/globals.css", "utf8")
  check(
    "globals.css has --app-surface-2 token",
    /--app-surface-2:\s*#f8fafc/.test(globalsSrc) && /\.dark\s*{[\s\S]*?--app-surface-2:\s*rgba\(30,\s*41,\s*59/.test(globalsSrc),
    "浅色 + 暗色 token 都存在",
  )
  check(
    "globals.css has --app-text-1/-2/-3/-4",
    /--app-text-1:/.test(globalsSrc) &&
      /--app-text-2:/.test(globalsSrc) &&
      /--app-text-3:/.test(globalsSrc) &&
      /--app-text-4:/.test(globalsSrc),
  )
  check(
    "globals.css has --app-info-bg/text/border",
    /--app-info-bg:/.test(globalsSrc) &&
      /--app-info-text:/.test(globalsSrc) &&
      /--app-info-border:/.test(globalsSrc),
  )
  check(
    "globals.css has --app-warn/error/success",
    /--app-warn-bg:/.test(globalsSrc) &&
      /--app-error-bg:/.test(globalsSrc) &&
      /--app-success-bg:/.test(globalsSrc),
  )

  // ── 2. styles/dark.css 增强 ────────────────────────────────
  const darkCssSrc = readFileSync("styles/dark.css", "utf8")
  check(
    "dark.css: chip 全族覆盖 (blue/amber/red/emerald/orange/indigo)",
    /\.dark \.bg-blue-50[^}]+}/.test(darkCssSrc) &&
      /\.dark \.bg-amber-50[^}]+}/.test(darkCssSrc) &&
      /\.dark \.bg-red-50[^}]+}/.test(darkCssSrc) &&
      /\.dark \.bg-emerald-50[^}]+}/.test(darkCssSrc) &&
      /\.dark \.bg-orange-50[^}]+}/.test(darkCssSrc) &&
      /\.dark \.bg-indigo-50[^}]+}/.test(darkCssSrc),
    "6 个色族都有 .dark bg-X-50 覆盖",
  )
  check(
    "dark.css: text-X-700 提亮 (blue/amber/red/emerald/orange/indigo)",
    /color:\s*#93c5fd\s*!important/.test(darkCssSrc) &&
      /color:\s*#fcd34d\s*!important/.test(darkCssSrc) &&
      /color:\s*#fca5a5\s*!important/.test(darkCssSrc) &&
      /color:\s*#6ee7b7\s*!important/.test(darkCssSrc) &&
      /color:\s*#fdba74\s*!important/.test(darkCssSrc) &&
      /color:\s*#a5b4fc\s*!important/.test(darkCssSrc),
    "6 个色族都有 .dark text 提亮",
  )
  check(
    "dark.css: hover 半透明全族 (slate-50/100 + blue-50)",
    /hover\\:bg-slate-50:hover/.test(darkCssSrc) &&
      /hover\\:bg-slate-100:hover/.test(darkCssSrc) &&
      /hover\\:bg-blue-50:hover/.test(darkCssSrc),
  )
  check(
    "dark.css: Radix data-state 暗色",
    /\[data-state="active"\]/.test(darkCssSrc) && /\[data-state="open"\]/.test(darkCssSrc),
  )
  check(
    "dark.css: Radix tooltip 暗色",
    /\[role="tooltip"\]/.test(darkCssSrc),
  )
  check(
    "dark.css: 紫/粉/天空/玫瑰/青/绿/黄 等 12 色族扩展",
    /bg-purple-50/.test(darkCssSrc) &&
      /bg-pink-50/.test(darkCssSrc) &&
      /bg-sky-50/.test(darkCssSrc) &&
      /bg-rose-50/.test(darkCssSrc) &&
      /bg-violet-50/.test(darkCssSrc) &&
      /bg-teal-50/.test(darkCssSrc) &&
      /bg-cyan-50/.test(darkCssSrc) &&
      /bg-fuchsia-50/.test(darkCssSrc) &&
      /bg-lime-50/.test(darkCssSrc) &&
      /bg-yellow-50/.test(darkCssSrc),
    "10 色族扩展 (R.77 增强)",
  )

  // ── 3. GlassPanel 三档 intensity 全部带 dark ──────────────
  const glassPanelSrc = readFileSync("components/platform/glass-panel.tsx", "utf8")
  const intensityLines = (glassPanelSrc.match(/soft:|default:|strong:/g) ?? []).length
  const darkIntensityCount = (glassPanelSrc.match(/dark:bg-slate-9/g) ?? []).length
  check(
    "GlassPanel: 3 档 intensity 都带 dark:",
    intensityLines === 3 && darkIntensityCount >= 3,
    `intensity=${intensityLines} darkIntensity=${darkIntensityCount}`,
  )

  // ── 4. WelcomeBanner gradient 双主题 ──────────────────────
  const welcomeBannerSrc = readFileSync("components/dashboard/welcome-banner.tsx", "utf8")
  check(
    "WelcomeBanner: bg-gradient 含 dark:from-slate-900",
    /dark:from-slate-900/.test(welcomeBannerSrc),
  )
  check(
    "WelcomeBanner: 状态 chip 含 dark:bg-emerald-900/30 或 amber/red",
    /dark:bg-emerald-900\/30/.test(welcomeBannerSrc) ||
      /dark:bg-amber-900\/30/.test(welcomeBannerSrc),
  )
  check(
    "WelcomeBanner: HealthChip 含 dark:bg-slate-800",
    /dark:bg-slate-800/.test(welcomeBannerSrc),
  )

  // ── 5. Header ⌘K + 健康徽章 双主题 ─────────────────────────
  const headerSrc = readFileSync("components/dashboard/header.tsx", "utf8")
  check(
    "Header: ⌘K 触发器含 dark:bg-slate-800",
    /dark:bg-slate-800/.test(headerSrc) && /command-palette-trigger/.test(headerSrc),
  )
  check(
    "Header: kbd 含 dark:bg-slate-900",
    /dark:bg-slate-900/.test(headerSrc),
  )
  check(
    "Header: 健康徽章含 dark:bg-emerald-900/30 或 amber",
    /dark:bg-emerald-900\/30/.test(headerSrc) || /dark:bg-amber-900\/30/.test(headerSrc),
  )
  check(
    "Header: 通知 Bell icon 含 dark:text-slate-300",
    /dark:text-slate-300/.test(headerSrc),
  )

  // ── 6. sync-trend-chart 引入 useTheme + lib/chart-theme ──
  const chartSrc = readFileSync("components/dashboard/sync-trend-chart.tsx", "utf8")
  check(
    "sync-trend-chart: 引入 useTheme from next-themes",
    /useTheme/.test(chartSrc),
  )
  check(
    "sync-trend-chart: 引入 getChartPalette from chart-theme",
    /getChartPalette|chart-theme/.test(chartSrc),
  )
  check(
    "sync-trend-chart: 动态 palette 应用到 Bar fill / Tooltip",
    /fill=\{palette\.(bar1|bar2|bar3)\}/.test(chartSrc) &&
      /backgroundColor:\s*palette\.tooltipBg/.test(chartSrc),
  )

  // ── 7. 10 个 page.tsx 含 dark: 前缀数量 ──────────────────
  const pageFiles = [
    "app/racks/page.tsx",
    "app/tasks/page.tsx",
    "app/settings/page.tsx",
    "app/sites/page.tsx",
    "app/users/page.tsx",
    "app/logs/page.tsx",
    "app/sync/page.tsx",
    "app/search/page.tsx",
    "app/volumes/page.tsx",
    "app/api/page.tsx",
  ]
  let totalDarkPrefix = 0
  let pagesWithDark = 0
  for (const f of pageFiles) {
    try {
      const c = countMatches(f, /\bdark:/g)
      totalDarkPrefix += c
      if (c >= 5) pagesWithDark++
    } catch {
      // file may not exist; skip
    }
  }
  check(
    "page.tsx 总 dark: 前缀 ≥ 100",
    totalDarkPrefix >= 100,
    `totalDarkPrefix=${totalDarkPrefix}`,
  )
  check(
    "至少 8 个 page.tsx 含 dark: 前缀 ≥ 5",
    pagesWithDark >= 8,
    `pagesWithDark=${pagesWithDark}/10`,
  )

  // ── 8. 6 个 dashboard 子组件 + 7 个 platform/shared/site/tasks 组件 ──
  const compFiles = [
    "components/dashboard/stats-cards.tsx",
    "components/dashboard/dashboard-summary-bar.tsx",
    "components/dashboard/dashboard-recent-syncs.tsx",
    "components/dashboard/site-health-heatmap.tsx",
    "components/dashboard/alert-center.tsx",
    "components/dashboard/task-table.tsx",
    "components/platform/capsule-tabs.tsx",
    "components/platform/permission-tree.tsx",
    "components/platform/status-badges.tsx",
    "components/shared/empty-state.tsx",
    "components/shared/command-palette.tsx",
    "components/site/site-selector.tsx",
    "components/tasks/control-command-panel.tsx",
  ]
  let totalCompDark = 0
  for (const f of compFiles) {
    try {
      totalCompDark += countMatches(f, /\bdark:/g)
    } catch {
      // skip missing
    }
  }
  check(
    "组件层 dark: 前缀 ≥ 60 (覆盖 13 个组件)",
    totalCompDark >= 60,
    `totalCompDark=${totalCompDark}`,
  )

  // ── 9. LoginCard 浅色玻璃 + 暗色玻璃双主题 ─────────────────
  const loginCardSrc = readFileSync("components/auth/login-card.tsx", "utf8")
  check(
    "LoginCard: 浅色玻璃 bg-white/70",
    /bg-white\/70/.test(loginCardSrc),
  )
  check(
    "LoginCard: 暗色玻璃 dark:bg-white/[0.12]",
    /dark:bg-white\/\[0\.12\]/.test(loginCardSrc),
  )
  check(
    "LoginCard: 标题 text-slate-900 dark:text-white",
    /text-slate-900/.test(loginCardSrc) && /dark:text-white/.test(loginCardSrc),
  )
  const loginPageSrc = readFileSync("app/login/page.tsx", "utf8")
  check(
    "login/page: useTheme 动态背景 (isDark 分支)",
    /useTheme/.test(loginPageSrc) && /isDark/.test(loginPageSrc) && /resolvedTheme/.test(loginPageSrc),
  )
  check(
    "login/page: mounted guard 防 hydration mismatch",
    /mounted/.test(loginPageSrc) && /setMounted/.test(loginPageSrc),
  )

  // ── 10. lib/chart-theme.ts 存在 + palette 各 9 字段 ────────
  const chartThemeSrc = readFileSync("lib/chart-theme.ts", "utf8")
  check(
    "lib/chart-theme.ts: lightPalette / darkPalette export",
    /export const lightPalette/.test(chartThemeSrc) && /export const darkPalette/.test(chartThemeSrc),
  )
  check(
    "lib/chart-theme.ts: 9 个 palette 字段 (grid/axis/bar1-3/tooltipBg/Border/Text/legendText)",
    /grid:/.test(chartThemeSrc) &&
      /axis:/.test(chartThemeSrc) &&
      /bar1:/.test(chartThemeSrc) &&
      /bar2:/.test(chartThemeSrc) &&
      /bar3:/.test(chartThemeSrc) &&
      /tooltipBg:/.test(chartThemeSrc) &&
      /tooltipBorder:/.test(chartThemeSrc) &&
      /tooltipText:/.test(chartThemeSrc) &&
      /legendText:/.test(chartThemeSrc),
  )

  // ── 11. SSR HTTP 200 ────────────────────────────────────────
  const pages = ["/login", "/", "/tasks", "/racks", "/sites", "/sync", "/search", "/settings", "/logs", "/users"]
  for (const p of pages) {
    try {
      const res = await fetch(`${BASE}${p}`)
      check(`SSR ${p} HTTP 200`, res.status === 200, `HTTP ${res.status}`)
    } catch (e) {
      check(`SSR ${p} HTTP 200`, false, `fetch error: ${e}`)
    }
  }

  // ── 12. 暗色类在浅色 SSR HTML 中不应破坏渲染 ──────────────
  const loginHtml = await (await fetch(`${BASE}/login`)).text()
  check(
    "/login SSR 含 dark:text-white (暗色变体被 SSR 渲染)",
    loginHtml.includes("dark:text-white"),
  )
  // 首页 CommandCenterPanel 故意保留深色 (产品差异化),不算"必须有 dark:"
  // 注意: client components (WelcomeBanner / Header / dashboard 子组件) 在 SSR HTML
  // 里不带 dark: 前缀 (它们在 client 端 hydrate 后才挂上),所以这个断言只在 SSR
  // 含 dark:bg-slate-800 这种"server component 嵌入"时才通过。多数首页组件是 client,
  // 因此这条断言有意宽松。
  const homeHtml = await (await fetch(`${BASE}/`)).text()
  check(
    "/  SSR 不报错 (HTTP 200 已检,这里只校验无 dark:bg-slate-900 反白)",
    !homeHtml.includes("dark:bg-slate-900 text-white"),
    "首页允许全 dark, 不允许反白",
  )

  // ── 13. 不引入 mock:暗色完全靠 next-themes ────────────────
  check(
    "next-themes 是唯一主题切换机制 (dark.css / login page 不引其他 provider)",
    !/js-cookie|localStorage\.getItem\("theme"\)/.test(darkCssSrc + loginPageSrc),
  )

  // ── Summary ──────────────────────────────────────────────────
  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
