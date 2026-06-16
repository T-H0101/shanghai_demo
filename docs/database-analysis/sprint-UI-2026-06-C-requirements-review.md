# Sprint UI-2026-06-C — Hover/UX 精细化 — Requirements Review

## 1. Sprint 概览

| 项 | 值 |
|---|---|
| Sprint | UI-2026-06-C |
| 日期 | 2026-06-16 |
| 主题 | Hover/UX 精细化: 扩充引导 + 补缺失 Tooltip |
| 触发 | 用户反馈"hover 不匹配, 引导只有两个比较少" |
| 改动文件 | 5 |

## 2. Requirement IDs

| Req ID | 关联 |
|---|---|
| REQ-1.2.1 | 集团层统一管控平台 (Header Tooltip 解释) |
| REQ-4.2 | 任务管理 (Tasks Tooltip + 引导) |
| REQ-4.2.3 | 站点管理 (Sites Tooltip + 引导) |
| REQ-6.3.1 | 兼容与可维护 |

## 3. Implementation

| 文件 | 修改类型 | 变化 |
|---|---|---|
| `app/page.tsx` | FirstRunCoach 步骤 2 → 5 | +3 步骤: KPI设备 / 同步趋势 / 任务表格 |
| `app/tasks/page.tsx` | 加 4 个 testid + AppTooltip | 搜索/类型/阶段筛选 + 重置按钮 |
| `app/sites/page.tsx` | 加 3 个 AppTooltip + FirstRunCoach | 刷新/注册/一致性按钮 Tooltip |
| `components/dashboard/task-table.tsx` | 加 data-testid | dashboard-task-table |
| `components/dashboard/dashboard-recent-syncs.tsx` | 加 data-testid | dashboard-recent-syncs |
| `scripts/e2e/test-header-ux-lift.ts` | 扩充 23 项 | 53 → 76 项 |

## 4. Backend reality

**0 新 API / 0 schema 变更**。本 Sprint 纯 UI 精细化。

## 5. UI reality

### 5.1 FirstRunCoach 步骤扩充 (2 → 11)

| 页面 | Before | After |
|---|---|---|
| Dashboard | 2 (⌘K, KPI 任务) | **5** (+ KPI 设备, + 同步趋势, + 任务表格) |
| Tasks | 1 (暂停按钮) | **4** (+ 搜索输入, + 阶段筛选, + 重置按钮) |
| Sites | 0 | **2** (+ 刷新, + 一致性) |

### 5.2 AppTooltip 扩充 (10 → 17)

| 位置 | Before | After |
|---|---|---|
| Header | 7 | 7 (保持) |
| Tasks | 2 (暂停/恢复) | **6** (+ 搜索, + 类型筛选, + 阶段筛选, + 重置) |
| Sites | 0 | **3** (+ 刷新, + 注册, + 一致性) |
| Dashboard 卡片 | 已 hover 反馈 | (无新增) |

### 5.3 新增 testid

- `tasks-search-input`, `tasks-type-filter`, `tasks-phase-filter`, `tasks-reset-filters`
- `dashboard-task-table`, `dashboard-recent-syncs`

## 6. Hover/鼠标 匹配度

### 6.1 已确认 hover 反馈的按钮
- ✅ Sites 刷新/注册/一致性: cursor-pointer + hover:bg-slate-100 + transition-colors
- ✅ Tasks 重置: cursor-pointer + hover:bg-slate-100 + transition-colors
- ✅ Tasks 搜索/筛选/阶段 Select: AppTooltip + 默认 cursor-pointer (Radix Select)
- ✅ Header 7 个图标按钮: AppTooltip + cursor-pointer
- ✅ Dashboard KPI 4 张卡片: cursor-pointer + focus-visible ring + transition-all

### 6.2 仍使用浏览器原生 title 的（不打算改）
- e2e 兼容保留按钮（hidden，视觉无影响）
- 表格行 `<tr>` 行点击跳转（自然有 cursor-pointer）
- 链接 `<Link>` 默认 cursor-pointer

## 7. Verdict

**pass** — 76/76 事件级测试 + 全套 e2e 0 fail

## 8. 测试结果

```
pnpm exec tsc --noEmit         ✅ 0 error
pnpm e2e:all                   ✅ 0 fail
  - e2e:header-ux-lift         ✅ 76 pass (53 → 76, 扩充 23 项)
  - e2e:dashboard              ✅ 9 pass
  - e2e:tasks                  ✅ 16 pass
  - e2e:sites                  ✅ 22 pass
  - e2e:frontend-integration   ✅ 9 pass
  - e2e:site-agent-control     ✅ R.19D PASS
```
