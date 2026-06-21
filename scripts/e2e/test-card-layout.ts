/**
 * Card Layout Fix e2e — Sprint R.78.
 *
 * 验证范围:
 *  1. DetailPanel 源码含关键 layout class (overflow-y-auto / flex-1 min-h-0 / 暗色)
 *  2. DetailPanel 去 ScrollArea 包装 (不再 import ScrollArea)
 *  3. DetailRow value 含 min-w-0 break-words + dark:text-slate-100
 *  4. Card 含 bg-white dark:bg-slate-900
 *  5. /sites /users /racks /tasks /volumes SSR HTTP 200
 *  6. Drawer 内部 ScrollArea 高度合理(改后是 flex-1 min-h-0,改前是 h-[Xpx])
 *  7. 首页 dashboard 卡片含 tabular-nums + break-words
 *  8. 浅色模式不被破坏(关键浅色 class 仍在)
 *  9. pnpm exec tsc --noEmit 通过(在脚本外验证)
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

async function main() {
  console.log("=== Card layout fix e2e (R.78) ===\n")

  // ── 1. DetailPanel 关键 layout class ────────────────────
  const detailPanelSrc = readFileSync("components/platform/detail-panel.tsx", "utf8")
  check(
    "DetailPanel: 源码含 flex-1 min-h-0 overflow-y-auto",
    /flex-1\s+min-h-0\s+overflow-y-auto/.test(detailPanelSrc),
  )
  check(
    "DetailPanel: 源码含 h-full flex flex-col",
    /h-full\s+flex\s+flex-col/.test(detailPanelSrc),
  )
  check(
    "DetailPanel: Card 含 overflow-hidden (防止阴影外溢)",
    /overflow-hidden/.test(detailPanelSrc),
  )

  // ── 2. 去 ScrollArea 包装 ────────────────────────────────
  check(
    "DetailPanel: 不再 import ScrollArea",
    !/import[^\n]*ScrollArea[^\n]*from[^\n]*scroll-area/.test(detailPanelSrc),
  )
  check(
    "DetailPanel: 不再使用 <ScrollArea 组件",
    !/<ScrollArea/.test(detailPanelSrc),
  )

  // ── 3. Card 暗色背景 ────────────────────────────────────
  check(
    "DetailPanel: Card 含 bg-white dark:bg-slate-900",
    /bg-white\s+dark:bg-slate-900/.test(detailPanelSrc),
  )
  check(
    "DetailPanel: Card 含 border-slate-200 dark:border-slate-700",
    /border-slate-200\s+dark:border-slate-700/.test(detailPanelSrc),
  )

  // ── 4. CardHeader 分隔线 ────────────────────────────────
  check(
    "DetailPanel: CardHeader 含 border-b + 暗色",
    /CardHeader[^>]*className[^>]*border-b[^>]*dark:border-slate-800/.test(detailPanelSrc),
  )
  check(
    "DetailPanel: CardTitle 含 dark:text-slate-50",
    /dark:text-slate-50/.test(detailPanelSrc),
  )

  // ── 5. DetailRow value 文字策略 ────────────────────────
  check(
    "DetailRow: value 含 min-w-0 break-words",
    /min-w-0/.test(detailPanelSrc) && /break-words/.test(detailPanelSrc),
  )
  check(
    "DetailRow: value 含 dark:text-slate-100",
    /dark:text-slate-100/.test(detailPanelSrc),
  )
  check(
    "DetailRow: label 仍 shrink-0 (不换行)",
    /shrink-0/.test(detailPanelSrc),
  )

  // ── 6. SSR HTTP 200 ─────────────────────────────────────
  const pages = ["/sites", "/users", "/racks", "/tasks", "/volumes"]
  for (const p of pages) {
    const res = await fetch(`${BASE}${p}`)
    check(`SSR ${p} HTTP 200`, res.status === 200, `HTTP ${res.status}`)
  }

  // ── 7. Drawer 内部 ScrollArea 审计 ─────────────────────
  const drawerPages = ["app/racks/page.tsx", "app/tasks/page.tsx", "app/volumes/page.tsx"]
  for (const f of drawerPages) {
    try {
      const src = readFileSync(f, "utf8")
      const hasOldStyle = /<ScrollArea[^>]*className="h-\[\d+px\]/.test(src)
      const hasOldViewport = /<ScrollArea[^>]*className="flex-1\s+h-\[calc\(100vh/.test(src)
      const hasNewStyle = /<ScrollArea[^>]*className="flex-1\s+min-h-0/.test(src)
      if (hasOldStyle && !hasNewStyle) {
        check(`${f}: 仍有 ScrollArea 固定 h-[Xpx] 未改`, false)
      } else if (hasOldViewport && !hasNewStyle) {
        check(`${f}: 仍有 ScrollArea flex-1 h-[calc(100vh-...)] 未改`, false)
      } else {
        check(`${f}: Drawer 内部 ScrollArea 高度策略合理`, true)
      }
    } catch (e) {
      check(`${f} 可读`, false, `${e}`)
    }
  }

  // ── 8. 首页 dashboard 卡片审计 ─────────────────────────
  const statsCardsSrc = readFileSync("components/dashboard/stats-cards.tsx", "utf8")
  check(
    "stats-cards: 大数字 value 含 tabular-nums",
    /tabular-nums/.test(statsCardsSrc),
  )

  const alertCenterSrc = readFileSync("components/dashboard/alert-center.tsx", "utf8")
  check(
    "alert-center: alert message 含 break-words",
    /break-words/.test(alertCenterSrc),
  )

  const summaryBarSrc = readFileSync("components/dashboard/dashboard-summary-bar.tsx", "utf8")
  check(
    "dashboard-summary-bar: tile value 含 tabular-nums 或 break-words",
    /tabular-nums/.test(summaryBarSrc) || /break-words/.test(summaryBarSrc),
  )

  // ── 9. 浅色模式不被破坏 ────────────────────────────────
  check(
    "DetailPanel: 浅色 bg-white 仍在 (浅色模式不回归)",
    /bg-white/.test(detailPanelSrc),
  )
  check(
    "DetailPanel: 浅色 border-slate-200 仍在",
    /border-slate-200/.test(detailPanelSrc),
  )

  // ── Summary ──────────────────────────────────────────────
  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
