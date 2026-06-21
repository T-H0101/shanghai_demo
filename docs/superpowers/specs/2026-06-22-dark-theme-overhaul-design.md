# 暗色主题整体重做 — 设计 spec

> **范围**: 全平台暗色主题适配,目标:浅色模式完全不动,暗色模式字体清晰、卡片/模块无过曝、交互反馈正确。
> **日期**: 2026-06-22
> **对应需求**: `requirements.md §6.2 安全 / 视觉合规 / §3.3 部门 / §4.2 任务管理`(展示一致性)
> **对应规范**: CLAUDE.md §9 文档同步 / R.5 前端事件级测试

---

## 0. 上下文与现状

### 触发

用户反馈:"现在有一些字体显示不清,或者有一些卡片/模块会过曝,我希望你修复一下。白天模式不需要动。"

### 现状盘点

**已覆盖**(来自 `styles/dark.css` + `app/globals.css`):

- `body` 背景、`.bg-white / .bg-slate-50 / .bg-slate-100` 重映射为 `#1e293b / #0f172a`
- `text-slate-900 / 800 / 700 / 600 / 500 / 400` 逐级提亮
- `border-slate-200 / 100` 重映射
- `input / textarea / select` 背景与文字
- 表格 `table / td / th`
- `[role="dialog|listbox|menu"]`
- `bg-red-50 / bg-amber-50` 告警卡
- 滚动条、hr、`outline button`、`hover:bg-slate-50/100`
- `.app-ambient-shell / .app-header-glass / .page-header-glass`(基线已加)

### 缺口(从 audit 报告归纳)

按影响分 3 类:

**P0 — 浅色 → 暗色 切换失效或视觉崩坏**

1. `/login` 整页 `style={{ backgroundColor: "#020617" }}` + 根 `<div text-white>` → 浅色下也是深底白字
2. `Sidebar` 整段 inline radial-gradient + `text-white` → 浅色下永久深色
3. `CommandCenterPanel` 整块 `bg-slate-950 text-white` → 首页 hero 强制深色
4. `GlassPanel` 三档 `bg-white/70 / 85 / 95` → 暗色下整页过曝
5. `WelcomeBanner` `bg-gradient-to-br from-white via-blue-50/40 ...` → 暗色下整块白底
6. `Header` `⌘K` 触发器 `bg-slate-50 border-slate-200` + 健康徽章 `bg-emerald-50` → 暗色下浅色
7. `Racks` 页 16+ 处 `bg-white`(模式控制、tab list、子卡片、设备总览、托盘)
8. `Tasks` 页 `viewSwitcher bg-white` + 激活 `bg-slate-900`(暗色下两块都是深)
9. `Settings` 15+ 处 `bg-slate-50` 容器 + 缺 `dark:border`
10. `Pages/Hot Pages` `bg-blue-50 text-blue-700` 提示条(text 暗色下太暗)
11. `status-badges.tsx` 整张状态映射表无 dark variant(整 11+ 色)

**P1 — Recharts 图表硬编码颜色**

- `SyncTrendChart` `CartesianGrid stroke="#e2e8f0"` + `Bar fill="#475569/#94a3b8/#cbd5e1"` 永久深,浅色下 tooltip 反白
- 修法:抽 `<ChartThemeProvider>` + CSS 变量,Recharts 读 var

**P2 — hover / 边框 / 装饰半透明**

- `hover:bg-slate-50/100` 半透明在暗色下区分度差(已覆盖实色,但 `/50 /80` 未覆盖)
- `bg-white/[0.04..0.06]` `border-white/10/15` 这类"刻意透明"在浅色下父是 slate-950 OK,但浅色下父切换后反而消失

---

## 1. 设计原则

### 1.1 YAGNI 边界

**不动**:
- ✅ `components/dashboard/sidebar.tsx` 在浅色下保持深色(radial gradient + `text-white` 是设计风格)
  - **理由**:浅色下的 sidebar 强制深色是"产品差异化"(`enterprise-productization` 已定型)
  - 如果用户后续要求 sidebar 也跟随主题,可在另一 Sprint 处理
- ✅ 浅色模式任何 `class` 不动
- ✅ `tailwind.config.ts` 不引入新 color(只用 Tailwind 内建 + CSS 变量)
- ✅ Login 页背景:用户明确希望是深色星空 + 玻璃质感(`login-redesign`),浅色下也保留深色,但需修 LoginCard 的"内部文字不要跟随父"问题

### 1.2 修复策略

**两条路径并用**:

**(A) `dark:` 前缀(优先生效,响应 next-themes)**

适用于所有"双主题需要共存"的组件。

```
bg-white              →  bg-white dark:bg-slate-900
text-slate-700        →  text-slate-700 dark:text-slate-200
border-slate-200      →  border-slate-200 dark:border-slate-700
hover:bg-slate-50     →  hover:bg-slate-50 dark:hover:bg-slate-800
bg-blue-50 text-blue-700  →  bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300
```

**(B) `styles/dark.css` 强覆盖(纯全局规则)**

只覆盖:
1. 跨 5+ 页面的重复模式(如 `app-shell` 内的所有 `[data-state=active]:bg-white`)
2. Recharts 内嵌 SVG 属性(无法加 `dark:`)

### 1.3 暗色色彩令牌(新增,统一管理)

`app/globals.css` 在 `:root` 与 `.dark` 下扩展:

| 令牌 | 浅色 | 暗色 |
|---|---|---|
| `--surface` | `#ffffff` | `rgb(15 23 42 / 0.86)` |
| `--surface-2`(卡片副) | `#f8fafc` | `rgb(30 41 59 / 0.5)` |
| `--surface-3`(凹陷) | `#f1f5f9` | `rgb(15 23 42 / 0.6)` |
| `--border` | `#e2e8f0` | `rgb(148 163 184 / 0.18)` |
| `--border-strong` | `#cbd5e1` | `rgb(148 163 184 / 0.28)` |
| `--text-1` | `#0f172a` | `#f1f5f9` |
| `--text-2` | `#334155` | `#cbd5e1` |
| `--text-3` | `#64748b` | `#94a3b8` |
| `--text-4`(最弱) | `#94a3b8` | `#64748b` |
| `--info-bg / info-text` | `bg-blue-50 / text-blue-700` | `rgb(30 58 138 / 0.3) / #93c5fd` |
| `--warn-bg / warn-text` | `bg-amber-50 / text-amber-700` | `rgb(120 53 15 / 0.35) / #fcd34d` |
| `--error-bg / error-text` | `bg-red-50 / text-red-700` | `rgb(127 28 28 / 0.35) / #fca5a5` |
| `--success-bg / success-text` | `bg-emerald-50 / text-emerald-700` | `rgb(6 78 59 / 0.35) / #6ee7b7` |

> 这些令牌是**新增的**,与 dark.css 现有的 `text-slate-*` 重映射不冲突(后者优先级更高,因为是 `!important`)。新代码优先用令牌,老代码不强制改。

---

## 2. 修复明细(按优先级)

### Phase 1 — P0 全局框架 / 通用组件(必修)

#### 1.1 Login 整页

**问题**: `app/login/page.tsx:25-28` `style={{ backgroundColor: "#020617" }}` + `text-white` 写死。

**修法**: 整页背景 + LoginCard 在浅色下改用浅色玻璃。

- `app/login/page.tsx`:
  - 移除根 `text-white` 强制,改 `text-slate-900 dark:text-white`
  - `backgroundColor: "#020617"` → 用 `dark:` 内联:`style={{ backgroundColor: isDark ? "#020617" : "#f8fafc", ... }}`(用 `useTheme` hook)
  - 移除 `data-testid="login-brand"` 中的 `text-blue-400` 在浅色下太亮
- `components/auth/login-card.tsx`:
  - `bg-white/[0.12]` → `bg-white/70 dark:bg-white/[0.12]`
  - 标题 `text-white` → `text-slate-900 dark:text-white`
  - 描述 `text-slate-300/400` → `text-slate-600 dark:text-slate-400`
  - sites 容器 `bg-slate-950/40 border-white/10` → `bg-slate-100/80 border-slate-200 dark:bg-slate-950/40 dark:border-white/10`
  - button `bg-blue-600 text-white` 不变(双主题 OK)
  - `disabled:bg-slate-700 disabled:text-slate-400` → `disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700`
- `components/auth/login-header.tsx`: 不变(Logo + 文字,浅色下用深色 `text-slate-900`)

#### 1.2 Sidebar

**保持不动**(产品差异化)。但顶部 logo 容器 `border-white/15 bg-white/10` 暗色下 OK,无需改。

#### 1.3 CommandCenterPanel(首页 hero)

**问题**: `components/dashboard/command-center-panel.tsx:246` `bg-slate-950 text-white` 永久深。

**修法**: 浅色下用浅蓝渐变 + 深色文字。

```
bg-slate-950 text-white
  → bg-gradient-to-br from-blue-50 via-white to-indigo-50 text-slate-900 dark:bg-slate-950 dark:text-white
```

`border-white/10 bg-white/5` 等半透明白 → 浅色下保留(浅色父也是浅色,反而不显眼,需改 `dark:bg-white/5`,确认):
- `border-white/10 bg-white/5 backdrop-blur p-3`(line 277) → 浅色下改 `border-slate-200 bg-white/60`
- `bg-white/[0.04] text-slate-300`(line 360) → 浅色下改 `bg-slate-100 text-slate-600`
- outline button `border-white/15 bg-white/5 text-white`(line 374) → 浅色下改 `border-slate-200 bg-white text-slate-700`
- 进度条 `bg-white/10`(line 419) → 浅色下改 `bg-slate-200`

#### 1.4 GlassPanel(3 档半透明白)

**问题**: `components/platform/glass-panel.tsx:33-35` 整张 intensityClass 全写死 `bg-white/{70,85,95}`。

**修法**:
```
soft:   "bg-white/70 dark:bg-slate-900/80 border-slate-200/70 dark:border-slate-700/70"
default:"bg-white/85 dark:bg-slate-900/90 border-slate-200 dark:border-slate-700"
strong: "bg-white/95 dark:bg-slate-900 border-slate-300 dark:border-slate-700"
```

#### 1.5 WelcomeBanner

**问题**: `components/dashboard/welcome-banner.tsx:86` 整块 gradient `from-white via-blue-50/40 to-indigo-50/30`。

**修法**:
```
bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/30
  → bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/30
    dark:from-slate-900 dark:via-slate-900/40 dark:to-indigo-950/30
```

Badge(button, chip): 加 `dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300`。

#### 1.6 Header(⌘K + 健康徽章)

**问题**: `components/dashboard/header.tsx:153` 触发器浅色 + `163` kbd 白底 + `200-220` 健康徽章浅色。

**修法**:
- ⌘K 触发器:
  ```
  border-slate-200 bg-slate-50 text-slate-600
    → border-slate-200 bg-slate-50 text-slate-600
      dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300
  ```
- kbd:
  ```
  bg-white text-slate-500 border-slate-200
    → bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700
  ```
- 健康徽章 3 状态(emerald/amber/rose):
  ```
  bg-emerald-50 text-emerald-700 border-emerald-200
    → bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800
  ```

#### 1.7 Racks 页

**问题**: `app/racks/page.tsx` 16+ 处 `bg-white`,模式控制、tab list、子卡片、设备总览、托盘全是白。

**修法**: 系统性 `bg-white → bg-white dark:bg-slate-800`(每个 box 单独判):

| 行 | 当前 | 修后 |
|---|---|---|
| 944/945 | 模式控制滑动块 `bg-white` | `bg-white dark:bg-slate-900` |
| 994 | 托盘 `border-slate-100 bg-white` | `bg-white dark:bg-slate-800 dark:border-slate-700` |
| 1299/1306 | tab list `bg-white` | `bg-white dark:bg-slate-900 dark:border-slate-700` |
| 1310/1317/1324 | TabTrigger active `bg-white` | `bg-white dark:bg-slate-800` |
| 1335/1341 | 恢复模式 active `bg-white` | `bg-white dark:bg-slate-800` |
| 1367/1387/1431/1441/1479 | 子卡片 `bg-white rounded-lg p-3` | `bg-white dark:bg-slate-800 dark:border-slate-700` |
| 1540/1561/1579/1595 | 设备总览 `bg-white p-4` | `bg-white dark:bg-slate-800 dark:border-slate-700` |

#### 1.8 Tasks viewSwitcher

**问题**: `app/tasks/page.tsx:411` 容器 `bg-white` + 激活 `bg-slate-900`。

**修法**:
- 容器: `bg-white dark:bg-slate-800 dark:border-slate-700`
- 激活: `bg-slate-900 text-white` → 浅色下深底白字 OK;暗色下需 `dark:bg-slate-100 dark:text-slate-900`
- inactive `text-slate-600 hover:bg-slate-100` → `text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700`

#### 1.9 Settings 容器

**问题**: 15+ 处 `bg-slate-50 p-X` 容器 + 缺 dark border。

**修法**: 系统加 `dark:bg-slate-900/50 dark:border-slate-700`,text 加 `dark:text-slate-*`(`dark.css` 已自动重映射,但 `border` 没)。

提示卡 amber/red:
- `border-amber-200 bg-amber-50 text-amber-800` → `bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800`

#### 1.10 状态 chip(text 不变暗色)

**问题**: `bg-blue-50 text-blue-700` / `bg-amber-50 text-amber-700` 等被 `dark.css` 重映射 `bg`,但 `text-*` 是深色(`blue-700`),在暗色下深底浅深色看不清。

**修法**: 整套 `bg-X-50 text-X-700` → `bg-X-50 text-X-700 dark:bg-X-900/30 dark:text-X-300`(所有提示条、徽章)。

涉及范围(逐文件):
- `app/sites/page.tsx:389` row 选中 `bg-blue-50` + `text-blue-700`
- `app/users/page.tsx:226` 错误 + `:323` 底部 amber + `:278` row 选中
- `app/search/page.tsx:191` blocker amber + `:210` 权限范围 blue50/30
- `app/sync/page.tsx:992` row 选中
- `app/logs/page.tsx:430` amber + `:560` row 选中
- `app/tasks/page.tsx:563/846` blue/red chip + `:969/972` 提示条
- 全部 dashboard 子组件:`dashboard-summary-bar.tsx:45-56`、`dashboard-recent-syncs.tsx:25-29`、`site-health-heatmap.tsx:14-18`、`alert-center.tsx:117`、`task-table.tsx:22-28`、`welcome-banner.tsx:131-133`、`stats-cards.tsx:92-175`
- `components/platform/capsule-tabs.tsx:174-178`
- `components/site/site-selector.tsx:78/104`
- `components/shared/empty-state.tsx:48-83`

#### 1.11 状态映射函数

**问题**: `components/platform/status-badges.tsx` + 各 page 的 `deviceStatusMap / slotStatusColor / typeBadge / statusBadge / syncStatusColor / logLevelColor / typeColors` 全表缺 dark。

**修法**:
- `components/platform/status-badges.tsx`:整张表加 `dark:bg-X-900/30 dark:text-X-300` + `dark:border-X-800`
- `app/racks/page.tsx:54-62`: `slotStatusColor` + `logLevelColor` 同上
- `app/sites/page.tsx:47-52`: `deviceStatusMap` 同上
- `app/users/page.tsx:372-376`: auth status 同上
- `app/tasks/page.tsx:42-50`: `typeColors` + `logLevelColor` 同上
- `app/volumes/page.tsx:46-57`: `typeBadge` + `statusBadge` 同上
- `app/logs/page.tsx:85-110`: status/badge color 同上
- `app/sync/page.tsx:130-140`: `syncStatusColor` 同上

### Phase 2 — P1 Recharts

#### 2.1 ChartThemeProvider

**问题**: `components/dashboard/sync-trend-chart.tsx` `CartesianGrid stroke="#e2e8f0"` + Bar fill hardcoded。

**修法**:
- 新增 `lib/chart-theme.ts`:
  ```ts
  export const chartColors = {
    light: { grid: "#e2e8f0", axis: "#94a3b8", bar1: "#475569", bar2: "#94a3b8", bar3: "#cbd5e1" },
    dark:  { grid: "#334155", axis: "#64748b", bar1: "#94a3b8", bar2: "#cbd5e1", bar3: "#e2e8f0" },
  }
  ```
- SyncTrendChart 用 `useTheme()` 选 light/dark
- tooltip `backgroundColor` 动态(已 hardcoded `#1e293b`,浅色下应 `#ffffff`)

### Phase 3 — P2 半透明 hover / 装饰

#### 3.1 hover:bg-slate-50/100

**修法**: `dark.css` 加:
```css
.dark .hover\:bg-slate-50\/50:hover,
.dark .hover\:bg-slate-50:hover,
.dark .hover\:bg-slate-100\/50:hover,
.dark .hover\:bg-slate-100:hover,
.dark .hover\:bg-blue-50:hover,
.dark .hover\:bg-blue-50\/50:hover {
  background-color: rgb(30 41 59 / 0.6) !important;  /* slate-800/60 */
}
```

#### 3.2 border-white/10/15 bg-white/5/10(命令面板 / CommandCenterPanel)

**修法**: 仅 CommandCenterPanel 浅色父处改为 `bg-white/60 dark:bg-white/5`。

---

## 3. 不动的部分(明确边界)

| 元素 | 不动原因 |
|---|---|
| `Sidebar` 整段深色 | enterprise-productization 已定型,产品差异化 |
| `Login` 主背景 `#020617` + Canvas 流星 | 用户在 login-redesign Sprint 明确要求保持深色星空感(但 LoginCard 内部要跟随主题) |
| `next-themes` 配置 | 已 OK,只是部分组件没消费 |
| `dark.css` 已有的 `!important` 规则 | 优先级最高,不冲突 |
| 浅色模式所有 class | 用户明确不动 |

---

## 4. 验证标准(必须通过)

### 4.1 视觉验证(用户手工)

- 切换 `light` ↔ `dark` ↔ `system`
- 10 个页面 (`/` `/tasks` `/racks` `/sites` `/sync` `/search` `/settings` `/logs` `/users` `/volumes` `/login`) 都过一遍
- 检查:
  - 文字清晰可读(无白底白字 / 深底深字)
  - 卡片/模块无整块过曝(暗色下不全白)
  - 边框可见
  - 状态 chip 在暗色下文字 + 背景对比度 OK
  - Recharts 图表在两主题下都正常
- 浅色模式 0 回归

### 4.2 e2e 验证(`scripts/e2e/test-dark-mode.ts`)

新增 e2e 脚本,验证:

1. `<html>` 在 cookie/localStorage 控制下可切换 class
2. `/login / / /tasks /racks /sites /sync /search /settings /logs /users /volumes` 各页 SSR HTML 含 `dark:` 前缀足够多
3. 关键 `data-testid` 在 dark class 下能找到容器
4. `styles/dark.css` 包含特定 `bg-blue-50 dark:bg-blue-950` 风格组合的 source assertion
5. `app/globals.css` 包含新增的 CSS 变量
6. `components/platform/status-badges.tsx` 包含 dark variant
7. 现有 `test-login.ts` 27 项不回归
8. 现有 `test-header-ux-lift.ts` 5 项新增 dark 断言不回归
9. 现有 `test-theme-background.ts` 跑通

### 4.3 构建 + 类型检查

- `pnpm exec tsc --noEmit` ✅
- `pnpm build` ✅
- `pnpm e2e:dark-mode` ✅
- `pnpm e2e:header-ux-lift` ✅
- `pnpm e2e:login` ✅
- `pnpm e2e:theme-background` ✅

---

## 5. 涉及 Req IDs

| Req ID | 状态 | 备注 |
|---|---|---|
| `requirements.md §6.2` | `partial` → `complete` | 视觉合规:暗色主题全部页面对齐 |

非功能需求,不涉及后端 / 同步 / 控制链路。

---

## 6. 风险与权衡

### 风险

| 风险 | 缓解 |
|---|---|
| 改动文件多(30+) → 容易漏 | e2e 100% 覆盖 + PageHeader 验收脚本 + 抽样人工 |
| dark.css `!important` 与 Tailwind `dark:` 冲突 | Tailwind `dark:` 生成特异性 ≥ `!important`,实测 |
| 用户感觉"暗色变得不够暗" | 给 `--app-bg` 加更深的 `#020617` + 加 `--app-surface-2/3` 区分层次 |
| LoginCard 浅色下"玻璃感"消失 | 用 `bg-white/70 backdrop-blur-2xl` 保持质感 |

### 权衡

- **Token 化 vs 类名**: 选 token(`--info-bg` 等)与类名(`dark:bg-blue-950/30`)并存。Token 给新代码用,老代码不强制改。**理由**:100% 重写老代码成本太高,逐文件加 `dark:` 更稳。
- **Recharts 修法**: 选 `useTheme()` 动态选 palette,**不**用 CSS 变量注入 Recharts(后者需要改 recharts 内部 props 支持)。**理由**:Recharts SVG `fill` 不读 CSS 变量。

---

## 7. 不在本 Sprint

- 主题切换器 UI 重做(当前是 Sun/Moon 切换,功能 OK)
- 系统主题检测优化
- 高对比度 / 色盲模式(后续 Sprint)
- Sidebar 跟随浅色主题(产品决策,等领导)
- `tailwind.config.ts` 引入新 color

---

## 8. Verdict

`pass` 设计稿,等待 plan + 实现。
