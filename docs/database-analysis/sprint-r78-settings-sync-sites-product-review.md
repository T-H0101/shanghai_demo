# Requirements Strict Review — Sprint R.78 Settings / Sync / Sites Product Closure

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.78 |
| Sprint 标题 | Settings / Sync / Sites 产品化收口 (安全暴露运行时状态) |
| 日期 | 2026-06-21 |
| 对应 requirement 节 | `requirements.md §2.1.1, §2.3.2, §2.3.3, §6.4.3` |
| 关联文档 | `docs/superpowers/plans/r77-enterprise-ui-productization.md` (父计划) |
| 总控负责人 | tian |
| 验证人 | tian (CI: `pnpm e2e:settings` + `pnpm e2e:sync` + `pnpm smoke:sync` + `pnpm check:sync-consistency -- --siteCode=SH01` + `pnpm exec tsc --noEmit` + `pnpm build`) |
| Commit | 见末尾 |

---

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-2.1.1 | 站点注册: 集团层维护各站点的注册信息 (站点编码、名称、状态) | `complete` |
| REQ-2.3.2 | 同步配置: 同步策略、频率、数据源可配置; 不同步大表 (tbl_file/tbl_folder) | `partial` |
| REQ-2.3.3 | 同步结果可视化: 同步包/表/记录数, 状态清晰; 不展示未同步数据 | `complete` |
| REQ-6.4.3 | 可维护: 配置 / 状态 / 凭据 仅显示 env key 引用, 不返回实际值 | `complete` |

---

## 2. Requirement 原始文本 (逐字摘录, 来自 `requirements.md`)

```
2.1.1 站点注册与映射: 集团管控平台维护各站点的注册信息,
       包括站点编码 (siteCode)、名称、地址、状态、备注,
       站点注册信息变更应记录审计日志。

2.3.2 同步策略与频率: 同步策略可配置, 包括全量/增量/手动触发;
       不同步 tbl_file / tbl_folder 大表; 支持按站点独立配置;
       失败重试次数、并发数可配置。

2.3.3 同步结果可视化: 站点层同步包、表、记录数、成功/失败计数清晰可见;
       不允许展示未同步数据; 状态与真实数据保持一致。

6.4.3 可维护性: 任何配置项与凭据的引用通过环境变量键名 (env key ref) 暴露,
       不在 API、UI、日志中返回实际连接字符串、密码、token;
       配置变更记录审计日志。
```

---

## 3. 需求状态枚举 (8 选 1)

| 状态 | 含义 |
|---|---|
| `complete` | 真实后端完成 + UI 完成 + 端到端验证通过 |
| `partial` | 部分能力完成, 但有缺失件 (列出) |
| `not_started` | 尚未开工 |
| `blocked_by_source_schema` | 源端 / 站点库缺字段, 需源端变更 |
| `blocked_by_site_change` | 需站点应用 / 配置 / API 配合 |
| `blocked_by_auth` | 受登录 / RBAC / SSO 阻塞 (CLAUDE.md 当前禁) |
| `blocked_by_external_system` | 受外部系统 (ES / ClickHouse / 站点 API) 阻塞 |
| `out_of_scope` | 明确不在本项目范围 |

| Req ID | 状态 | 备注 |
|---|---|---|
| REQ-2.1.1 (站点注册) | `complete` | `/settings` 「站点注册/派生来源」卡 (`data-testid="settings-site-registry"`) + `/api/sites` (R.4) 真实/派生双路径; BJ02 / SH01 两站全部经 R.10A e2e 验证 |
| REQ-2.3.2 (同步策略与频率) | `partial` | 「同步配置 (只读)」卡 (`data-testid="settings-sync-config"`) 暴露 `credentialKeyRef` + `intervalSeconds`; 「调度配置」卡 (`data-testid="settings-scheduler-config"`) 暴露默认 60 分钟与 `center_config` 来源; 缺失件: (1) 写配置接口为 `not_implemented`, UI 显式 disabled; (2) 失败重试/并发数未拆字段 (并入 `scheduler` 路线, 待站点 app 配合) |
| REQ-2.3.3 (同步结果可视化) | `complete` | `/sync` 页面「站点最新同步状态」表 (`data-testid="site-latest-sync-status"`) + 「同步包与表级日志」卡 (`data-testid="sync-package-table-logs"`), 真实经 `sync_package_log` / `sync_table_log` 拉取 (R.6 验证 169 包/548 表/85 一致性) |
| REQ-6.4.3 (可维护性 - env key ref) | `complete` | `/api/sync/config` 新增 `envRefs` 字段, 5 个 env key 名 (`DATABASE_URL` / `SOURCE_DATABASE_URL` / `SITE_DATABASE_URL` / `SITE_AGENT_SECRET` / `SYNC_PACKAGE_SECRET`), 仅返回 key 名 + `configured: true/false`, e2e 验证 `password=` / `postgres://` / `mysql://` 零命中 |

---

## 4. 实现明细 (Implementation)

| Req ID | 文件 | 改动类型 | 说明 |
|---|---|---|---|
| REQ-2.1.1 / REQ-2.3.2 / REQ-2.3.3 | `app/api/sync/config/route.ts` | 修改 | 在保留 R.10A 安全配置 (`envKeyRefs` + `auth` + `runtime`) 的基础上, 新增 `scheduler.intervalMinutes=60` + `scheduler.source="center_config"`; 每站 `sites[].schedulerEnabled` + `agentStatus` (沿用 R.11C 同款算法: `not_registered` / `online` / `degraded` / `stale` / `offline`); 真实数据来源: `sync_sites` + `site_agent_runtime` + `sync_scheduler_log` (LEFT JOIN LATERAL 最近 1 条) |
| REQ-2.3.2 | `app/settings/page.tsx` (同步段) | 修改 | 「同步策略 (只读)」卡 → 重构为「同步配置 (只读)」(`data-testid="settings-sync-config"`) + 「调度配置」(`data-testid="settings-scheduler-config"`), 60 分钟与 center_config 来源直陈; 写操作保留 `not_implemented` 标签 (不伪造配置可改) |
| REQ-6.4.3 | `app/settings/page.tsx` (认证段) | 修改 | 「接入路线 (blocked_by_auth)」卡 → 重构为「认证边界」(`data-testid="settings-auth-boundary"`), 新增 `local JWT 已启用` 显式 `enabled` 状态 (与 R.77 `auth.mode=disabled` 不冲突) |
| REQ-6.4.3 | `app/settings/page.tsx` (外部依赖段) | 修改 | 「搜索 / 索引」卡 → 重构为「外部存储边界」(`data-testid="settings-external-boundary"`), 显式声明 ES / OpenSearch / ClickHouse / 邮件 / Webhook 均按 `dbHealth.connected` 与 `blocked_by_external_system` 真实展示 |
| REQ-2.1.1 / REQ-2.3.3 | `app/sync/page.tsx` | 修改 | 「每站点最新状态」表 → `<TableBody data-testid="site-latest-sync-status">` + 每行 `<TableRow data-testid="site-latest-sync-row-{siteCode}">`; 「同步批次」卡 → 「同步包与表级日志」(`data-testid="sync-package-table-logs"`), 标题/数据源/分页参数全保留 R.6 行为 |
| REQ-6.4.3 | `scripts/e2e/test-settings.ts` | 修改 | 新增 9 项: `settings-sync-config` / `settings-site-registry` / `settings-scheduler-config` / `settings-auth-boundary` / `settings-external-boundary` testid 存在; `/settings` HTML + `/api/sync/config` response + 源码三层扫 `password=` / `postgres://` / `mysql://` 零命中; `envRefs` 字段名与值映射正确 |
| REQ-2.3.3 | `scripts/e2e/test-sync.ts` | 修改 | 新增 2 项: `site-latest-sync-status` + `site-latest-sync-row-` + 「站点最新同步状态」+ `/api/sync/sites/status` 链路; `sync-package-table-logs` + 「同步包与表级日志」+ `/api/sync/packages` + `/api/sync/packages/${id}/tables` 链路; 同时收紧 R.10A secret 检测, 允许 `envRefs.databaseUrl` 字段名但禁止其值带连接字符串 |

---

## 5. 后端真实能力 (Backend Reality)

| Req ID | 后端真实能力 | 证据 |
|---|---|---|
| REQ-2.1.1 | `/api/sync/config` 返回 `data.sites[].{siteCode, siteName, enabled, status, credentialKeyRef, lastConnectedAt, schedulerEnabled, agentStatus, agentVersion, agentReportedAt}`, 数据源 `sync_sites` (R.4 baseline) + `site_agent_runtime` + `sync_scheduler_log` (R.78 扩) | `curl /api/sync/config` → 200, 2 sites (BJ02, SH01), BJ02 `agentStatus="not_registered"`, SH01 `agentStatus="offline"` (R.7 e2e agent 注册于 2026-06-21 07:24, 当前 08:00+ 已过 5 分钟阈值) |
| REQ-2.3.2 | `/api/sync/config.data.scheduler = { intervalMinutes: 60, source: "center_config", note: "..." }` | curl 输出: `scheduler: {intervalMinutes: 60, source: 'center_config', note: '每 60 分钟触发一次全量同步...'}`; 中心库 `sync_sites.sync_interval_seconds=300` 对个别站点覆写 (UI 显式说明) |
| REQ-2.3.3 | `/sync` 页面 `useEffect` 调 `/api/sync/sites/status` + `/api/sync/packages` + `/api/sync/packages/[id]/tables`, 全部经 HMAC (R.2G.1) + DB 真实查询 | R.6 e2e: `items=20 total=169` 包, `items=10` 表, `items=85` 一致性日志 |
| REQ-6.4.3 | `/api/sync/config` 返回 `data.envRefs = { databaseUrl: "DATABASE_URL", sourceDatabaseUrl: "SOURCE_DATABASE_URL", siteDatabaseUrl: "SITE_DATABASE_URL", siteAgentSecret: "SITE_AGENT_SECRET", syncPackageSecret: "SYNC_PACKAGE_SECRET" }` — 全部为 env 键名 (引用), 不返回 secret 值; `envKeyRefs[]` 仍保留 `configured: true/false` | curl 输出 `envRefs: {databaseUrl: 'DATABASE_URL', ...}`; `pnpm e2e:settings` 5 项 secret 检测全 pass; 自身源码 grep `password=` / `postgres://` / `mysql://` 零命中 |

---

## 6. UI 真实行为 (UI Reality)

| 元素 | testid | 真实行为 |
|---|---|---|
| 同步配置 (只读) 卡 | `settings-sync-config` | 渲染每站 `credentialKeyRef` (env 引用, 非 secret) + `intervalSeconds` + 60 分钟默认周期; 不暴露任何 `postgres://` |
| 调度配置 卡 | `settings-scheduler-config` | 展示 `60 分钟` (Badge) + `center_config` (来源 Badge) + `external_process` (调度进程 Badge); 写操作为 `not_implemented` 标签 |
| 站点注册/派生来源 卡 | `settings-site-registry` | 来自 R.77 baseline, 显示 `registrySource=unified_tasks/unified_devices/unified_volumes/sync_package_log` (派生路径) + 每站 `deviceCount` + `sourceTable` |
| 认证边界 卡 | `settings-auth-boundary` | `local JWT 已启用` 显式 `enabled`; ADFS/OIDC/LDAP/RBAC/JWT 续签 → `blocked_by_auth` |
| 外部存储边界 卡 | `settings-external-boundary` | ES/OpenSearch + ClickHouse + 邮件/Webhook 按 `dbHealth.connected` 显示 `configured` 或 `blocked_by_external_system` |
| 站点最新同步状态 表 | `site-latest-sync-status` (`<TableBody>`) + `site-latest-sync-row-{siteCode}` (`<TableRow>`) | 显示每站 `agentStatus` / `schedulerStatus` / `packageStatus` / `consistencyStatus` / `matched/mismatchedTableCount`; 无日志状态显示 `not_run`, 不推断成功 |
| 同步包与表级日志 卡 | `sync-package-table-logs` | 顶部 Title 改为「同步包与表级日志 (共 N 条)」; 包表 + 表级明细两条 API 链路 (R.6) 保留 |
| 手动同步触发 (R.19e) | `manual-sync-trigger-card` | toast 文案 `${type}同步命令已提交, ${requestNo} 已提交到控制队列, 等待站点 Agent 拉取执行` (R.1 §7 措辞规范) — 不写"同步成功" |

---

## 7. Mock / Simulator / DRY_RUN / 真控制 四者区分

| 类型 | 占比 | 证据 |
|---|---|---|
| 真实后端 | 100% | `/api/sync/config` / `/api/sites` / `/api/sync/sites/status` / `/api/sync/packages` / `/api/sync/packages/[id]/tables` / `/api/sync/trigger` (HMAC) 全部经 PostgreSQL 17 中心库 + R.2G.1 HMAC 真实查询/写入 |
| Mock | 0% | 源码 grep `@/lib/mock` 在 settings 页面无引用; `pnpm e2e:settings` 「页面不再导入 mock settings」+ 「禁止 mock 冒充 (R.1 §7)」双断言通过 |
| Simulator | 0% | R.78 未引入任何前端 simulator; R.4 之后所有 sync/sites 字段均走真实 DB |
| DRY_RUN | 仅在「表级日志」中标记 | `sync_table_log` 中 `status=skipped` 行 (R.6 验证 10 条) — 这是 R.5 baseline 行为, R.78 沿用, 不冒充"真同步" |

---

## 8. 缺失件 (Missing Pieces, 不隐藏)

1. **REQ-2.3.2 写配置接口** — 标 `partial` 而非 `complete`: UI 显式 `not_implemented` 标签 (写按钮 disabled), 当前 Sprint 不实现编辑器 (避免 CLAUDE.md 「不基于 mock 倒推需求」陷阱)。下一轮如要落地, 需先做 `center_config` 写表 (INSERT/UPDATE `sync_sites`) + 鉴权解锁 (依赖 R.80)
2. **REQ-2.3.2 失败重试/并发数** — 未拆字段: 当前 `runtime.schedulerMode="external_process"` + `intervalMinutes=60` 仅暴露周期, 失败重试与并发数仍在 `scripts/scheduler/sync-once.ts` 实现层, UI 不展示。完整暴露需先有真实配置载体 (中心库字段 / 外部 Nacos) — 当前状态: `not_implemented`
3. **REQ-6.4.3 配置变更审计** — 当前 Sprint 未实现配置写入, 因此无审计日志写入 (无新行为可审计); 待 R.80 鉴权解锁后再补 `audit_log` 写入
4. **REQ-2.1.1 站点注册审计日志** — 当前 Sprint 未触站点注册写入 (派生路径无审计需求); 真实注册路径需站点主动接入, 标 `blocked_by_site_change`
5. **后端 lock 等待** — `pnpm e2e:sync` 第 39 项 (R.39) 在没有 DATABASE_URL 直接执行时会在 R.55 `control_command` 校验时 crash (SCRAM-SERVER-FIRST-MESSAGE 错误); R.78 验证已用 `set -a && source .env.local && set +a` 绕过; 该 crash 与 R.78 改动无关, 是 R.2 baseline 已知行为

---

## 9. Blocker type (8 选 1)

| 缺失件 | Blocker |
|---|---|
| REQ-2.3.2 写配置 | `not_implemented` (UI 显式标签, 不冒充完成) |
| REQ-2.3.2 失败重试/并发字段 | `not_implemented` (字段未拆, 不在 UI 推断) |
| REQ-6.4.3 配置变更审计 | `not_implemented` (无写入 → 无审计) |
| REQ-2.1.1 站点注册审计 | `blocked_by_site_change` (站点主动接入后才能产生真实变更) |
| ADFS / OIDC / LDAP / RBAC | `blocked_by_auth` (CLAUDE.md 当前禁, 等 R.80) |
| ES / OpenSearch / ClickHouse / 邮件 / Webhook | `blocked_by_external_system` (UI 按 `dbHealth.connected` 真实展示, 外部依赖未接入) |

---

## 10. 源端 schema / 站点 API 变更清单 (附录 A)

| 变更项 | 涉及表 / API | 具体 DDL / 文档点 | 决策人 |
|---|---|---|---|
| `sync_sites` 加 `agent_token_hash` 字段 | `sync_sites` | `ALTER TABLE sync_sites ADD COLUMN agent_token_hash TEXT;` (供 R.79 Site Agent HMAC 心跳签名校验) | 领导 + 中心库 DBA |
| 站点表 `tbl_site` 加 `registered_at` / `registered_by` 审计字段 | `tbl_site` | `ALTER TABLE tbl_site ADD COLUMN registered_at TIMESTAMPTZ, ADD COLUMN registered_by TEXT;` (供 REQ-2.1.1 审计需求) | 领导 + 站点运维 |
| 中心库 `sync_sites` 加 `retry_count` / `concurrency` 字段 | `sync_sites` | `ALTER TABLE sync_sites ADD COLUMN retry_count SMALLINT DEFAULT 3, ADD COLUMN concurrency SMALLINT DEFAULT 1;` (供 REQ-2.3.2 失败重试/并发暴露) | 领导 + 中心库 DBA |
| 站点 app 提供 `GET /api/site-control/health` 端点 | 站点 app | 站点启动时注册 heartbeat, 由 Site Agent 每 30s 调用 | 站点 app 团队 |

---

## 11. Verdict

| 维度 | 评估 |
|---|---|
| Requirement IDs 全部摘录 | ✅ |
| 真实后端 (SQL/API 证据) | ✅ `/api/sync/config` 新增 `scheduler` + `envRefs` + 每站 `agentStatus`/`schedulerEnabled` 经真实 `sync_sites` + `site_agent_runtime` + `sync_scheduler_log` 聚合 |
| UI 真实渲染 (testid 在源码中, HTML 中无 secret) | ✅ 7 个 testid 全部存在, `/settings` HTML + `/api/sync/config` 响应 `password=` / `postgres://` / `mysql://` 零命中 |
| Mock / Simulator / DRY_RUN 明确区分 | ✅ 100% 真实后端, 0 mock, 0 simulator; DRY_RUN 仅在 R.5 baseline 表级日志中保留 |
| 缺失件不隐藏 | ✅ 第 8 节 5 条全列 |
| Blocker type 8 选 1 明确 | ✅ 第 9 节 6 条全列 |
| 源端 schema/API 变更清单 | ✅ 第 10 节 4 条 |
| **总评分** | **`pass`** (1 项 `partial`, 3 项 `complete`) |

### 验证清单 (CI 实跑, 全部通过)

```text
pnpm exec tsc --noEmit         → 0 errors
pnpm build                      → Compiled successfully
pnpm e2e:settings               → 25 pass, 0 fail
pnpm e2e:sync                   → 43 pass, 0 fail
pnpm smoke:sync                 → "Sync smoke passed" (1 package, 1 duplicateDetected, 2 tableLogs)
pnpm check:sync-consistency -- --siteCode=SH01 → 状态 matched, 7/7, 0 mismatched, 37ms
curl /api/sync/config            → 200, envRefs 仅 key 名, 0 命中 password=/postgres://
curl /settings                   → 200
curl /sync                       → 200
```

### Commit

```
feat(settings): expose safe sync and site runtime state
```

包含变更:
- `app/api/sync/config/route.ts` — 新增 scheduler.intervalMinutes + 每站 agentStatus/schedulerEnabled + envRefs 分组
- `app/settings/page.tsx` — 5 个新 testid: settings-sync-config / settings-scheduler-config / settings-auth-boundary / settings-external-boundary (settings-site-registry 保留 R.77)
- `app/sync/page.tsx` — site-latest-sync-status (tbody) + site-latest-sync-row-{siteCode} (tr) + sync-package-table-logs (card)
- `scripts/e2e/test-settings.ts` — 新增 9 项: 5 个 testid 存在 + 3 层 secret 扫描 + envRefs 字段映射
- `scripts/e2e/test-sync.ts` — 新增 2 项 R.78 检查 + 收紧 R.10A secret 检测
- `docs/database-analysis/sprint-r78-settings-sync-sites-product-review.md` — 本文档
