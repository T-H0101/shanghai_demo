# Sprint UI-2026-06 — Console Usability Lift

> 任务: 修复白盒测试 (R.19D) + 全面 UI 改造, 让用户第一眼就想用

## 1. 背景与动机

### 1.1 触发问题

- 用户反馈: "测试不通过, UI 不够好"
- `docs/testing/r19d-site-agent-control-whitebox-guide.md` 白盒测试 e2e:site-agent-control 失败: 500 (password auth)
- 全套 e2e (Dashboard/Tasks/Sync/Control/Sites/Search/Settings/Users/Racks/Volumes/Logs/Exports/R.16/R.19A-D/Frontend/Full Audit) 大量失败

### 1.2 根因

`.env.local` 中 `DATABASE_URL=postgresql://unified:XZTY_intern\$123@...` 用了反斜杠转义美元符, 但 Next.js 的 dotenv 不识别这种转义, 导致:
- `\$1` 在 Next.js 解析中被当作未定义变量替换为**空字符串**, 结果 dev server 拿到密码 `XZTY_intern`
- 同时 `set -a; source .env.local` 的 shell 测试脚本会先解析 `\$` 为 `$`, 拿到正确密码 `XZTY_intern$123`
- 因此 dev server HTTP API 全部失败 (500), 但 e2e 脚本通过 psql 直连仍能验证数据库 — 形成"dev 服务挂而脚本通过"的迷惑现象

### 1.3 UI 现状

- 现有 Dashboard 已经布局合理: 顶部 dataSource + summary bar + 4 stats cards + sync trend + recent syncs + tasks + alerts
- 每个功能页 (sites/racks/tasks/volumes/users/search/settings/logs) 都是 400-1500 行的大文件, 内部重复的"过滤 + 表格 + 对话框"模式
- 没有跨页链接, 没有全局快捷键, 没有命令面板
- Tasks 页已经支持暂停/恢复 + 控制命令提交, 但 UI 反馈不够直观

### 1.4 不做什么 (YAGNI)

- ❌ 不切换到 dark mode / OLED 主题 (CLAUDE.md: "不改 UI 风格")
- ❌ 不替换 Tailwind/Radix/Lucide 技术栈
- ❌ 不修改 `lib/types/*` Adapter 接口
- ❌ 不新增 mock 数据
- ❌ 不替换现有 API provider 数据源
- ❌ 不动 auth/RBAC 系统 (Sprint 5.x 解锁)

## 2. 目标 (Success Criteria)

### 2.1 必达

- ✅ 白盒测试 e2e:site-agent-control 全 PASS
- ✅ e2e:all 全 0 fail
- ✅ tsc / build / lint 无错
- ✅ 现有页面功能 100% 保留, 不删除按钮/交互
- ✅ 所有 8 项 R.5 "前端变更强制披露" 完整记录
- ✅ 所有 10 项 R.5 "事件验证" 完整覆盖

### 2.2 用户体验

1. **第一眼冲击力**: Dashboard 顶部加 "系统状态总览 + 关键操作 1-2-3" 横幅
2. **跨页联动**: Dashboard 告警 → Tasks 详情, Dashboard 同步趋势 → Sync 页
3. **全局命令面板 (⌘K)**: 跨页跳转 + 快速任务控制
4. **控制反馈透明**: Tasks 暂停/恢复后, 显示命令已提交 → Agent 处理中 → 完成 的实时状态
5. **共享组件**: 把 site-code 切换、表格分页、KPI 卡片抽成共享组件, 减代码量

## 3. 设计方案

### 3.1 修复白盒测试 (高优先级, 1 个 commit)

| 文件 | 修改 |
|---|---|
| `.env.local` | `DATABASE_URL` 中 `\$` → `%24` (URL-encode); `SOURCE_DATABASE_URL` 同样 |
| 无需重启, Next.js 加载 `.env.local` 自动重读 | dev server 重启 |

> URL-encode 密码里的 `$` 是 Next.js dotenv 不解释、PostgreSQL 客户端可解码的标准方式. 这样既保留 shell 直读 `set -a; source` 时也能用同样的密码 (shell 解析 `%24` 字面保留, 然后 libpq 解码).

### 3.2 UI 改造 — 整合 + 体验

#### 3.2.1 全局组件抽取 (components/shared/)

| 新文件 | 作用 |
|---|---|
| `components/shared/kpi-card.tsx` | 统一 KPI 卡片 (dashboard 已经在用, 抽出来) |
| `components/shared/page-toolbar.tsx` | 页面顶部工具栏 (搜索 + 筛选 + 操作按钮) |
| `components/shared/data-table.tsx` | 通用表格 (列定义 + 排序 + 分页 + 加载/空/错误态) |
| `components/shared/cross-page-link.tsx` | 跨页跳转链接 (Dashboard 卡片可点跳详情) |
| `components/shared/control-status-badge.tsx` | 控制命令状态徽章 (pending/running/success/failed) |
| `components/shared/site-context-bar.tsx` | 站点切换器 (已有 `useSite()`, 加 UI) |

#### 3.2.2 Dashboard 改造 (app/page.tsx)

**改造前**:
```
[dataSource strip]
[DashboardSummaryBar]
[StatsCards]
[SyncTrendChart | RecentSyncs]
[TaskTable | AlertCenter]
```

**改造后**:
```
[welcome 横幅: 当前用户 + 系统状态 + 快捷操作按钮 ⌘K 提示]
[dataSource strip (R.15 保持)]
[DashboardSummaryBar]
[4 KPI cards (共享组件, hover 跳详情页)]
[Sync trend + Recent syncs (点击跳 /sync)]
[Tasks 表格 + AlertCenter (告警点击跳 /tasks?status=alert)]
[新增: 命令面板入口 + 全局 ⌘K 监听]
```

#### 3.2.3 全局命令面板 (components/shared/command-palette.tsx)

按 `⌘K` / `Ctrl+K` 打开, 模糊搜索:
- 页面跳转: 控制台 / 站点 / 任务 / 盘架 / 卷 / 用户 / 日志 / 检索 / 设置
- 快速任务操作: 暂停最近任务 / 查看最近告警
- 站点切换: 切换 SH01 / BJ02 / ...

不修改业务逻辑, 只触发 `router.push()` 或调现有 API.

#### 3.2.4 Tasks 页增强 (app/tasks/page.tsx)

已有 16 项 e2e 全过. 改造点:
- 控制按钮点击后, 显示"命令已提交, 等待 Agent 执行"loading 状态 (现有已部分实现, 强化视觉反馈)
- 表格行加状态徽章组件 (复用 control-status-badge)
- 顶部加搜索栏 (跨字段模糊搜索现有已经实现, 强化样式)

#### 3.2.5 跨页链接 (CrossPageLink)

Dashboard 的:
- KPI 卡片 → 对应详情页 (`/tasks?status=failed` / `/racks?status=offline`)
- Recent Syncs 行 → `/sync?packageId=xxx`
- Alert Center 告警 → `/tasks/{id}`

不破坏现有 e2e (因为 e2e 检查的是页面可达性, 链接是额外功能).

## 4. 实施步骤 (Plan 概要)

### Step 1: 修复白盒测试 + 跑 e2e:all 验证
- 改 `.env.local` 2 行 (DATABASE_URL, SOURCE_DATABASE_URL)
- 重启 dev server
- 跑 `pnpm e2e:all`, 确认 0 fail

### Step 2: UI 改造 - 全局共享组件
- 新建 `components/shared/` 5 个共享组件
- 不立即应用, 先有组件骨架

### Step 3: Dashboard 改造
- 改 `app/page.tsx` 引入欢迎横幅 + 跨页链接
- 加 `components/dashboard/welcome-banner.tsx`

### Step 4: 全局命令面板
- 新建 `components/shared/command-palette.tsx`
- 在 `app/layout.tsx` 引入

### Step 5: Tasks 页控制反馈强化
- 改造 `app/tasks/page.tsx` 的暂停/恢复按钮区域

### Step 6: 前端事件级测试 (R.5 强制)
- 改/新增 e2e 脚本验证 10 项
- 跑 tsc / build / e2e:all / lint

### Step 7: commit + 文档同步

## 5. 风险与回退

| 风险 | 缓解 |
|---|---|
| 共享组件改动破坏现有 e2e | Step 2 不挂到任何页面, Step 3-5 逐页改, 改完跑 e2e 增量验证 |
| 命令面板与现有快捷键冲突 | 命令面板只在 `⌘K` / `Ctrl+K` 触发, 不绑其他键 |
| 跨页链接点击后查询参数不识别 | 各页支持 `?status=xxx` 查询参数 (已部分支持, 增量加) |
| UI 改造引入新 bug | 每个 commit 单独可回退 |

## 6. 不在本次 Sprint 范围

- ❌ 真正的全文检索 (REQ-4.1, blocked_by_external_system ES)
- ❌ ADFS 真实登录 (REQ-2.2, blocked_by_auth)
- ❌ reset/priority/inspect/recovery 任务动作 (R.19D §边界 已声明未实现)
- ❌ 站点 schema 变更 (附录 A, 由领导决策)
- ❌ 大表 tbl_file/tbl_folder 同步 (走 ES/CH, 后续 Sprint)

## 7. 验收标准 (Verdict)

| 项 | 通过条件 |
|---|---|
| `pnpm exec tsc --noEmit` | 无错误 |
| `pnpm build` | 成功 |
| `pnpm e2e:all` | 0 fail |
| `pnpm lint` | 无 error (warning 允许) |
| e2e:site-agent-control | 全 PASS (已通过) |
| R.5 §前端变更清单 | 8 项完整 |
| R.5 §事件测试 | 10 项完整 |
| 现有页面功能 | 100% 保留 |
| Sprint review | 输出 `docs/database-analysis/sprint-UI-2026-06-requirements-review.md` |

