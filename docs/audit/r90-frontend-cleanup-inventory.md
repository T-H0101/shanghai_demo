# R.90 前端清理 — 静态扫描清单 (Inventory Only)

> **范围**: 仅静态扫描, **未修改任何文件, 未删除任何文件**。
> **扫描目标**: `app/`, `components/`, `lib/api/`
> **生成时间**: 2026-06-29
> **扫描 Sprint**: R.90 (前端清理前置审计)

---

## 1. Executive Summary

### 1.1 总体计数

| 类别 | Must-fix | Should-fix | Acceptable-context | 总计 |
|---|---:|---:|---:|---:|
| **A: Mock data leaks** | 9 | 8 | 14 | 31 |
| **B: Hardcoded values** | 3 | 8 | 7 | 18 |
| **C: Page comments / user-visible "待接入"** | 4 | 9 | 8 | 21 |
| **合计** | **16** | **25** | **29** | **70** |

### 1.2 优先级页面命中统计 (按页面)

| 优先级页面 | A 类 | B 类 | C 类 | 合计 |
|---|---:|---:|---:|---:|
| **app/racks/** | 3 | 0 | 0 | 3 |
| **app/dashboard/** (components/dashboard/*) | 4 | 0 | 2 | 6 |
| **app/settings/** | 0 | 0 | 4 | 4 |
| **app/sites/** | 0 | 1 | 1 | 2 |
| **app/sync/** | 0 | 5 | 1 | 6 |
| **app/tasks/** | 0 | 0 | 3 | 3 |
| **app/logs/** | 0 | 0 | 1 | 1 |
| **app/search/** | 0 | 1 | 2 | 3 |
| **app/users/** | 0 | 0 | 1 | 1 |
| **app/volumes/** | 2 | 0 | 0 | 2 |
| **app/login/** | 0 | 1 | 0 | 1 |
| **lib/api/ (核心)** | 8 | 0 | 2 | 10 |
| **全局 UI (global-control-ball, header)** | 0 | 0 | 3 | 3 |

### 1.3 Top 5 优先级关注页面

1. **`app/racks/page.tsx`** — 直接 `import "@/lib/mock/racks"`, 完全绕过 API mode 检查 (A1.1, A4.1, A4.2)
2. **`lib/api/api-providers.ts`** — `apiTaskProvider` / `apiSiteProvider` / `apiRackProvider` / `apiUserProvider` 静默 fallback 到 mock (A2.1-A2.8)
3. **`app/sync/page.tsx`** — 5 处硬编码 `SH01` fallback, 含 UI 按钮文案 (B1.4-B1.8)
4. **`app/api/{auth/permission-sync,sync/trigger,sync/dump-now}/route.ts`** — 3 个生产 API 路由硬编码 `SH01` fallback (B1.1-B1.3)
5. **`app/search/page.tsx`** — 用户可见的 "待接入" 徽章 + 警告横幅 (C2.5, C2.6)

---

## 2. Section A: Mock 数据泄漏 (在非 mock API mode 下回落到 mock)

### A1: 直接 `import` from `lib/mock/*` (非 mock 文件)

| # | 文件 | 行 | 片段 | 严重度 | 说明 |
|---|---|---:|---|---|---|
| A1.1 | `app/racks/page.tsx` | 25 | `import { racks as mockRacks, mockBackupFiles, ... } from "@/lib/mock/racks"` | **must-fix** | 页面级直接 import mock 数据, 完全绕过 `isApiMode` 检查; 在 API 模式下也会使用硬编码 mock 数据 |

### A2: `api*Provider` 内部静默 fallback 到 mock provider

| # | 文件 | 行 | 片段 | 严重度 | 说明 |
|---|---|---:|---|---|---|
| A2.1 | `lib/api/api-providers.ts` | 106-168 | `mockTaskProvider.getAll/getById/getStats/getLogs/createTask/...` | **must-fix** | `apiTaskProvider` 多处方法在 fetch 失败时直接调用 `mockTaskProvider`, 不抛 `ApiUnavailableError` |
| A2.2 | `lib/api/api-providers.ts` | 41-62 | `fetchWithFallback(... () => mockSiteProvider.getAll() ...)` | **must-fix** | `apiSiteProvider.getAll/getById` 在 fetch error 时静默返回 mock, 无错误抛出 |
| A2.3 | `lib/api/api-providers.ts` | 67, 71 | `return mockSiteProvider.syncSite(id)` / `mockSiteProvider.checkConsistency(id)` | **must-fix** | `syncSite` / `checkConsistency` 等写操作完全 mock, 无真实后端 |
| A2.4 | `lib/api/api-providers.ts` | 295-311 | `return mockRackProvider.registerTransfer()` / `mockRackProvider.syncRacks()` | **must-fix** | `apiRackProvider` 所有写操作完全 mock |
| A2.5 | `lib/api/api-providers.ts` | 428-441 | `return mockUserProvider.getStats()` / `mockUserProvider.createUser()` | **must-fix** | `apiUserProvider` 写方法与 `getStats` 完全 mock |
| A2.6 | `lib/api/api-providers.ts` | 331-333 | `const racks = await mockRackProvider.getAll(siteCode)` | **must-fix** | `fetchVolumes()` catch 块用 mock provider 提取 volumes 作为 fallback |
| A2.7 | `lib/api/api-providers.ts` | 26-29 | `tasks: await mockTaskProvider.getStats()` / `mockRackProvider.getStats()` | **must-fix** | `fetchDashboardSummary()` fallback 块调用 mock 聚合器 |
| A2.8 | `lib/api/api-providers.ts` | 350-400 | `Mock alerts from taskAlerts and racks/sites aggregated` | **must-fix** | `fetchAlerts()` fallback 块手动从 mock provider 聚合告警 |
| A2.9 | `lib/api/index.ts` | 132-153 | `Mock aggregation using mockTaskProvider.getStats()` | should-fix | `getDashboardSummary()` API mode 调用有 mock fallback 的函数; 设计意图可理解但实现脆弱 |
| A2.10 | `lib/api/index.ts` | 161-162 | `const racks = await mockRackProvider.getAll(siteCode)` | should-fix | `getVolumes()` mock-mode 分支直接调用 `mockRackProvider` |
| A2.11 | `lib/api/index.ts` | 170-213 | `Mock alert aggregation from taskAlerts/racks/sites` | should-fix | `getAlerts()` mock-mode 分支手动聚合 |

### A3: 静默 fallback 模式 (`if (!api) return mockData`)

| # | 文件 | 行 | 片段 | 严重度 | 说明 |
|---|---|---:|---|---|---|
| A3.1 | `lib/api/dashboard-provider.ts` | 76-79 | `if (!isApiMode) { return { data: null, source: "mock", error: null } }` | should-fix | `fetchDashboardSummary()` 非 API mode 返回 mock; 显式 `source: "mock"` 标记是好的实践 |
| A3.2 | `lib/api/dashboard-provider.ts` | 101-103 | `if (!isApiMode) { return { data: null, source: "mock", error: null } }` | should-fix | 同上 pattern, `fetchRecentSyncs()` |
| A3.3 | `app/volumes/page.tsx` | 115-117 | `if (Array.isArray(result)) { setVolumes(result); setSource("fallback") }` | **must-fix** | `fetchVolumes` 可返回 mock array, 页面用 `Array.isArray()` 判定 fallback 并渲染, 无错误抛出 |

### A4: TODO / FIXME / 历史注释涉及 mock

| # | 文件 | 行 | 片段 | 严重度 | 说明 |
|---|---|---:|---|---|---|
| A4.1 | `app/racks/page.tsx` | 135 | `// R.15: mountForm.siteName 改用真实 /api/sites, 不用 mockSites` | should-fix | 历史注释, 但页面 line 25 仍 import mock 数据用于存储浏览 |
| A4.2 | `app/racks/page.tsx` | 145 | `// R.15: 加载 /api/sites 站点列表 (真实接口, 替 mockSites)` | acceptable-context | 记录已完成迁移的注释 |
| A4.3 | `app/racks/page.tsx` | 410 | `window.addEventListener(MOCK_STORE_EVENT, handler)` | acceptable-context | devtools hook, 仅 mock mode 调试 |
| A4.4 | `app/sites/page.tsx` | 204 | `// 一致性校验 — 替换 mockSiteProvider, 走 R.7 真实 API` | acceptable-context | 记录已完成迁移 |
| A4.5 | `app/search/page.tsx` | 75 | `// 移除原 lib/mock/search 列表 + setTimeout 假"导出成功", 全部走真 /api/search` | acceptable-context | 记录已完成清理 |
| A4.6 | `app/search/page.tsx` | 126 | `// R.14F: 检索结果从真实 /api/search 取 (blocked 时 0 行, 不渲染 mock)` | acceptable-context | 记录正确行为 |
| A4.7 | `app/tasks/page.tsx` | 110 | `// 6) 数据源徽章 (用于头部, 标识当前是 API 还是 mock)` | acceptable-context | UI 特性注释 |
| A4.8 | `app/volumes/page.tsx` | 113 | `// fetchVolumes 返回 ... 或 mock array` | should-fix | 注释承认 mock array fallback 路径 (line 115-117) 是泄漏 |
| A4.9 | `app/api/alerts/route.ts` | 162 | `// 5) 转 DTO (用 alert-adapter 的 MockAlert 接口, 不重复实现)` | acceptable-context | 类型使用, 非数据泄漏 |
| A4.10 | `lib/api/index.ts` | 17 | `// Mock Providers` | acceptable-context | section 注释 |
| A4.11 | `lib/api/index.ts` | 57 | `// 是否使用 Mock 模式` | acceptable-context | 文档注释 |
| A4.12 | `lib/api/index.ts` | 68 | `// 避免静默 fallback 到 mock (UI 应能识别并展示 BLOCKED 状态)` | should-fix | 设计意图注释, 但 `api-providers.ts` 实际有静默 fallback, **注释与代码不一致** |
| A4.13 | `lib/api/dashboard-provider.ts` | 76 | `// mock mode 不走真实端点` | acceptable-context | 记录有意行为 |
| A4.14 | `lib/api/api-providers.ts` | 1-4 | `* API Providers - 调用 Sprint 1 完成的 API 端点 / 数据来自 /api/* 端点，端点内部返回 mock DTO` | should-fix | 文件 header 说"数据来自 /api/* 端点", 但方法 fallback 到 mock provider, **注释误导** |
| A4.15 | `lib/api/api-providers.ts` | 350 | `// Mock alerts 从 taskAlerts 和 racks/sites 聚合` | **must-fix** | 显式记录 `fetchAlerts` 的 mock fallback 行为 |

### A5: `MOCK_STORE_EVENT` 监听器 (mock-mode devtools)

| # | 文件 | 行 | 片段 | 严重度 | 说明 |
|---|---|---:|---|---|---|
| A5.1 | `app/racks/page.tsx` | 410-411 | `window.addEventListener(MOCK_STORE_EVENT, handler)` | acceptable-context | devtools 监听器, 仅 mock mode 调试 |
| A5.2 | `components/dashboard/stats-cards.tsx` | 62-63 | `window.addEventListener(MOCK_STORE_EVENT, handler)` | acceptable-context | devtools 监听器 |
| A5.3 | `components/dashboard/site-health-heatmap.tsx` | 41-42 | `window.addEventListener(MOCK_STORE_EVENT, handler)` | acceptable-context | devtools 监听器 |
| A5.4 | `components/dashboard/alert-center.tsx` | 103-104 | `window.addEventListener(MOCK_STORE_EVENT, handler)` | acceptable-context | devtools 监听器 |

---

## 3. Section B: 硬编码值 (应改为可配置)

### B1: 硬编码 site code (`SH01` / `BJ02`)

| # | 文件 | 行 | 片段 | 严重度 | 说明 |
|---|---|---:|---|---|---|
| B1.1 | `app/api/auth/permission-sync/route.ts` | 53 | `sourceSiteId: body.siteCode ?? "SH01"` | **must-fix** | 生产 API 路由硬编码 fallback; `body.siteCode` 缺失时静默使用 `SH01`, 跨站点请求会被错误归属 |
| B1.2 | `app/api/sync/trigger/route.ts` | 39 | `const siteCode = body.siteCode ?? "SH01"` | **must-fix** | 同步触发 API 硬编码 fallback |
| B1.3 | `app/api/sync/dump-now/route.ts` | 262 | `const siteCode = String(body.siteCode ?? "SH01")` | **must-fix** | dump-now API 硬编码 fallback |
| B1.4 | `app/sync/page.tsx` | 433 | `siteCodeFilter.trim() || 'SH01'` | should-fix | UI 状态硬编码 fallback |
| B1.5 | `app/sync/page.tsx` | 579 | `\|\| 'SH01'}` in display text | should-fix | UI 显示文本硬编码 fallback |
| B1.6 | `app/sync/page.tsx` | 592 | `立即同步 SH01` | should-fix | UI 按钮文案硬编码 (用户可见) |
| B1.7 | `app/sync/page.tsx` | 608 | `siteCodeFilter \|\| 'SH01'` | should-fix | onClick handler 硬编码 fallback |
| B1.8 | `app/sync/page.tsx` | 616 | `siteCodeFilter \|\| 'SH01'` in button | should-fix | 按钮文本硬编码 fallback |
| B1.9 | `app/login/page.tsx` | 121 | `availableSites={["SH01"]}` | should-fix | 硬编码单站点数组, 限制登录仅 SH01 |
| B1.10 | `app/search/page.tsx` | 295-296 | `SelectItem value="SH01"` / `"BJ02"` | should-fix | Select 选项硬编码, 应从 API 拉取 |
| B1.11 | `app/sync/page.tsx` | 619 | `站点: SH01 (本 Sprint...` | acceptable-context | Sprint 验证范围注释 |
| B1.12 | `app/sync/page.tsx` | 901 | CLI command in comment | acceptable-context | 文档示例 |
| B1.13 | `app/sync/page.tsx` | 958 | `placeholder="如 SH01"` | acceptable-context | 输入框 placeholder 示例 |
| B1.14 | `app/tasks/page.tsx` | 945 | `placeholder="例如: SH01 档案备份..."` | acceptable-context | placeholder 命名示例 |
| B1.15 | `app/logs/page.tsx` | 483 | `placeholder="siteCode (如 SH01)"` | acceptable-context | placeholder 示例 |
| B1.16 | `app/api/sync/scheduler/logs/route.ts` | 2 | `* GET /api/sync/scheduler/logs?siteCode=SH01` | acceptable-context | JSDoc 注释 |
| B1.17 | `app/api/sync/consistency/route.ts` | 2, 57 | Example usage in comments | acceptable-context | 文档注释 |

### B2: 硬编码端口号 (`9200` / `5432` / `5434` / `3000` / `8080`)

**无发现** — 所有端口号都在 `.env.local` / `.env.example` 中正确管理, 无生产代码硬编码。

### B3: 硬编码 URL (`http://localhost:*` / `http://127.0.0.1:*`)

**无发现** — 扫描范围内无硬编码 localhost URL。

### B4: 硬编码 email (`admin@example.com` 等)

**无发现** — 扫描范围内无硬编码邮箱地址。

### B5: 硬编码 secret / password / api_key 字面值

**无发现** — 已验证 `app/api/sites/[id]/sso/route.ts` 中的 `secret` 变量来自 `process.env.SITE_AGENT_SECRET` (line 40), 无硬编码。

### B6: 硬编码 IP 地址 (`192.168.*` / `10.*` / `172.16-31.*`)

**无发现** — 扫描范围内无硬编码私有 IP 地址。

---

## 4. Section C: 页面注释 / 用户可见 "未完成" 字符串

### C1: JSX 注释 (`{/* ... */}`) 含 TODO / 待接入 / Sprint

| # | 文件 | 行 | 片段 | 严重度 | 说明 |
|---|---|---:|---|---|---|
| C1.1 | `app/tasks/page.tsx` | 566 | `Sprint 2F.3: 实时运行状态提示` | acceptable-context | 内部 JSX 注释, 无用户影响 |
| C1.2 | `app/tasks/page.tsx` | 785 | `多线程封包 (Sprint 2F.3: 仅 mock 模式展示...)` | acceptable-context | 内部 JSX 注释, mock-only |
| C1.3 | `app/tasks/page.tsx` | 863 | `文件索引 (后置加载，Sprint 2C.20)` | acceptable-context | 内部 JSX 注释 |
| C1.4 | `app/sync/page.tsx` | 700 | `Sprint R.7: 数据一致性校验卡片` | acceptable-context | 内部 JSX 注释 |
| C1.5 | `app/sync/page.tsx` | 883 | `Sprint R.8: 自动同步调度区域` | acceptable-context | 内部 JSX 注释 |
| C1.6 | `app/logs/page.tsx` | 442 | `Sprint R.27: 登录审计已接入, 仅数字签名仍 blocked` | acceptable-context | 内部 JSX 注释 |
| C1.7 | `components/shared/time-format.tsx` | 34 | `/* 占位符 (value 无效时) */` | acceptable-context | 内部 JSDoc-style 注释 |
| C1.8 | `components/dashboard/dashboard-summary-bar.tsx` | 8 | `失败: 显示"统计加载失败"占位` | acceptable-context | 内部代码注释 (非 JSX) |

### C2: 用户可见字符串含 `待接入` / `未完成` / `占位`

| # | 文件 | 行 | 片段 | 严重度 | 说明 |
|---|---|---:|---|---|---|
| C2.1 | `app/settings/page.tsx` | 213 | `description="未完成能力保持明确标记，不展示为已完成"` | should-fix | Panel 描述文本向用户展示 "未完成" 标记策略 |
| C2.2 | `app/settings/page.tsx` | 517 | `description="本地登录已启用；企业单点登录等待接入"` | should-fix | Panel 描述告知用户 SSO 待接入 |
| C2.3 | `app/settings/page.tsx` | 658 | `{reason === "not_implemented" ? "待接入" : reason}` | should-fix | Settings UI Badge 显示 "待接入" 文本 |
| C2.4 | `app/settings/page.tsx` | 701 | `not_implemented: "待接入"` | should-fix | 状态映射产生 "待接入" 显示在 UI |
| C2.5 | `app/search/page.tsx` | 243 | `badge={dataSource === "blocked" ? "待接入" : ...}` | **must-fix** | 页面头部 Badge 显著展示 "待接入" |
| C2.6 | `app/search/page.tsx` | 259 | `<Badge>待接入</Badge>` | **must-fix** | 警告横幅内联 Badge 显示 "待接入" |
| C2.7 | `app/sites/page.tsx` | 271 | `<AppTooltip content="站点登记功能待接入">` | should-fix | "注册新站点" 按钮 tooltip 告知用户功能未接入 |
| C2.8 | `app/users/page.tsx` | 222 | `权限分配与跨站点权限同步仍待接入。` | should-fix | Alert 描述文本告知用户跨站点权限同步待接入 |
| C2.9 | `app/sync/page.tsx` | 640 | `站点硬件告警待接入后纳入统一视图。` | should-fix | Alert 描述告知用户硬件告警待接入 |
| C2.10 | `components/ui/global-control-ball.tsx` | 720 | `企业认证待接入` | **must-fix** | 控制球 UI 内粗体文本直接展示给用户 |
| C2.11 | `components/ui/global-control-ball.tsx` | 800 | `主机 CPU / 内存 / 磁盘趋势待接入实时采集后展示。` | should-fix | 主机指标区域文本告知用户趋势待实时采集 |
| C2.12 | `components/dashboard/command-center-panel.tsx` | 400 | `evidence="全文索引 / 待接入"` | should-fix | LaneCard evidence label 显示 "待接入" |
| C2.13 | `components/dashboard/header.tsx` | 229 | `<AppTooltip content="通知接口待接入">` | should-fix | disabled 铃铛 tooltip 告知用户通知 API 待接入 |

### C3: 引用未来 Sprint 的注释 (R.XX / Sprint X)

所有 C3 命中已合并至 C1.1-C1.6 (acceptable-context), 无额外独立发现。

---

## 5. "What to fix first" — Top 10 must-fix (按页面优先级)

> **优先级排序原则**: 1) 生产 API 路由 > 页面级; 2) 用户可见文本 > 内部注释; 3) 跨站点影响 > 单站点影响。

| # | 优先级 | 文件 | 行 | 类别 | 摘要 |
|---|---|---|---:|---|---|
| **1** | 🔴 P0 | `lib/api/api-providers.ts` | 41-441 | A2.2-A2.8 | `apiSiteProvider` / `apiRackProvider` / `apiUserProvider` / `apiTaskProvider` 静默 fallback 到 mock; 必须改为抛 `ApiUnavailableError` 让 UI 展示 BLOCKED 状态 |
| **2** | 🔴 P0 | `app/racks/page.tsx` | 25 | A1.1 | 页面级直接 import `@/lib/mock/racks`, 完全绕过 API mode 检查; 在 API 模式下也会渲染 mock 数据 |
| **3** | 🔴 P0 | `app/api/auth/permission-sync/route.ts` | 53 | B1.1 | 生产 API 路由硬编码 `SH01` fallback; 跨站点请求被错误归属, 安全/数据完整性风险 |
| **4** | 🔴 P0 | `app/api/sync/trigger/route.ts` | 39 | B1.2 | 同步触发 API 硬编码 `SH01` fallback; 跨站点触发会被错误归属 |
| **5** | 🔴 P0 | `app/api/sync/dump-now/route.ts` | 262 | B1.3 | dump-now API 硬编码 `SH01` fallback |
| **6** | 🟠 P1 | `app/volumes/page.tsx` | 115-117 | A3.3 | `Array.isArray()` 判定 fallback 触发 mock 渲染, 无错误抛出 |
| **7** | 🟠 P1 | `app/search/page.tsx` | 243, 259 | C2.5, C2.6 | 用户可见 "待接入" Badge 在页面头部 + 警告横幅显著展示 |
| **8** | 🟠 P1 | `components/ui/global-control-ball.tsx` | 720 | C2.10 | 控制球 UI 内粗体文本 "企业认证待接入" 直接展示 |
| **9** | 🟠 P1 | `lib/api/api-providers.ts` | 350 | A4.15 | `fetchAlerts` 显式 mock fallback 注释 — 与 A2.8 同一文件同一问题 |
| **10** | 🟠 P1 | `app/sync/page.tsx` | 433-616 | B1.4-B1.8 | 5 处硬编码 `SH01` fallback (UI 状态 + 按钮文案, 用户可见) |

---

## 6. "Explicitly NOT flagged" (误报排除)

以下条目**经核查不视为问题**, 列出以供后续 Sprint 复核时参考:

### 6.1 `lib/mock/*` 内部 (mock 数据 home, 合法)

- `lib/mock/audit.ts`, `lib/mock/auth.ts`, `lib/mock/notifications.ts`, `lib/mock/racks.ts`, `lib/mock/search.ts`, `lib/mock/settings.ts`, `lib/mock/sites.ts`, `lib/mock/tasks.ts`, `lib/mock/users.ts`
- 这些文件是 mock 数据源, 本身职责就是存放 mock; 引用方 (`mock-providers.ts` / `mock-store.ts` 等) 才是 audit 重点

### 6.2 `lib/api/mock-providers.ts` / `lib/api/mock-store.ts`

- 这两个文件是**显式 mock provider 实现**, 通过 `isApiMode` 切换, 不视为泄漏

### 6.3 `*.test.ts` / `*.spec.ts` / `__tests__/*`

- 测试文件可使用 mock, 不视为生产代码泄漏
- 例如: `app/api/__tests__/*` 等

### 6.4 根目录 `test-login.js`

- pre-tsx artifact, R.89 已 flag, 本次扫描不重复计入

### 6.5 历史注释 (acceptable-context)

- A4.2, A4.4, A4.5, A4.6, A4.7, A4.9, A4.10, A4.11, A4.13 — 记录已完成迁移或设计意图的注释, 无活跃泄漏
- C1.1-C1.8 — 内部 JSX 注释, 无用户影响

### 6.6 文档示例字符串

- B1.11-B1.17 — JSDoc / placeholder / 命令示例, 非生产配置

### 6.7 `package.json`

- 本身不含 SH01 / 端口 / 密码字面值

### 6.8 `.env.local` / `.env.example`

- 端口 / 站点配置正确存储在 env 文件中

### 6.9 `MOCK_STORE_EVENT` 监听器 (A5.1-A5.4)

- 仅 mock-mode devtools UI 刷新用途, 不会在 API mode 触发
- 关键注释 `// 不允许 mock 静默 fallback` (stats-cards.tsx:28) 显示设计意图是禁止 fallback

### 6.10 secret / api_key 检查

- `app/api/sites/[id]/sso/route.ts:40` 的 `secret` 变量正确从 `process.env.SITE_AGENT_SECRET` 获取, 无硬编码

---

## 7. 附录: 扫描方法学

### 7.1 扫描工具

- `grep -rn` 模式匹配 (recursive, line numbers)
- 文件类型过滤: `--include="*.tsx"` / `--include="*.ts"`

### 7.2 排除规则

| 路径 / 模式 | 排除原因 |
|---|---|
| `lib/mock/*` | mock 数据源, 合法 home |
| `lib/api/mock-providers.ts` | 显式 mock provider |
| `lib/api/mock-store.ts` | 显式 mock store |
| `*.test.ts`, `*.spec.ts`, `__tests__/*` | 测试 fixture |
| `/Users/tian/Desktop/上海/test-login.js` | pre-tsx artifact (R.89 已 flag) |
| `.env.local`, `.env.example` | 配置 home, 端口 / secret 合法 |
| `package.json` 字面值 | 依赖声明 |

### 7.3 严重度判定原则

- **must-fix**: 生产 API / 用户可见 UI / 安全风险 / 跨站点影响
- **should-fix**: UI 状态 / 历史注释与代码不一致 / 误导性注释
- **acceptable-context**: 设计文档化注释 / devtools hook / 文档示例

### 7.4 已知未覆盖范围

- **运行时行为验证**: 本次为静态扫描, 未执行运行时 mock fallback 触发测试
- **TypeScript 类型一致性**: 未深入验证 `MockAlert` 等类型与真实 DTO 的对齐
- **i18n 字符串**: 未扫描多语言 key 文件中的 "待接入" / "未完成"

---

## 8. 附录 B 引用 — requirements 完成度 (R.90 范围)

> 本次扫描**仅产出 inventory**, **未修改任何文件**, 因此 requirements 完成度**无变化**。
> 后续 Sprint (R.90 页面清理 #26/#27) 将基于本清单执行修复, 并在 `sprint-r90-requirements-review.md` 中更新完成度。