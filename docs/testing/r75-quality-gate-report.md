# R.75 Quality Gate Report

> Date: 2026-06-21
> Strict baseline: 29/45 (64.4%) · Candidate: 45/45
> Status: All quality gates PASS; no requirement upgrades

---

## Security

| Check | Result | Evidence |
|---|---|---|
| Auth mode 显式 (local JWT / ADFS blocked) | ✅ pass | `app/login/page.tsx` 文案: "当前认证:本地 JWT / 企业 ADFS/LDAP:待接入" |
| Secret 不泄露 | ✅ pass | `/api/system/health` 不含 `password =` 模式 (test-worst-case-quality.ts) |
| HMAC-SHA256 Site Agent 校验 | ✅ pass | `lib/site-agent/control/postgres-adapter.ts` 走 HMAC 签名 |
| RBAC role inheritance | ✅ pass | `lib/auth/rbac-policy.ts` viewer/operator/admin, deny-by-default |
| Cross-site 数据隔离 | ✅ pass | siteCode 字段全 API 强制 (`test-frontend-integration` 84/84) |

## Maintainability

| Check | Result | Evidence |
|---|---|---|
| Site registry 单一来源 | ✅ pass (R.69) | `lib/site/site-context.tsx` 从 `/api/sync/config` 拉取,无硬编码 `SITE_CANDIDATES` |
| 无静默 mock fallback | ✅ pass (R.71) | `lib/api/fallback.ts` 改用 `console.error` + `ApiUnavailableError`,搜索/审计/设置 provider 返回显式 blocked |
| API mode 不伪装 mock | ✅ pass | `/api/search` 返回 `source=blocked_by_external_system` 而不是 mock |
| 业务字段可追溯 (sourceEvidence) | ✅ pass | `/api/racks` 和 `/api/racks/[id]` 都含 sourceEvidence (test-racks 30/30) |

## Availability

| Check | Result | Evidence |
|---|---|---|
| Site Agent heartbeat | ✅ pass | R.70 运行时日志 `heartbeat_recorded` 200 OK |
| Disabled site behavior | ✅ pass | `/api/tasks/create` 返回 400 `siteCode is not registered or disabled` (R.70) |
| Scheduler logs 真实 | ✅ pass | `/api/system/db-health` 200 响应 + sync_package_log 真实记录 |
| 站点 Agent 异常容忍 | ✅ pass | `SKIP LOCKED` + lease 30s (R.63) |

## Usability

| Check | Result | Evidence |
|---|---|---|
| 显式目标站点 | ✅ pass (R.70) | `data-testid="task-create-target-site"` 显示 `siteCode` + 解释性文案 |
| Blocked 状态可视化 | ✅ pass (R.UI) | `EmptyState severity="blocked"` 三档配色 (slate/amber/red) |
| First-run guide | ✅ pass | 10 路由覆盖, dismiss-all, resize-safe (test-header-ux-lift 128/128) |
| Command Center 4 通道 | ✅ pass | 同步/控制/检索/安全 + strict 29/45 + candidate 45/45 双 Badge |
| Toast 不冒充成功 | ✅ pass | R.5 §10 措辞规范 + test-worst-case 无 "已暂停"/"同步完成" |

## Performance

| Check | Result | Evidence |
|---|---|---|
| 健康 endpoint 响应 | ✅ pass | `/api/system/health` 200 < 100ms |
| 设备导出 | ✅ pass | `/api/racks/export?siteCode=SH01` 200 + SHA-256 摘要 (test-racks) |
| Search route | ✅ pass | `/api/search?q=x` 200 即使 blocked 也即时返回 |
| Logs route | ✅ pass | `/api/logs?limit=1` 200 含 source + items |

## Modifiability

| Check | Result | Evidence |
|---|---|---|
| 一站一 Agent | ✅ pass | `lib/site-agent/control/postgres-adapter.ts` 按 SITE_CODE 路由 |
| Env key refs | ✅ pass | `/api/sync/config` 返 `envKeyRefs` 仅显示键名,无 secret 值 |
| External store adapters | ✅ pass | `lib/search/es-client.ts` / `lib/logs/clickhouse-client.ts` 独立模块,未配置返回 blocked |
| Account mapping | ✅ pass (R.66) | `lib/auth/account-mapping.ts` 候选 |

## Test Coverage Summary (本次新增 + 已有)

| 测试脚本 | pass/total | 来源 |
|---|---|---|
| test-sites | 25/25 | R.9A + R.69 (3 new) |
| test-tasks | 17/17 | R.6 + R.69 校验 |
| test-task-create-control | 1/1 + 3/3 soft | R.58 + R.70 |
| test-racks | 30/30 | R.10D + R.17 + R.UI (4 new) |
| test-settings | 16/16 | R.10B |
| test-logs | 43/43 | R.12 + R.20 |
| test-search | 13/13 | R.48 + R.55 |
| test-frontend-integration | 14/14 | R.71 (5 new) |
| test-route-page-integration | 84/84 | R.44 |
| test-header-ux-lift | 128/128 | UI (R.UI: 7 new) |
| test-command-center | 26/26 | R.UI (3 new) |
| test-worst-case-quality | 5/5 | R.67 |

**总: 402/402 真实运行时通过**

## Strict 数字计算

| 状态 | 计数 |
|---|---:|
| complete | 29 |
| partial | 6 |
| blocked_by_auth | 5 |
| blocked_by_external_system | 1 |
| blocked_by_site_change | 1 |
| blocked_by_source_schema | 3 |
| **strict** | **29/45 = 64.4%** |
| candidate | 45/45 |

## 阻塞项决策 (待领导/运维)

| 阻塞 | 升级所需 |
|---|---|
| 5 项 blocked_by_auth | OIDC_ISSUER_URL + 测试账号 + 角色映射 |
| 1 项 blocked_by_external_system | 生产 ES/OpenSearch 部署 |
| 3 项 blocked_by_source_schema | tbl_depa / tbl_device_device / cage_move 表 |
| 1 项 blocked_by_site_change | 真实站点 Site Agent 部署验证 |

## Verdict

**pass** — 所有质量门通过。本次 R.69/R.70/R.71 三轮改动:
- 没有引入新的 blocked
- 没有降级任何 complete
- 加固了 site registry / task create / fallback 三条关键路径
- 没有声称 strict 升级 (实际 strict 仍 29/45, 但 evidence 强度大幅提升)

不主动声称 strict 升级到 35/45 — 实际 strict 受限于 ES/CH/ADFS/Agent 部署, 计划书中的乐观目标需领导决策。

---

Commits in this sprint (R.69-R.71):

- `5534fbb feat(sites): use center registry for site selection`
- `3a3bdfa fix(sites): migrate command palette to useSiteSites`
- `e7099e4 feat(tasks): require explicit site for center task creation`
- `807cefc fix(api): fail closed instead of falling back to mock`