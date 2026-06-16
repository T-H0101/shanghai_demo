# Sprint UI-2026-06-B — Header UX 提升 + 首访引导

> 任务: header 精简 + 重点 Tooltip + 首访引导 + 表格空状态引导

## 1. 背景与动机

### 1.1 触发问题

- 用户反馈: "header 挤在一起"
- 用户希望"悬浮在按钮上有正确引导"
- 用户希望整体 UX 提升

### 1.2 当前 Header 现状（已审计）

**从左到右 9 个元素**:
1. ☰ 移动菜单 (mobile only)
2. 搜索框 (跳 /search, 含"待 ES"黄徽)
3. ⌘K 命令面板触发器
4. 站点选择器 SiteSelector
5. "核心服务: 正常运行 🟢" 文字
6. "状态检查于: 2026/6/16 16:00"
7. "SYSTEM 健康度: 正常"
8. 通知铃铛
9. 用户块 (姓名+副标题+头像+Logout 按钮)

**问题**:
- 3 处健康状态信息冗余 (#5/#6/#7)
- 用户块挤 4 列信息 (#9)
- "待 ES" 永久黄色徽章 — 负面提醒
- 多数按钮只用 `title=""` — 延迟 0.5s 才显示, 样式不可定制
- 桌面 1152px 装 9 元素, 平均 128px → 极挤

### 1.3 不做什么 (YAGNI)

- ❌ 不改 UI 风格 (CLAUDE.md)
- ❌ 不替换技术栈
- ❌ 不引入新库 (Radix Tooltip 项目已有)
- ❌ 不改 e2e testid (兼容 R.5 §保留)
- ❌ 不动 lib/types/* Adapter 接口
- ❌ 不做全功能 Tour 引导 (Radix Popover/Tooltip 即可, 不引入 driver.js)

## 2. 目标 (Success Criteria)

### 2.1 必达

- ✅ e2e:all 全 0 fail (含 e2e:header-ux-lift 新增)
- ✅ tsc / build / lint 无错
- ✅ 现有 testid 100% 保留 (global-search-entry, command-palette-trigger, task-row-pause 等)
- ✅ Header 元素从 9 → 5 (移动端) / 7 (桌面)
- ✅ 所有图标按钮有 Tooltip (按重点项原则, 不叨扰纯文字按钮)
- ✅ 首访引导 1.5s 后出现, 2s 后自动消失, 仅一次

### 2.2 用户体验

1. **Header 视觉清爽** — 三合一健康徽章, 头像下拉菜单
2. **悬停即懂** — Tooltip 200ms 出现, 解释按钮用途 (如 "提交任务暂停命令, 等待站点 Agent 执行")
3. **首访不迷路** — Dashboard 第一次访问 1.5s 后高亮 ⌘K + 健康徽章
4. **空状态不冷场** — 表格空 → 友好提示 + 跳转入口

## 3. 设计方案

### 3.1 Header 精简改造 (components/dashboard/header.tsx)

**Before (9 元素)**:
```
☰ | [搜索 待ES] [⌘K] | 站点 | 核心服务:正常🟢 | 状态检查于:16:00 | 健康度:正常 | 🔔 | 姓名+角色+部门 [头像] [Logout]
```

**After (7 元素 desktop / 5 元素 mobile)**:
```
☰ | [⌘K 搜索框] | 站点 | 🟢三合一徽章 (hover 看时间) | 🔔 | [头像▼]
```

**变化点**:
| # | 改动 | 说明 |
|---|---|---|
| 1 | 搜索框 + ⌘K 触发器**合并** | 单一 ⌘K 触发器, 宽度 w-72 → w-64, 提示 "搜索页面、站点、操作…" |
| 2 | 搜索框去掉 "待 ES" 黄徽 | 加 Tooltip 解释 "阻塞于 ES/ClickHouse 未接入" |
| 3 | 3 处健康状态**合并为单一徽章** | "🟢 服务正常" + Tooltip 显示检查时间; 点击展开 Drawer 看详情 |
| 4 | 用户块**只剩头像** | 点击头像弹出 DropdownMenu 含: 姓名/角色/部门 + 设置链接 + 退出 |
| 5 | 所有图标按钮加 Tooltip | ⌘K / 健康徽章 / 通知 / 头像 / 站点切换 |

**保留兼容**:
- ✅ `data-testid="global-search-entry"` 仍存在
- ✅ `data-testid="command-palette-trigger"` 仍存在
- ✅ `data-testid="header-user-avatar"` 新增
- ✅ `data-testid="header-health-badge"` 新增

### 3.2 Tooltip 组件 (components/shared/tooltip.tsx)

封装 Radix Tooltip, 统一 API:
```tsx
<AppTooltip content="提交任务暂停命令, 等待站点 Agent 执行">
  <Button>暂停</Button>
</AppTooltip>
```

**配置**:
- delayDuration: 200ms (R.5 §UX 流畅)
- 位置: 自动避让 (top/bottom/left/right)
- 暗色背景 + 白字 + 阴影 + 圆角
- 键盘可达 (Tab + Enter 触发)

**加挂位置**:
- Header: ⌘K / 健康徽章 / 通知 / 头像 / 站点切换
- Tasks 页面: task-row-pause / task-row-resume (解释"提交控制命令")
- Dashboard: KPI 卡片 (hover 显明细 + 跳转提示)
- Dashboard: WelcomeBanner 快捷按钮 (解释去向)

### 3.3 首访引导 (components/shared/first-run-coach.tsx)

```tsx
<FirstRunCoach
  pageKey="dashboard"
  steps={[
    { selector: '[data-testid="command-palette-trigger"]', message: "按 ⌘K 快速跳转任意页面" },
    { selector: '[data-testid="dashboard-stat-tasks"]', message: "点这里查看任务列表" },
  ]}
/>
```

**实现要点**:
- localStorage key: `unified.firstRun.dashboard` (存访问时间戳)
- 仅在首次访问时显示 (1.5s 后出现, 5s 后自动消失, 也可点 ✕ 关闭)
- 视觉: 高亮圆环 + Tooltip 气泡 + 进度指示 (1/2)
- 不引入 driver.js / react-joyride — 用 Radix Tooltip + 简单定位
- 仅 3 页启用: dashboard / tasks / sites

### 3.4 表格空/错状态引导

**空状态统一组件** (components/shared/empty-state.tsx):
```tsx
<EmptyState
  icon={Inbox}
  title="暂无任务"
  description="等待站点上报任务数据"
  action={{ label: "查看其他站点", href: "/sites" }}
/>
```

**应用位置**:
- Tasks 空 → "暂无任务, 等待站点上报" + 跳转 /sites
- Sites 空 → "暂无注册站点" + 跳转 /settings
- Racks 空 → "暂无设备" + 跳转 /sites
- Volumes 空 → "暂无存储卷" + 跳转 /racks

**错误状态** (components/shared/error-state.tsx):
- 文案: "中心库读取失败, 刷新或联系运维"
- 提供重试按钮

## 4. 实施步骤

### Step 1: Tooltip 共享组件
- 新建 components/shared/tooltip.tsx (封装 Radix)
- 不挂任何页面, 仅骨架

### Step 2: FirstRunCoach 组件
- 新建 components/shared/first-run-coach.tsx
- 不挂任何页面, 仅骨架

### Step 3: EmptyState / ErrorState 共享组件
- 新建 components/shared/empty-state.tsx + error-state.tsx
- 不挂任何页面, 仅骨架

### Step 4: Header 精简改造
- 改 components/dashboard/header.tsx
- 验证 e2e:frontend-integration + e2e:tasks + e2e:full-audit 仍过
- 跑 e2e:all

### Step 5: Tooltip 挂载
- Header 内所有图标按钮
- Tasks 暂停/恢复按钮
- Dashboard KPI 卡片 + WelcomeBanner 快捷按钮

### Step 6: FirstRunCoach 挂载
- app/page.tsx (Dashboard)
- app/tasks/page.tsx (Tasks)
- app/sites/page.tsx (Sites)

### Step 7: EmptyState 替换
- Tasks / Sites / Racks / Volumes 表格空分支
- 不替换 mock 分支 (项目已无 mock)

### Step 8: 事件级测试 + commit

## 5. 风险与回退

| 风险 | 缓解 |
|---|---|
| Tooltip 覆盖原有 e2e 检查 | 保留所有 testid, Tooltip 仅包裹, 不改 props |
| FirstRunCoach 每次都显示 | localStorage 持久化, 仅首次 |
| EmptyState 改动破坏表格渲染 | 仅替换 `<div>暂无数据</div>` 部分, 不动 thead/tbody |
| Header 改动破坏响应式 | 移动端 hidden + 桌面端 flex, 渐进步骤验证 |

## 6. 不在本次 Sprint 范围

- ❌ 真实全文检索 (REQ-4.1.1, blocked_by_external_system)
- ❌ 通知中心后端接入 (现有 mock store, 不动)
- ❌ ADFS 真实登录 (REQ-2.2, blocked_by_auth)
- ❌ Header Drawer 看健康详情 (本期只徽章 + Tooltip, 详情页后续)

## 7. 验收标准

| 项 | 通过条件 |
|---|---|
| `pnpm exec tsc --noEmit` | 0 error |
| `pnpm build` | success |
| `pnpm e2e:all` | 0 fail |
| Header 元素 | 桌面 ≤ 7, 移动 ≤ 5 |
| Tooltip 数 | header ≥ 5, Tasks 按钮 2, Dashboard 卡片 4 |
| FirstRunCoach | 3 页挂载, localStorage 持久化 |
| EmptyState | ≥ 4 页应用 |
| Sprint review | 产出 `docs/database-analysis/sprint-UI-2026-06-B-requirements-review.md` |

## 8. e2e 覆盖

新增 `scripts/e2e/test-header-ux-lift.ts` 覆盖:
- Tooltip wrapper 源码存在 + Radix Tooltip 使用
- FirstRunCoach 组件存在 + localStorage key
- EmptyState/ErrorState 组件存在
- Header 改造后元素 ≤ 7 个 (统计 testid)
- Header 仍含 global-search-entry / command-palette-trigger
- Tasks 按钮 Tooltip 挂载
- Dashboard KPI Tooltip 挂载
- 运行时 HTTP 200 / API 仍可用

加到 `pnpm e2e:all` 末尾。
