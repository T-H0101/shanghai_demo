# Requirements Integration Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current 29/45 strict requirements state into a coherent, testable, multi-site control platform by closing integration gaps before claiming more requirements complete.

**Architecture:** Product pages must read only center-owned data (`unified_*`, center sync/control/audit tables, ES/OpenSearch, ClickHouse). Source/restore databases are synchronization sources only. Each station is represented by a center registry row and, in real deployment, one Site Agent instance that polls center commands and syncs station data back to the center.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, PostgreSQL 17, Site Agent polling, `pg_dump table_backup.sql`, ES/OpenSearch boundary, ClickHouse boundary, local JWT/RBAC with future OIDC/LDAP adapters.

---

## Current Strict Baseline

- Strict verified completion: `29/45 = 64.4%`.
- Candidate coverage: `45/45 candidate`, but candidate is not strict completion.
- Existing dirty worktree warning at plan time: `components/dashboard/command-center-panel.tsx` and `scripts/e2e/test-command-center.ts` are already modified; do not overwrite them without reviewing current diff.
- Highest standard: `docs/source/requirements.md`.
- Project constraints: `CLAUDE.md` and `AGENTS.md`.
- Required checks before every commit:

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
```

## Unsatisfied Requirement Map

| Requirement | Current state | Closure strategy |
|---|---|---|
| REQ-2.1.1 站点配置 | Marked complete but integration is weak | Make site registry the only UI site source, remove hardcoded site candidates, add station onboarding tests |
| REQ-2.1.2 站点切换 SSO | blocked_by_auth | Keep blocked until OIDC/ADFS values exist; implement safe config view and explicit blocked UI |
| REQ-2.2.1 ADFS/LDAP | partial | Keep local JWT strict; add OIDC/LDAP adapter contract and config validation without fake login |
| REQ-2.2.2 AD 到站点账号映射 | blocked_by_auth | Add center mapping table/API/UI in blocked/candidate state, strict only after IdP test |
| REQ-2.3.1 同步范围 | complete after R.68, but needs multi-site hardening | Run one-site and two-site sync tests through center registry |
| REQ-3.1.1 Site 多对多账号 | blocked_by_source_schema | Add center-side mapping support, mark source gaps clearly |
| REQ-3.1.2 全 Site 提醒 | blocked_by_site_change | Add notification config model, keep delivery blocked until station channel exists |
| REQ-3.2.1/3.2.2 权限分配/生效 | blocked_by_auth | Build center permission workflow; station propagation remains blocked without IdP/station adapter |
| REQ-3.3.1/3.3.2 部门/权限审计 | blocked_by_source_schema/auth | Add center department model if source exists; otherwise keep blocked with evidence |
| REQ-4.1.1/4.1.2 检索 | partial/blocked_by_external_system | Wire ES/OpenSearch local dev to file index search, fail closed when unavailable |
| REQ-4.2.1 任务新建 | complete claim needs stricter UX | Require explicit target site, file refs for restore/backup, no default SH01 |
| REQ-4.2.2/4.2.3 控制/巡检 | partial | Add missing command atoms and station execution evidence; strict only after station DB mutation + sync back |
| REQ-4.3.1 盘笼移位 | blocked_by_source_schema | Keep center command/audit; strict needs station table/API evidence |
| REQ-5.1.1 日志采集 | partial | Wire ClickHouse local dev for task logs, fallback to center PG as partial only |
| REQ-5.2.1 索引范围 | partial | Use ES/OpenSearch for file index; do not ingest full `tbl_file`/`tbl_folder` into PG17 |
| REQ-6.x 非功能 | many complete claims need worst-case proof | Add quality gate report covering security, maintainability, availability, usability, performance, modifiability |

## File Structure

- Modify: `lib/site/site-context.tsx`  
  Loads site options from center registry instead of hardcoded `SITE_CANDIDATES`.
- Modify: `components/site/site-selector.tsx`  
  Shows source, disabled/error state, and explicit all-sites behavior.
- Modify: `app/api/sites/route.ts`  
  Exposes center registry and derived source separately; no mock fallback.
- Modify: `app/api/sync/config/route.ts`  
  Returns safe site registry, scheduler config, Agent status, and env key refs without secrets.
- Modify: `app/tasks/page.tsx`  
  Adds explicit target site in create dialog, file relation fields, blocked states, and no hidden defaults.
- Modify: `app/api/tasks/create/route.ts`  
  Requires explicit `siteCode`, validates registered/enabled site, enqueues command only.
- Modify: `lib/control/task-create.ts`  
  Carries target site, task fields, and file refs into `control_command` payload.
- Modify: `lib/site-agent/control/task-create-adapter.ts`  
  Executes station DB inserts for `tbl_task` plus file relation tables only when schema is verified.
- Modify: `lib/api/index.ts`, `lib/api/fallback.ts`, `lib/api/api-providers.ts`  
  Remove silent mock fallback from API mode; return explicit blocked/error states.
- Modify: `lib/search/es-client.ts`, `lib/search/file-index-repository.ts`, `app/api/search/route.ts`  
  Make ES/OpenSearch local dev a real searchable path; unavailable ES returns blocked.
- Modify: `lib/logs/clickhouse-client.ts`, `lib/logs/log-repository.ts`, `app/api/logs/route.ts`  
  Make ClickHouse local dev a real task-log path; unavailable CH returns partial center PG result.
- Modify: `app/settings/page.tsx`, `app/sync/page.tsx`, `app/sites/page.tsx`  
  Align multi-site registry, scheduler status, and Agent health UX.
- Modify or create tests under `scripts/e2e/`:
  `test-sites.ts`, `test-settings.ts`, `test-tasks.ts`, `test-task-create-control.ts`, `test-sync.ts`, `test-search-es.ts`, `test-clickhouse-logs.ts`, `test-frontend-integration.ts`, `test-worst-case-quality.ts`.
- Create review docs:
  `docs/database-analysis/sprint-r69-site-registry-integration-review.md`,
  `docs/database-analysis/sprint-r70-task-create-site-closure-review.md`,
  `docs/database-analysis/sprint-r71-no-mock-fallback-review.md`,
  `docs/database-analysis/sprint-r72-es-clickhouse-integration-review.md`,
  `docs/database-analysis/sprint-r73-auth-permission-boundary-review.md`,
  `docs/database-analysis/sprint-r74-quality-gate-review.md`.
- Update:
  `docs/database-analysis/requirements-traceability.md`,
  `docs/database-analysis/requirements-traceability.json`,
  `README.md`.

---

## Task 1: Site Registry Becomes The Single Site Source

**Requirements:** REQ-2.1.1, REQ-2.3.2, REQ-6.4.3  
**Commit:** `feat(sites): use center registry for site selection`

- [ ] **Step 1: Add failing e2e contract for dynamic site selector**

Modify `scripts/e2e/test-sites.ts` to assert these source strings:

```ts
check("site selector no longer uses hardcoded SITE_CANDIDATES", !read("lib/site/site-context.tsx").includes("SITE_CANDIDATES"))
check("site context fetches /api/sync/config or /api/sites", read("lib/site/site-context.tsx").includes("/api/sync/config") || read("lib/site/site-context.tsx").includes("/api/sites"))
check("site selector exposes data source state", read("components/site/site-selector.tsx").includes("data-testid=\"site-selector-source\""))
```

- [ ] **Step 2: Run failing test**

```bash
set -a && source .env.local && set +a
pnpm e2e:sites
```

Expected: fails on hardcoded `SITE_CANDIDATES`.

- [ ] **Step 3: Replace hardcoded site candidates**

In `lib/site/site-context.tsx`, replace the static list with a fetched `sites` state. Keep `ALL_SITES`, localStorage, and URL sync. The fetch must use:

```ts
const res = await fetch("/api/sync/config", { cache: "no-store" })
const json = await res.json()
const rows = json?.data?.sites ?? []
const options = rows
  .filter((row: any) => row.enabled !== false)
  .map((row: any) => ({ code: row.siteCode, label: row.siteName ? `${row.siteCode} ${row.siteName}` : row.siteCode }))
```

If fetching fails, expose an error state and keep only `全部站点`; do not invent `SH01`.

- [ ] **Step 4: Update selector UI**

In `components/site/site-selector.tsx`, render:

```tsx
<span data-testid="site-selector-source" className="sr-only">
  {error ? "error" : "sync_sites"}
</span>
```

When no registered sites exist, disable single-site actions and show `未注册站点`.

- [ ] **Step 5: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:sites
pnpm e2e:settings
pnpm exec tsc --noEmit
```

- [ ] **Step 6: Review doc and commit**

Create `docs/database-analysis/sprint-r69-site-registry-integration-review.md` with requirement text, API evidence, UI evidence, missing pieces, blocker type, and verdict. Then:

```bash
git add lib/site/site-context.tsx components/site/site-selector.tsx scripts/e2e/test-sites.ts scripts/e2e/test-settings.ts docs/database-analysis/sprint-r69-site-registry-integration-review.md
git commit -m "feat(sites): use center registry for site selection"
```

---

## Task 2: Task Creation Requires Explicit Site And Real Control Evidence

**Requirements:** REQ-4.2.1, REQ-4.2.2, REQ-6.2.4  
**Commit:** `feat(tasks): require explicit site for center task creation`

- [ ] **Step 1: Add failing e2e checks**

Modify `scripts/e2e/test-task-create-control.ts`:

```ts
check("task create API has no default SH01", !read("app/api/tasks/create/route.ts").includes("?? \"SH01\""))
check("task create dialog shows target site", read("app/tasks/page.tsx").includes("data-testid=\"task-create-target-site\""))
check("task create validates registered site", read("app/api/tasks/create/route.ts").includes("sync_sites"))
```

- [ ] **Step 2: Run failing test**

```bash
set -a && source .env.local && set +a
pnpm e2e:task-create-control
```

Expected: fails because API defaults to `SH01` and dialog does not expose target site.

- [ ] **Step 3: Remove default site from API**

In `app/api/tasks/create/route.ts`, replace:

```ts
const siteCode = (body.siteCode ?? "SH01").trim()
```

with:

```ts
const siteCode = (body.siteCode ?? "").trim()
if (!siteCode) {
  return NextResponse.json(
    { code: 400, error: "siteCode is required" },
    { status: 400 }
  )
}
```

Then query `sync_sites`:

```ts
const siteResult = await query<{ site_code: string; enabled: boolean }>(
  "SELECT site_code, enabled FROM sync_sites WHERE site_code = $1 LIMIT 1",
  [siteCode]
)
if (siteResult.rows.length === 0 || siteResult.rows[0].enabled === false) {
  return NextResponse.json(
    { code: 400, error: "siteCode is not registered or disabled" },
    { status: 400 }
  )
}
```

- [ ] **Step 4: Show target site in the dialog**

In `app/tasks/page.tsx`, inside the create dialog body, add:

```tsx
<div data-testid="task-create-target-site" className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
  目标站点: <code>{siteCode}</code>
</div>
```

Add a short note: `任务不会写入 unified_tasks；只有站点 Agent 执行并同步回中心后才出现在任务列表。`

- [ ] **Step 5: Add file relation inputs without fake ES completion**

If task type is `restore`, show optional file refs fields but mark them `中心命令 payload；文件索引完整验证依赖 ES/OpenSearch` until Task 5 is complete. The payload must use existing `fileRefs` shape:

```ts
fileRefs: [{ rootPath, originalPath, itemName, isFolder }]
```

Do not claim `REQ-5.2.1` complete from this task.

- [ ] **Step 6: Verify station execution path**

Run:

```bash
set -a && source .env.local && set +a
pnpm e2e:task-create-control
pnpm test:e2e:worker
pnpm e2e:tasks
```

Expected:
- API returns `400` without `siteCode`.
- UI blocks create in all-sites mode.
- With `siteCode=SH01`, command enters `control_command`.
- Strict completion requires station Agent execution and station DB mutation evidence.

- [ ] **Step 7: Review doc and commit**

Create `docs/database-analysis/sprint-r70-task-create-site-closure-review.md`. Then:

```bash
git add app/tasks/page.tsx app/api/tasks/create/route.ts lib/control/task-create.ts scripts/e2e/test-task-create-control.ts scripts/e2e/test-tasks.ts docs/database-analysis/sprint-r70-task-create-site-closure-review.md
git commit -m "feat(tasks): require explicit site for center task creation"
```

---

## Task 3: Remove Silent Mock Fallback From API Mode

**Requirements:** REQ-1.1.1, REQ-1.2.1, REQ-6.2.4  
**Commit:** `fix(api): fail closed instead of falling back to mock`

- [ ] **Step 1: Add failing integration checks**

Modify `scripts/e2e/test-frontend-integration.ts`:

```ts
check("API mode does not silently fallback to mock", !read("lib/api/fallback.ts").includes("using mock"))
check("search provider is not always mock", !read("lib/api/index.ts").includes("searchProvider: SearchProvider = mockSearchProvider"))
check("settings provider is not always mock", !read("lib/api/index.ts").includes("settingsProvider: SettingsProvider = mockSettingsProvider"))
```

- [ ] **Step 2: Run failing test**

```bash
set -a && source .env.local && set +a
pnpm e2e:frontend-integration
```

Expected: fails on mock fallback.

- [ ] **Step 3: Replace fallback helper**

In `lib/api/fallback.ts`, change API-mode behavior to throw a typed error:

```ts
export class ApiUnavailableError extends Error {
  constructor(public readonly context: string, message: string) {
    super(`${context}: ${message}`)
    this.name = "ApiUnavailableError"
  }
}
```

`fetchWithFallback` must throw in API mode. Mock fallback may only be used when `NEXT_PUBLIC_API_MODE=mock`.

- [ ] **Step 4: Update provider exports**

In `lib/api/index.ts`, use API providers for search/settings/audit where API routes exist. If no API exists, return explicit blocked DTOs; do not use mock data in API mode.

- [ ] **Step 5: Update pages to show blocked/error states**

For tasks, sites, search, logs, settings, racks, and volumes, render existing `EmptyState` with `severity="blocked"` or `severity="error"` when an API fails.

- [ ] **Step 6: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:frontend-integration
pnpm e2e:route-page-integration
pnpm e2e:all
pnpm exec tsc --noEmit
```

- [ ] **Step 7: Review doc and commit**

Create `docs/database-analysis/sprint-r71-no-mock-fallback-review.md`. Then:

```bash
git add lib/api/index.ts lib/api/fallback.ts lib/api/api-providers.ts app scripts/e2e/test-frontend-integration.ts scripts/e2e/test-route-page-integration.ts docs/database-analysis/sprint-r71-no-mock-fallback-review.md
git commit -m "fix(api): fail closed instead of falling back to mock"
```

---

## Task 4: Multi-Site Sync Onboarding And Scheduler Closure

**Requirements:** REQ-2.1.1, REQ-2.3.2, REQ-2.3.3, REQ-6.1.3, REQ-6.4.3  
**Commit:** `feat(sync): add multi-site onboarding and scheduler evidence`

- [ ] **Step 1: Add failing sync checks**

Modify `scripts/e2e/test-sync.ts`:

```ts
check("sync config exposes site registry", bodyText.includes("sync_sites"))
check("sync page shows agent status per site", read("app/sync/page.tsx").includes("site-agent-status"))
check("scheduler docs mention one agent per site", read("docs/operations/site-agent-deployment.md").includes("每个站点"))
```

- [ ] **Step 2: Add a safe local two-site seed**

Create or extend a database seed patch to include `SH01` and one disabled placeholder site such as `BJ02` in `sync_sites`. Store only `credential_ref`, never a password value.

- [ ] **Step 3: Make Settings and Sync Center show onboarding checklist**

Add a section:

```text
1. Register site in sync_sites
2. Configure env key ref
3. Start Site Agent with SITE_CODE
4. Verify heartbeat
5. Run manual sync
6. Run consistency check
```

Do not display real DB passwords.

- [ ] **Step 4: Verify one-site flow**

```bash
set -a && source .env.local && set +a
pnpm scheduler:sync:once -- --siteCode=SH01
pnpm check:sync-consistency -- --siteCode=SH01
pnpm e2e:sync
pnpm e2e:settings
```

- [ ] **Step 5: Verify disabled-site behavior**

Call sync trigger for disabled `BJ02`; expected result is a clear blocked/error response, not fake success.

- [ ] **Step 6: Review doc and commit**

Create `docs/database-analysis/sprint-r72-multisite-sync-onboarding-review.md`. Then:

```bash
git add app/sync/page.tsx app/settings/page.tsx app/api/sync/config/route.ts scripts/e2e/test-sync.ts scripts/e2e/test-settings.ts docs/operations/site-agent-deployment.md docs/database-analysis/sprint-r72-multisite-sync-onboarding-review.md
git commit -m "feat(sync): add multi-site onboarding and scheduler evidence"
```

---

## Task 5: ES/OpenSearch And ClickHouse Local Integration

**Requirements:** REQ-4.1.1, REQ-4.1.2, REQ-5.1.1, REQ-5.1.3, REQ-5.2.1  
**Commit:** `feat(observability): wire search and log external stores`

- [ ] **Step 1: Add failing external-store checks**

Update:

```bash
scripts/e2e/test-search-es.ts
scripts/e2e/test-clickhouse-logs.ts
scripts/e2e/test-external-dev-stack.ts
```

Required assertions:

```ts
check("docker compose contains elasticsearch or opensearch", compose.includes("elasticsearch") || compose.includes("opensearch"))
check("docker compose contains clickhouse", compose.includes("clickhouse"))
check("search route returns source es when SEARCH_ES_URL is configured", body.source === "es")
check("logs route returns clickhouse source when CLICKHOUSE_URL is configured", body.source === "clickhouse")
```

- [ ] **Step 2: Run failing tests**

```bash
set -a && source .env.local && set +a
pnpm e2e:dev-stack
pnpm e2e:search-es
pnpm e2e:clickhouse-logs
```

- [ ] **Step 3: Complete docker compose local stack**

In `docker-compose.yml`, ensure ES/OpenSearch and ClickHouse services exist with local-only ports and no real secrets. Add `.env.example` key refs only.

- [ ] **Step 4: Implement ES indexing path for file index samples**

Add a small deterministic indexing script under `scripts/search/` or extend existing file-index importer. It must index sampled or verified file index rows only. Do not full-ingest `tbl_file` or `tbl_folder` into PG17.

- [ ] **Step 5: Implement ClickHouse task log ingestion sample**

Add a small deterministic task-log ingestion path from center logs or station source logs into ClickHouse. This satisfies local candidate evidence only; production strict requires deployed ClickHouse and retention config.

- [ ] **Step 6: Verify blocked behavior when external stores are absent**

Unset `SEARCH_ES_URL` and `CLICKHOUSE_URL` temporarily in a shell session and run:

```bash
pnpm e2e:search-es
pnpm e2e:clickhouse-logs
```

Expected: routes return explicit `blocked_by_external_system` or partial center PG source, not mock.

- [ ] **Step 7: Verify enabled behavior when local stores are present**

```bash
docker compose up -d elasticsearch clickhouse
set -a && source .env.local && set +a
pnpm e2e:dev-stack
pnpm e2e:search-es
pnpm e2e:clickhouse-logs
```

- [ ] **Step 8: Review doc and commit**

Create `docs/database-analysis/sprint-r73-es-clickhouse-integration-review.md`. Then:

```bash
git add docker-compose.yml .env.example lib/search lib/logs app/api/search app/api/logs scripts/e2e/test-search-es.ts scripts/e2e/test-clickhouse-logs.ts scripts/e2e/test-external-dev-stack.ts docs/database-analysis/sprint-r73-es-clickhouse-integration-review.md
git commit -m "feat(observability): wire search and log external stores"
```

---

## Task 6: Auth, Permission, Department Boundaries Without Fake SSO

**Requirements:** REQ-2.1.2, REQ-2.2.1, REQ-2.2.2, REQ-3.1.1, REQ-3.2.1, REQ-3.2.2, REQ-3.3.1, REQ-3.3.2, REQ-6.2.4  
**Commit:** `feat(auth): expose enterprise auth readiness without fake sso`

- [ ] **Step 1: Add failing auth boundary checks**

Modify `scripts/e2e/test-auth.ts` and `scripts/e2e/test-rbac.ts`:

```ts
check("auth config exposes local vs oidc vs ldap", read("lib/auth/config.ts").includes("AUTH_MODE"))
check("SSO start route does not fake login", !read("app/api/auth/sso/start/route.ts").includes("success: true"))
check("permission page shows blocked_by_auth when no IdP", read("app/users/page.tsx").includes("blocked_by_auth"))
```

- [ ] **Step 2: Run failing tests**

```bash
set -a && source .env.local && set +a
pnpm e2e:auth
pnpm e2e:rbac
```

- [ ] **Step 3: Make enterprise auth configuration explicit**

Settings must show:

```text
当前认证: local JWT
ADFS/OIDC: blocked_by_auth until OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_JWKS_URL exist
LDAP: blocked_by_auth until LDAP_URL, LDAP_BASE_DN, bind key refs exist
```

Do not store or display bind passwords or client secrets.

- [ ] **Step 4: Add account-site mapping candidate table/API if absent**

Only store center-side mapping:

```text
account_id
site_code
station_account_ref
sync_status
last_synced_at
```

Strict status remains blocked until enterprise IdP and station permission propagation are verified.

- [ ] **Step 5: Add permission workflow blocked UI**

Users page must show a two-step permission workflow:

```text
1. assign sites
2. assign devices / volumes
```

Write actions stay disabled unless auth/RBAC mode is configured and tested.

- [ ] **Step 6: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:auth
pnpm e2e:auth-audit
pnpm e2e:rbac
pnpm e2e:users
```

- [ ] **Step 7: Review doc and commit**

Create `docs/database-analysis/sprint-r74-auth-permission-boundary-review.md`. Then:

```bash
git add lib/auth app/api/auth app/users/page.tsx app/settings/page.tsx scripts/e2e/test-auth.ts scripts/e2e/test-auth-audit.ts scripts/e2e/test-rbac.ts scripts/e2e/test-users.ts docs/database-analysis/sprint-r74-auth-permission-boundary-review.md
git commit -m "feat(auth): expose enterprise auth readiness without fake sso"
```

---

## Task 7: Command Center UI/UX Integration Pass

**Requirements:** REQ-6.3.1, REQ-6.4.3 and frontend event constraint in AGENTS.md  
**Commit:** `style(ui): unify command center integration states`

- [ ] **Step 1: Review existing dirty files first**

Run:

```bash
git diff -- components/dashboard/command-center-panel.tsx scripts/e2e/test-command-center.ts
```

If those changes are not yours, preserve them and build on top.

- [ ] **Step 2: Add UI integration checks**

Extend `scripts/e2e/test-command-center.ts`:

```ts
check("command center shows strict and candidate separately", source.includes("strict") && source.includes("candidate"))
check("command center shows not-ready dependencies", source.includes("ADFS") && source.includes("ES") && source.includes("ClickHouse") && source.includes("Site Agent"))
check("command center links to sync tasks search logs settings", source.includes("/sync") && source.includes("/tasks") && source.includes("/search") && source.includes("/logs") && source.includes("/settings"))
```

- [ ] **Step 3: Run failing test**

```bash
set -a && source .env.local && set +a
pnpm e2e:command-center
```

- [ ] **Step 4: Implement UI state language**

Command Center must show four lanes:

```text
同步: registry / scheduler / consistency
控制: command queue / Agent poll / station DB evidence
检索: center index / ES status / export
安全: local JWT / RBAC / ADFS blocked
```

Do not say `45/45 complete`; say `29/45 strict, 45/45 candidate`.

- [ ] **Step 5: Verify responsive and guide behavior**

```bash
set -a && source .env.local && set +a
pnpm e2e:command-center
pnpm e2e:header-ux-lift
pnpm e2e:floating-assistant
pnpm e2e:compat
```

- [ ] **Step 6: Review doc and commit**

Create `docs/database-analysis/sprint-r75-command-center-integration-review.md`. Then:

```bash
git add components/dashboard/command-center-panel.tsx app/page.tsx scripts/e2e/test-command-center.ts scripts/e2e/test-header-ux-lift.ts scripts/e2e/test-floating-assistant.ts docs/database-analysis/sprint-r75-command-center-integration-review.md
git commit -m "style(ui): unify command center integration states"
```

---

## Task 8: Worst-Case Quality Gate And Matrix Backfill

**Requirements:** all 45, especially REQ-6.1 through REQ-6.4  
**Commit:** `docs(requirements): backfill strict matrix after integration closure`

- [ ] **Step 1: Run full required checks**

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
```

- [ ] **Step 2: Run targeted checks**

```bash
pnpm e2e:sites
pnpm e2e:settings
pnpm e2e:sync
pnpm e2e:task-create-control
pnpm e2e:search-es
pnpm e2e:clickhouse-logs
pnpm e2e:auth
pnpm e2e:rbac
pnpm e2e:worst-case
```

- [ ] **Step 3: Write quality report**

Create `docs/testing/r75-quality-gate-report.md` with:

```text
Security: auth mode, no secret display, HMAC, RBAC, cross-site checks
Maintainability: registry-owned site source, no hardcoded site list, no silent mock fallback
Availability: Agent heartbeat, disabled-site behavior, scheduler logs
Usability: explicit target site, blocked states, first-run guide, command center status
Performance: ordinary queries, search/log route behavior, export checks
Modifiability: one Agent per site, env key refs, external store adapters
```

- [ ] **Step 4: Update strict matrix**

Update `docs/database-analysis/requirements-traceability.md` and `.json`. Rules:

- Upgrade to `complete` only when backend + UI + e2e + DB/API evidence exist.
- Keep `partial` when code exists but production system is not verified.
- Keep `blocked_by_auth` for ADFS/LDAP/SSO until real IdP details and test account exist.
- Keep `blocked_by_external_system` if ES/ClickHouse is not running and tested.
- Keep `blocked_by_source_schema` when station source tables/fields are absent.

- [ ] **Step 5: Update README reporting language**

README must say:

```text
Strict completion: X/45
Candidate coverage: Y/45
Do not report candidate as complete.
Remaining leadership decisions: ADFS/OIDC/LDAP details, production ES/ClickHouse, production Site Agent deployment, station schema gaps.
```

- [ ] **Step 6: Commit**

```bash
git add docs/database-analysis/requirements-traceability.md docs/database-analysis/requirements-traceability.json docs/testing/r75-quality-gate-report.md README.md
git commit -m "docs(requirements): backfill strict matrix after integration closure"
```

---

## Execution Order

1. Task 1: site registry source of truth.
2. Task 2: task creation site closure.
3. Task 3: no silent mock fallback.
4. Task 4: multi-site sync onboarding.
5. Task 5: ES/ClickHouse local integration.
6. Task 6: auth/permission boundary.
7. Task 7: Command Center UI/UX integration.
8. Task 8: worst-case quality gate and matrix backfill.

This order is intentional: site identity must be stable before task creation, sync, permissions, and UI polish.

## Stop Conditions

- Any required verification fails and cannot be fixed safely.
- A change would store or display real secrets.
- A change would full-ingest `tbl_file` or `tbl_folder` into PG17.
- A task would claim ADFS/LDAP/SSO strict completion without real IdP configuration and a test account.
- A task would claim ES/ClickHouse strict completion without running local or production services.
- A task would claim real control success without station Agent execution and station DB mutation evidence.

## Expected Completion After This Plan

Conservative target:

- Strict completion: from `29/45` to approximately `35/45` if local ES/ClickHouse and station Agent evidence pass.
- Candidate coverage: stays `45/45 candidate`.
- Remaining strict blockers likely after execution:
  - ADFS/OIDC/LDAP production details and test account.
  - Production ES/ClickHouse deployment and retention policy.
  - Production Site Agent deployment for each real station.
  - Station source schema gaps for departments, cage move, and message push.

Do not pre-commit these numbers. Recalculate from evidence in Task 8.

## Leadership Questions To Carry Forward

These are not required to start Tasks 1-5, but they are required before strict completion of blocked enterprise items:

1. ADFS/OIDC/LDAP endpoint values, callback URL, test account, group/role claim mapping.
2. Production ES/OpenSearch deployment address, index naming, retention, backup policy.
3. Production ClickHouse deployment address, task log schema, retention period.
4. Whether each station will run one Site Agent instance with `SITE_CODE` and `SITE_DATABASE_URL`.
5. Station schema/API decision for department hierarchy, cage move approval fields, and cross-site notification delivery.

## Self-Review

- Spec coverage: all current partial/blocked requirement families are mapped above.
- Placeholder scan: no `TBD` or unassigned owner steps remain.
- Type consistency: `siteCode`, `sync_sites`, `control_command`, `fileRefs`, ES/OpenSearch, and ClickHouse names match current codebase terms.
- Requirements truthfulness: plan keeps strict and candidate completion separate.
