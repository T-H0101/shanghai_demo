# Enterprise Productization Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the platform from a partly integrated demo into a requirements-driven enterprise control product: center DB reads, explicit site targeting, real sync/control evidence, honest blocked states, and a consistent UI.

**Architecture:** Product pages read center-owned data only: `unified_*`, sync/control/audit tables, ES/OpenSearch, and ClickHouse. Restore/source databases are synchronization sources, never direct product-page data sources. Each site is represented by `sync_sites` plus one Site Agent that polls center commands, executes local station DB work, and syncs evidence back.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, PostgreSQL 17, Site Agent polling, `pg_dump table_backup.sql` sync, ES/OpenSearch for file index/search, ClickHouse for logs, local JWT/RBAC with future OIDC/LDAP adapters.

---

## Source Inputs

- Requirements: `docs/source/requirements.md`
- Project constraints: `CLAUDE.md`, `AGENTS.md`
- UI design spec: `docs/superpowers/specs/2026-06-21-enterprise-ui-productization-design.md`
- Existing UI plan input: `docs/superpowers/plans/2026-06-21-enterprise-ui-productization.md`
- Existing integration plan input: `docs/superpowers/plans/2026-06-21-requirements-integration-closure.md`
- Current strict matrix: `docs/database-analysis/requirements-traceability.json`

## Current Verified Baseline

- Strict completion currently recorded: `29/45 = 64.4%`.
- Candidate coverage is not strict completion and must be reported separately.
- Current branch: `main`, ahead of `origin/main`; do not create a side branch unless the user explicitly changes direction.
- Current closure checks already verified:

```bash
set -a && source .env.local && set +a
pnpm e2e:sites
pnpm e2e:frontend-integration
pnpm e2e:task-create-control
pnpm exec tsc --noEmit
```

Expected current result: all pass before starting this plan.

## Non-Negotiable Constraints

- `requirements.md` is the highest standard.
- Do not lower, delete, or silently reinterpret requirements.
- Do not count mock, simulator, or DRY_RUN as strict completion.
- Do not read product pages directly from restore/source DB.
- Do not ingest full `tbl_file` or `tbl_folder` into PostgreSQL 17.
- Store env key references only; never commit real secrets.
- ADFS/OIDC/LDAP remains blocked until endpoint values, callback, test account, and claim mapping exist.
- ES/OpenSearch and ClickHouse can be implemented locally, but strict production completion requires deployed services and retention policy.
- New frontend buttons, route changes, filters, dialogs, and exports require event e2e.

## Current Integration Defects To Fix First

| Defect | Evidence | Required closure |
|---|---|---|
| Command palette task shortcuts use `/tasks?status=failed/running` | `components/shared/command-palette.tsx` pushes `status`, while `app/tasks/page.tsx` consumes only `device` and `view` | Use page-consumed `phase` query, or remove shortcut until page consumes it |
| Traceability top actions are stale | JSON stats says `not_started: 0`; top actions still label REQ-4.1.3 and REQ-5.2.2 as `not_started` | Recalculate top action statuses from actual requirement entries |
| UI plan and closure plan are split | Two separate untracked plan files exist | Use this file as canonical execution plan |
| Settings/read-only UX is not productized | Page can look like implementation notes instead of a real enterprise console | Rebuild presentation while keeping blocked/write constraints |
| Auth is locally implemented only | No ADFS/OIDC/LDAP endpoint/test account | Keep strict blocked state and show safe local JWT/RBAC truth |

## Target Completion Reporting

Report two numbers after every sprint:

- **Strict requirements completion:** only `complete` rows from `requirements-traceability.json`.
- **Implemented-but-unverified candidate coverage:** rows with code/config/UI path but missing production/external/auth verification.

Do not merge these numbers.

---

## File Structure

- Modify: `components/shared/command-palette.tsx`  
  Fix task shortcut route/query contract, soften active row and hover behavior, use dynamic site options.
- Modify: `app/tasks/page.tsx`  
  Consume `phase` query, keep explicit target site creation, show control queue language, remove misleading write affordances.
- Modify: `scripts/e2e/test-frontend-integration.ts`  
  Add route/query contract checks for command palette and tasks page.
- Modify: `lib/site/site-context.tsx`, `components/site/site-selector.tsx`  
  Keep `sync_sites` as only site source and expose source/error states.
- Modify: `app/api/tasks/create/route.ts`, `lib/control/task-create.ts`, `lib/site-agent/control/task-create-adapter.ts`  
  Preserve total-control path: center creates command, Site Agent writes station `tbl_task`, sync brings it back.
- Modify: `app/settings/page.tsx`, `app/sync/page.tsx`, `app/sites/page.tsx`  
  Productize multi-site registry, scheduler, safe config, auth/external blocked states.
- Create: `components/platform/glass-panel.tsx`, `components/platform/capsule-tabs.tsx`  
  Shared UI primitives for enterprise visual consistency.
- Modify: `app/globals.css`, `app/login/page.tsx`, `components/layout/app-shell.tsx`  
  Apply glass, capsule, hover shine, reduced-motion, and real product copy.
- Modify: `docker-compose.yml`, `.env.example`  
  Add local-only ES/OpenSearch and ClickHouse configuration with key refs only.
- Create/modify: `lib/search/es-client.ts`, `lib/search/file-index-repository.ts`, `app/api/search/route.ts`  
  Use ES/OpenSearch when configured; otherwise explicit blocked state.
- Create/modify: `lib/logs/clickhouse-client.ts`, `lib/logs/log-repository.ts`, `app/api/logs/route.ts`  
  Use ClickHouse for task logs when configured; otherwise explicit partial center fallback.
- Create/modify e2e:
  `scripts/e2e/test-header-ux-lift.ts`,
  `scripts/e2e/test-settings.ts`,
  `scripts/e2e/test-tasks.ts`,
  `scripts/e2e/test-task-create-control.ts`,
  `scripts/e2e/test-search-es.ts`,
  `scripts/e2e/test-clickhouse-logs.ts`,
  `scripts/e2e/test-worst-case-quality.ts`,
  `scripts/e2e/test-frontend-integration.ts`.
- Create review docs:
  `docs/database-analysis/sprint-r76-command-palette-contract-review.md`,
  `docs/database-analysis/sprint-r77-enterprise-ui-productization-review.md`,
  `docs/database-analysis/sprint-r78-settings-sync-sites-product-review.md`,
  `docs/database-analysis/sprint-r79-es-clickhouse-local-review.md`,
  `docs/database-analysis/sprint-r80-auth-permission-boundary-review.md`,
  `docs/database-analysis/sprint-r81-final-quality-matrix-review.md`.
- Update:
  `docs/database-analysis/requirements-traceability.json`,
  `docs/database-analysis/requirements-traceability.md`,
  `docs/testing/r81-quality-gate-report.md`,
  `README.md`.

---

## Task 1: Fix Command Palette Route Contracts

**Requirements:** REQ-6.3.1, REQ-6.3.2, frontend event e2e constraint  
**Commit:** `fix(ui): align command palette task filters`

- [ ] **Step 1: Add failing contract checks**

Modify `scripts/e2e/test-frontend-integration.ts`:

```ts
const paletteSource = await readFile("components/shared/command-palette.tsx", "utf8")
const tasksSource = await readFile("app/tasks/page.tsx", "utf8")

check(
  "command palette task shortcuts use page-consumed phase query",
  !paletteSource.includes("/tasks?status=") &&
    paletteSource.includes("/tasks?phase=failed") &&
    paletteSource.includes("/tasks?phase=running")
)
check(
  "tasks page consumes phase query",
  tasksSource.includes('searchParams.get("phase")') &&
    tasksSource.includes("setPhaseFilter(initialPhase)")
)
```

- [ ] **Step 2: Run and confirm failure**

```bash
set -a && source .env.local && set +a
pnpm e2e:frontend-integration
```

Expected: fails because the palette still pushes `status`.

- [ ] **Step 3: Fix task shortcut route**

In `components/shared/command-palette.tsx`, replace:

```ts
router.push("/tasks?status=failed")
router.push("/tasks?status=running")
```

with:

```ts
router.push("/tasks?phase=failed")
router.push("/tasks?phase=running")
```

- [ ] **Step 4: Consume phase query on the tasks page**

In `app/tasks/page.tsx`, initialize `phaseFilter` from query:

```ts
const phaseQuery = searchParams.get("phase")
const initialPhase =
  phaseQuery && Object.keys(TASK_PHASE_LABELS).includes(phaseQuery)
    ? phaseQuery
    : "all"
const [phaseFilter, setPhaseFilter] = useState<string>(initialPhase)
```

Add an effect to stay in sync after navigation:

```ts
useEffect(() => {
  const nextPhase =
    phaseQuery && Object.keys(TASK_PHASE_LABELS).includes(phaseQuery)
      ? phaseQuery
      : "all"
  setPhaseFilter(nextPhase)
}, [phaseQuery])
```

- [ ] **Step 5: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:frontend-integration
pnpm e2e:tasks
pnpm exec tsc --noEmit
```

- [ ] **Step 6: Requirements review and commit**

Create `docs/database-analysis/sprint-r76-command-palette-contract-review.md` with:

```md
# Sprint R.76 Requirements Review

## Requirement IDs
- REQ-6.3.1
- REQ-6.3.2

## Backend Reality
No backend behavior changed.

## UI Reality
Command palette task shortcuts now navigate to filters consumed by `/tasks`.

## Mock / Simulator / DRY_RUN
None.

## Verdict
pass
```

Then commit:

```bash
git add components/shared/command-palette.tsx app/tasks/page.tsx scripts/e2e/test-frontend-integration.ts docs/database-analysis/sprint-r76-command-palette-contract-review.md
git commit -m "fix(ui): align command palette task filters"
```

---

## Task 2: Enterprise UI Productization Pass

**Requirements:** REQ-6.3.1, REQ-6.3.2  
**Commit:** `style(ui): productize enterprise control experience`

- [ ] **Step 1: Add failing UI source checks**

Modify `scripts/e2e/test-header-ux-lift.ts`:

```ts
const glassSource = readFileSync("components/platform/glass-panel.tsx", "utf8")
const capsuleSource = readFileSync("components/platform/capsule-tabs.tsx", "utf8")
const globalsSource = readFileSync("app/globals.css", "utf8")
const loginSource = readFileSync("app/login/page.tsx", "utf8")
const settingsSource = readFileSync("app/settings/page.tsx", "utf8")

check("GlassPanel component exists", glassSource.includes("export function GlassPanel"))
check("CapsuleTabs component exists", capsuleSource.includes("export function CapsuleTabs"))
check("Diagonal shine utility exists", globalsSource.includes("app-shine-hover"))
check("Reduced motion respected", globalsSource.includes("prefers-reduced-motion"))
check("login removes demo-looking copy", !loginSource.includes("演示环境") && !loginSource.includes("开发账号"))
check("settings uses capsule sections", settingsSource.includes("CapsuleTabs"))
```

- [ ] **Step 2: Run and confirm failure**

```bash
set -a && source .env.local && set +a
pnpm e2e:header-ux-lift
```

- [ ] **Step 3: Create shared primitives**

Create `components/platform/glass-panel.tsx`:

```tsx
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface GlassPanelProps {
  children: ReactNode
  tone?: "light" | "dark"
  shine?: boolean
  className?: string
  testid?: string
}

const toneClass: Record<NonNullable<GlassPanelProps["tone"]>, string> = {
  light: "border-white/70 bg-white/85 text-slate-950 shadow-2xl shadow-slate-900/10 backdrop-blur-xl",
  dark: "border-white/15 bg-white/[0.08] text-white shadow-2xl shadow-black/25 backdrop-blur-xl",
}

export function GlassPanel({ children, tone = "light", shine = false, className, testid }: GlassPanelProps) {
  return (
    <div
      data-testid={testid}
      className={cn("relative overflow-hidden rounded-3xl border", toneClass[tone], shine && "app-shine-hover", className)}
    >
      {children}
    </div>
  )
}
```

Create `components/platform/capsule-tabs.tsx`:

```tsx
"use client"

import { cn } from "@/lib/utils"

export interface CapsuleTabItem<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

interface CapsuleTabsProps<T extends string> {
  value: T
  items: CapsuleTabItem<T>[]
  onChange: (value: T) => void
  className?: string
  testid?: string
}

export function CapsuleTabs<T extends string>({ value, items, onChange, className, testid }: CapsuleTabsProps<T>) {
  const activeIndex = Math.max(0, items.findIndex((item) => item.value === value))
  const width = `${100 / Math.max(items.length, 1)}%`
  return (
    <div
      data-testid={testid ?? "capsule-tabs"}
      className={cn("relative inline-grid rounded-full border border-slate-200 bg-slate-100 p-1", className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      role="tablist"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1 top-1 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ width, transform: `translateX(${activeIndex * 100}%)` }}
      />
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          disabled={item.disabled}
          onClick={() => onChange(item.value)}
          className={cn(
            "relative z-10 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
            item.value === value ? "text-blue-700" : "text-slate-500 hover:text-slate-900"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Add CSS utilities**

Modify `app/globals.css`:

```css
.app-shine-hover::after {
  content: "";
  position: absolute;
  inset: -40% auto -40% -80%;
  width: 55%;
  transform: rotate(18deg);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.34), transparent);
  opacity: 0;
  pointer-events: none;
  transition: transform 520ms ease, opacity 520ms ease;
}

.app-shine-hover:hover::after {
  opacity: 1;
  transform: translateX(280%) rotate(18deg);
}

@media (prefers-reduced-motion: reduce) {
  .app-shine-hover::after {
    display: none;
  }
}
```

- [ ] **Step 5: Productize login and settings**

In `app/login/page.tsx`:

- remove visible strings `演示环境`, `开发账号`, and implementation comments from JSX.
- keep local JWT login honest.
- show enterprise SSO only as disabled if present:

```tsx
<Button disabled variant="outline" data-testid="login-sso-blocked">
  企业 SSO 待接入
</Button>
```

In `app/settings/page.tsx`:

- use `CapsuleTabs` for sections `overview`, `sites`, `sync`, `auth`, `external`.
- show write actions as disabled unless a real API and permission check exists.
- show env key refs, not secret values.
- show ADFS/OIDC/LDAP as `blocked_by_auth`.
- show ES/OpenSearch and ClickHouse as configured/running/blocked, based on safe API status.

- [ ] **Step 6: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:header-ux-lift
pnpm e2e:settings
pnpm e2e:auth
pnpm exec tsc --noEmit
pnpm build
```

- [ ] **Step 7: Review and commit**

Create `docs/database-analysis/sprint-r77-enterprise-ui-productization-review.md` and commit:

```bash
git add components/platform/glass-panel.tsx components/platform/capsule-tabs.tsx app/globals.css app/login/page.tsx app/settings/page.tsx scripts/e2e/test-header-ux-lift.ts scripts/e2e/test-settings.ts scripts/e2e/test-auth.ts docs/database-analysis/sprint-r77-enterprise-ui-productization-review.md
git commit -m "style(ui): productize enterprise control experience"
```

---

## Task 3: Settings, Sync, And Site Registry Product Closure

**Requirements:** REQ-2.1.1, REQ-2.3.2, REQ-2.3.3, REQ-6.4.3  
**Commit:** `feat(settings): expose safe sync and site runtime state`

- [ ] **Step 1: Add failing tests**

Modify `scripts/e2e/test-settings.ts`:

```ts
check("settings shows sync config source", settingsSource.includes("settings-sync-config"))
check("settings shows site registry", settingsSource.includes("settings-site-registry"))
check("settings shows scheduler config", settingsSource.includes("settings-scheduler-config"))
check(
  "settings does not display secret values",
  !/postgres:\/\/[^<\s]+/.test(settingsHtml) &&
    !/mysql:\/\/[^<\s]+/.test(settingsHtml) &&
    !/password\s*[:=]\s*[^<\s]+/i.test(settingsHtml)
)
```

Modify `scripts/e2e/test-sync.ts`:

```ts
check("sync page shows per-site latest status", syncSource.includes("site-latest-sync-status"))
check("sync page shows package table logs", syncSource.includes("sync-package-table-logs"))
```

- [ ] **Step 2: Expose safe config API**

Update `app/api/sync/config/route.ts` to return:

```ts
{
  sites: [{ siteCode, siteName, enabled, credentialRef, schedulerEnabled, agentStatus }],
  scheduler: { intervalMinutes: 60, source: "center_config" },
  envRefs: {
    databaseUrl: "DATABASE_URL",
    siteDatabaseUrl: "SITE_DATABASE_URL",
    siteAgentSecret: "SITE_AGENT_SECRET"
  }
}
```

Never include actual connection strings or secrets.

- [ ] **Step 3: Render settings and sync page evidence**

In `app/settings/page.tsx`, add cards with test IDs:

```tsx
<section data-testid="settings-site-registry">
  <h2>站点注册表</h2>
  <p>来源: sync_sites</p>
</section>
<section data-testid="settings-sync-config">
  <h2>同步配置</h2>
  <p>来源: 中心配置, 密钥仅显示 env key ref</p>
</section>
<section data-testid="settings-scheduler-config">
  <h2>调度配置</h2>
  <p>默认每 60 分钟执行一次站点同步</p>
</section>
<section data-testid="settings-auth-boundary">
  <h2>认证边界</h2>
  <p>local JWT 已启用; ADFS/OIDC/LDAP blocked_by_auth</p>
</section>
<section data-testid="settings-external-boundary">
  <h2>外部存储</h2>
  <p>ES/OpenSearch 与 ClickHouse 按配置显示 running 或 blocked_by_external_system</p>
</section>
```

In `app/sync/page.tsx`, add:

```tsx
<section data-testid="site-latest-sync-status">
  <h2>站点最新同步状态</h2>
  <p>按 siteCode 展示最近 package、tableCount、recordCount 与一致性状态</p>
</section>
<section data-testid="sync-package-table-logs">
  <h2>同步包与表级日志</h2>
  <p>展示 sync_package_log 与 sync_table_log 的真实记录</p>
</section>
```

- [ ] **Step 4: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:settings
pnpm e2e:sync
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm exec tsc --noEmit
```

- [ ] **Step 5: Review and commit**

Create `docs/database-analysis/sprint-r78-settings-sync-sites-product-review.md` and commit:

```bash
git add app/api/sync/config/route.ts app/settings/page.tsx app/sync/page.tsx scripts/e2e/test-settings.ts scripts/e2e/test-sync.ts docs/database-analysis/sprint-r78-settings-sync-sites-product-review.md
git commit -m "feat(settings): expose safe sync and site runtime state"
```

---

## Task 4: ES/OpenSearch And ClickHouse Local Integration

**Requirements:** REQ-4.1.1, REQ-4.1.2, REQ-4.1.3, REQ-5.1.1, REQ-5.1.2, REQ-5.2.1, REQ-5.2.2  
**Commit:** `feat(search): add local external stores for index and logs`

- [ ] **Step 1: Add local-only services**

Modify `docker-compose.yml`:

```yaml
  opensearch:
    image: opensearchproject/opensearch:2.15.0
    environment:
      - discovery.type=single-node
      - plugins.security.disabled=true
      - OPENSEARCH_INITIAL_ADMIN_PASSWORD=local-dev-only-not-used
    ports:
      - "9200:9200"

  clickhouse:
    image: clickhouse/clickhouse-server:24.8
    ports:
      - "8123:8123"
      - "9000:9000"
```

Modify `.env.example`:

```bash
SEARCH_ES_URL=http://localhost:9200
SEARCH_ES_INDEX=disc_file_index_dev
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_LOG_TABLE=task_logs_dev
```

- [ ] **Step 2: Add failing tests**

Create or update `scripts/e2e/test-search-es.ts`:

```ts
check("search route has ES blocked state", searchSource.includes("blocked_by_external_system"))
check("search route uses SEARCH_ES_URL", searchSource.includes("SEARCH_ES_URL"))
check("full tbl_file/tbl_folder not ingested into PG", !searchSource.includes("INSERT INTO unified_tbl_file"))
```

Create or update `scripts/e2e/test-clickhouse-logs.ts`:

```ts
check("logs route uses CLICKHOUSE_URL", logsSource.includes("CLICKHOUSE_URL"))
check("logs route exposes partial fallback honestly", logsSource.includes("partial") || logsSource.includes("blocked_by_external_system"))
```

- [ ] **Step 3: Implement ES/OpenSearch boundary**

Create `lib/search/es-client.ts`:

```ts
export function getSearchExternalStatus() {
  const url = process.env.SEARCH_ES_URL
  if (!url) {
    return { enabled: false, blocker: "blocked_by_external_system" as const }
  }
  return { enabled: true, url, index: process.env.SEARCH_ES_INDEX ?? "disc_file_index_dev" }
}
```

Update `app/api/search/route.ts`:

- if ES is configured and reachable, query it.
- if ES is not configured, return `501` with `blocked_by_external_system`.
- never return mock rows in API mode.

- [ ] **Step 4: Implement ClickHouse boundary**

Create `lib/logs/clickhouse-client.ts`:

```ts
export function getClickHouseStatus() {
  const url = process.env.CLICKHOUSE_URL
  if (!url) {
    return { enabled: false, blocker: "blocked_by_external_system" as const }
  }
  return { enabled: true, url, table: process.env.CLICKHOUSE_LOG_TABLE ?? "task_logs_dev" }
}
```

Update `app/api/logs/route.ts`:

- use ClickHouse for task log query when configured.
- if ClickHouse is absent, keep center PG logs only and mark `dataSource: "center_pg_partial"`.
- export must include source and partial flags.

- [ ] **Step 5: Verify local external stack**

```bash
docker compose up -d opensearch clickhouse
set -a && source .env.local && set +a
pnpm e2e:dev-stack
pnpm e2e:search-es
pnpm e2e:clickhouse-logs
pnpm e2e:search
pnpm e2e:logs
pnpm baseline:check
```

- [ ] **Step 6: Review and commit**

Create `docs/database-analysis/sprint-r79-es-clickhouse-local-review.md`. Report strict and candidate separately:

```md
- Strict completion: only if local services ran and e2e passed.
- Production completion: candidate only until production ES/ClickHouse address and retention policy are approved.
```

Commit:

```bash
git add docker-compose.yml .env.example lib/search/es-client.ts lib/logs/clickhouse-client.ts app/api/search/route.ts app/api/logs/route.ts scripts/e2e/test-search-es.ts scripts/e2e/test-clickhouse-logs.ts docs/database-analysis/sprint-r79-es-clickhouse-local-review.md
git commit -m "feat(search): add local external stores for index and logs"
```

---

## Task 5: Auth And Permission Boundary Closure

**Requirements:** REQ-2.2.1, REQ-2.2.2, REQ-3.1.1, REQ-3.1.2, REQ-3.2.1, REQ-3.2.2, REQ-6.2.1, REQ-6.2.2  
**Commit:** `feat(auth): expose enterprise auth boundary`

- [ ] **Step 1: Add auth truth tests**

Modify `scripts/e2e/test-auth.ts` and `scripts/e2e/test-rbac.ts`:

```ts
check("local JWT login works", login.status === 200)
check("OIDC adapter remains blocked without issuer", authSource.includes("OIDC_ISSUER_URL"))
check("ADFS not claimed complete", traceabilitySource.includes("blocked_by_auth"))
check("settings shows auth boundary", settingsSource.includes("settings-auth-boundary"))
```

- [ ] **Step 2: Add OIDC/LDAP config validation without fake login**

In `lib/auth/oidc-provider.ts`, expose:

```ts
export function getOidcReadiness() {
  const required = ["OIDC_ISSUER_URL", "OIDC_CLIENT_ID", "OIDC_JWKS_URL"]
  const missing = required.filter((key) => !process.env[key])
  return {
    ready: missing.length === 0,
    missingEnvKeys: missing,
    status: missing.length === 0 ? "configured_candidate" : "blocked_by_auth",
  }
}
```

- [ ] **Step 3: Permission page behavior**

On `app/users/page.tsx` or the existing permissions section:

- show local RBAC roles that are actually enforced.
- show site/AD mapping as blocked/candidate unless source and IdP evidence exist.
- disable station propagation actions until Site Agent permission adapter exists.

- [ ] **Step 4: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:auth
pnpm e2e:rbac
pnpm e2e:users
pnpm e2e:settings
pnpm exec tsc --noEmit
```

- [ ] **Step 5: Review and commit**

Create `docs/database-analysis/sprint-r80-auth-permission-boundary-review.md` and commit:

```bash
git add lib/auth/oidc-provider.ts app/settings/page.tsx app/users/page.tsx scripts/e2e/test-auth.ts scripts/e2e/test-rbac.ts scripts/e2e/test-users.ts docs/database-analysis/sprint-r80-auth-permission-boundary-review.md
git commit -m "feat(auth): expose enterprise auth boundary"
```

---

## Task 6: Final Quality Gate And Requirements Matrix Reconciliation

**Requirements:** all 45 requirements  
**Commit:** `docs(requirements): reconcile enterprise productization closure`

- [ ] **Step 1: Run complete verification**

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
pnpm e2e:sites
pnpm e2e:settings
pnpm e2e:sync
pnpm e2e:tasks
pnpm e2e:task-create-control
pnpm e2e:search-es
pnpm e2e:clickhouse-logs
pnpm e2e:worst-case
```

- [ ] **Step 2: Produce quality report**

Create `docs/testing/r81-quality-gate-report.md`:

```md
# R.81 Quality Gate Report

## Security
- No secret values committed.
- Auth mode: local JWT strict, ADFS/OIDC/LDAP blocked unless env and test account exist.
- Cross-site actions require explicit `siteCode`.

## Maintainability
- Site source is `sync_sites`.
- API mode fails closed instead of silent mock fallback.
- External stores are isolated behind adapters.

## Availability
- Site Agent heartbeat and scheduler status visible.
- Disabled site behavior tested.

## Usability
- Command palette routes match page filters.
- First-run guide and responsive UI tested.
- Settings states are readable and not implementation-note driven.

## Performance
- Large file/index and logs use ES/OpenSearch or ClickHouse; no full `tbl_file`/`tbl_folder` PG ingest.

## Modifiability
- One site = one registry row + one Agent config.
- New external systems use env key refs and adapters.

## Verification
Paste command results with pass/fail status.
```

- [ ] **Step 3: Recalculate matrix**

Update `docs/database-analysis/requirements-traceability.json` and `.md`:

```txt
complete = only backend + UI + e2e + DB/API evidence
partial = some implemented pieces but missing external/auth/site production evidence
blocked_by_auth = ADFS/OIDC/LDAP or permission propagation without IdP
blocked_by_external_system = ES/ClickHouse absent or not production verified
blocked_by_site_change = station app/schema behavior needed
```

Fix stale top actions by deriving statuses from the actual requirement entries.

- [ ] **Step 4: Update README**

Update `README.md` with:

```md
## Current Verification Snapshot

- Strict requirements completion: computed from `requirements[].current_status === "complete"`.
- Implemented candidate coverage: computed separately from review evidence and candidate markers.
- Strict blockers: ADFS/OIDC/LDAP, production ES/ClickHouse, production Site Agent deployment, station schema/API gaps.
- Product pages read center DB/external stores only; restore/source DB is sync source only.
```

- [ ] **Step 5: Commit**

```bash
git add docs/database-analysis/requirements-traceability.json docs/database-analysis/requirements-traceability.md docs/testing/r81-quality-gate-report.md README.md
git commit -m "docs(requirements): reconcile enterprise productization closure"
```

---

## Stop Conditions

Stop and report instead of committing when:

- Any required verification fails and cannot be safely fixed in the same unit.
- A task would claim ADFS/OIDC/LDAP strict completion without real IdP config and a test account.
- A task would claim production ES/ClickHouse strict completion without deployed service and retention policy.
- A task requires destructive deletion, real secrets, or production data mutation.
- A change would route product pages directly to restore/source DB.

## Expected Outcome

- Strict completion can rise only where evidence is complete.
- Candidate coverage can reach `45/45` only if unverified external/auth/site pieces are clearly separated.
- UI becomes enterprise-grade without hiding blocked capabilities.
- Leadership blockers become concrete:
  1. ADFS/OIDC/LDAP endpoint, callback URL, test account, group/role claim mapping.
  2. Production ES/OpenSearch address, index naming, retention, backup policy.
  3. Production ClickHouse address, task log schema, retention period.
  4. Production Site Agent deployment approval per site.
  5. Station schema/API decisions for department hierarchy, cage move approval, and cross-site notification delivery.

## Self-Review

- Spec coverage: UI productization, command palette integration, site registry, settings/sync, task control, ES/OpenSearch, ClickHouse, auth boundary, quality gate, and matrix reconciliation are each mapped to a task.
- Placeholder scan: no open placeholder instructions; blocked external values are intentionally listed as leadership inputs.
- Type consistency: uses current project terms `siteCode`, `sync_sites`, `control_command`, `fileRefs`, ES/OpenSearch, ClickHouse, local JWT/RBAC, and Site Agent.
- Requirements truthfulness: strict and candidate completion are reported separately; no mock, simulator, DRY_RUN, or UI-only work is counted as strict completion.
