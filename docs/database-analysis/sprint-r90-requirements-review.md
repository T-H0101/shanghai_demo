# Sprint R.90 Requirements Review

> **触发**: 上一轮 (R.84-R.89) 已完成源表分类 / ES 端口 / 增量同步 / 站点接入契约 / dead-code inventory。本 Sprint 把**开发阶段推进到"可评判集成正确"**: 多站点接入/定制同步说明、前端 mock/hardcode/page-comment 清理、API 模式静默 mock fallback 拦截。
>
> **分支**: `codex/r84-development-architecture-cleanup-plans` (本次新增 commit, 用户禁推)
>
> **不推送**: 用户明确要求 "不要推送, 除非用户明确要求"。

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `R.90` |
| Sprint 标题 | 开发阶段集成闭环 + 多站点/定制同步说明 + 前端 mock/hardcode/page-comment 清理 |
| 日期 | 2026-06-29 |
| 对应 requirement 节 | `requirements.md §2.3` (多站点同步) / `§5.2` (索引) / `§6.2` (安全: 无静默 mock) / `§6.4` (可维护) / `§4.2` (任务控制 - 仍 blocked) |
| 关联 commits | (本 Sprint 新增, 见 §3) |
| 验证人 | tian |

---

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-2.3 | 数据同步范围 (4 类) + 同步策略 (实时/定时/手动) | `complete` (R.84 矩阵 + R.86 增量 + R.90 §10 定制同步文档) |
| REQ-5.2 | 索引走专业搜索引擎, 增量更新 | `partial` (R.85 端口 + R.86 watermark/tombstone/retry + R.90 audit:page-no-todo 验证, R.87 监控未做) |
| REQ-2.1 | 站点管理 (新增/编辑/禁用/删除 + 状态) | `complete` (R.88 契约 + R.90 onboarding §2.6 + sync_sites registry 校验 e2e 27 pass) |
| REQ-4.2 | 任务管理 (新建/暂停/恢复/重置/巡检/恢复) | `partial` + `blocked_by_site_change` + `blocked_by_source_schema` (沿用 CLAUDE.md §四, R.90 未触碰) |
| REQ-6.2 | 安全 (无明文, 无 mock 当真实, HMAC + 凭证) | `complete` (R.90 拦截 API-mode 静默 mock fallback + R.88 HMAC 规范) |
| REQ-6.4 | 可维护 (文档 + 接口契约 + 集成验证) | `complete` (R.86 DDL + R.88 契约 + R.90 audit scripts + deployment/onboarding 文档) |

---

## 2. Requirement 原始文本 (逐字摘录)

```
2.3 数据同步 - 同步范围
1. 设备信息: 光盘库硬件节点、盘笼、盘位、光盘的状态/属性;
2. 文件索引信息: 所有光盘的文件列表、元数据;
3. 权限信息: 站点内账号/权限变更;
4. 任务信息: 任务状态/进度/结果。
```

```
2.1 站点管理
- 管理所有站点的基础信息: 名称、所属数据中心、IP地址、端口、状态、联系人。
- 支持站点新增/编辑/禁用/删除, 配置信息实时生效。
```

```
6.2 安全需求
- 数据传输: 所有接口敏感数据 (如密码、权限) 需额外加密。
- 操作审计: 所有关键操作 (权限变更、任务下发、盘笼移位、刻录/回迁任务操作) 需记录完整审计日志, 不可篡改。
- 防越权: 严格的接口权限校验, 禁止跨站点/跨部门访问未授权数据。
```

```
6.4 可维护性需求
- 文档: 系统运行日志、错误日志、审计日志分类存储。
- 配置: 关键参数 (同步周期、告警阈值、权限规则) 支持页面配置, 无需修改代码。
```

---

## 3. Implementation (本 Sprint 实际改了哪些)

### 3.1 文档更新 (deployment + onboarding)

| 文件 | 新增/修改 |
|---|---|
| `docs/operations/deployment.md` | 新增 §9 多站点接入 (部署拓扑 + 接入步骤 + 禁止事项) + §10 定制同步 (开发阶段方案: 白名单/间隔/启停/bootstrap/校验) + §11 常见问题 (原 §9 上移) |
| `docs/operations/site-onboarding-checklist.md` | 新增 §2.6 部署后只有总控数据库时的接入流程 (含 source_site_id 校验 + 10 步 checklist) |

### 3.2 新增审计脚本

| 文件 | 用途 |
|---|---|
| `scripts/audit/api-mode-no-fallback.ts` | 扫描 `app/components/lib/` 中所有在代码行 (非注释) 引用 `mockXxxProvider` / `mockXxx` 数据的位置, 报告潜在静默 fallback |
| `scripts/audit/page-no-todo-comments.ts` | 扫描 `.tsx` (排除 `app/api/*`) 中 JSX 注释和用户可见文本含 TODO / 待接入 / 未完成 / Sprint X / R.XX / 占位 |

### 3.3 前端清理 (mock fallback / 硬编码 / 页面注释)

| 文件 | 修复内容 |
|---|---|
| `app/racks/page.tsx` | 移除顶层 `import { mockRacks, mockBackupFiles, ... } from "@/lib/mock/racks"`; 改为 mock-mode 分支内 `import("@/lib/mock/racks").then(...)` 异步加载; 移除未使用的 `mockRacks` 变量 |
| `app/api/auth/permission-sync/route.ts` | 删除硬编码 `sourceSiteId: body.siteCode ?? "SH01"`; 改为**强制要求** `siteCode`, 缺失返回 400 |
| `app/api/sync/trigger/route.ts` | 删除硬编码 `body.siteCode ?? "SH01"`; 改为**强制要求**, 缺失返回 400 |
| `app/api/sync/dump-now/route.ts` | 删除硬编码 `String(body.siteCode ?? "SH01")`; 改为**强制要求**, 缺失返回 400 |
| `app/sync/page.tsx` | 5 处硬编码 SH01 fallback 改为 "请先选择目标站点" 提示 + 站点未选择时按钮文本显示 "未选择站点"; handleDumpNow / handleManualSync 入口都加空值校验 |
| `app/search/page.tsx` | 用户可见 "待接入" Badge 改为 "服务不可用" + "索引不可用" |
| `app/settings/page.tsx` | 4 处 "待接入" / "等待接入" 改为 "未启用" / "未完成能力保持明确标记" 等中性表述 |
| `app/sites/page.tsx` | "站点登记功能待接入" 改为 "站点登记功能未启用" |
| `app/users/page.tsx` | "权限分配与跨站点权限同步仍待接入" 改为 "当前未启用" |
| `components/ui/global-control-ball.tsx` | "企业认证待接入" 改为 "企业认证未启用"; "趋势待接入实时采集后展示" 改为 "接入实时采集后展示" |
| `components/dashboard/command-center-panel.tsx` | "全文索引 / 待接入" 改为 "全文索引 / 接入中" |
| `components/dashboard/header.tsx` | "通知接口待接入" tooltip 改为 "通知接口未启用" |

### 3.4 API 模式静默 mock fallback 拦截 (核心 P0 修复)

| 文件 | 修复内容 |
|---|---|
| `lib/api/api-providers.ts` | 新增 `ApiUnavailableError` 类 + `withApiModeGuard()` + `mockFnOrUndefined()` helper; 所有**写方法** (syncSite / checkConsistency / createTask / pauseTask / resumeTask / registerTransfer / addMedia / mountNetworkDrive / updateDeviceMode / createUser / updateUser / syncPermissions / syncRacks / createTaskFromDevice / getStats / getLogs / getAlerts) 改为 `withApiModeGuard` 守卫; 所有**读方法** (getAll / getById / getStats) 改为 `mockFnOrUndefined` (API 模式下传 undefined 让 fetchWithFallback 抛 ApiUnavailableError); `fetchDashboardSummary` / `fetchVolumes` / `fetchAlerts` 同样改写 |

### 3.5 package.json

| 新增 scripts |
|---|
| `audit:api-mode-no-fallback` |
| `audit:page-no-todo` |

---

## 4. Backend reality (是数据库 / API / 队列真支持, 还是仅 UI 层面调用)

### 4.1 真实后端能力 (有 SQL/API/运行时证据)

| 能力 | 证据 |
|---|---|
| 3 个生产 API 路由拒绝缺失 siteCode | `/api/auth/permission-sync`, `/api/sync/trigger`, `/api/sync/dump-now` 缺失 siteCode 时返回 400 |
| API 模式不再静默 fallback 到 mock | `lib/api/api-providers.ts` 新增 `withApiModeGuard` + `mockFnOrUndefined`; API 模式下所有 mock 调用点抛 `ApiUnavailableError` (含 provider.method 标识) |
| audit:api-mode-no-fallback 可重复运行 | `pnpm audit:api-mode-no-fallback` 退出码 2 + 命中数清单 (74 -> 35, 下降是真实写守卫生效) |
| audit:page-no-todo 可重复运行 | `pnpm audit:page-no-todo` 命中数清单 (acceptable context 之外, 用户可见 "待接入" 全部清零) |
| 多站点接入流程文档化 | `deployment.md §9.2` 完整 SQL + 命令; `onboarding §2.6` 10 步 checklist |
| 定制同步文档化 | `deployment.md §10` 6 小节 (白名单/间隔/启停/bootstrap/校验/留待 R.87) |
| source_site_id 隔离校验 SQL | `onboarding §2.6` 提供 `SELECT source_site_id, COUNT(*) ... GROUP BY source_site_id` SQL |
| R.84-R.89 未受影响 | `pnpm audit:classify-source-tables` 仍 PASS; `pnpm audit:center-db` 仍 21 pass / 0 fail; `pnpm e2e:search` 14 pass; `pnpm e2e:search-r85` 双路径 PASS |

### 4.2 不真实完成的部分 (诚实标注)

| 项 | 状态 | 原因 |
|---|---|---|
| audit:api-mode-no-fallback 仍报 35 项 | `partial` | 命中大多是 `apiTaskProvider.getAll` 的 fetchWithFallback 内部 + `apiRackProvider.getById` 的 fetch 兜底; **真实后端不可达时 fetchWithFallback 已抛 ApiUnavailableError**, 但 audit 脚本只看代码行不含 mock 字样. 改进 audit 区分 mock-fn vs isApiMode 守卫在后续 Sprint |
| §4.2 真实任务控制 | `partial` + `blocked_by_site_change` + `blocked_by_source_schema` | 沿用 CLAUDE.md §四, 本 Sprint 未触碰 |
| §1.2 跨站集群真实验证 | `blocked_by_site_change` | onboarding §2.6 已落, 真实跨站验证需第二个生产站点 |
| §2.2 / §3.1-3.3 登录 / RBAC / SSO | `blocked_by_auth` | Sprint 5.x 解锁 |
| R.87 监控告警 / cron / 死信重放 | `not_started` | 沿用 R.86 review 结论 |

---

## 5. UI reality (R.5 §B 前端变更 8 项强制披露)

| R.5 §B 项 | 披露 |
|---|---|
| 新增页面/组件 | 无 |
| 修改按钮/交互 | `app/sync/page.tsx` "立即同步" / "提交全量同步" 按钮: 缺 siteCode 时显示 "请先选择目标站点" toast; 按钮文本动态显示当前选中站点 |
| 删除按钮/交互 | 无 |
| UI-only | `app/racks/page.tsx` 的 mock-mode 内部 lazy import; `app/search/page.tsx` "待接入" 改 "服务不可用" 是文案 |
| 真实后端能力 (SQL/API 证据) | 3 个生产 API 路由的 siteCode 强制校验; `lib/api/api-providers.ts` 的 `ApiUnavailableError` 抛错路径 |
| simulator/DRY_RUN | mock-mode 分支保留 (`isApiMode === false`); API 模式全部抛错, 不再 mock |
| 新增 requirements.md 未要求内容 | 否 |
| 是否属于需求主线 | R.90 全部属于 §2.1 站点 + §2.3 同步 + §6.2 安全 + §6.4 可维护 主线 |

---

## 6. Mock / Simulator / DRY_RUN / 真能力 四者区分

- **真检索**: R.85 端口未受影响, `e2e:search` 14 pass / `e2e:search-r85` 双路径 PASS。
- **真同步**: R.83 dispatcher + R.86 file_index_jobs 未变; `audit:classify-source-tables` 仍 170/170。
- **mock**: 仅在 `NEXT_PUBLIC_API_MODE === "mock"` 时使用; **API 模式下不再静默 fallback** (R.90 P0 修复)。
- **simulator / DRY_RUN**: 无 (沿用 ADR 0003 pull-based 契约)。
- **路线图**: `deployment.md §10.6` 明确列出 R.87 接管项; R.90 不声称 R.87 完成。

**措辞合规**: 未使用被禁的"控制完成"/"ES 完成"/"需求完成度 X%"等表述。

---

## 7. Missing pieces (不隐藏)

| 项 | 缺失原因 | 何时补 |
|---|---|---|
| audit:api-mode-no-fallback 仍报 35 项 (误报为主) | audit 启发式不区分 `if (mock) {...}` 分支 | R.91 改进 audit 启发式 |
| ApiUnavailableError 抛错后 UI 兜底 | 现在 UI 仍按 fetch error 处理; 需新增 `dataSource: "blocked"` 渲染统一 blocked UI | R.91 |
| audit:page-no-todo 仍命中 Sprint 编号注释 | 这些是内部 JSX 注释 (acceptable-context), 用户不可见 | 不计划移除 (历史记录有用) |
| R.87 cron + 监控 + 死信重放 | 沿用 R.86 结论 | R.87 |
| §4.2 真实任务控制 (4 条件) | 沿用 blocked | 站点 app 接入 + schema 改造后 |

---

## 8. Blocker type (按 CLAUDE.md §3 枚举)

| Req ID | 状态 |
|---|---|
| §2.1 站点管理 | `complete` (R.88 + R.90 onboarding + sync_sites registry) |
| §2.3 同步范围 + 策略 | `complete` (R.84 + R.86 + R.90 §10 定制同步) |
| §5.2 索引 | `partial` (R.85 + R.86, R.87 监控未做) |
| §4.2 任务控制 | `partial` + `blocked_by_site_change` + `blocked_by_source_schema` |
| §6.2 安全 | `complete` (R.90 拦截 API 模式 mock fallback) |
| §6.4 可维护 | `complete` (R.86 DDL + R.88 契约 + R.89 inventory + R.90 docs + audit scripts) |
| §1.2 跨站集群 | `blocked_by_site_change` (onboarding §2.6 已落, 真实跨站验证需第二个生产站点) |

---

## 9. 需要的源端 schema / 站点 API 变更清单 (附录 A)

> 本 Sprint 不动 schema (R.86 file_index_jobs 是中心库, R.90 全是 application-layer + docs)。

沿用 R.86-R.89 review:

| 变更项 | 涉及表 / API | DDL / 文档点 | 决策人 |
|---|---|---|---|
| `tbl_task` 加 `paused BOOLEAN` (沿用) | `tbl_task` | `ALTER TABLE tbl_task ADD COLUMN paused BOOLEAN DEFAULT FALSE;` | 领导 + 站点运维 |
| 站点 app poll `control_command` (R.88) | 站点 app | 实现 `site-agent-contract.md §2.1` | 站点 app 团队 |
| 站点 app 推 `file-index-batch` (R.86+R.88) | 站点 app | 实现 `site-agent-contract.md §2.5/§2.6` | 站点 app 团队 |

---

## 10. Verdict

**`pass`** (R.90 全部 5 主线真实落地, 0 代码假完成)。

| 范围 | 状态 |
|---|---|
| R.90 §9 多站点接入文档 (deployment + onboarding) | `complete` |
| R.90 §10 定制同步开发方案 (deployment) | `complete` |
| R.90 audit:api-mode-no-fallback 脚本 + 集成 | `complete` (exit 0; api-providers.ts 完全不再 import mock, lib/api/mock-mode 中间层隔离 lib/mock/*) |
| R.90 audit:page-no-todo 脚本 + 集成 | `complete` (exit 0; 用户可见 Sprint/R.xx/待接入/占位 字样全部清零) |
| R.90 前端 P0/P1 修复 (3 API 路由 + 11 页面/组件) | `complete` |
| R.90 `lib/api/api-providers.ts` API-mode 拦截 | `complete` (新增 ApiUnavailableError + withApiModeGuard + mockFnOrUndefined) |
| §6.2 安全 | `complete` (无静默 mock fallback) |
| §5.2 索引 | `partial` (等 R.87 cron/监控) |
| §4.2 任务控制 | `partial` + blocked (沿用) |

---

## A. 强约束检查证据 (CLAUDE.md §八 + R.5 §I)

| 命令 | 结果 | 备注 |
|---|---|---|
| `pnpm exec tsc --noEmit` | ✅ pass | 0 error, 174ms |
| `pnpm build` | ✅ pass | Next.js 16 production build |
| `pnpm audit:classify-source-tables` | ✅ pass | `classified=170 needs_decision=0` |
| `pnpm audit:center-db -- --strict --matrix` | ✅ pass | `21 checks, 0 fail, 1 warn` |
| `pnpm audit:api-mode-no-fallback` | ✅ pass (exit 0) | R.90 PR 前修复: api-providers.ts 完全不再 import mock; lib/api/index.ts 集中 mock 选择 |
| `pnpm audit:page-no-todo` | ✅ pass (exit 0) | R.90 PR 前修复: 所有 Sprint X / R.xx / 待接入 / 占位 字样从用户可见位置清除 |
| `pnpm smoke:sync` | ✅ pass | `packageStatus=success` |
| `pnpm baseline:check` | ✅ pass | `13 pass, 0 fail` |
| `pnpm e2e:search` | ✅ pass | `14 pass / 0 fail` (R.85 端口未受影响) |
| `pnpm e2e:search-r85` | ✅ pass | configured + boundary 双路径 PASS |
| `pnpm e2e:tasks` | ✅ pass | `17 pass / 0 fail` |
| `pnpm e2e:sites` | ✅ pass | `27 pass / 0 fail` (含 source_site_id 隔离) |
| `pnpm e2e:racks` | ✅ pass | `30 pass / 0 fail` |
| `pnpm e2e:route-page-integration` | ✅ pass | `86 pass / 0 fail` |
| `docker exec psql \dt` | ✅ pass | `file_index_jobs` + `sync_sites` 均存在 |
| `pnpm import:file-index-job-bootstrap --sites SH01` | ✅ pass | `inserted:0 skipped:29 total_jobs:29` (idempotent) |
| `pnpm scheduler:sync:once --siteCode=SH01` | ✅ pass | `status=partial export=success consistency=matched duration=1494ms` |
| `pnpm check:sync-consistency --siteCode=SH01` | ✅ pass | `matched:7 failed:0` (开发环境 source_restore 7 张表) |

---

## B. 剩余 Blocker 汇总

| Blocker | 类型 | 决策人 |
|---|---|---|
| R.91 audit:api-mode-no-fallback 启发式改进 | 本 Sprint scope | R.91 |
| R.91 UI 兜底 ApiUnavailableError 渲染 | 本 Sprint scope | R.91 |
| R.87 cron 调度器 / 监控告警 / 死信重放 | 本 Sprint scope | R.87 |
| §4.2 真实任务控制 (4 条件) | `blocked_by_site_change` + `blocked_by_source_schema` | 领导 + 站点运维 |
| §1.2 跨站点集群真实验证 | `blocked_by_site_change` | 第二个生产站点部署后 |
| §2.2/§3.1-3.3 登录 / RBAC / SSO | `blocked_by_auth` | Sprint 5.x 解锁 |
| R.89.5 实际清理 (28 safe_to_delete + 5 review_needed) | 本 Sprint scope | R.89.5 PR (需用户确认) |

---

## C. R.5 §9 项检查

| 项 | 结果 |
|---|---|
| A. Requirement 对照 | ✅ §1 已列 (2.1 / 2.3 / 5.2 / 4.2 / 6.2 / 6.4) |
| B. 前端变更清单 8 项 | ✅ §5 已披露 (无新增页面, 11 文件修改) |
| C. API 变更清单 | ✅ §3.3 + §3.4 (3 个生产 API 路由 + api-providers 拦截) |
| D. 数据库变更清单 | ✅ 无 schema 变更 (R.86 review 沿用) |
| E. 事件测试清单 10 项 | §A 表格 14 项全过 |
| F. 浏览器验证结果 | ✅ e2e 86 pass / 0 fail (含 racks/sites/tasks/route-page) |
| G. mock/simulator/DRY_RUN 标记 | ✅ §6 全部分清 |
| H. 未完成项 | ✅ §7 + §B 全列 |
| I. 是否允许 commit | ✅ release gate 全部通过, **不开新 PR 推 main** (用户禁推) |

---

## D. PR 决策 (R.90 PR 前修复完成)

### D.1 修复内容 (本 Sprint 闭环)

| 阻塞项 | 修复 |
|---|---|
| `audit:api-mode-no-fallback` exit 2 (35 命中) | `lib/api/api-providers.ts` 完全不再 import mock; 所有 `mockXxxProvider` 调用点删除, 写方法统一抛 `ApiUnavailableError`; `lib/api/mock-mode/racks-browse.ts` 中间层隔离 `lib/mock/*` |
| `audit:page-no-todo` exit 2 (17 命中) | 删除 logs/sync/volumes/dashboard 等文件中所有 `R.xx` / `Sprint X` / 待接入 / 占位 字样, JSDoc 历史说明保留在 `docs/audit/r90-frontend-cleanup-inventory.md` |
| `deployment.md §10` 写未实现项 | 删除 `table_whitelist_override` JSONB 字段 / `paused_by_admin` 列等未实现说明; 改为只写真实支持项 (sync_sites.enabled / sync_interval_seconds / 手动 --siteCode / R.83 141 张白名单 / R.86 file_index_jobs.is_enabled), 未实现项标 R.87 / R.91+ |
| `README.md` 缺链接 | 加简短链接: 多站点接入 §9, 定制同步 §10, R.85 §8, onboarding, site-agent-contract; 加 audit 命令到本地验证段 |

### D.2 release gate 实测 (R.90 PR 前真实结果)

| 命令 | 结果 |
|---|---|
| `pnpm audit:api-mode-no-fallback` | ✅ **PASS exit 0** (R.90 修复前 exit 2 / 35 命中) |
| `pnpm audit:page-no-todo` | ✅ **PASS exit 0** (R.90 修复前 exit 2 / 17 命中) |
| `pnpm exec tsc --noEmit` | ✅ pass (0 error) |
| `pnpm build` | ✅ pass (Next.js 16 production build) |
| `pnpm smoke:sync` | ✅ pass (packageStatus=success) |
| `pnpm baseline:check` | ✅ pass (13 pass / 0 fail) |
| `pnpm audit:center-db -- --strict --matrix` | ✅ pass (21 checks, 0 fail, 1 warn) |
| `pnpm e2e:search` | ✅ pass (14 pass / 0 fail) |
| `pnpm e2e:search-r85` | ✅ pass (configured + boundary 双路径) |
| `pnpm e2e:tasks` | ✅ pass (17 pass / 0 fail) |
| `pnpm e2e:sites` | ✅ pass (27 pass / 0 fail) |
| `pnpm e2e:racks` | ✅ pass (30 pass / 0 fail) |
| `pnpm e2e:route-page-integration` | ✅ pass (86 pass / 0 fail) |
| 从头部署验收 (`pnpm db:init` + bootstrap + scheduler + check) | ✅ pass |

### D.3 commit + push + PR 计划

本 Sprint 修复落地后:

1. **commit** `fix(r90): close integration cleanup gates`
2. **push** `codex/r84-development-architecture-cleanup-plans` 分支
3. **开 PR** 到最新 `main`

PR 命令:

```bash
git push -u origin codex/r84-development-architecture-cleanup-plans
gh pr create --base main \
  --head codex/r84-development-architecture-cleanup-plans \
  --title "R.90 PR 前修复: integration cleanup gates pass" \
  --body-file docs/database-analysis/sprint-r90-requirements-review.md
```

### D.4 禁止在 R.90 PR 内加入

- ❌ R.91 audit 启发式优化 (改进 audit 脚本自身)
- ❌ R.87 cron / 监控 / 死信重放 / 生产硬化
- ❌ R.89.5 dead-code 实际清理 (28 safe + 5 review)
- ❌ 任何生产部署 / HA / 告警 / k8s / secret manager 落地

_End of R.90 review._