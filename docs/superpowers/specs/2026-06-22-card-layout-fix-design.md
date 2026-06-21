# Card Layout Fix — 设计 spec (R.78)

> **范围**: 详情面板/抽屉的"内容被隐藏"修复,全站扫描统一修;DetailPanel 改为 h-full + flex-1 + overflow-y-auto;DetailRow 加 min-w-0 + break-words;首页卡片 / Drawer / Dialog 审计小修。
>
> **日期**: 2026-06-22
> **对应需求**: `requirements.md §6.2 安全 / 视觉合规`(展示层一致 + 关键信息可达)
> **上游**: R.77 dark-theme-overhaul(`fix/dark-theme-overhaul` 分支,PR #2)

---

## 0. 上下文与现状

### 触发

用户反馈:"优化一下卡片排版,有一些如站点详情之类的卡片会有部分被隐藏,因为排版问题。"

明确范围:
- **重点**:详情面板/抽屉(`/sites` 站点详情、 `/racks` 机架/设备、其他)
- 次要:首页某些卡片被裁、表格行
- 浅色 / 暗色模式都要正确

### 现状盘点

| 元素 | 现状 | 问题 |
|---|---|---|
| `components/platform/detail-panel.tsx` `ScrollArea h-[calc(100vh-280px)] min-h-[320px]` | 高度用 viewport 算 | 小屏或 Header 高时底部被截 |
| `DetailRow flex justify-between gap-4` value 缺 `min-w-0 break-words` | 长文本溢出隐藏 | IP/邮箱/描述撑爆被截 |
| `Card` 默认 `bg-card`(Tailwind token) | 暗色下勉强可用 | 缺显式 `dark:bg-slate-900`,子元素覆盖不一致 |
| `Drawer sm:max-w-sm` (默认 vaul) | 实际没用,调用方都 `!w-[720px] !max-w-[90vw]` | OK |
| `CardHeader` 没 `border-b` | 详情面板标题/内容视觉混 | 标题 + 内容无视觉分隔 |
| 首页 `h-[220px]` chart 容器 | 内容固定 7 柱 | OK,不动 |

### 涉及页面(扫描范围)

| 页面 | 详情容器 | 文件位置 |
|---|---|---|
| `/sites` | `DetailPanel` | `app/sites/page.tsx:446` |
| `/users` | `DetailPanel` | `app/users/page.tsx:305` |
| `/racks` | `Drawer w-720px` | `app/racks/page.tsx:901` |
| `/tasks` | `Drawer w-680px` | `app/tasks/page.tsx:689` |
| `/volumes` | `Drawer sm:max-w-xl` | `app/volumes/page.tsx:373` |
| `/` (首页) | `Card`(stats/summary/recent/heatmap/alert/task-table/welcome/chart) | 8 个 dashboard 子组件 |
| 其他 | 表格行 | `components/ui/table.tsx` + 各 page |

---

## 1. 设计原则

### 1.1 YAGNI 边界

- ❌ **不动 Sidebar / CommandCenterPanel / 命令面板 / Login**(这些已重构,布局 OK)
- ❌ **不动 drawer.tsx / dialog.tsx 组件定义**(调用方已传合理宽度)
- ❌ **不加 Playwright 验证**(方案 B 不含)
- ❌ **不改 Tailwind 配置**
- ❌ **不重写详情页架构**(只修容器 + 滚动 + 行 padding)
- ❌ **不动 R.77 已完成的暗色 `dark:` 前缀**(除顺手补全)
- ✅ 只动布局(padding / 高度策略 / 文字换行 / 容器 flex)

### 1.2 修复策略

**(A) `components/platform/detail-panel.tsx` 重构(核心)**

- `Card` 加 `bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700`
- `CardHeader` 加 `border-b border-slate-100 dark:border-slate-800 px-5 pt-5`
- `CardContent` 去掉 `ScrollArea` 包装,直接 `flex-1 min-h-0 overflow-y-auto px-5 py-4`
- `DetailRow` value 加 `min-w-0 break-words` + `dark:text-slate-100`

**理由**:
- 父容器 `h-full flex flex-col` 已在 sites/users 调用方确认
- `min-h-0` 是 flexbox 子项允许收缩的关键(默认 `min-height: auto` 不收缩)
- 原生 `overflow-y-auto` 比 `ScrollArea` 简单,且 Radix ScrollArea 暗色滚动条已在 dark.css 处理
- `break-words` 让长文本自动换行不撑爆

**(B) Drawer / Dialog 审计(只审计,不动)**

- `app/racks/page.tsx:901` `!w-[720px] !max-w-[90vw]` — OK
- `app/tasks/page.tsx:689` `!w-[680px] !max-w-[90vw]` — OK
- `app/volumes/page.tsx:373` `h-full w-full sm:max-w-xl` — OK
- 检查 DrawerContent 内部 ScrollArea 高度合理性,有问题的 ScrollArea 改 `flex-1 min-h-0`

**(C) 首页卡片(8 个 dashboard 子组件)小修**

| 组件 | 检查项 | 修法 |
|---|---|---|
| `stats-cards.tsx` | grid-cols / value 截断 | 加 `text-2xl tabular-nums`,value 不 truncate |
| `dashboard-summary-bar.tsx` | tile 高度 / text 截断 | `min-h-0` + value 字号 |
| `dashboard-recent-syncs.tsx` | row 高度 / hover | OK,audit only |
| `site-health-heatmap.tsx` | cell 高度 / 字号 | `min-h-[Xpx]` 保证可读 |
| `alert-center.tsx` | 列表行 / 文字溢出 | `break-words` on message |
| `task-table.tsx` | row 高度 | OK,audit only |
| `welcome-banner.tsx` | 大 banner | OK |
| `sync-trend-chart.tsx` | h-[220px] 容器 | OK,内容固定 |

**(D) 表格行(`components/ui/table.tsx` + 各 page)**

- TableCell 加 `whitespace-nowrap`(数字/状态 chip 不换行)
- 长文本列加 `max-w-[Xpx] truncate`(如时间戳、ID)
- 关键信息列加 `min-w-0`(如 description)

**(E) e2e 验证**

新增 `scripts/e2e/test-card-layout.ts`(12 断言)

---

## 2. 修复明细

### Phase 1 — 核心 (DetailPanel)

**文件**: `components/platform/detail-panel.tsx`

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

**改动要点**:
- ❌ 去掉 `ScrollArea` 包装(原生 `overflow-y-auto`)
- ❌ 去掉 `h-[calc(100vh-280px)]` 高度
- ✅ `flex-1 min-h-0 overflow-y-auto` 让父容器决定高度
- ✅ `CardHeader` 加 `border-b` + `px-5 pt-5`
- ✅ `CardTitle` 加 `dark:text-slate-50`
- ✅ `subtitle` 加 `truncate`(防止长字符串撑爆)
- ✅ `actions` 区域加 `flex items-start justify-between gap-2`(原代码已有)
- ✅ `Card` 加 `bg-white dark:bg-slate-900 border` + `overflow-hidden`
- ✅ `DetailRow` value 加 `min-w-0 break-words dark:text-slate-100`

### Phase 2 — Drawer 内部 ScrollArea 审计

`app/racks/page.tsx:901` DrawerContent 内部 ScrollArea(如有)检查高度:
```tsx
// 如果是 height 固定值,改为 flex-1
<ScrollArea className="h-[400px]">  // 改前
<ScrollArea className="flex-1 min-h-0">  // 改后
```

### Phase 3 — 首页卡片审计

#### 3.1 stats-cards.tsx
- value 数字加 `tabular-nums`(对齐)
- 不 truncate 数字

#### 3.2 dashboard-summary-bar.tsx
- tile value 字号不缩
- hover/focus 状态正常

#### 3.3 site-health-heatmap.tsx
- cell 高度最小 `min-h-[36px]`
- label `truncate` 但 title 完整

#### 3.4 alert-center.tsx
- alert message 加 `break-words`

### Phase 4 — 表格行

`components/ui/table.tsx`:
- TableCell 加 `align-middle`(垂直居中)
- TableRow 加 `h-12`(统一行高)

各 page 的表格(如 /tasks /logs /sites /sync)的长文本列:
- 加 `max-w-[200px]` + `truncate` 或 `break-words`

### Phase 5 — e2e

`scripts/e2e/test-card-layout.ts`:

```ts
// 1. DetailPanel 源码含关键类
check("DetailPanel: 源码含 overflow-y-auto", detailPanelSrc.includes("overflow-y-auto"))
check("DetailPanel: 源码含 flex-1 min-h-0", detailPanelSrc.includes("flex-1 min-h-0"))
check("DetailPanel: 源码去 ScrollArea 包装", !detailPanelSrc.includes("ScrollArea"))
check("DetailPanel: Card 含 bg-white dark:bg-slate-900",
  detailPanelSrc.includes("bg-white dark:bg-slate-900"))

check("DetailRow: value 含 min-w-0 break-words",
  detailPanelSrc.includes("min-w-0") && detailPanelSrc.includes("break-words"))
check("DetailRow: 暗色文字 dark:text-slate-100",
  detailPanelSrc.includes("dark:text-slate-100"))

// 2. SSR HTML 检查
const sitesHtml = await (await fetch(`${BASE}/sites`)).text()
check("/sites SSR 200", sitesHtml.length > 1000)
const usersHtml = await (await fetch(`${BASE}/users`)).text()
check("/users SSR 200", usersHtml.length > 1000)

// 3. 现有 e2e 不回归(单独跑,不在这脚本中)
// pnpm e2e:login / e2e:header-ux-lift / e2e:dark-mode / e2e:theme-background

// 4. typecheck
```

---

## 3. 涉及 Req IDs

| Req ID | 状态 | 备注 |
|---|---|---|
| `requirements.md §6.2` 视觉合规 | `complete` (R.77) → **`complete` (R.78 增强)** | 详情面板/卡片内容可达 + 暗色下不截 |
| `requirements.md §6.4` 可维护 | `partial` → **`partial`** | 不动逻辑,只动布局 |

仅前端视觉/可达性,不动后端 / 同步 / 控制链路。

---

## 4. 验证标准

### 4.1 自动验证

- ✅ `pnpm exec tsc --noEmit` 通过
- ✅ `pnpm e2e:card-layout` 12/12 通过(本 sprint 新增)
- ✅ `pnpm e2e:login` 27/27 不回归
- ✅ `pnpm e2e:dark-mode` 44/44 不回归
- ✅ `pnpm e2e:theme-background` 10/10 不回归
- ✅ `pnpm e2e:header-ux-lift` 不新增失败(4 项 pre-existing 不算)

### 4.2 手动验证(用户)

- 打开 `/sites`,点任一站点
- 检查右侧详情面板:
  - 标题 + 副标题不被截
  - 12 个 DetailRow 都完整显示(长 IP / 长邮箱 / 长描述不撑爆)
  - 按钮(数据一致性校验)可见
- 切换暗色:
  - 详情面板背景深色
  - 标题白字
  - DetailRow 文字深色背景下清晰
- 打开 `/racks`,展开任一设备抽屉(720px 宽)
- 打开 `/tasks`,展开任一任务抽屉(680px 宽)
- 打开 `/volumes`,展开任一卷抽屉(576px)
- 首页 dashboard 各卡片在 1280 / 1440 / 1920 宽度下都正常

---

## 5. 风险与权衡

| 风险 | 缓解 |
|---|---|
| DetailPanel 父容器不是 h-full | 调用方都已 `h-full flex`(确认 sites/users) |
| Drawer 内部 ScrollArea 高度不够 | Phase 2 审计,只改明显不够的 |
| `break-words` 让 IP 等不期望换行 | `DetailRow` value 用 `min-w-0 break-words`,数字 ID 仍 `whitespace-nowrap` |
| `overflow-hidden` 在 Card 父上可能截子元素阴影 | 已审计 Card 内部元素无外阴影 |
| 浅色 padding 微调影响视觉 | padding 增量 ≤ 0.25rem,用户已同意 |

### 权衡

- **去 ScrollArea vs 留**:选去(原生 `overflow-y-auto` 更轻,Radix ScrollArea 暗色已 OK)
- **Drawer 内部高度策略**:只审计,不动组件
- **首页卡片**:只小修(stats / alert 加 break-words),不全改

---

## 6. 不在本 Sprint

- 抽屉宽度统一(调用方已合理)
- Playwright 视觉回归(后续 Sprint)
- Sidebar / CommandCenterPanel / Login 卡片(已 OK)
- 详情页架构重写(只修容器)

---

## 7. 改动文件清单(估)

| 类别 | 文件数 |
|---|---|
| 核心 (DetailPanel) | 1 |
| Drawer 内部 ScrollArea | 1-2 |
| 首页 dashboard 卡片 | 4-5(stats-cards / dashboard-summary-bar / site-health-heatmap / alert-center) |
| 表格 + 各 page | 2-3(components/ui/table.tsx + 1-2 个 page 长文本列) |
| e2e | 1(新) |
| spec/plan/review | 3(新) |
| **合计** | **~13** |

预计 commit 数:**~8**

---

## 8. Verdict

`pass` 设计稿,等待 plan + 实施。
