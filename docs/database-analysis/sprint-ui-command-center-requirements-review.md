# Sprint UI Command Center Requirements Review

> Date: 2026-06-21
> Status: UI clarity + worst-case coverage in place; no requirement upgrades

---

## Requirement IDs

- REQ-4.2.1 (任务控制 — 暂停/恢复走控制队列)
- REQ-4.2.2 (任务控制 — 新建/重置/巡检/恢复)
- REQ-4.3.1 (盘笼)
- REQ-5.1.1 (日志)
- REQ-6.3.1 (UX 一致性)
- REQ-6.4.2 (可测试性 / 事件级 e2e)

## Backend Reality

UI 改动不引入新的后端实现：

- 任务创建：`POST /api/tasks/create` 已存在 (R.62)，UI 仅对齐文案 (button testid `task-create-open`、toast `任务创建命令已提交`、dialog description `站点 Agent 拉取后在站点库创建真实任务`)。
- Racks 存储浏览/数据恢复：在 API 模式下显示 `EmptyState severity="blocked"`，不假装真实目录树；不写新的 mock fallback。
- 命令中心首页 (Command Center)：消费既有真实 API (`/api/dashboard/summary`, `/api/sync/sites/status`, `/api/sync/packages`, `/api/control/commands`, `/api/alerts`)，不新建端点。
- 首访引导：单例全局 (`<FirstRunCoach>` 仅在 `AppShell` 渲染一次)，localStorage `unified.firstRun.disabled` 支持一键不再显示，resize-safe (fixed 定位不叠加 `window.scrollY`/`scrollX`)。

## UI Reality

| 页面 | 主要改动 | 文案合规 |
|---|---|---|
| 通用 | `PageHeader` 暴露 `source` / `requirement` 徽章 slot | "数据源"/"对应需求" 字段可追溯 |
| 通用 | `StatCard` 点击态: `cursor-pointer` + `hover:border-blue-200` + `focus-visible:ring-2` | 无误导 |
| 通用 | `EmptyState` 增加 `severity="empty"\|"blocked"\|"error"` 三档 | blocked/error 用 amber/red 配色 |
| `/` (总控首页) | 4 大通道 (同步/控制/检索/安全) + `strict 29/45` + `candidate 45/45` 双 Badge | "pg_dump 白名单"/"control_command"/"ES boundary"/"JWT" 等真实证据 |
| `/tasks` | 新建对话框文案已对齐 `任务创建命令已提交 / 等待站点 Agent 执行`，无"已暂停"等误导 | 通过 |
| `/racks` | Tabs 用 `TabsContent` 包结构 (修复 Tab 切换卡死)；`设备总览` Tab 增加 `设备列表预览` 区 (前 5 台) | API 模式 browse/restore 显示 `EmptyState severity="blocked"` |
| 全站 | `FirstRunCoach` 唯一实例，`AppShell` 全 10 路由覆盖，dismiss-all 支持 | 通过 |

## Mock / Simulator / DRY_RUN 标记

| 项 | 状态 |
|---|---|
| 真实后端调用 | `/api/tasks/create` (R.62 站点 Agent INSERT 路径) |
| 控制队列 | `control_command` 提交 → Site Agent poll → 真实 `tbl_task` INSERT (R.63/R.58) |
| 失败 closed | `EmptyState severity="blocked"` 显示源端/外部依赖阻塞原因 |
| DRY_RUN | 无新增 DRY_RUN |
| 模拟数据 | 命令中心/racks 概览均读真实 API，禁用 mock fallback |

## 强制事件级测试 (R.5 §10)

| 测试脚本 | 覆盖 | 状态 |
|---|---|---|
| `scripts/e2e/test-header-ux-lift.ts` | PageHeader/StatCard/EmptyState 契约 + FirstRunCoach 稳定性 + AppShell 10 路由覆盖 + 跨页面无 mock 承诺 | 通过 (新增 7 项断言) |
| `scripts/e2e/test-command-center.ts` | 4 通道锚点 + strict/candidate Badge + 通道文案证据 | 通过 (新增 3 项断言) |
| `scripts/e2e/test-tasks.ts` | `task-create-open` testid + `/api/tasks/create` + 移除节点跳转旧口径 + dialog 文案 | 通过 (新增 4 项断言) |
| `scripts/e2e/test-racks.ts` | TabsContent 结构 + `severity="blocked"` 驱动 + 设备列表预览 | 通过 (新增 4 项断言) |

## 未完成项

- ADFS/LDAP 真实接入 (5 项 `blocked_by_auth` 不变)
- ES/ClickHouse 部署 (1 项 `blocked_by_external_system` 不变)
- 设备总览 Tab 内容增强 (后续接入 `unified_slots` 实时明细)

## Verdict

**pass** (UI 清晰度 + 事件级覆盖完成，无 requirements 单纯因视觉改动升级)。

---

Commits in this sprint:

- `style(ui): standardize command center primitives` (Task 1)
- `style(ui): sharpen command center hierarchy` (Task 2)
- `fix(tasks): align task creation with total control` (Task 3)
- `fix(racks): restore tab switching and blocked state` (Task 4)
- `fix(ui): stabilize first run guide assertions` (Task 5)