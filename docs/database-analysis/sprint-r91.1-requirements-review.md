# Sprint R.91.1 Requirements Review

> **触发**: R.90 完成开发阶段集成闭环。本 Sprint 聚焦**页面合并 + 产品文案清理 + 审计脚本强化**, 把 page-scope 盘点中识别的发散页面(/check, /volumes)合并到 /racks 子视图, 全面清除开发者术语, 同时强化 4 个审计脚本使违规可检测。

> **分支**: `codex/r84-development-architecture-cleanup-plans` (本次新增 8 个 commits, 用户禁推)

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `R.91.1` |
| Sprint 标题 | 页面合并 + 产品文案清理 + 审计脚本强化 |
| 日期 | 2026-06-29 |
| 对应 requirement 节 | `requirements.md §4.2` (任务管理), `§4.3` (盘笼检查), `§5.1` (日志), `§3.1-3.3` (账号权限), `§6.4` (可维护) |
| 关联 commits | `f24e4e1`, `590ce33`, `b62187b`, `ae9ec24`, `820e02b`, `e2e3c25`, `e925210` (product-copy 2), `0e5231a` |
| 验证人 | tian |

---

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-4.2 | 任务管理 (新建/暂停/恢复/重置/巡检/恢复) | `partial` + `blocked_by_site_change` |
| REQ-4.3 | 盘笼检查 (巡检策略/盘位管理/检查任务) | `partial` (17-tab /check 合并到 rack 子视图) |
| REQ-5.1 | 日志管理 (七类日志查看/导出/数字签名) | `partial` (sync_package 文案清理, 数字签名 blocked) |
| REQ-3.1 | 账号管理 (统一用户/Auth/权限/RBAC) | `partial` (RBAC 组件文案清理, 字典→基础配置) |
| REQ-3.2 | 权限管理 (角色、权限树) | `partial` (同步 RBAC 清理) |
| REQ-3.3 | 部门管理 (站点多对多关系) | `partial` (同 REQ-3.1) |
| REQ-6.4 | 可维护 (文档 + 接口契约 + 集成验证) | `complete` (审计脚本强化, 4 个脚本通过) |

---

## 2. Requirement 原始文本 (逐字摘录)

```
§4.2 任务管理:
- 新建/暂停/恢复/重置/巡检/恢复任务 6 个原子动作
- 每站点多站点支持
- 任务状态实时更新, 逾期/失败告警
```

```
§4.3 盘笼检查:
- 盘笼日常检查: 检查分类/检查任务/巡检策略
- 存储卷: 逻辑卷元信息、盘位聚合
- 调度运维: 调度任务、执行记录
- 告警管理: 告警媒体、监控运维
```

```
§5.1 日志管理:
- 七类日志: 同步包、同步表、调度、一致性、控制命令、审计、登录审计
- 关键字段: 时间、类型、级别、来源、操作描述、用户
- 日志保留策略与定期清理
```

```
§3.1-3.3 账号权限:
- 统一用户视图 (与部门关联)
- 角色定义与权限分配 (RBAC)
- 字典管理 (基础数据维护)
```

---

## 3. 需求状态枚举 (8 选 1)

| Req ID | 状态 | 说明 |
|---|---|---|
| REQ-4.2 | `partial` + `blocked_by_site_change` | 控制队列框架完成, 站点 app poll 无 evidence |
| REQ-4.3 | `partial` | /check 合并到盘架视图, 17-tab raw 结构已删除, 巡检/存储卷/监控通过 /racks?view=inspection 和 /racks?view=volumes 可访问 |
| REQ-5.1 | `partial` | 七类日志核心功能完整, 数字签名未接入; 本 Sprint 清理了 sync_package 等开发者术语 |
| REQ-3.1-3.3 | `partial` | RBAC/字典/日志凭据组件文案合规化, 但真实 RBAC 服务未接入 |
| REQ-6.4 | `complete` | 4 个审计脚本(page-scope, product-copy, data-coverage, page-no-todo)全部强化通过 |

---

## 4. 实现明细 (Implementation)

### 4.1 页面合并 (Task 1-3)

| 文件 | 改动类型 | commit |
|---|---|---|
| `app/check/page.tsx` | 重写 → redirect(`/racks?view=inspection`) | `f24e4e1` |
| `app/volumes/page.tsx` | 重写 → redirect(`/racks?view=volumes`) | `f24e4e1` |
| `components/shared/command-palette.tsx` | 删除 `p-volumes` CommandItem | `f24e4e1` |
| `components/racks/inspection-view.tsx` | **新建** — 巡检视图组件 | `590ce33` |
| `components/racks/volumes-view.tsx` | **新建** — 存储卷视图组件 (从原 `/volumes` 提取) | commit 3 |
| `app/racks/page.tsx` | 新增 `?view=` 参数分派 / inspection/volumes 子路由 | `590ce33`, commit 3 |

### 4.2 产品文案清理 (Task 4-6)

| 文件 | 改动类型 | commit |
|---|---|---|
| `components/rbac/dictionaries-tab.tsx` | `字典` → `基础配置`, 删除 `源记录 ID`/`数据来源` | `b62187b` |
| `components/rbac/logs-credentials-tab.tsx` | `日志与凭据` → `权限日志`, 同上 | `b62187b` |
| `components/rbac/role-permissions-tab.tsx` | 删除 `源记录 ID`/`数据来源`/`SOURCE_TABLES` | `b62187b` |
| `app/users/page.tsx` | Tab 标签 + 两个 `真实` 文案 + `源表`/`源记录 ID` DetailRow 删除 | `b62187b` |
| `app/settings/page.tsx` | 删除 `真实告警阈值与任务策略` 中的 `真实` | `ae9ec24` |
| `app/sync/page.tsx` | `not_run` 文案替换 | `820e02b` |
| `app/logs/page.tsx` | `sync_package` 等类型标签 → 中文文案 | `820e02b` |
| `app/tasks/page.tsx` | `演示模式` → `当前模式不支持此操作`, 删除 2 处 `真实` | `820e02b` |
| `components/dashboard/welcome-banner.tsx` | `sync_package` → `同步到站点代理` | `820e02b` |
| `components/dashboard/sync-trend-chart.tsx` | `暂无真实趋势数据` → `暂无趋势数据` | `820e02b` |
| `components/ui/global-control-ball.tsx` | `暂无真实告警` → `暂无告警` | `820e02b` |
| `components/tasks/control-command-panel.tsx` | `真实结果` → `执行结果`, 删除 `库闭环` | `820e02b` |
| `components/layout/app-shell.tsx` | 8 处 `真实` → 用户语言 | `820e02b` |
| Additional product-copy cleanup | 2 个补充 commits | `e2e3c25`, `e925210` |

### 4.3 审计脚本强化 (Task 7-8)

| 文件 | 改动类型 | commit |
|---|---|---|
| `scripts/audit/page-scope.ts` | 新增 command palette 检查, route auto-discovery, `/check`/`/volumes` fail gate | commit 7 |
| `scripts/audit/product-copy.ts` | 16+ 禁止词模式, `components/` 扫描, match-context 启发式, severity 分级 | commit 7 |
| `scripts/audit/data-coverage.ts` | minRows 强制, requireAnySite, 3-tier verdict, /check redirect 检查 | `0e5231a` |
| `scripts/audit/page-no-todo-comments.ts` | `mock`/`等待闭环`/`临时`/`演示模式` 模式, `.ts` 扫描, false-positive 过滤 | `0e5231a` |

---

## 5. 页面合并详情

### 5.1 `/check` (17-tab raw-table browser) → `/racks?view=inspection`

**合并前**: 405 行, 17 个原始检查 tab, 客户端 fetch 14 个独立 API endpoint, 60+ `unified_check_*` 表。
**合并后**: 9 行 redirect, 完全不再提供逐表原始浏览。巡检聚合数据通过 `/api/inspection/summary` 在 `/racks?view=inspection` 展示。

**直接访问 `/check`**: HTTP 307 redirect → `/racks?view=inspection`。

**数据影响**: 访问原 17-tab 的能力理论上仍可通过 `/api/check/*` 直接调用, 前端不再暴露逐表 UI。

### 5.2 `/volumes` (standalone 475-line page) → `/racks?view=volumes`

**合并前**: 475 行独立页面, 含 stat cards、数据表、类型筛选 Tab、drawer details。
**合并后**: 核心逻辑提取到 `components/racks/volumes-view.tsx` (170 行, 纯组件), 通过 `/racks?view=volumes` 展示。

**直接访问 `/volumes`**: HTTP 307 redirect → `/racks?view=volumes`。

### 5.3 Command palette 清理

- 删除 `{ id: "p-volumes", label: "存储卷", icon: Database, ... }` 项
- 删除 `Database` import (原仅 `p-volumes` 使用)
- Sidebar 未变动 (已有 9 项, 不含 `/check` 或 `/volumes` 入口)

---

## 6. 产品文案清理详细清单

> R.91.1 清理了 8 个文件中的开发者术语, 以下逐条记录。同时审计脚本 `product-copy.ts` 可检测 16+ 模式, 后续新增违规会被拦截。

### 6.1 `字典` → `基础配置` (4 locations)

| 文件 | 位置 | 原文 | 修改后 |
|---|---|---|---|
| `components/rbac/dictionaries-tab.tsx` | Tab title | "字典" | "基础配置" |
| `components/rbac/dictionaries-tab.tsx` | 列名 | "字典名" | "名称" |
| `components/rbac/dictionaries-tab.tsx` | 列名 | "字典值" | "配置值" |
| `app/users/page.tsx` | Tab label | "字典" | "基础配置" |

### 6.2 `日志与凭据` → `权限日志` (2 locations)

| 文件 | 位置 | 修改后 |
|---|---|---|
| `components/rbac/logs-credentials-tab.tsx` | Tab title | "权限日志" |
| `app/users/page.tsx` | Tab label | "权限日志" |

### 6.3 `数据来源:` + `unified_*` → removed (3 RBAC tabs)

| 文件 | 删除内容 |
|---|---|
| `components/rbac/dictionaries-tab.tsx` | "数据来源: unified_* / unified_*" 整行 + `SOURCE_TABLES` |
| `components/rbac/logs-credentials-tab.tsx` | "数据来源: unified_* / unified_*" 整行 + `SOURCE_TABLES` |
| `components/rbac/role-permissions-tab.tsx` | "数据来源: unified_* / unified_*" 整行 + `SOURCE_TABLES` |

### 6.4 `源记录 ID` → removed (5 locations)

| 文件 | 位置 | 操作 |
|---|---|---|
| `components/rbac/dictionaries-tab.tsx` | TableHead + TableCell | 删除列 |
| `components/rbac/logs-credentials-tab.tsx` | TableHead + TableCell | 删除列 |
| `components/rbac/role-permissions-tab.tsx` | TableHead + TableCell | 删除列 |
| `app/users/page.tsx` | DetailRow | 删除行 (2 处: 源表 + 源记录 ID) |

### 6.5 `源表` → removed (2 locations)

| 文件 | 位置 | 操作 |
|---|---|---|
| `app/users/page.tsx` | `<DetailRow label="源表" ...>` | 删除行 |

### 6.6 `真实` → removed/rephrased (16+ locations across 8 files)

| 文件 | 原文 | 修改后 |
|---|---|---|
| `app/users/page.tsx` | "真实账号" | "账号" |
| `app/users/page.tsx` | "真实 Auth/RBAC 服务" | "认证与权限服务" |
| `app/settings/page.tsx` | "真实告警阈值与任务策略" | "告警阈值与任务策略" |
| `app/tasks/page.tsx` | "创建真实任务" | "创建任务" |
| `app/tasks/page.tsx` | "真实创建完成" | "创建完成" |
| `components/dashboard/sync-trend-chart.tsx` | "暂无真实趋势数据" | "暂无趋势数据" |
| `components/ui/global-control-ball.tsx` | "暂无真实告警" | "暂无告警" |
| `components/tasks/control-command-panel.tsx` | "展示真实结果" | "展示执行结果" |
| `components/layout/app-shell.tsx` | 8 处 `真实` 文案 | 用户语言替换 |

### 6.7 `sync_package` → user language (3 locations)

| 文件 | 原文 | 修改后 |
|---|---|---|
| `components/dashboard/welcome-banner.tsx` | "中心库 → 站点 sync_package 链路" | "中心库同步到站点代理" |
| `app/logs/page.tsx` | sync_package_log (描述) | "按站点包传输审计" |
| `app/logs/page.tsx` | 6 个内部类型名 | 中文标签 |

### 6.8 `not_run` → removed from user-visible text (1 location)

| 文件 | 原文 | 修改后 |
|---|---|---|
| `app/sync/page.tsx` | "not_run" (siteStatusNote) | "未运行状态" |

### 6.9 `演示模式` → `当前模式不支持此操作` (1 location)

| 文件 | 原文 | 修改后 |
|---|---|---|
| `app/tasks/page.tsx` | toast "演示模式不支持" | "当前模式不支持此操作" |

### 6.10 `blocked_by_*`

**状态**: PASS — R.91.1 未引入新的 `blocked_by_*` 用户可见文本。`app/settings/page.tsx` 中所有 `blocked_by_*` 值仅出现在 `displayStatus()` 映射键和 `<BlockedItem>` 的 `status=` prop 中, 不暴露原始 developer 字符串给用户。

---

## 7. 后端真实能力 (Backend Reality)

| Req ID | 后端真实能力 | 证据 |
|---|---|---|
| REQ-4.2 (任务控制) | ⚠️ 控制队列框架 — `control_command` 表写入, DRY_RUN 处理, **不修改 `tbl_task.paused`** | `SELECT * FROM control_command WHERE command_type='task_pause'` 可查 audit 记录 |
| REQ-4.3 (盘笼检查) | ✅ `/check` 页面 redirect 后, 巡检数据通过 `/api/inspection/summary` 查询真实 `unified_check_*` 表 | `/racks?view=inspection` 组件 fetch `/api/inspection/summary?siteCode=SH01` 返回真实 DB 数据 |
| REQ-4.3 (存储卷) | ✅ `/volumes` 页面 redirect 后, 卷数据通过 `fetchVolumes()` 查询 `unified_volumes` 聚合表 | `api-providers.ts` 中 `fetchVolumes` 从 `unified_volumes` 查询 |
| REQ-5.1 (日志) | ✅ 七类日志同步/调度/控制命令全部真实 DB 查询 | `audit:center-db --strict --matrix` 验证 |
| REQ-3.1-3.3 | ⚠️ RBAC 是真实 UI + 组件重构, 但权限分配 / Auth 服务仍 blocked | 组件引用真实 API, 但 RBAC 分配无后端支持 |

---

## 8. UI 真实能力 (UI Reality)

| Req ID | UI 元素 | 真实点击行为 | 是否误导用户? |
|---|---|---|---|
| `/check` 直接访问 | 无 UI | 307 redirect → `/racks?view=inspection` | ✅ 不误导 |
| `/volumes` 直接访问 | 无 UI | 307 redirect → `/racks?view=volumes` | ✅ 不误导 |
| `/racks?view=inspection` | InspectionView 组件 | fetch `/api/inspection/summary` → 展示真实数据 | ✅ 不误导 |
| `/racks?view=volumes` | VolumesView 组件 | fetch volums provider → 展示真实数据 | ✅ 不误导 |
| RBAC Tabs (字典/权限日志) | 清理后的 Tab 名称 | 无功能变更, 仅 UI 标签改名 | ✅ 更清晰 |

**禁止**:
- ✅ `/check` 先前的 17-tab 浏览视图已删除, 不再误导用户以为可逐表浏览
- ✅ `/volumes` 独立页面已删除, 不再误导用户以为独立页面功能完整
- ✅ 所有 `真实` 措辞已从用户可见文本中移除

---

## 9. Mock / Simulator 状态

| 组件 | Mock 模式 | 真控制 | 说明 |
|---|---|---|---|
| InspectionView | ❌ | ✅ | 直接 fetch API, 无 mock 路径 |
| VolumesView | ⚠️ provider fallback | ✅ | provider 在 empty-allowed 时返回 `[]`, dataSource 徽章区分 |
| Racks (browse/restore Tabs) | ✅ (原功能, 未改) | ❌ | 未修改, mock 路径保留 (R.91.2 处理) |
| Task 控制 | ⚠️ DRY_RUN | ❌ | 控制队列框架, 站点未接入 |

---

## 10. 数据真实性评估 (Data Reality)

### 10.1 有真实后端数据的页面 (smoke:sync 后)

| 页面 | 数据来源 | 证据 |
|---|---|---|
| `/sites` | `sync_sites` 注册表 | `pnpm smoke:sync` 后 1+ site |
| `/tasks` | `unified_tasks` | 同步后有任务数据 |
| `/racks` | `unified_devices`, `unified_cages` | 真实设备数据 |
| `/racks?view=volumes` | `unified_volumes` | 真实卷聚合数据 |
| `/logs` | 7 类日志表 | 同步后日志完整 |
| `/users` | `unified_users` | 真实用户数据 |
| `/sync` | `sync_package_log`, `sync_sites` | 同步记录 |

### 10.2 允许空数据的页面

| 页面 | 说明 |
|---|---|
| `/search` | 依赖 OpenSearch/ES, 未接入时显示 blocker banner |

### 10.3 需求阻塞页面

| 页面 | blocker | 详情 |
|---|---|---|
| `/tasks` 控制链 | `blocked_by_site_change` | control_command 链路完成, 站点 app 未 poll |
| `/search` 全文检索 | `blocked_by_external_system` | ES 未接入 |

---

## 11. 审计脚本强化 (Audit Strengthening)

### 11.1 page-scope.ts (Task 7)

| 新增检查 | 实现细节 | 验证结果 |
|---|---|---|
| Check 3: Command palette | 解析 `command-palette.tsx` 中 `router.push(...)` 路由并验证 | 9 条路由全匹配 |
| Check 4: Route auto-discovery | 遍历 `app/` 中所有 `page.tsx`, 告警孤立路由 | 13 条路由发现, 全部匹配 |
| Check 5: `/check` fail gate | 验证 `/check/page.tsx` 为简单 redirect | PASS (TabsTrigger=0) |
| Check 6: `/volumes` fail gate | 验证 `/volumes/page.tsx` 为简单 redirect | PASS (9 行 ≤ 10) |

### 11.2 product-copy.ts (Task 7)

| 新增能力 | 实现细节 |
|---|---|
| 扫描范围扩展 | 除 `app/` 外新增 `components/` 目录扫描 |
| 16+ 禁止词模式 | 额外增加: `blocked_by_*`, `unified_*`, `dispatcher`, `sync_package`, `not_run`, `源记录 ID`, `源表`, `真实`, `demo`, `mock`, `DRY_RUN` 等 |
| Match-context heuristic | 检查行上下文区分代码引用 vs 用户可见文本 |
| Severity 分级 | FAIL (用户可见, exit 2) / WARN (仅代码, exit 0) |

### 11.3 data-coverage.ts (Task 8)

| 新增能力 | 实现细节 | 验证结果 |
|---|---|---|
| minRows 强制 | 9 个页面设 `minRows: 1` | `/search` 保留 `minRows: 0` (允许空) |
| requireAnySite | 至少 1 个站点 ≥ minRows | PASS (SH01 数据完整) |
| 3-tier verdict | `pass` / `empty_allowed` / `fail` | 9 pass, 0 fail |
| `/check` redirect | 请求 `/api/check`, 非 3xx 时检查文件内容 | PASS (redirect) |
| pass logging | `[PASS]` 行输出 | 自文档化 |

### 11.4 page-no-todo-comments.ts (Task 8)

| 新增能力 | 实现细节 | 验证结果 |
|---|---|---|
| 新增禁词模式 | `等待闭环`, `mock`, `临时`, `演示模式` | PASS (exit 0) |
| `.ts` 扫描 | walk 函数新增 `.ts` 文件 | 全部覆盖 |
| false-positive 过滤 | mock 在字符串字面量/imports 时不标记 | 避免误报 |

---

## 12. 缺失件 (Missing Pieces)

| 项 | 原因 |
|---|---|
| `/racks` 浏览/恢复 Tab mock 数据未清理 | R.91.1 范围: 合并 + 产品文案 + 审计脚本; mock Tab 清理留 R.91.2 |
| 控制命令真实站点执行 | `blocked_by_site_change` — 站点 app 未 poll `control_command` |
| 全文检索 (ES) | `blocked_by_external_system` |
| RBAC 真实权限分配 | `blocked_by_auth` |

---

## 13. Blocker 类型 (8 选 1)

| 缺失件 | Blocker Type | 解除条件 |
|---|---|---|
| Racks 浏览/恢复 mock | `blocked_by_source_schema` | 站点提供真实目录树/恢复 API |
| 真实任务控制 | `blocked_by_site_change` | 站点 app poll + 写 `tbl_task.paused` |
| ES 全文检索 | `blocked_by_external_system` | 接入 OpenSearch/ES 服务 |
| RBAC 权限分配 | `blocked_by_auth` | CLAUDE.md 解禁 |

---

## 14. 需要的源端 / 站点 schema/API 变更清单

| 变更项 | 涉及表 / API | 具体 DDL / 文档点 |
|---|---|---|
| `tbl_task` 加 `paused BOOLEAN` | `tbl_task` | `ALTER TABLE tbl_task ADD COLUMN paused BOOLEAN DEFAULT FALSE;` |
| 站点 app poll `control_command` 新行 | 站点 app | 启动时注册 GET /api/site-control/commands, 写 status, 调 ack |

---

## 15. 是否影响 requirements 完成率

| 维度 | 数值 |
|---|---|
| 本 Sprint 涉及 Req ID 数 | 6 |
| `complete` | 1 (REQ-6.4 可维护: 审计脚本) |
| `partial` | 5 (REQ-4.2, 4.3, 5.1, 3.1, 3.2/3.3) |
| `blocked_*` | — (继承, 非本次新增) |
| **本 Sprint 完成率** | 1/6 = 16.6% (可维护项 complete) |
| **全局说明** | 本 Sprint 聚焦清理/合并/审计, 不新增功能完成 |

---

## 16. 最终判决 (Verdict)

### Verdict: `partial`

**理由**:
- ✅ 页面合并: `/check` (17-tab) → `/racks?view=inspection`, `/volumes` (475-line) → `/racks?view=volumes`, command palette p-volumes 删除
- ✅ 产品文案: 8 个文件 16+ 处 forbidden term 全部清理, all pass
- ✅ 审计剧本: 4 个脚本全部强化, 违规可检测
- ✅ tsc + build + 所有 audit 脚本通过
- ⚠️ `/racks` 浏览/恢复 Tab mock 数据**未清理** — 标为 R.91.2 待处理
- ⚠️ 控制链 + 搜索仍按 CLAUDE.md §4 阻塞

**领导决策项**:
- A. 站点表加 `paused` / `priority` 字段 → 真控制可行
- B. `/racks` 浏览/恢复 mock Tab 是否继续保留 (R.91.2 讨论)
- C. ES 接入计划

---

## 17. 提交前检查清单

- [x] 所有 Req ID 已列, 不允许漏
- [x] 每个 Req ID 打了 1 个状态标签 (8 选 1)
- [x] 后端真实能力每个 Req ID 都有 SQL / API 证据
- [x] 明确 mock / simulator / DRY_RUN / 真控制的区别
- [x] 缺失件不隐藏, 全部列出
- [x] blocker 类型 8 选 1
- [x] 站点 schema/API 变更清单已在附录
- [x] requirements 完成率已计算
- [x] verdict 已给出 (partial)
- [x] 文件命名 `sprint-r91.1-requirements-review.md` 放 `docs/database-analysis/`
- [ ] PROJECT_STATUS.md / ROADMAP.md 同步更新 (Task 10)
- [x] 链接到本模板的 commit 描述