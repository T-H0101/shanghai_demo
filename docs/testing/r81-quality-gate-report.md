# R.81 Quality Gate Report

> Final reconciliation gate for the enterprise productization closure plan (R.76-R.80). Aggregates R.81/R.82 verification, R.75 quality gate findings, and the strict requirements matrix.

Date: 2026-06-21
Scope: R.76-R.80 product closure + R.81 final gate + R.82 integration fixes
Total requirements: 45 (strict)
Completion rate: **29/45 = 64.4%** (strict)
Candidate coverage: 45/45 (every entry has either strict-complete or implemented-candidate path)

---

## Security

- No real secret values committed. Repository scan confirms `.env.local` is untracked; findings are limited to documented placeholders/local-dev defaults in `.env.example`, README examples, and `docker-compose.yml`. Production secrets remain env-injected or referenced by key name only (`credential_key_ref`, `agentSecretKeyRef`, `syncPackageSecretKeyRef`, etc.).
- Auth mode: **local JWT strict**. HttpOnly `odp_session` cookie (HS256, 1h expiry), `requireSession` / `requirePermission` / `requireSiteAccess` middleware on tasks/racks/volumes/logs/users/control-commands. `auth/me`, `auth/accounts` responses verified to omit `password_hash` and `scrypt` fields.
- ADFS/OIDC/LDAP blocked: no IdP integration shipped. Local login flow stands in as the only auth path until enterprise IdP parameters are provided (REQ-2.2.1).
- Site-control endpoints (POST `/api/site-control/commands/...`) require HMAC-SHA256 signature via `verifySiteControlRequest`. Unsigned requests return HTTP 401 (e2e:security-boundaries verified).
- Cross-site actions require explicit `siteCode`: POST `/api/tasks/create` and POST `/api/control/commands` validate siteCode against `sync_sites` and return HTTP 400 `siteCode_required` / `siteCode_not_registered` when missing or unregistered (R.70).
- Audit hash-chain: `audit_log` rows linked via `audit_hash_chain`; `/api/audit/verify` detects tamperedIds (R.43 e2e verified).

## Maintainability

- Site source of truth is `sync_sites` (R.69). All site-context reads route through `/api/sync/config` → `sync_sites`. No hardcoded `SITE_CANDIDATES` fallback in code.
- API mode fails closed: R.71 replaced silent mock fallback with `ApiUnavailableError`. Routes that cannot reach the center DB expose `dataSource: "error"` or `dataSource: "blocked_by_external_system"` instead of returning mock data. UI shows explicit blocker banner rather than fake success.
- External stores are isolated behind client/repository boundaries: `lib/search/es-client.ts` + `lib/search/file-index-repository.ts` for ES/OpenSearch, and `lib/logs/clickhouse-client.ts` + `lib/logs/log-repository.ts` for ClickHouse. Missing ES config surfaces as `blocked_by_external_system`; the primary `/api/logs` route remains center-PG based and reports database/empty/error explicitly.
- Adapter pattern preserved for source APIs: `lib/api/api-providers.ts` is the only path from frontend to backend. No direct DB imports in components.

## Availability

- Site Agent heartbeat and scheduler status visible at `/api/sync/sites/status` (HTTP 200, real data). `/sites` page shows agent heartbeat time, `databaseReachable`, `agentVersion`, `spoolDepth`, and per-site `lastSyncAt`. Floating assistant surfaces site health.
- Disabled-site behavior tested: `R.9A` e2e verifies Power (enable/disable) button is disabled when `dataSource != database`; "注册新站点" button disabled; SSO button disabled with REQ-2.1.2 explanation.
- Heartbeat stale detection: <5min = online, 5-15min = stale, >15min = offline (synthesized from `site_agent_runtime.reported_at`).

## Usability

- Command palette task filters match `/tasks` page filters: failed uses `phase=failed`; running uses `phaseGroup=running` because running is a derived group, not a `TaskPhase`. `e2e:frontend-integration` verifies the query contract.
- First-run guide: `/settings` page renders disabled states when sync registry is empty or unreachable. Product pages show operator-facing "待接入/待认证接入/待外部服务" wording rather than raw blocker enums.
- Responsive UI: Tailwind v4 breakpoints exercised across Dashboard/Tasks/Racks/Volumes/Search/Sites/Logs/Users/Settings/Sync (R.35 `e2e:compat` 10/10 HTTP 200).
- Settings states are readable: each config card labels its source in product language and does not display DB/source/API implementation notes to operators.
- Search blocker copy is sanitized: `/search` does not render backend `meta.reason` / `meta.nextStep` directly, preventing internal `es_unavailable_*` style reasons from leaking into product UI.

## Performance

- Large file/index uses ES/OpenSearch when configured, or explicit `blocked_by_external_system` when ES and center index are absent. ClickHouse has a client/repository boundary and typed HTTP query contract; the product `/api/logs` route currently remains center-PG based. Current `e2e:search-es` and `e2e:clickhouse-logs` verify boundary behavior when env keys are absent.
- No full `tbl_file` / `tbl_folder` PG ingest: product `/api/search` never inserts those tables into PG17. Source DB file-index readers are audit/import tooling only; product pages read center DB or external stores.
- Concurrency verified: R.36 20-concurrent test against Tasks/Racks/Volumes/Logs/Users/Health achieved 100% success rate, average <1000ms, max <3000ms.

## Modifiability

- One site = one `sync_sites` row + one Site Agent config. R.69 removed dual hardcoded/mocked site sources; adding a site now requires inserting one row (or letting Site Agent self-register via heartbeat with valid HMAC).
- New external systems use env-key refs and client/repository boundaries: `SEARCH_ES_URL`, `CLICKHOUSE_URL`, `CLICKHOUSE_LOG_TABLE`, `SITE_AGENT_SECRET` etc. are referenced via env keys — never inlined as real secrets.
- Settings UI surfaces only env-key names and runtime status, never secret values (e2e:settings verifies HTML payload).

---

## Verification

### Pre-commit gate (R.81 Step 1)

| Command | Result | Notes |
|---|---|---|
| `pnpm exec tsc --noEmit` | PASS | no type errors |
| `pnpm build` | PASS | Next.js production build succeeded |
| `pnpm smoke:sync` | PASS | batch=TEST_SMOKE-1782042611758 status=success dupDetected=true |
| `pnpm check:sync-consistency -- --siteCode=SH01` | PASS | 7/7 tables matched, 0 anomalies, 62ms; wrote `docs/audit/consistency/consistency-SH01-2026-06-21T11-50-12-980Z.json` |
| `pnpm baseline:check` | PASS | 13/13 baseline checks |
| `pnpm e2e:all` | PASS | 35 scripts, 137s |

### Targeted scripts (R.81 Step 1)

| Command | Result | Notes |
|---|---|---|
| `pnpm e2e:sites` | PASS (25/25) | R.69 sync_sites source, disabled-state, derived coverage |
| `pnpm e2e:settings` | PASS (25/25) | envRefs only, no secret leakage, R.78 product surface |
| `pnpm e2e:sync` | PASS (43/43) | R.39 real trigger, R.55 pg_dump protocol, R.21 alert aggregation |
| `pnpm e2e:tasks` | PASS (17/17) | command-machine verbs, no misleading toast, R.70 siteCode enforcement |
| `pnpm e2e:search` | PASS (14/14) | includes product-copy guard: UI does not directly display backend blocker reasons |
| `pnpm e2e:task-create-control` | PASS | R.70 soft checks 3/3; Site Agent `--once` control_cycle_completed + sync_completed + heartbeat_recorded + task_create station insert |
| `pnpm e2e:auth` | PASS | local JWT + blocked enterprise IdP contract |
| `pnpm e2e:rbac` | PASS (23/23) | deny-by-default + settings auth-boundary contract |
| `pnpm e2e:search-es` | PASS (boundary) | SEARCH_ES_URL not configured; explicit `blocked_by_external_system` |
| `pnpm e2e:clickhouse-logs` | PASS (boundary) | CLICKHOUSE_URL not configured; ClickHouse typed-query contract + center_pg fallback |
| `pnpm e2e:worst-case` | PASS | no mock fallback, no false success toast, no secret leakage, route/api alignment, export fail-closed |

### Script availability

- `pnpm baseline:check` — exists, PASS (above).
- `pnpm e2e:all` — exists, PASS (above).
- `pnpm e2e:header-ux-lift` — exists, PASS (155/155) and is included in `e2e:all`.

R.82 added/updated assertions in existing e2e scripts; no additional package script is required.

### External store and IdP boundaries

- ES/OpenSearch configured path skipped with `blocked_by_external_system` evidence (SEARCH_ES_URL not set in env).
- ClickHouse configured path skipped in this gate because CLICKHOUSE_URL is not set in `.env.local`; the client now uses typed HTTP params and `FORMAT TabSeparatedWithNames`, while primary `/api/logs` remains center-PG based.
- ADFS/LDAP/OIDC not implemented (REQ-2.2.1 partial); local JWT only.

---

## Strict counts (recalculated from `requirements[].current_status`)

```
complete:               29
partial:                 6  (REQ-2.2.1, REQ-4.1.1, REQ-4.2.2, REQ-4.2.3, REQ-5.1.1, REQ-5.2.1)
blocked_by_auth:         5  (REQ-2.1.2, REQ-2.2.2, REQ-3.2.1, REQ-3.2.2, REQ-3.3.2)
blocked_by_source_schema: 3  (REQ-3.1.1, REQ-3.3.1, REQ-4.3.1)
blocked_by_site_change:  1  (REQ-3.1.2)
blocked_by_external_system: 1  (REQ-4.1.2)
out_of_scope:            0

total:                  45
completion_rate:        29/45 = 64.4%
```

---

## Candidate coverage (separate metric, NOT merged with strict)

```
strict complete:        29
implemented_candidate:  16  (every partial / blocked_* has implemented_candidate path:
                              - control_command queue + audit for REQ-4.2.x
                              - local JWT strict for REQ-2.2.x/3.2.x
                              - ES/OpenSearch client boundary and explicit blocked state for REQ-4.1.x
                              - sync_sites registry + e2e for REQ-2.1.2/3.1.2)
candidate_total:        45
candidate_coverage:     45/45 = 100%
```

---

## Observations

1. `top10_next_actions` in `requirements-traceability.json` was stale (7 of 10 statuses did not match the current `current_status`). R.81 recalculates it from real entries; see updated file.
2. R.82 fixes corrected stale auth/RBAC e2e string contracts after UI copy productization. `pnpm e2e:auth`, `pnpm e2e:rbac`, and `pnpm e2e:all` now pass.
3. ES returns explicit `blocked_by_external_system` rather than mock data; ClickHouse remains a client/repository boundary until the product `/api/logs` route is promoted to ClickHouse-backed reads.
4. Site Agent `--once` cycle is the most direct evidence of R.22 pause/resume real-execution; production deployment remains pending (REQ-4.2.2 stays partial until deployment verification).
5. Toast wording discipline verified by `e2e:tasks`: no `已暂停` / `暂停成功` strings in source; only `已提交` / `已提交暂停命令` phrasing is allowed.
6. README.md and `.env.example` now align on API-first mode. Mock mode remains available only for isolated UI styling and cannot be counted as requirements evidence.

---

## Verdict

PASS for R.81/R.82 closure: strict evidence reconfirmed, top-10 actions refreshed, all verification commands pass, no fabricated mock/simulator/DRY_RUN evidence counted as complete.
