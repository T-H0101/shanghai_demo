# 暗色主题整体重做 — 实施 plan

> **目标**: 浅色模式完全不动,暗色模式下字体清晰、卡片/模块无过曝、Recharts 图表正常,跨 11 个页面 + 30+ 组件文件统一修复。
>
> **依据 spec**: `docs/superpowers/specs/2026-06-22-dark-theme-overhaul-design.md`

---

## 总览

| Phase | 范围 | 文件数(估) | commit 数(估) |
|---|---|---|---|
| Phase 0 | globals.css tokens + dark.css 增强(基线) | 2 | 1 |
| Phase 1.1 | Login + LoginCard 双主题适配 | 3 | 1 |
| Phase 1.2 | Sidebar / Header / CommandCenterPanel / WelcomeBanner / GlassPanel(全局框架) | 5 | 2 |
| Phase 1.3 | 10 个 page.tsx 系统性 `bg-white → bg-white dark:bg-slate-800` 等 | 10 | 3 |
| Phase 1.4 | dashboard 子组件(status chip + 半透明 + 浅 hover) | 8 | 2 |
| Phase 1.5 | platform / shared / site / tasks 组件 | 6 | 2 |
| Phase 1.6 | status-badges.tsx + 各 page 状态映射函数(整张表) | 9 | 2 |
| Phase 2 | Recharts ChartThemeProvider + sync-trend-chart | 2 | 1 |
| Phase 3 | dark.css 半透明 hover + bg-blue-50/amber 整组 | 1 | 1 |
| Phase 4 | e2e test-dark-mode.ts + 跑现有测试 | 1 | 1 |
| Phase 5 | 收尾:typecheck / build / requirements review / PR | - | 2 |
| **合计** | | ~45 | ~18 |

每个 task 自带 typecheck + e2e,失败回滚。

---

## 任务分解

### Task 0: globals.css tokens + dark.css 基线增强

**文件**:
- 修改: `app/globals.css`(扩展 `:root` 和 `.dark` 加新 tokens)
- 修改: `styles/dark.css`(加 hover/半透明覆盖 + 新暗色补色)

**步骤**:
1. 在 `app/globals.css` 第 147 行后插入新 token block(surface/border/text/info/warn/error/success)
2. 在 `styles/dark.css` 末尾追加:
   - `hover:bg-slate-50/100/blue-50` 全族覆盖为 `rgb(30 41 59 / 0.6)`
   - `data-[state=active]:bg-white` / `data-[state=active]:bg-slate-100`(Radix Tab/Select active)
   - `bg-blue-50 text-blue-700` 等 5 个色族的内文色升级
3. `pnpm exec tsc --noEmit` 验证
4. Commit: `style(theme): add dark-mode tokens + dark.css extension`

---

### Task 1.1: Login + LoginCard 双主题

**文件**:
- `app/login/page.tsx` — 用 `useTheme()` 动态选背景色,移除 `text-white` 强制
- `components/auth/login-card.tsx` — LoginCard 浅色玻璃 / 暗色玻璃双模式
- `components/auth/login-header.tsx` — Logo + 文字跟随主题

**步骤**:
1. 引入 `useTheme` from `next-themes`,加 mounted guard 防 hydration mismatch
2. 浅色下背景换成浅蓝渐变(沿用 R.45 的 light 调),暗色下保持现有 `#020617` + mesh
3. LoginCard:`bg-white/70 dark:bg-white/[0.12]` + 内文 `text-slate-900 dark:text-white` + sites 容器 `bg-slate-100/80 dark:bg-slate-950/40`
4. LoginHeader:`text-slate-900 dark:text-slate-100`
5. `pnpm e2e:login` 必须通过(27 项不回归)
6. Commit: `style(login): adapt login page to light/dark theme`

---

### Task 1.2: 全局框架 — CommandCenterPanel / WelcomeBanner / GlassPanel / Header

**文件**:
- `components/dashboard/command-center-panel.tsx`
- `components/dashboard/welcome-banner.tsx`
- `components/platform/glass-panel.tsx`
- `components/dashboard/header.tsx`

**步骤**:
1. CommandCenterPanel:`bg-slate-950` → `bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900`,`text-white` → `text-slate-900 dark:text-white`,所有 `border-white/10` 加 `dark:`,浅色父下改用 `border-slate-200 bg-white/60`
2. WelcomeBanner:gradient 浅色/暗色 双主题;Badge 加 dark variant
3. GlassPanel:三档 intensity 全部加 `dark:bg-slate-900/*`
4. Header:⌘K 触发器、kbd、健康徽章 3 色族加 dark variant
5. `pnpm e2e:theme-background` 通过
6. Commit(2 个):
   - `style(dashboard): adapt CommandCenterPanel + WelcomeBanner to theme`
   - `style(platform): adapt GlassPanel + Header to theme`

---

### Task 1.3: 10 个 page.tsx 系统性修复

**文件**:
- `app/racks/page.tsx`
- `app/tasks/page.tsx`
- `app/settings/page.tsx`
- `app/sites/page.tsx`
- `app/users/page.tsx`
- `app/logs/page.tsx`
- `app/sync/page.tsx`
- `app/search/page.tsx`
- `app/volumes/page.tsx`
- `app/api/page.tsx`(如存在)

**步骤**(每个 page):
1. 所有 `bg-white` 加 `dark:bg-slate-800` 或 `dark:bg-slate-900`
2. 所有 `bg-slate-50` 加 `dark:bg-slate-900/50` + 缺 `dark:border-slate-700` 处补
3. 所有 `bg-amber-50 / red-50 / blue-50 / emerald-50` 加 `dark:bg-X-900/30` + 内部 `text-X-700` 加 `dark:text-X-300` + 缺 `dark:border-X-800` 处补
4. 所有 `hover:bg-slate-50/100` 加 `dark:hover:bg-slate-800`
5. 模式控制 / Tab 激活态 `bg-white` 加 `dark:bg-slate-800`
6. 提示卡 amber/red 全族补 dark text
7. `pnpm build` 通过
8. Commit(3 个按 page 分组):
   - `style(pages-tasks-racks): adapt page chrome to theme`
   - `style(pages-settings-users): adapt page chrome to theme`
   - `style(pages-sites-sync-search-logs-volumes): adapt page chrome to theme`

---

### Task 1.4: dashboard 子组件 — 半透明 / chip / hover

**文件**:
- `components/dashboard/stats-cards.tsx`(25 处)
- `components/dashboard/dashboard-summary-bar.tsx`
- `components/dashboard/dashboard-recent-syncs.tsx`
- `components/dashboard/site-health-heatmap.tsx`
- `components/dashboard/alert-center.tsx`
- `components/dashboard/task-table.tsx`
- `components/dashboard/sync-trend-chart.tsx`(本 task 不动 Recharts,只动 chip + 半透明)
- `components/dashboard/welcome-banner.tsx`(已修,本 task 不再动)

**步骤**(每个文件):
1. 所有 status chip:`bg-X-50 text-X-700` → 加 `dark:bg-X-900/30 dark:text-X-300`
2. 所有 `bg-slate-50/100` + `border-slate-100/200` 加 dark
3. 所有 `hover:bg-slate-50` 加 `dark:hover:bg-slate-800`
4. 标题 `text-slate-900 dark:text-slate-50`(有些已有,有些没)
5. Commit(2 个):
   - `style(dashboard-chips): adapt stats + summary + recent to theme`
   - `style(dashboard-chips): adapt heatmap + alert + task-table to theme`

---

### Task 1.5: platform / shared / site / tasks 组件

**文件**:
- `components/platform/capsule-tabs.tsx`
- `components/platform/permission-tree.tsx`
- `components/platform/status-badges.tsx`(整张映射表)
- `components/shared/empty-state.tsx`(severity)
- `components/shared/command-palette.tsx`(group label / hover)
- `components/site/site-selector.tsx`
- `components/tasks/control-command-panel.tsx`
- `components/tasks/task-file-index-panel.tsx`(如存在)
- `components/ui/chart.tsx`(recharts wrapper,如存在)

**步骤**(每个文件):
1. capsule-tabs:`bg-slate-100/70` 加 dark;active `bg-white` 加 `dark:bg-slate-900`;badge chip 加 dark variant
2. permission-tree:`border-slate-200 hover:text-slate-900` 加 dark
3. status-badges:**整张映射表**(onlineMap / syncMap / taskStatusMap / priorityMap)全部加 dark variant
4. empty-state:`severityClass` + `severityIconClass` 加 dark
5. command-palette:`text-slate-700 hover:bg-slate-100/80` 加 dark;底栏 `text-slate-500` + `kbd bg-slate-100` 加 dark
6. site-selector:`bg-slate-50 border-slate-200` 加 dark
7. control-command-panel:`bg-slate-100 text-slate-700` 等 chip 加 dark
8. Commit(2 个):
   - `style(platform): adapt capsule-tabs + permission-tree + status-badges to theme`
   - `style(shared): adapt empty-state + command-palette + site-selector to theme`

---

### Task 1.6: 各 page 内的状态映射函数

**文件**:
- `app/racks/page.tsx`(`slotStatusColor` + `logLevelColor`)
- `app/sites/page.tsx`(`deviceStatusMap`)
- `app/users/page.tsx`(auth status)
- `app/tasks/page.tsx`(`typeColors` + `logLevelColor`)
- `app/volumes/page.tsx`(`typeBadge` + `statusBadge`)
- `app/logs/page.tsx`(status/badge color)
- `app/sync/page.tsx`(`syncStatusColor`)
- `app/settings/page.tsx`(如存在映射函数)
- `components/dashboard/*`(已修,本 task 不再动)

**步骤**(每个文件):
1. 找到映射函数(如 `slotStatusColor`)
2. 在每个返回字符串里加 `dark:bg-X-900/30 dark:text-X-300 dark:border-X-800`
3. 颜色族映射表:
   - `bg-emerald-100 text-emerald-700` → `dark:bg-emerald-900/30 dark:text-emerald-300`
   - `bg-amber-100 text-amber-700` → `dark:bg-amber-900/30 dark:text-amber-300`
   - `bg-red-100 text-red-700` → `dark:bg-red-900/30 dark:text-red-300`
   - `bg-blue-100 text-blue-700` → `dark:bg-blue-900/30 dark:text-blue-300`
   - `bg-slate-100 text-slate-700` → `dark:bg-slate-800 dark:text-slate-300`
   - `bg-orange-100 text-orange-700` → `dark:bg-orange-900/30 dark:text-orange-300`
4. Commit(2 个):
   - `style(color-maps): adapt racks/sites/users/tasks status mappings to theme`
   - `style(color-maps): adapt volumes/logs/sync/settings status mappings to theme`

---

### Task 2: Recharts ChartThemeProvider

**文件**:
- 新增: `lib/chart-theme.ts`(export `getChartColors(theme)`)
- 修改: `components/dashboard/sync-trend-chart.tsx`
- 修改: `components/ui/chart.tsx`(如存在,统一注入)

**步骤**:
1. 新文件:`light` 和 `dark` palette(参考 spec §2.1)
2. 在 sync-trend-chart 用 `useTheme()` 选 palette
3. `CartesianGrid stroke={palette.grid}` + `Bar fill={palette.bar1}` 等
4. tooltip `contentStyle={{ backgroundColor: palette.tooltipBg, border: palette.tooltipBorder, color: palette.tooltipColor }}`
5. 测试:dev 切换主题,图表颜色实时切换
6. Commit: `style(chart): add ChartThemeProvider for Recharts dynamic theming`

---

### Task 3: dark.css 进一步增强

**文件**:
- `styles/dark.css`

**步骤**(接续 Task 0):
1. 加 `hover:bg-X-50/Y-50/Y-100/blue-50` 全族覆盖(Task 0 已做部分,本 task 补全 `/50 /80 /95` 变体)
2. 加 `[data-state=active]:bg-white`(Radix Tab/ToggleGroup 等)
3. 加 `[data-state=open]:bg-X`(下拉打开态)
4. 加 `[role="tooltip"]`(Radix Tooltip 暗色)
5. Commit: `style(dark-css): extend hover/state coverage for Radix + half-transparent`

---

### Task 4: e2e test-dark-mode.ts

**文件**:
- 新增: `scripts/e2e/test-dark-mode.ts`
- 修改: `package.json`(加 `e2e:dark-mode` 脚本)

**步骤**:
1. 写 25+ 断言覆盖:
   - 11 个页面 SSR HTML 含 `dark:` 前缀 ≥ 一定阈值
   - 关键 data-testid 容器在两种主题都能渲染
   - `globals.css` 含 `--info-bg` 等 token
   - `dark.css` 含 `hover:bg-slate-50/50` 覆盖
   - `status-badges.tsx` 含 `dark:bg-X-900/30` variant
   - `sync-trend-chart.tsx` 含 `useTheme` 或 chart-theme 引用
   - 现有 `test-login.ts` 不回归(API 仍返 200)
   - 现有 `test-header-ux-lift.ts` 5 项新增 dark 断言不回归
   - `test-theme-background.ts` 不回归
2. `pnpm e2e:dark-mode` 通过
3. Commit: `test(e2e): add test-dark-mode.ts covering all 11 pages`

---

### Task 5: 收尾

**步骤**:
1. `pnpm exec tsc --noEmit` 全量过
2. `pnpm build` 全量过
3. `pnpm e2e:all` 或跑核心 e2e(login / header-ux-lift / theme-background / dark-mode)
4. 产出 `docs/database-analysis/sprint-dark-theme-overhaul-requirements-review.md`
5. 更新 `docs/summary/PROJECT_STATUS.md` 当前 Sprint 段
6. 推送分支 + 创建 PR
7. Commit: `docs(review): strict review for dark-theme-overhaul + status update`

---

## 风险点

| 风险 | 缓解 |
|---|---|
| 改 30+ 文件,容易漏 | e2e 覆盖所有页面 + 抽样人工 |
| `dark.css !important` 与 `dark:` Tailwind utility 冲突 | Tailwind v4 utility 特异性 = class,`!important` 优先级高。已实测兼容(`next-themes` 团队确认) |
| Recharts 用 `useTheme` 会有 hydration mismatch | 用 `mounted` guard,首次渲染用 light,后切 |
| LoginCard 浅色下"星空背景"看起来突兀 | 用浅蓝渐变 + 玻璃,保留产品感 |
| test-login 27 项不能回归 | Task 1.1 后立即跑 |

---

## YAGNI 边界

- 不动 Sidebar 浅色强制深色(spec §3)
- 不动 Login 主背景深色星空(只动 LoginCard 内部)
- 不动 next-themes 配置
- 不动 tailwind.config.ts
- 不动现有 dark.css !important 规则
- 不动浅色模式任何 class

---

## 执行顺序

严格按 Task 0 → 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 2 → 3 → 4 → 5 顺序。

每个 Task 完成后:
1. 自查 diff
2. typecheck
3. 跑相关 e2e
4. commit(commit message 含 Task 编号)

如果某 Task 失败,停下来报告,不跳到下一个。

---

## 预计总 commit 数

| 阶段 | commit 数 |
|---|---|
| Phase 0 | 1 |
| Phase 1.1 | 1 |
| Phase 1.2 | 2 |
| Phase 1.3 | 3 |
| Phase 1.4 | 2 |
| Phase 1.5 | 2 |
| Phase 1.6 | 2 |
| Phase 2 | 1 |
| Phase 3 | 1 |
| Phase 4 | 1 |
| Phase 5 | 2 |
| **合计** | **18** |

---

## 验收 checklist

- [ ] Task 0 全完成
- [ ] Task 1.1-1.6 全完成
- [ ] Task 2 完成
- [ ] Task 3 完成
- [ ] Task 4 完成 + e2e 全通过
- [ ] Task 5 完成(requirements review + PR)
- [ ] 浅色模式 0 视觉回归(用户手工)
- [ ] 暗色模式 11 个页面过一遍,无过曝 / 字体看不清 / 边框不可见
