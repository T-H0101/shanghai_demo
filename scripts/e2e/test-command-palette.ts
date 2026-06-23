/**
 * Command Palette (⌘K) e2e — Sprint UI-2026-06 r2 fixes
 *
 * White-box source-level verification:
 *  - r2 Bug A: activeItemId (string) 作为状态, activeIndex 仅作 filtered 派生值
 *  - r2 Bug A: 箭头键用 filtered.findIndex, hover 用 id 查找
 *  - r2 Bug B: CommandItemRow React.memo 包裹
 *  - r2 Bug B: useCallback 缓存 hover/select handlers
 *  - r2 Bug B: hover 行加 will-change GPU 加速
 *
 * 运行时交互(键盘 ↑↓ / 鼠标 hover)需要 Playwright, 当前项目 e2e 不启用,
 * 静态源码断言覆盖核心修复. 后续 Sprint 可补 Playwright 集成.
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
  console.log("=== Command palette e2e (r2 fixes) ===\n")

  // ── 0. CommandPalette 挂在根 providers, 任意路由可达 ──
  const res = await fetch(`${BASE}/`)
  check("Home reachable", res.status === 200, `HTTP ${res.status}`)

  // ── 1. 源码完整性 ─────────────────────────────────────
  const src = readFileSync("components/shared/command-palette.tsx", "utf8")

  // Bug A: id-based active state
  check(
    "r2 Bug A: activeIndex is derived, not state",
    src.includes("const activeIndex = activeItemIdState") &&
      !src.includes("useState<number"),
    "activeIndex 仅由 activeItemIdState + filtered 派生",
  )
  check(
    "r2 Bug A: activeItemId (string|null) introduced",
    /useState<string \| null>\(null\)/.test(src) || src.includes("activeItemId"),
    "字符串状态存在",
  )

  // Bug A: 箭头键基于 filtered, hover 基于 id 反查
  check(
    "r2 Bug A: 箭头键使用 filtered.findIndex",
    /filtered\.findIndex/.test(src),
    "filtered 是键盘导航索引来源",
  )
  check(
    "r2 Bug A: 鼠标 hover 通过 id 查找",
    /setActiveIndex\(items\.findIndex/.test(src),
    "hover 使用 id 反查, 避免分组局部 index 错位",
  )
  check(
    "r2 Bug A: mouseEnter 直接传 id (不再绕 index)",
    /onHover=\{handleHover\}/.test(src) &&
      /onMouseEnter=\{\(\) => onHover\(item\.id\)\}/.test(src),
    "onMouseEnter → handleHover(item.id)",
  )

  // Bug B: memo
  check(
    "r2 Bug B: CommandItemRow is React.memo wrapped",
    /memo\(function CommandItemRow/.test(src),
    "memo 边界存在",
  )
  check(
    "r2 Bug B: useCallback used for handlers",
    src.includes("useCallback"),
    "useCallback 引用",
  )
  check(
    "r2 Bug B: will-change on hover rows",
    src.includes("will-change"),
    "GPU 加速提示",
  )
  check(
    "r2 Bug B: hover transition explicit (duration-100)",
    src.includes("duration-100"),
    "短 transition (100ms)",
  )

  // ── 2. 旧功能未破坏 ───────────────────────────────────
  check(
    "preserve: ⌘K / Ctrl+K 快捷键监听",
    /metaKey.*ctrlKey.*k/i.test(src) ||
      /\(e\.metaKey \|\| e\.ctrlKey\) && e\.key\.toLowerCase\(\) === "k"/.test(src),
    "全局快捷键保留",
  )
  check(
    "preserve: ESC 关闭对话框",
    /Escape/.test(src) && /setOpen\(false\)/.test(src),
    "ESC 处理保留",
  )
  check(
    "preserve: Enter 选择当前 active 项",
    /e\.key === "Enter"/.test(src),
    "Enter 处理保留",
  )
  check(
    "preserve: 数据源仍 useSiteSites (Sprint R.69)",
    src.includes("useSiteSites"),
    "中心注册表未改",
  )

  // ── 3. 数据流正确 ─────────────────────────────────────
  // 用 query 过滤后, active 重置到第一项 (iPhone-style 默认)
  check(
    "r2: query 变化时 active 重置",
    /useEffect[\s\S]{0,200}filtered\[0\]\?\.id/.test(src),
    "useEffect 监听 query 变化",
  )

  // ── 4. r3 跨组视觉改进 ──────────────────────────────────
  check(
    "r3: CommandItemRow uses scrollIntoView on activation",
    /scrollIntoView\(\{ block: "nearest" \}\)/.test(src),
    "active 变化时滚到可见",
  )
  check(
    "r3: 命令面板源码引用 scrollIntoView",
    src.includes("scrollIntoView"),
    "scrollIntoView 调用存在",
  )
  check(
    "r3: 分组标题使用 data-has-active 属性",
    /data-has-active=\{groupHasActive/.test(src),
    "groupHasActive 计算属性",
  )
  check(
    "r3: 分组标题使用 data-testid for e2e",
    /data-testid=\{`command-group-\$\{g\}`\}/.test(src),
    "command-group-{g} 测试钩子",
  )

  // ── Summary ──────────────────────────────────────────
  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
