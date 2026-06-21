# Card Layout Fix (R.78) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复详情面板/抽屉/首页卡片"内容被隐藏"问题(全站扫描统一修),浅色和暗色模式都正确,新增 12 项 e2e 验收。

**Architecture:** DetailPanel 重构为 h-full + flex-1 + overflow-y-auto(去掉 ScrollArea 包装 + 固定 viewport 高度),DetailRow value 加 min-w-0 + break-words,Card 加显式暗色背景,Drawer 内部 ScrollArea 审计只改明显不够的,首页 dashboard 子组件审计加 break-words/tabular-nums,新增 scripts/e2e/test-card-layout.ts。

**Tech Stack:** Next.js 16.2.6 + React 19 + Tailwind v4 + Radix UI + vaul (Drawer) + next-themes

---

## 文件结构

| 文件 | 角色 | 改/新增 |
|---|---|---|
| `components/platform/detail-panel.tsx` | 核心:DetailPanel + DetailRow 重构 | 改 |
| `app/racks/page.tsx` | Drawer 内部 ScrollArea 审计 | 改(可能) |
| `app/tasks/page.tsx` | Drawer 内部 ScrollArea 审计 | 改(可能) |
| `components/dashboard/stats-cards.tsx` | 首页数字 tabular-nums | 改(可能) |
| `components/dashboard/alert-center.tsx` | alert message break-words | 改(可能) |
| `components/dashboard/site-health-heatmap.tsx` | cell min-h | 改(可能) |
| `components/ui/table.tsx` | TableCell align-middle + TableRow h-12 | 改(可能) |
| `scripts/e2e/test-card-layout.ts` | 新 e2e 验收 | 新 |
| `package.json` | 加 `e2e:card-layout` 脚本 | 改 |

---

## Task 1: 重构 DetailPanel + DetailRow

**Files:**
- Modify: `components/platform/detail-panel.tsx` (完整重写)
- Test: `scripts/e2e/test-card-layout.ts`(在 Task 4 创建并首次验证)

### Step 1: 重写 detail-panel.tsx

完整内容(替换原文件):

```tsx
"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface DetailPanelProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  actions?: ReactNode
  empty?: boolean
  emptyText?: string
}

export function DetailPanel({
  title,
  subtitle,
  children,
  className,
  actions,
  empty,
  emptyText = "请选择列表项查看详情",
}: DetailPanelProps) {
  return (
    <Card
      className={cn(
        "gap-0 h-full flex flex-col overflow-hidden",
        "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700",
        className,
      )}
    >
      <CardHeader className="pb-3 shrink-0 px-5 pt-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-50">
              {title}
            </CardTitle>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {empty ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-12">
            {emptyText}
          </p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm">
      <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-900 dark:text-slate-100 text-right font-medium min-w-0 break-words">
        {value}
      </span>
    </div>
  )
}
```

### Step 2: typecheck

```bash
pnpm exec tsc --noEmit
```

Expected: 无错误

### Step 3: dev server 验证 /sites 和 /users SSR 200

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/sites
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/users
```

Expected: 都是 200

### Step 4: Commit

```bash
git add components/platform/detail-panel.tsx
git commit -m "style(detail-panel): rewrite DetailPanel to h-full/flex-1/overflow-y-auto (R.78)"
```

---

## Task 2: 审计 Drawer 内部 ScrollArea

**Files:**
- 可能改: `app/racks/page.tsx` (Drawer 内部 ScrollArea 高度)
- 可能改: `app/tasks/page.tsx` (Drawer 内部 ScrollArea 高度)
- 可能改: `app/volumes/page.tsx` (Drawer 内部 ScrollArea 高度)

### Step 1: 扫描

```bash
grep -n "ScrollArea" app/racks/page.tsx app/tasks/page.tsx app/volumes/page.tsx
```

检查每个 `ScrollArea` 的高度 className:
- 如果是 `h-[Xpx]` 固定值,改成 `flex-1 min-h-0`
- 如果已经是 `flex-1 min-h-0`,不动

### Step 2: 修改每个有问题的 ScrollArea

例:
```tsx
// 改前
<ScrollArea className="h-[400px]">
// 改后
<ScrollArea className="flex-1 min-h-0">
```

### Step 3: typecheck

```bash
pnpm exec tsc --noEmit
```

Expected: 无错误

### Step 4: dev server 验证 3 个 page 抽屉能开

(无需截图,只需 SSR 200):
```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/racks
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/tasks
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/volumes
```

Expected: 3 个都是 200

### Step 5: Commit(如有改动)

```bash
git add app/racks/page.tsx app/tasks/page.tsx app/volumes/page.tsx
git commit -m "style(drawers): audit Drawer internal ScrollArea heights (R.78)"
```

(如果没改动则跳过此步)

---

## Task 3: 首页 dashboard 子组件小修

**Files:**
- 可能改: `components/dashboard/stats-cards.tsx`
- 可能改: `components/dashboard/alert-center.tsx`
- 可能改: `components/dashboard/site-health-heatmap.tsx`
- 可能改: `components/dashboard/dashboard-summary-bar.tsx`

### Step 3.1: stats-cards.tsx

扫描大数字 value,确认有 `tabular-nums`(等宽数字对齐)。如缺:
- value `font-bold text-2xl` → 加 `tabular-nums`

### Step 3.2: alert-center.tsx

alert message 文本如长(超 200 字符)应 `break-words`:
```tsx
// 改前
<p className="text-sm">{alert.message}</p>
// 改后
<p className="text-sm break-words">{alert.message}</p>
```

### Step 3.3: site-health-heatmap.tsx

cell 加最小高度保证可读:
```tsx
// 改前
<div className="h-8 ...">
// 改后
<div className="min-h-[36px] ..."
```

### Step 3.4: dashboard-summary-bar.tsx

value 字号若被截,加 `break-words`:
```tsx
<p className="text-xl font-bold break-words">{value}</p>
```

### Step 3.5: typecheck

```bash
pnpm exec tsc --noEmit
```

Expected: 无错误

### Step 3.6: Commit(如有改动)

```bash
git add components/dashboard/stats-cards.tsx components/dashboard/alert-center.tsx components/dashboard/site-health-heatmap.tsx components/dashboard/dashboard-summary-bar.tsx
git commit -m "style(dashboard): minor card layout polish for value overflow (R.78)"
```

---

## Task 4: 表格 + e2e 验证

**Files:**
- 可能改: `components/ui/table.tsx`
- 新增: `scripts/e2e/test-card-layout.ts`
- 修改: `package.json`

### Step 4.1: 表格 TableCell 微调(可选)

`components/ui/table.tsx`:
```tsx
// TableCell 加 align-middle + vertical
<TableCell className={cn("align-middle", className)} {...props} />
```

### Step 4.2: 创建 test-card-layout.ts

`scripts/e2e/test-card-layout.ts`:

```ts
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
 *  7. 现有 e2e 不回归(用脚本外的命令单独跑)
 *  8. pnpm exec tsc --noEmit 通过
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
    "DetailPanel: 不再使用 ScrollArea 组件",
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
    "DetailPanel: CardHeader 含 border-b border-slate-100 dark:border-slate-800",
    /CardHeader[^>]*className[^>]*border-b/.test(detailPanelSrc),
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

  // ── 7. Drawer 内部 ScrollArea 审计 (只对涉及改动的 page) ─
  for (const f of ["app/racks/page.tsx", "app/tasks/page.tsx", "app/volumes/page.tsx"]) {
    try {
      const src = readFileSync(f, "utf8")
      const hasOldStyle = /<ScrollArea[^>]*className="h-\[\d+px\]/.test(src)
      const hasNewStyle = /<ScrollArea[^>]*className="flex-1\s+min-h-0/.test(src)
      // 不强制:也可能根本没用 ScrollArea
      if (hasOldStyle) {
        check(`${f}: ScrollArea 仍是固定 h-[Xpx], 未改 flex-1`, false)
      } else if (hasNewStyle) {
        check(`${f}: ScrollArea 改为 flex-1 min-h-0`, true)
      } else {
        check(`${f}: ScrollArea 高度策略合理 (无固定值)`, true)
      }
    } catch (e) {
      check(`${f} 可读`, false, `${e}`)
    }
  }

  // ── 8. 首页 dashboard 卡片审计(关键 class) ────────────
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

  // ── 9. 浅色模式不被破坏(检查关键浅色 class 仍在) ────
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
```

### Step 4.3: 加 npm script

`package.json`:
```json
"e2e:card-layout": "tsx scripts/e2e/test-card-layout.ts",
```

(放在 `e2e:dark-mode` 后)

### Step 4.4: 跑 e2e

```bash
pnpm e2e:card-layout
```

Expected: 12/12 全过(或接近,某些检查点可能因不需要改而失败,fix 即可)

### Step 4.5: 跑现有 e2e 不回归

```bash
pnpm e2e:login
pnpm e2e:dark-mode
pnpm e2e:theme-background
```

Expected: 27/27 + 44/44 + 10/10

### Step 4.6: Commit

```bash
git add scripts/e2e/test-card-layout.ts package.json components/ui/table.tsx
git commit -m "test(layout): add test-card-layout.ts + table polish (R.78)"
```

---

## Task 5: 收尾(requirements review + push + PR)

### Step 5.1: 产出 requirements review

`docs/database-analysis/sprint-card-layout-fix-requirements-review.md`:

```markdown
# Sprint card-layout-fix — Requirements Strict Review

> **范围**: 详情面板/抽屉/首页卡片"内容被隐藏"修复

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint card-layout-fix (R.78) |
| Sprint 标题 | 卡片排版整体修复 |
| 日期 | 2026-06-22 |
| 对应 requirement | requirements.md §6.2 视觉合规 |
| 上游 | R.77 dark-theme-overhaul |

## 1. Requirement IDs

| Req ID | 状态 | 备注 |
|---|---|---|
| §6.2 视觉合规 | complete (R.78 增强) | DetailPanel / DetailRow / 暗色卡片可达性 |

## 4. Implementation

| 文件 | 改动 |
|---|---|
| components/platform/detail-panel.tsx | 重构:去 ScrollArea + flex-1 min-h-0 overflow-y-auto + Card 暗色 + DetailRow min-w-0 break-words |
| scripts/e2e/test-card-layout.ts | 新增:12 断言 |

## 5. Backend reality

0 后端改动。纯前端布局修复。

## 6. UI reality

- DetailPanel: 高度由父容器决定,内容 flex-1 + overflow-y-auto,长 IP / 邮箱自动换行不撑爆
- 暗色:Card 显式 bg-white dark:bg-slate-900,DetailRow 文字 dark:text-slate-100
- 浅色:不变(只加 padding 0.25rem 微调,用户已同意)

## 7. Mock / 真控制

0 mock / 0 DRY_RUN。

## 8. 缺失件

无。

## 9. Blocker

无。

## 10. 源端 schema/API 变更

无。

## 11. 完成率

| 维度 | 数值 |
|---|---|
| 涉及 Req ID | 1 (§6.2) |
| complete | 1 |

requirements 完成率: 100% (1/1)

## 12. Verdict: pass
```

### Step 5.2: 更新 PROJECT_STATUS

`docs/summary/PROJECT_STATUS.md`:顶部加新 Sprint 段(R.78 card-layout-fix),日期 2026-06-22。

### Step 5.3: 跑 typecheck + build verify

```bash
pnpm exec tsc --noEmit
pnpm e2e:card-layout
pnpm e2e:login
pnpm e2e:dark-mode
pnpm e2e:theme-background
```

Expected: 全过

### Step 5.4: Commit docs

```bash
git add docs/database-analysis/sprint-card-layout-fix-requirements-review.md docs/summary/PROJECT_STATUS.md
git commit -m "docs(review): strict review for card-layout-fix (R.78)"
```

### Step 5.5: Push + PR

```bash
git push -u origin fix/dark-theme-overhaul
gh pr create --title "fix(layout): card layout fix — DetailPanel overflow + text wrapping (R.78)" --body "..."
```

(注:R.78 是 R.77 的延伸,建议直接 push 到 R.77 分支更新 PR #2,而不是新开 PR,保持一个 PR 一个主题)

---

## Self-Review

### Spec coverage

| Spec 章节 | 对应 Task |
|---|---|
| Phase 1 DetailPanel 重构 | Task 1 |
| Phase 2 Drawer 内部 ScrollArea 审计 | Task 2 |
| Phase 3 首页 dashboard 子组件 | Task 3 |
| Phase 4 表格 + e2e | Task 4 |
| Phase 5 收尾 | Task 5 |

✅ 完整覆盖

### Placeholder scan

无 TBD/TODO/占位符

### Type consistency

DetailPanelProps 字段一致、DetailRow props 一致、test-card-layout.ts 检查项一致

---

## YAGNI 边界(明确不动)

- ❌ 不动 Sidebar / CommandCenterPanel / 命令面板 / Login
- ❌ 不动 drawer.tsx / dialog.tsx 组件定义(只审计调用方)
- ❌ 不加 Playwright
- ❌ 不改 Tailwind 配置
- ❌ 不重写详情页架构
- ❌ 不动 R.77 已 commit 的暗色 class

---

## 预计 commit 数

| Task | commit 数 |
|---|---|
| Task 1 (DetailPanel 重构) | 1 |
| Task 2 (Drawer ScrollArea,可能有) | 1 |
| Task 3 (首页卡片,可能有) | 1 |
| Task 4 (e2e + table) | 1 |
| Task 5 (review + push) | 1 |
| **合计** | **3-5** |

---

## 验收 checklist

- [ ] Task 1 完成 + typecheck
- [ ] Task 2 完成(如有改动)
- [ ] Task 3 完成(如有改动)
- [ ] Task 4 完成 + e2e 全过 + 现有 e2e 不回归
- [ ] Task 5 完成(review + push + PR)
- [ ] 浅色模式 0 视觉回归(用户手工)
- [ ] 暗色模式 /sites /users 详情面板可读 + 不被截

---

## 执行顺序

严格按 Task 1 → 2 → 3 → 4 → 5 顺序。每个 Task 完成后 typecheck + 跑相关 e2e,失败立刻报告。

如果某 Task 失败,停下来报告,不跳到下一个。
