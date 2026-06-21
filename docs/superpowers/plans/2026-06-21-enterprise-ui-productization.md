# Enterprise UI Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved enterprise UI productization design so the platform looks like a real deployable enterprise control product while preserving requirements truthfulness.

**Architecture:** Apply the visual system through shared primitives first, then update login, settings, and command palette. Product pages must keep real-data and blocked-state boundaries; no UI refresh may claim strict requirements completion without backend/API/e2e evidence.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/Radix primitives, Lucide icons, existing `scripts/e2e/*` white-box/event tests.

---

## Source Inputs

- Design spec: `docs/superpowers/specs/2026-06-21-enterprise-ui-productization-design.md`
- Requirements source: `docs/source/requirements.md`
- Project constraints: `CLAUDE.md`, `AGENTS.md`
- Existing UI guide: `docs/design/command-center-design-system.md`

## Current Constraints

- Do not change business logic unless a task explicitly says so.
- Do not remove strict/candidate/blocked truthfulness.
- Do not claim ADFS/LDAP/SSO complete.
- Do not hide read-only or blocked capabilities behind successful-looking UI.
- Do not introduce emoji icons.
- Do not store or display real secrets.
- Do not commit if required checks fail.

## Required Checks Before Each Commit

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
```

For UI-only intermediate commits, at minimum run the task-specific e2e plus `pnpm exec tsc --noEmit` and `pnpm build`; before final push, run the full required suite above.

## File Structure

- Create: `components/platform/glass-panel.tsx`  
  Reusable restrained glass surface for login, Command Center, command palette, and key status cards.
- Create: `components/platform/capsule-tabs.tsx`  
  Reusable capsule/segmented control with sliding active pill and reduced-motion support.
- Modify: `app/globals.css`  
  Adds glass, diagonal light sweep, focus, and reduced-motion utility classes.
- Modify: `app/login/page.tsx`  
  Removes visible demo/development copy and applies left-deep/right-light enterprise glass design.
- Modify: `app/settings/page.tsx`  
  Rebuilds visual hierarchy into overview and sections without fake write actions.
- Modify: `components/shared/command-palette.tsx`  
  Cleans up route/filter mismatches, improves active row and hover visuals, keeps keyboard behavior sane.
- Modify: `components/layout/app-shell.tsx`  
  Updates settings guide text and adds skip-to-content if absent.
- Modify: `scripts/e2e/test-auth.ts`  
  Adds login UI copy and auth truthfulness checks.
- Modify: `scripts/e2e/test-settings.ts`  
  Adds settings section/read-only/blocked-state checks.
- Modify: `scripts/e2e/test-frontend-integration.ts`  
  Adds command palette route/filter consistency checks.
- Modify: `scripts/e2e/test-header-ux-lift.ts`  
  Adds glass/capsule/focus/reduced-motion source checks.
- Create: `docs/database-analysis/sprint-ui-productization-requirements-review.md`  
  Requirements review for the UI productization sprint.

---

## Task 1: Shared Visual Primitives

**Purpose:** Add the approved visual language once, then reuse it instead of scattering one-off Tailwind strings.

**Requirements:** REQ-6.3.1, AGENTS frontend-event constraints  
**Commit:** `style(ui): add enterprise glass and capsule primitives`

- [ ] **Step 1: Add failing UI primitive checks**

Modify `scripts/e2e/test-header-ux-lift.ts` and add these checks near the shared component section:

```ts
const glassSource = readFileSync("components/platform/glass-panel.tsx", "utf8")
const capsuleSource = readFileSync("components/platform/capsule-tabs.tsx", "utf8")
const globalsSource = readFileSync("app/globals.css", "utf8")

check("GlassPanel component exists", glassSource.includes("export function GlassPanel"))
check("GlassPanel supports light and dark tone", glassSource.includes('"light"') && glassSource.includes('"dark"'))
check("CapsuleTabs component exists", capsuleSource.includes("export function CapsuleTabs"))
check("CapsuleTabs exposes data-testid", capsuleSource.includes("data-testid"))
check("Diagonal shine utility exists", globalsSource.includes("app-shine-hover"))
check("Reduced motion respected", globalsSource.includes("prefers-reduced-motion"))
```

- [ ] **Step 2: Run the failing test**

```bash
set -a && source .env.local && set +a
pnpm e2e:header-ux-lift
```

Expected: fails because `glass-panel.tsx`, `capsule-tabs.tsx`, and CSS utilities do not exist yet.

- [ ] **Step 3: Create GlassPanel**

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

export function GlassPanel({
  children,
  tone = "light",
  shine = false,
  className,
  testid,
}: GlassPanelProps) {
  return (
    <div
      data-testid={testid}
      className={cn(
        "relative overflow-hidden rounded-3xl border",
        toneClass[tone],
        shine && "app-shine-hover",
        className,
      )}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Create CapsuleTabs**

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

export function CapsuleTabs<T extends string>({
  value,
  items,
  onChange,
  className,
  testid,
}: CapsuleTabsProps<T>) {
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
        style={{
          width,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative z-10 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
              active ? "text-blue-700" : "text-slate-500 hover:text-slate-900",
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Add CSS utilities**

Modify `app/globals.css` and add:

```css
.app-shine-hover::before {
  content: "";
  position: absolute;
  inset: -40%;
  pointer-events: none;
  transform: translateX(-120%) rotate(18deg);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.34), transparent);
  opacity: 0;
}

.app-shine-hover:hover::before,
.app-shine-hover:focus-within::before {
  animation: app-shine-sweep 650ms ease-out;
}

@keyframes app-shine-sweep {
  0% {
    opacity: 0;
    transform: translateX(-120%) rotate(18deg);
  }
  25% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(120%) rotate(18deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-shine-hover::before {
    display: none;
  }
}
```

- [ ] **Step 6: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:header-ux-lift
pnpm exec tsc --noEmit
pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add components/platform/glass-panel.tsx components/platform/capsule-tabs.tsx app/globals.css scripts/e2e/test-header-ux-lift.ts
git commit -m "style(ui): add enterprise glass and capsule primitives"
```

---

## Task 2: Login Page Visual Refresh And Copy Cleanup

**Purpose:** Make login look like a formal enterprise gateway and remove visible demo/development copy.

**Requirements:** REQ-2.2.1 partial truthfulness, REQ-2.2.3 login audit visibility, REQ-6.3.1  
**Commit:** `style(auth): redesign enterprise login gateway`

- [ ] **Step 1: Add failing login checks**

Modify `scripts/e2e/test-auth.ts`:

```ts
const loginSource = read("app/login/page.tsx")
check("login removes demo environment copy", !loginSource.includes("演示环境"))
check("login does not reveal local development credential", !loginSource.includes("admin / admin"))
check("login uses GlassPanel", loginSource.includes("GlassPanel"))
check("login keeps local JWT truthfulness", loginSource.includes("本地 JWT"))
check("login keeps enterprise SSO blocked wording", loginSource.includes("企业 SSO") && loginSource.includes("待接入"))
check("login form has test ids", loginSource.includes('data-testid="login-account"') && loginSource.includes('data-testid="login-password"') && loginSource.includes('data-testid="login-submit"'))
```

- [ ] **Step 2: Run failing auth test**

```bash
set -a && source .env.local && set +a
pnpm e2e:auth
```

Expected: fails on demo/development copy and missing `GlassPanel`/test ids.

- [ ] **Step 3: Update login imports**

In `app/login/page.tsx`, import:

```tsx
import { GlassPanel } from "@/components/platform/glass-panel"
```

Keep existing auth behavior and error handling.

- [ ] **Step 4: Replace visible copy**

Replace visible text:

```text
Unified Optical Disc Library Management Platform — 集团级多站点统一视图、统一检索与统一运维入口（演示环境）。
```

with:

```text
集团级多站点光盘库统一视图、统一检索、统一控制与审计入口。
```

Remove visible local development credential text:

```text
本地开发账号：admin / admin
```

Keep:

```text
当前认证：本地 JWT
企业 SSO：待接入
登录审计：已启用
```

- [ ] **Step 5: Apply left-dark/right-light glass layout**

Use `GlassPanel tone="dark"` for the brand/capability column and `GlassPanel tone="light"` for the login card. Preserve all validation and `fetch("/api/auth/login")` behavior.

Add test ids:

```tsx
data-testid="login-page"
data-testid="login-brand-panel"
data-testid="login-card"
data-testid="login-account"
data-testid="login-password"
data-testid="login-site-select"
```

- [ ] **Step 6: Keep auth truthfulness**

Do not add ADFS login buttons unless they are disabled/blocked. If showing enterprise SSO, render it as:

```tsx
<Button type="button" variant="outline" disabled data-testid="login-sso-blocked">
  企业 SSO 待接入
</Button>
```

- [ ] **Step 7: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:auth
pnpm e2e:header-ux-lift
pnpm exec tsc --noEmit
pnpm build
```

- [ ] **Step 8: Commit**

```bash
git add app/login/page.tsx scripts/e2e/test-auth.ts
git commit -m "style(auth): redesign enterprise login gateway"
```

---

## Task 3: Settings Page Product-Looking Read-Only Experience

**Purpose:** Keep settings honest and mostly read-only, but make it feel intentional and operational instead of like an implementation note.

**Requirements:** REQ-2.1.1, REQ-2.3.2, REQ-6.4.3, REQ-6.2.1  
**Commit:** `style(settings): productize safe configuration view`

- [ ] **Step 1: Add failing settings checks**

Modify `scripts/e2e/test-settings.ts`:

```ts
const settingsSource = read("app/settings/page.tsx")
check("settings uses capsule sections", settingsSource.includes("CapsuleTabs"))
check("settings has overview section", settingsSource.includes('data-testid="settings-overview"'))
check("settings read-only copy is operational", settingsSource.includes("配置由环境变量和运维密钥管理"))
check("settings does not lead with not_implemented copy", !settingsSource.includes("写配置接口为 not_implemented"))
check("settings shows capability state", settingsSource.includes("read-only") && settingsSource.includes("blocked_by_auth"))
```

- [ ] **Step 2: Run failing settings test**

```bash
set -a && source .env.local && set +a
pnpm e2e:settings
```

Expected: fails because settings has no capsule sections and still leads with implementation-style copy.

- [ ] **Step 3: Add section state**

In `app/settings/page.tsx`, add:

```tsx
import { CapsuleTabs, type CapsuleTabItem } from "@/components/platform/capsule-tabs"
```

Add:

```tsx
type SettingsSection = "overview" | "sites" | "sync" | "auth" | "external"

const SETTINGS_SECTIONS: CapsuleTabItem<SettingsSection>[] = [
  { value: "overview", label: "概览" },
  { value: "sites", label: "站点接入" },
  { value: "sync", label: "同步策略" },
  { value: "auth", label: "认证安全" },
  { value: "external", label: "外部系统" },
]
```

Use `useState<SettingsSection>("overview")`.

- [ ] **Step 4: Replace the blunt read-only banner**

Replace the current amber banner copy with:

```text
配置由环境变量和运维密钥管理。当前页面展示可安全公开的配置状态、键引用和运行健康；写入类操作在企业认证、RBAC 和运维变更流程完成前保持只读。
```

Keep blocker labels such as `blocked_by_auth` and `not_implemented` in lower-detail badges, not as the main headline.

- [ ] **Step 5: Add overview summary strip**

Add `data-testid="settings-overview"` with four cards:

```text
认证模式
中心数据库
站点配置
外部依赖
```

Each card must show a source/status label. Use amber for blocked/partial and green only for verified healthy statuses.

- [ ] **Step 6: Gate existing cards by section**

Render existing cards under matching sections:

- `sites`: `settings-site-registry`, `settings-site-runtime`
- `sync`: runtime env key refs and scheduler/sync cards
- `auth`: `settings-auth-config`
- `external`: blocked/unimplemented capabilities and ES/ClickHouse state if available

Do not remove data currently shown.

- [ ] **Step 7: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:settings
pnpm e2e:header-ux-lift
pnpm exec tsc --noEmit
pnpm build
```

- [ ] **Step 8: Commit**

```bash
git add app/settings/page.tsx scripts/e2e/test-settings.ts
git commit -m "style(settings): productize safe configuration view"
```

---

## Task 4: Command Palette Route Consistency And Visual Polish

**Purpose:** Fix command palette UX so navigation, filtering, active highlight, and site switching feel coherent.

**Requirements:** REQ-6.3.1, REQ-2.1.1, frontend event constraints  
**Commit:** `fix(ui): align command palette navigation and polish`

- [ ] **Step 1: Add failing command palette checks**

Modify `scripts/e2e/test-frontend-integration.ts`:

```ts
const paletteSource = read("components/shared/command-palette.tsx")
const taskPageSource = read("app/tasks/page.tsx")
check("command palette does not use hardcoded SITE_CANDIDATES", !paletteSource.includes("SITE_CANDIDATES"))
check("failed task command uses page-consumed phase filter", !paletteSource.includes("status=failed") && paletteSource.includes("phase=failed"))
check("tasks page consumes phase query", taskPageSource.includes('searchParams.get("phase")'))
check("command palette active row uses shine hover", paletteSource.includes("app-shine-hover"))
check("command palette has no harsh bg-blue-600 active smear", !paletteSource.includes("bg-blue-600 text-white"))
```

- [ ] **Step 2: Run failing frontend integration**

```bash
set -a && source .env.local && set +a
pnpm e2e:frontend-integration
```

Expected: fails on hardcoded sites, `status=failed`, and harsh active highlight.

- [ ] **Step 3: Align task filters**

In `app/tasks/page.tsx`, read:

```tsx
const phaseQuery = searchParams.get("phase")
```

Initialize or sync `phaseFilter` so `/tasks?phase=failed` visibly selects failed phase. Accept only known phase values; otherwise default to `all`.

- [ ] **Step 4: Fix command items**

In `components/shared/command-palette.tsx`, change:

```tsx
router.push("/tasks?status=failed")
```

to:

```tsx
router.push("/tasks?phase=failed")
```

Change running similarly to the phase value the page consumes.

- [ ] **Step 5: Remove hardcoded site candidates from palette if site context already exposes options**

If `useSite()` exposes registered options after the site-registry work, consume them. If not yet available, remove site switch items from the palette for Phase A and show only page/action commands. Do not keep stale hardcoded station lists.

- [ ] **Step 6: Polish active row**

Replace active classes:

```tsx
bg-blue-600 text-white
```

with a softer capsule style:

```tsx
isActive
  ? "app-shine-hover border border-blue-200 bg-blue-50 text-blue-900 shadow-sm"
  : "border border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50"
```

Keep keyboard up/down/enter behavior.

- [ ] **Step 7: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:frontend-integration
pnpm e2e:tasks
pnpm e2e:header-ux-lift
pnpm exec tsc --noEmit
pnpm build
```

- [ ] **Step 8: Commit**

```bash
git add components/shared/command-palette.tsx app/tasks/page.tsx scripts/e2e/test-frontend-integration.ts
git commit -m "fix(ui): align command palette navigation and polish"
```

---

## Task 5: Visible Copy Cleanup Across Core Pages

**Purpose:** Remove user-visible AI/demo/development traces without deleting useful engineering comments.

**Requirements:** REQ-1.1.1, REQ-6.3.1  
**Commit:** `style(ui): remove demo-facing copy from product pages`

- [ ] **Step 1: Add copy audit checks**

Create or extend `scripts/e2e/test-console-usability-lift.ts`:

```ts
const productFiles = [
  "app/login/page.tsx",
  "app/settings/page.tsx",
  "app/page.tsx",
  "app/tasks/page.tsx",
  "app/sync/page.tsx",
  "app/racks/page.tsx",
  "app/search/page.tsx",
]

for (const file of productFiles) {
  const source = read(file)
  check(`${file} has no visible demo environment copy`, !source.includes("演示环境"))
  check(`${file} has no visible development account copy`, !source.includes("本地开发账号"))
  check(`${file} has no fake success wording`, !source.includes("暂停成功") && !source.includes("新建成功"))
}
```

- [ ] **Step 2: Run failing copy audit**

```bash
set -a && source .env.local && set +a
pnpm e2e:console-usability-lift
```

- [ ] **Step 3: Clean user-visible copy only**

Edit only JSX-visible strings. Do not remove code comments that explain complex logic or requirements constraints.

Replace implementation-style phrases:

- `写配置接口为 not_implemented` → `写入类操作需企业认证与运维变更流程解锁`
- `开发账号` → remove from UI
- `演示环境` → remove from UI

Keep blocker badges:

- `blocked_by_auth`
- `blocked_by_external_system`
- `partial`
- `read-only`

- [ ] **Step 4: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:console-usability-lift
pnpm e2e:auth
pnpm e2e:settings
pnpm exec tsc --noEmit
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add app scripts/e2e/test-console-usability-lift.ts
git commit -m "style(ui): remove demo-facing copy from product pages"
```

---

## Task 6: Requirements Review And Final UI Quality Gate

**Purpose:** Document what changed, what remains productization-only, and what must not be counted as strict requirements completion.

**Requirements:** AGENTS sprint review requirement, REQ-6.3.1  
**Commit:** `docs(ui): review enterprise productization sprint`

- [ ] **Step 1: Create requirements review**

Create `docs/database-analysis/sprint-ui-productization-requirements-review.md` with:

```markdown
# Sprint UI Productization Requirements Review

## Requirement IDs

- REQ-6.3.1 Frontend compatibility and interface adaptation
- REQ-6.4.3 Configuration visibility
- REQ-2.2.1 Auth boundary, partial only
- REQ-2.1.1 Site configuration, UI visibility only

## Requirement Original Text

Quote the relevant short requirement fragments from `docs/source/requirements.md`.

## Implementation

List changed files.

## Backend Reality

No backend completion is claimed unless a task changed and verified backend behavior.

## UI Reality

Login, settings, command palette, and shared primitives were updated.

## Mock / Simulator / DRY_RUN / Real Control

This sprint is UI productization. It does not convert blocked auth, ES/ClickHouse, or station control into strict complete.

## Missing Pieces

- Enterprise SSO remains blocked by IdP details.
- API-mode mock fallback remains a separate closure task if not completed.
- Site registry source of truth remains a separate closure task if not completed.

## Verdict

pass for UI productization; no strict requirements count increase unless Task 8 matrix review proves evidence.
```

- [ ] **Step 2: Run focused quality checks**

```bash
set -a && source .env.local && set +a
pnpm e2e:auth
pnpm e2e:settings
pnpm e2e:frontend-integration
pnpm e2e:header-ux-lift
pnpm e2e:console-usability-lift
pnpm exec tsc --noEmit
pnpm build
```

- [ ] **Step 3: Run full required checks**

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
```

- [ ] **Step 4: Commit**

```bash
git add docs/database-analysis/sprint-ui-productization-requirements-review.md
git commit -m "docs(ui): review enterprise productization sprint"
```

---

## Task 7: Optional Phase B/C Handoff Notes

**Purpose:** If Phase A finishes cleanly, write the next agent handoff for productization and requirements evidence closure.

**Requirements:** planning only  
**Commit:** `docs(ui): hand off productization follow-up`

- [ ] **Step 1: Create handoff note**

Create `docs/summary/UI_PRODUCTIZATION_HANDOFF.md`:

```markdown
# UI Productization Handoff

## Completed Phase A

- Login visual refresh
- Settings read-only productization
- Command palette route consistency
- User-visible demo copy cleanup
- Shared glass/capsule primitives

## Phase B Next

- Replace hardcoded site candidates with center registry
- Remove silent mock fallback in API mode
- Add permission-aware page states
- Turn settings sections into safe editable workflows where requirements allow

## Phase C Next

- Add requirements evidence widgets
- Remove hardcoded strict/candidate badges
- Recalculate requirements matrix after verification
```

- [ ] **Step 2: Commit**

```bash
git add docs/summary/UI_PRODUCTIZATION_HANDOFF.md
git commit -m "docs(ui): hand off productization follow-up"
```

---

## Execution Notes

- Phase A should not change strict requirements completion count unless it also changes verified backend/API behavior.
- If `pnpm e2e:all` fails due unrelated pre-existing tests, do not commit until failure is understood and documented.
- If command palette site registry depends on the separate closure plan, do the safe Phase A option: remove stale hardcoded site switching from palette until registry source is ready.
- `.superpowers/` visual companion files are working artifacts and should not be committed unless the team explicitly wants to preserve mockups.

## Expected Result

After completing Tasks 1-6:

- Login no longer looks like a demo.
- Settings looks intentionally read-only and operational.
- Command palette no longer navigates to mismatched page states.
- Core pages have less user-visible AI/demo copy.
- Glass, shine hover, and capsule transitions are available as reusable primitives.
- Requirements truthfulness remains intact.
