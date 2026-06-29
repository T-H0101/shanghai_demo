# Sprint R.91 页面范围盘点 (Page Scope Review)

> 输出位置: `docs/database-analysis/sprint-r91-page-scope-review.md`
> 范围: 13 个一级页面 + 1 个 `/control` 重定向
> 生成时间: 2026-06-29

---

## 1. Top-level Summary Table

| Page | Route | Req Section | Primary Nav? | Real API | Center DB | Mock/Fallback | Developer Wording | Merge? |
|---|---|---|---|---|---|---|---|---|
| 控制台 (Dashboard) | `/` | §3 整体, §2.3 同步, §4.2 任务, §5.1 日志 | 是 (LayoutDashboard) | `/api/dashboard/*`, `/api/alerts`, `/api/sync/*`, `/api/tasks/*`, `/api/sites` | `unified_*` 聚合 | 仅展示用, 无 mock 数据 | 无 (用户可见文案合规) | keep |
| 同步中心 (Sync) | `/sync` | §2.3 同步, §3 调度 | 是 (RefreshCw) | `/api/sync/packages`, `/api/sync/packages/[id]/tables`, `/api/sync/consistency`, `/api/sync/scheduler/logs`, `/api/sync/config`, `/api/sync/sites/status`, `/api/alerts`, `/api/sync/export`, `/api/sync/trigger` (POST), `/api/sync/dump-now` (POST) | `sync_package_log`, `sync_table_log`, `sync_scheduler_log`, `sync_consistency_log`, `sync_site_config`, `sync_sites`, `alerts` | 无 mock 兜底 (source 校验) | 大量 "站点代理" "Site Agent" 文案 (合规) | keep |
| 任务管理 (Tasks) | `/tasks` | §4.2 任务管理 | 是 (ClipboardList) | `/api/tasks/*` (provider), `/api/control/commands` (POST), `/api/tasks/create` (POST) | `unified_tasks`, `control_command`, `audit_log` | **是** — `lib/api` provider 在 isApiMode=false 时返回 mock | "演示数据模式" 徽章, "未接入" toast (合规) | keep |
| 盘架管理 (Racks) | `/racks` | §3.1 设备, §4.1 检索 | 是 (HardDrive) | `/api/racks` (provider), `/api/racks/[id]` (slot), `/api/racks/export`, `/api/sites` | `unified_devices`, `unified_cages` | **是** — `rackProvider` mock 路径 (isApiMode=false), 浏览/恢复 mock 数据 | "此处仅做演示" (line 972), "__demo__" SelectItem (line 1207), "操作未接入" toast | keep (mock 风险高, 建议清理) |
| 盘笼检查 (Check) | `/check` | §2.3 同步 (15 张检查表) | 是 (ClipboardList) | `/api/check/inspections`, `/api/check/patrols`, `/api/volume/storage`, `/api/schedule/ops`, `/api/data/receive`, `/api/early-warning`, `/api/system-config`, `/api/iso`, `/api/import-export`, `/api/monitor`, `/api/task-detail`, `/api/slot-files`, `/api/final-batch-a`, `/api/final-batch-b` | 60+ `unified_check_*`, `unified_*` 系列 | 无, 真实数据 | 无 | keep (需产品化, 见 §5) |
| 存储卷 (Volumes) | `/volumes` | §3.1 设备 (聚合) | 是 (Database) | `/api/volumes` (provider `fetchVolumes`) | `unified_volumes` (聚合 `tbl_logical_volume` + `tbl_volume_slot`) | **是** — provider fallback 返回空数组 | 无 (合规) | keep |
| 用户与权限 (Users) | `/users` | §3.1 账号, §3.2 权限 | 是 (Users) | `/api/users`, `/api/users/export`, `/api/auth/accounts`, `/api/auth/accounts/[id]/unlock` (POST) | `unified_users`, `auth_accounts` | 无 mock 兜底, 显式 dataSource | 无 (合规) | keep |
| 站点管理 (Sites) | `/sites` | §2.1 站点 | 是 (MapPin) | `/api/sites`, `/api/sites/orphans`, `/api/sync/consistency` | `sync_sites` (注册表) | 无, 显式 dataSource | 无 (合规, 写操作 disabled + tooltip) | keep |
| 审计日志 (Logs) | `/logs` | §5.1 日志 | 是 (FileText) | `/api/logs`, `/api/logs/export`, `/api/auth/audit`, `/api/auth/audit/export` | `sync_*_log`, `control_command`, `audit_log`, `auth_login_audit` | 无 mock, 显式 dataSource | "数字签名校验 (未接入)" 按钮 (合规) | keep |
| 系统设置 (Settings) | `/settings` | §6 可维护 (运行健康) | 是 (Settings) | `/api/sync/config`, `/api/system/health`, `/api/system/db-health`, `/api/sites`, `/api/sync/sites/status` | `sync_site_config`, `sync_sites`, runtime env | 无 | "READ ONLY" 徽章 + 写按钮 disabled (合规) | keep |
| 统一检索 (Search) | `/search` | §4.1 检索 | 是 (Search) | `/api/search`, `/api/search/export` | `disc_file_index` (待 ES 接入) | **明确 blocked** — `dataSource="blocked"`, ES 未接入显示 blocker banner | "全文检索服务暂未接入" 文案 (合规) | keep (或合并) |
| 控制命令 (Control) | `/control` | §4.2 任务 (控制命令) | **否** — 重定向至 `/tasks?view=commands` | — | — | — | — | **merge → /tasks** (已是 redirect) |
| 登录 (Login) | `/login` | §2.2 认证 | 否 (auth 后跳走) | `/api/auth/me`, `/api/auth/login` | `auth_accounts` | 无 (auth blocked) | 无 | keep (auth blocked) |

> **Primary Nav 决策依据**: `components/dashboard/sidebar.tsx` 第 22-34 行的 `menuItems` 数组。
> **`/login` 与 `/control` 不在 sidebar**: login 是公开路由, control 是 redirect。

---

## 2. Per-page Deep-dive

### 2.1 `/` (控制台 / Dashboard)

- **文件**: `app/page.tsx` (38 行, 简洁组装)
- **组合组件** (来自 `@/components/dashboard`):
  - `CommandCenterPanel` — KPI 总览, 4 个统计卡片
  - `SyncTrendChart` — 同步趋势图 (xl:col-span-2)
  - `DashboardRecentSyncs` — 最近同步记录
  - `TaskTable` — 任务状态表
  - `AlertCenter` — 告警中心
- **API 调用**: 全部在子组件中, 不在本文件直接 `fetch`
- **数据源标识**: `data-testid="dashboard-datasource"` 行显示 "平台数据实时读取, 异常时会直接提示" + "数据缺失时显示空状态"
- **Mock/Fallback**: 无
- **Developer wording**: 无 (合规)
- **Recommendation**: **keep** — 控制台是入口页, 集成度高, 拆分组件清晰

---

### 2.2 `/sync` (同步中心)

- **文件**: `app/sync/page.tsx` (1187 行, 含 8 个数据卡片)
- **Tabs**: 无显式 Tabs, 多 Card 垂直布局:
  1. PageHeader + 导出按钮
  2. 同步操作总览 (手动同步触发, 双按钮: 增量/全量)
  3. 同步任务 (立即同步, 不经过站点代理)
  4. 同步告警摘要 (来自 `/api/alerts` 过滤 type=sync/table)
  5. 数据一致性校验
  6. 多站点同步配置 (只读)
  7. 站点最新同步状态 (含 Site Agent 状态)
  8. 自动同步调度 (scheduler logs)
  9. 筛选器 (siteCode / status / batchId)
  10. 同步包与表级日志表格
  11. 批次明细 (selectedPkg 时显示)
- **API 调用**:
  - `GET /api/sync/packages?siteCode=&page=&pageSize=&status=&batchId=`
  - `GET /api/sync/packages/[id]/tables`
  - `GET /api/sync/consistency?siteCode=`
  - `GET /api/sync/scheduler/logs?siteCode=&limit=`
  - `GET /api/sync/config`
  - `GET /api/sync/sites/status`
  - `GET /api/alerts?pageSize=300&siteCode=`
  - `GET /api/sync/export?kind=&format=&siteCode=`
  - `POST /api/sync/trigger` {siteCode, syncType: 'full'|'incremental'}
  - `POST /api/sync/dump-now` {siteCode}
- **DB 表**: `sync_package_log`, `sync_table_log`, `sync_scheduler_log`, `sync_consistency_log`, `sync_site_config`, `sync_sites`, `alerts`
- **Mock/Fallback**: **无** — 显式检查 `json.source !== 'database'` 抛错
- **Developer wording**:
  - L558: "管理员可手动提交同步请求, **由站点代理**拉取执行"
  - L564: Badge "**通过站点代理触发**"
  - L567: "管理员触发后会进入同步队列, **站点代理**拉取执行并回写最终状态"
  - L610: Badge "**不经过站点代理**"
  - L839: TableHead "**Site Agent**"
  - **合规判断**: 全是用户可见文案, 措辞 "提交到控制队列, 等待站点 Agent 拉取" 完全符合 §4.2 强约束, 不属于 "禁止措辞"
- **Recommendation**: **keep** — 与 requirements §2.3 同步 / §4.2 任务管控高度匹配, 无合并需求

---

### 2.3 `/tasks` (任务管理)

- **文件**: `app/tasks/page.tsx` (982 行, 含两个 view: tasks / commands)
- **Tabs** (R.76 viewSwitcher + tab):
  - View 切换: "任务列表" / "控制命令" (`?view=commands`)
  - 任务类型 Tab: 全部 / 全量封包 / 增量封包 / 备份 / 恢复 / 移位 / 扫描
  - 筛选下拉: 任务类型 / 当前阶段 / 备份范围 / 关键词
- **API 调用**:
  - `taskProvider.getAll({siteCode, keyword, type, phase})` (通过 `@/lib/api` provider)
  - `POST /api/control/commands` {sourceSiteId, commandType, targetType, targetId, payload} (task_pause / task_resume)
  - `POST /api/tasks/create` {siteCode, taskName, taskType, source: "center_ui"}
- **DB 表**: `unified_tasks`, `control_command`, `audit_log`
- **Mock/Fallback**: **是** — `taskProvider` 在 `isApiMode=false` 时返回 mock 数据 (`lib/api/providers`)
- **Developer wording**:
  - L118: `title={isApiMode ? "实时数据模式" : "**演示数据模式**"}` — `DataSourceBadge` 显示 "实时"/"演示"
  - L120: `{isApiMode ? "实时" : "**演示**"}`
  - L281: toast "**演示模式不支持**"
  - L304: toast "**等待站点 Agent 执行**" (合规)
  - L430: description "...跟踪 **Site Agent** 最终结果"
  - L935: "新建命令会提交到控制队列, **由站点代理**拉取后在目标站点创建真实任务"
  - L966: "只有**站点代理**执行并同步回总控后, 任务才会出现在列表中"
  - **合规判断**: "演示" 标签是 isApiMode 切换, 走的是 provider mock, **符合 R.1 §7 措辞规范** (不混淆演示与真实)
- **Recommendation**: **keep** — `/control` 已 redirect 到此页, 任务管理是核心业务页

---

### 2.4 `/racks` (盘架管理)

- **文件**: `app/racks/page.tsx` (1635 行, 包含 3 个内部 Tabs)
- **Tabs** (storageTabs):
  - `overview` 设备总览 (默认)
  - `browse` 存储浏览 (mock)
  - `restore` 数据恢复 (mock)
- **API 调用**:
  - `rackProvider.getAll(siteCode)` (provider)
  - `rackProvider.getStats(siteCode)` (provider)
  - `fetchRackSlots(rackId, siteCode)` — `/api/racks/[id]` 拉盘位
  - `GET /api/racks/export?format=&siteCode=`
  - `GET /api/sites` (真实挂载 dialog 站点选择)
  - **mock 调用**:
    - `loadRacksBrowseMock(storageTab)` — `lib/mock-mode/racks-browse`
    - `loadRacksRestoreTargetsMock(restoreMode)` — `lib/mock-mode/racks-browse`
- **DB 表**: `unified_devices`, `unified_cages`, `sync_sites`
- **Mock/Fallback**: **是, 大量** —
  - `isApiMode=false` 时所有 rack/slot 数据来自 mock
  - 浏览 / 恢复 Tab 完全 mock
  - 多个 mock-only 操作 (扫描, RAID 校验, 模式切换, 添加介质)
- **Developer wording** (高风险):
  - **L972**: "模式切换需在设备本地控制台操作, **此处仅做演示**"
  - **L1207**: `<SelectItem value="__demo__" disabled>当前为演示模式, **暂不可选择真实站点**</SelectItem>`
  - L138: toast "**操作未接入**" (isApiMode=true 时)
  - L278-281: EmptyState "**存储浏览暂未接入真实源端目录树**"
  - L1430: EmptyState "**数据恢复任务等待 Site Agent 闭环**"
  - **合规判断**: L972 和 L1207 是显式承认 mock 的文案, 但 **L972 "此处仅做演示" 与 §7 措辞规范冲突** — 应当改用 "API 模式下未接入站点联动" 或 "需站点本地操作"
- **Recommendation**: **keep, 但 R.91 必须清理 L972 / L1207 措辞** + 浏览/恢复 Tab 在 API 模式下显示 EmptyState (已部分完成), mock 数据路径需要明确标注

---

### 2.5 `/volumes` (存储卷)

- **文件**: `app/volumes/page.tsx` (475 行)
- **Tabs**: 类型筛选 Tab (全部 / 光盘 / 磁卷)
- **API 调用**:
  - `fetchVolumes(siteCode)` (provider `lib/api/api-providers`)
- **DB 表**: `unified_volumes` (聚合 `tbl_logical_volume` + `tbl_volume_slot`)
- **Mock/Fallback**: **是** — provider fallback 路径返回 `[]` (空数组), 设 `source="fallback"`; 但页面有 `dataSource` 徽章显式区分 "实时" / "备用"
- **Developer wording**: 无显式 "mock"/"demo" 文案, 但 L105 `source: "fallback"` 是开发者变量
- **Recommendation**: **keep** — 真实聚合数据, §3.1 设备/卷匹配良好, fallback 处理合规

---

### 2.6 `/check` (盘笼检查)

- **文件**: `app/check/page.tsx` (405 行)
- **Tabs (17 个)** — 与子组件 `CheckResourceTab` 配合:
  1. 概览
  2. 检查分类 — `/api/check/inspections`
  3. 检查任务 — `/api/check/inspections` (复用!)
  4. 巡检策略 — `/api/check/patrols`
  5. 日志 — `/api/check/inspections` (复用)
  6. 存储卷 — `/api/volume/storage`
  7. 调度运维 — `/api/schedule/ops`
  8. 数据接收 — `/api/data/receive`
  9. 告警媒体 — `/api/early-warning`
  10. 系统配置 — `/api/system-config`
  11. ISO 与文件 — `/api/iso`
  12. 导入导出 — `/api/import-export`
  13. 监控运维 — `/api/monitor`
  14. 任务详情 — `/api/task-detail`
  15. 槽位管理 — `/api/slot-files`
  16. 备份辅助 — `/api/final-batch-a`
  17. 下载等待 — `/api/final-batch-b`
- **API 调用**: 14 个独立 endpoint (其中 `inspections` 被 3 个 Tab 复用)
- **DB 表**: 60+ 张 `unified_check_*`, `unified_*` 系列表 (来源声明写在 `sourceTables` prop 中)
- **Mock/Fallback**: 无 — 直接 fetch + toast 错误
- **Developer wording**: 无用户可见 "mock" / "demo"
- **Recommendation**:
  - **keep** — 17 Tab 覆盖真实数据源, 与 §2.3 同步契合
  - **建议改进**:
    1. Tab 2 / 4 / 5 都走 `/api/check/inspections` — 应当在 Tab 标题或数据卡片明确区分
    2. 当前页面文字稀疏, 缺产品化 banner 与说明
    3. "概览" Tab 当前是静态文案, 应改为真实统计

---

### 2.7 `/users` (用户与权限)

- **文件**: `app/users/page.tsx` (433 行)
- **Tabs (5 个)**:
  1. `unified` 统一用户视图 (默认)
  2. `auth` Auth 账号管理
  3. `rbac` 角色权限 (子组件 `RolePermissionsTab`)
  4. `dict` 字典 (`DictionariesTab`)
  5. `logs` 日志与凭据 (`LogsCredentialsTab`)
- **API 调用**:
  - `GET /api/users?pageSize=100`
  - `GET /api/users/export?format=`
  - `GET /api/auth/accounts?limit=100`
  - `POST /api/auth/accounts/[id]/unlock`
- **DB 表**: `unified_users`, `auth_accounts`
- **Mock/Fallback**: 无 — 显式 `dataSource: "database" | "empty" | "error"`, 校验 `body.source !== "database"` 抛错
- **Developer wording**:
  - L220: "账号管理已接入查看、启用、禁用、解锁和重置密码。**权限分配与跨站点权限同步当前未启用**" (合规, 用户可见)
  - L331: "**站点多对多关系、设备/数据权限树与账号生命周期需真实 Auth/RBAC 服务, 当前不推断、不模拟**" (合规)
- **Recommendation**: **keep** — 数据流清晰, RBAC/字典子组件按需加载, 状态区分明确

---

### 2.8 `/sites` (站点管理)

- **文件**: `app/sites/page.tsx` (628 行)
- **Tabs**: 无, 单视图 (Card + DetailPanel)
- **API 调用**:
  - `GET /api/sites`
  - `GET /api/sites/orphans`
  - `GET /api/sync/consistency?siteCode=`
- **DB 表**: `sync_sites` (注册表), 通过孤儿分析涉及 `unified_*` 业务表
- **Mock/Fallback**: 无 — 显式 `dataSource` 4 态 (database / empty / error / loading), 无静默 fallback
- **Developer wording**:
  - L196: toast "**功能未接入**" (注册新站点 / 启用禁用 / SSO)
  - L444-459: Power/SSO 按钮 `disabled` + tooltip "站点启用/禁用功能未接入" / "SSO 跳转功能未接入"
  - L618: 清理命令 `pnpm cleanup:test-pollution -- --apply`
- **Recommendation**: **keep** — R.82 真实数据 + 显式 4 态, 是 CLAUDE.md 优秀实践案例

---

### 2.9 `/logs` (审计日志)

- **文件**: `app/logs/page.tsx` (691 行)
- **Tabs (7 个)**:
  1. `sync_package` 同步包
  2. `sync_table` 同步表
  3. `sync_scheduler` 调度
  4. `sync_consistency` 一致性
  5. `control` 控制命令
  6. `audit` 审计
  7. `login_audit` 登录审计 (Sprint R.27 单独走 `/api/auth/audit`)
- **API 调用**:
  - `GET /api/logs?type=&siteCode=&status=&keyword=&errorCode=&deviceId=&taskType=&dateFrom=&dateTo=`
  - `GET /api/logs/export?type=&format=&max=5000&...`
  - `GET /api/auth/audit?...` (login_audit 专用)
  - `GET /api/auth/audit/export?...`
  - `siteProvider.getAll()` (siteCode datalist)
- **DB 表**: `sync_package_log`, `sync_table_log`, `sync_scheduler_log`, `sync_consistency_log`, `control_command`, `audit_log`, `auth_login_audit`
- **Mock/Fallback**: 无 — 显式 4 态 dataSource
- **Developer wording**:
  - L439: "**数字签名暂未接入**" banner
  - L677: 按钮 "**数字签名校验 (未接入)**"
  - **合规判断**: 完全符合 R.1 §7 (数字签名按钮已删除, 改为只读解释)
- **Recommendation**: **keep** — 与 §5.1 日志管理匹配最好, 数据完整性最完整

---

### 2.10 `/settings` (系统设置)

- **文件**: `app/settings/page.tsx` (714 行, 含 5 个 CapsuleTabs)
- **Tabs (5 个)**:
  1. `overview` 概览 — 健康/未接入能力
  2. `sites` 站点 — 注册状态 + 调度配置
  3. `sync` 同步 — 环境变量引用 + 调度配置
  4. `auth` 认证 — 配置边界 + 认证边界
  5. `external` 外部依赖 — 边界 + Agent
- **API 调用**:
  - `GET /api/sync/config`
  - `GET /api/system/health`
  - `GET /api/system/db-health` (允许 503)
  - `GET /api/sites`
  - `GET /api/sync/sites/status`
- **DB 表**: `sync_site_config`, `sync_sites`
- **Mock/Fallback**: 无 — 直接 fetch, 错误时全部置为 `EMPTY_SNAPSHOT`
- **Developer wording**:
  - L609: `badge="READ ONLY"` (合规)
  - L630: "**写入配置、企业认证和敏感安全策略尚未解锁。页面不会保存、导出或测试发送任何配置**" (合规)
  - L218-222: 列出未启用能力 (not_implemented / blocked_by_auth / blocked_by_external_system)
- **Recommendation**: **keep** — 这是合规性最好的页面之一, 可作为 R.91 文案改造范本

---

### 2.11 `/search` (统一检索)

- **文件**: `app/search/page.tsx` (497 行)
- **Tabs**: 无
- **API 调用**:
  - `GET /api/search?q=detect` (R.85 detect 用, 检测 ES 接入状态)
  - `GET /api/search?q=&page=&pageSize=&siteCode=`
  - `GET /api/search/export?q=&format=`
- **DB 表**: `disc_file_index` (但 R.85 后端 port `opensearch` 来源仅 ES)
- **Mock/Fallback**: **明确 blocked** — `dataSource="blocked" | "opensearch" | "empty"`, ES 未接入时显示 blocker banner, 0 条结果
- **Developer wording**:
  - L74: 注释 "**R.14F: 全文检索 blocked_by_external_system (ES/ClickHouse 未接入)**"
  - L259: Badge "**服务不可用**"
  - L263: "**当前仅展示已验证的数据范围**"
  - L347: "全文检索服务未接入, 当前 0 条"
  - L304: `<SelectItem value="blocked">全部类型 (**未接入**)</SelectItem>`
  - L310: `<SelectItem value="blocked">全部部门 (**未接入**)</SelectItem>`
  - **合规判断**: 文案完全合规, blocked_by_external_system 是 requirements §4.1.1 的真实状态
- **Recommendation**: **keep** — 与 §4.1 检索匹配, blocker 展示优秀

---

### 2.12 `/control` (控制命令) — 重定向

- **文件**: `app/control/page.tsx` (5 行)
- **唯一代码**: `redirect("/tasks?view=commands")`
- **API**: 无
- **DB**: 无
- **Mock/Fallback**: N/A
- **Developer wording**: 无
- **Recommendation**: **merge → /tasks?view=commands** (已是 redirect, 实际跳转) — 不需要删除, 但应在 sidebar 移除相关痕迹

---

### 2.13 `/login` (登录)

- **文件**: `app/login/page.tsx` (128 行)
- **API 调用**:
  - `isAuthenticated()` from `@/lib/auth/session` (检查本地登录)
- **DB 表**: `auth_accounts` (登录后由 `/api/auth/login` 写入)
- **Mock/Fallback**: 无
- **Auth state**: **blocked_by_auth** — 当前 session 仅本地, ADFS / SSO 未接入
- **Developer wording**: 无
- **Recommendation**: **keep** — auth blocked 但本地登录可用, 是项目入口

---

## 3. Merge Matrix (合并矩阵)

| From | To | Reason | Redirection |
|---|---|---|---|
| `/control` | `/tasks?view=commands` | 已是 redirect, 重定向至 /tasks 的 commands 视图 | 已实现 (app/control/page.tsx:4) |

> **结论**: 仅 1 个 merge 候选 (control → tasks), 且已实现 redirect。

---

## 4. Empty Pages Section (空/占位页面)

经审查, 以下页面**没有 "完全空"** (所有页面都有真实逻辑或显式说明):

| 页面 | 状态 |
|---|---|
| `/control` | redirect-only, 无真实 UI |
| `/search` | **功能 blocked** (ES 未接入), 但 blocker banner 文案完善 |
| `/racks` 浏览/恢复 Tab | mock 数据驱动, isApiMode=true 时显示 EmptyState |

> **真正 "占位" 页面**: 0
> **"功能 blocked 但有真实提示" 页面**: 2 (search, racks 浏览/恢复)
> **"redirect-only" 页面**: 1 (control)

---

## 5. API Surface (页面 → API 引用清单 + 404 风险)

> **404 风险评估**: 所有 API 都已存在于 `app/api/` 目录, 无 404 风险。
> 仅有 `/api/search/export` 在 ES blocked 时返回 501 (正常业务, 不算 404)。

### 5.1 控制台 `/`
- 子组件引用: `/api/dashboard/*`, `/api/sync/*`, `/api/tasks/*`, `/api/sites`, `/api/alerts`
- 404 风险: **0**

### 5.2 同步中心 `/sync`
- `/api/sync/packages` ✅
- `/api/sync/packages/[id]/tables` ✅
- `/api/sync/consistency` ✅
- `/api/sync/scheduler/logs` ✅
- `/api/sync/config` ✅
- `/api/sync/sites/status` ✅
- `/api/alerts` ✅
- `/api/sync/export` ✅ (XLSX 返回 501, 已知)
- `/api/sync/trigger` ✅ (POST)
- `/api/sync/dump-now` ✅ (POST)
- 404 风险: **0**

### 5.3 任务管理 `/tasks`
- provider: `/api/tasks/*` (动态)
- `/api/control/commands` ✅ (POST)
- `/api/tasks/create` ✅ (POST)
- 404 风险: **0**

### 5.4 盘架管理 `/racks`
- provider: `/api/racks/*`
- `/api/racks/[id]` ✅
- `/api/racks/export` ✅
- `/api/sites` ✅
- 404 风险: **0**

### 5.5 盘笼检查 `/check`
- `/api/check/inspections` ✅
- `/api/check/patrols` ✅
- `/api/volume/storage` ✅
- `/api/schedule/ops` ✅
- `/api/data/receive` ✅
- `/api/early-warning` ✅
- `/api/system-config` ✅
- `/api/iso` ✅
- `/api/import-export` ✅
- `/api/monitor` ✅
- `/api/task-detail` ✅
- `/api/slot-files` ✅
- `/api/final-batch-a` ✅
- `/api/final-batch-b` ✅
- 404 风险: **0** (但 Tab 2/4/5 都走 inspections, 数据可能混乱)

### 5.6 存储卷 `/volumes`
- `/api/volumes` ✅
- 404 风险: **0**

### 5.7 用户与权限 `/users`
- `/api/users` ✅
- `/api/users/export` ✅
- `/api/auth/accounts` ✅
- `/api/auth/accounts/[id]/unlock` ✅ (POST)
- 404 风险: **0**

### 5.8 站点管理 `/sites`
- `/api/sites` ✅
- `/api/sites/orphans` ✅
- `/api/sync/consistency` ✅
- 404 风险: **0**

### 5.9 审计日志 `/logs`
- `/api/logs` ✅
- `/api/logs/export` ✅
- `/api/auth/audit` ✅
- `/api/auth/audit/export` ✅
- `/api/sites` (datalist 间接)
- 404 风险: **0**

### 5.10 系统设置 `/settings`
- `/api/sync/config` ✅
- `/api/system/health` ✅
- `/api/system/db-health` ✅
- `/api/sites` ✅
- `/api/sync/sites/status` ✅
- 404 风险: **0**

### 5.11 统一检索 `/search`
- `/api/search` ✅ (blocked 时返回 blocked payload)
- `/api/search/export` ✅ (blocked 时 501)
- 404 风险: **0** (但 501 是预期的 blocker 行为)

### 5.12 控制命令 `/control`
- (redirect)

### 5.13 登录 `/login`
- `/api/auth/me` (间接 via `isAuthenticated`)
- `/api/auth/login` (间接)
- 404 风险: **0**

> **总览**: 所有 30+ 个 API endpoint 真实存在, **0 个 404 风险**。
> 唯一非 200 状态码: `/api/sync/export` (xlsx=501), `/api/search/export` (blocked=501), `/api/racks/export` (xlsx=501), `/api/users/export` (xlsx=501), `/api/auth/accounts/[id]/unlock` (404 当账号不存在) — 这些都是业务定义, 不是页面 bug。

---

## 6. Developer Wording Findings (开发者文案发现)

> 按"高风险 / 中风险 / 合规"分级。
> 高/中风险需要在 R.91 第四阶段 (产品化) 修复。

### 6.1 高风险 (违反 R.1 §7 措辞规范)

| 位置 | 原文 | 修正建议 |
|---|---|---|
| `app/racks/page.tsx:972` | "模式切换需在设备本地控制台操作, **此处仅做演示**" | 改为 "API 模式下设备模式切换需站点 app 配合" |
| `app/racks/page.tsx:1207` | "当前为演示模式, **暂不可选择真实站点**" | 改为 "API 模式下使用 `/api/sites` 真实站点列表" |

### 6.2 中风险 (用户可见, 但语境可接受)

| 位置 | 原文 | 评估 |
|---|---|---|
| `app/tasks/page.tsx:118` | `title={isApiMode ? "实时数据模式" : "演示数据模式"}` | 工具提示合规, 用于区分 mock/api 模式 |
| `app/tasks/page.tsx:120` | `{isApiMode ? "实时" : "演示"}` | 徽章简短, 可保留 |
| `app/tasks/page.tsx:281` | toast "演示模式不支持" | 含义清晰 |
| `app/racks/page.tsx:278-281` | EmptyState "存储浏览暂未接入真实源端目录树" | 文案合规, 表明真实状态 |

### 6.3 合规 (R.91 不需要改)

| 位置 | 原文 | 合规依据 |
|---|---|---|
| `app/sync/page.tsx:567` | "管理员触发后会进入同步队列, 站点代理拉取执行并回写最终状态。**页面只宣称"已提交", 不把提交动作说成同步完成**" | 完全符合 R.1 §7 |
| `app/tasks/page.tsx:935` | "新建命令会提交到控制队列, 由站点代理拉取后在目标站点创建真实任务" | 完全符合 §4.2 |
| `app/logs/page.tsx:439` | "数字签名暂未接入" banner | 完全符合 §5.1.2 (证书未托管) |
| `app/settings/page.tsx:609` | `badge="READ ONLY"` + L630 disclaimer | 优秀范本 |
| `app/search/page.tsx:259, 263, 304, 310` | blocker banner / "未接入" SelectItem | 完全符合 §4.1.1 ES blocked |
| `app/users/page.tsx:331` | "站点多对多关系、设备/数据权限树与账号生命周期需真实 Auth/RBAC 服务, 当前不推断、不模拟" | 优秀范本 |

---

## 7. Final Recommendations (R.91 行动清单)

### 7.1 必须做 (高优先级)
1. **修复 `app/racks/page.tsx:972` 和 `:1207` 的 "演示" 措辞** — 违反 R.1 §7
2. **`/control` 已是 redirect, 无需删除** — 但应在 sidebar 移除痕迹 (已不在 sidebar, ✅)
3. **审计 `app/racks/page.tsx` 浏览/恢复 Tab 的 mock 数据路径** — 当前 isApiMode=false 时仍走 mock, 需要明确标注或删除
4. **`app/check/page.tsx` 概览 Tab 是静态文案** — 应改为真实统计

### 7.2 建议做 (中优先级)
5. **`app/check/page.tsx` Tab 2/4/5 都走 `/api/check/inspections`** — 应在 Tab 标题或卡片区分
6. **统一页面文案** — 设置页 (READ ONLY) 可作为 R.91 文案改造的样板

### 7.3 不需要做 (已合规)
7. 控制台 / 同步 / 任务 / 卷 / 用户 / 站点 / 日志 / 设置 / 检索 / 登录 — 全部 keep
8. `/control` redirect — 已正确指向 `/tasks?view=commands`

---

## 8. 总结

- **盘点页面总数**: 13 (含 `/control` redirect-only)
- **Primary Nav 页面**: 11 (`/`, `/sync`, `/tasks`, `/racks`, `/check`, `/volumes`, `/users`, `/sites`, `/logs`, `/settings`, `/search`)
- **Non-nav 页面**: 2 (`/control` redirect, `/login` 公开)
- **Merge 建议**: 1 (`/control` → `/tasks`, 已实现 redirect)
- **真实 API 覆盖率**: 100% (所有 30+ endpoint 存在)
- **404 风险**: 0
- **Developer wording 高风险**: 2 处 (均在 `app/racks/page.tsx`)
- **Developer wording 合规范本**: 3 处 (settings/users/search)
- **Mock/Fallback 风险**: 1 页 (`/racks` 浏览/恢复 Tab + 多个 mock-only 操作)

R.91 第二阶段 (合并) 工作量极小 (control 已 redirect); 重点工作量在第三阶段 (产品化文案) 和第四阶段 (数据链路核对)。