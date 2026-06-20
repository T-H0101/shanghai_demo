# Command Center UI Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the unified disc-library control platform feel like a coherent enterprise command center while preserving strict requirements truthfulness, real-data boundaries, and event-level e2e coverage.

**Architecture:** Keep the existing Next.js App Router, Radix UI, Tailwind v4, and current API contracts. Improve UX through shared layout primitives, consistent empty/blocked states, command-center information hierarchy, and page-level interaction tests rather than adding new business pages.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Radix UI, Lucide icons, existing `scripts/e2e/*` test harness.

---

## Design System Source

Generated with `ui-ux-pro-max`:

- Pattern: Enterprise Gateway
- Style: Data-Dense Dashboard
- Primary: `#1E40AF`
- Secondary: `#3B82F6`
- CTA/attention: `#F59E0B`
- Background: `#F8FAFC`
- Text: `#1E3A8A`
- Effects: hover tooltips, row highlighting, smooth filter animation, loading spinners

Rules to enforce:

- No emoji icons; use Lucide only.
- All clickable cards/buttons need `cursor-pointer`, hover, focus-visible states.
- Blocked or partial capabilities must show explicit reason and next verification requirement.
- No fake success toast; control wording must say submitted to queue and waiting for Site Agent.
- Responsive checkpoints: 375px, 768px, 1024px, 1440px.

## File Structure

- Modify: `components/platform/page-header.tsx`  
  Owns consistent page title, subtitle, requirement/source badges, and page actions.
- Modify: `components/platform/stat-card.tsx`  
  Owns KPI card density, hover states, and drill-down affordance.
- Modify: `components/shared/empty-state.tsx`  
  Owns all empty/blocked/error state visuals with consistent severity styling.
- Modify: `components/shared/first-run-coach.tsx`  
  Owns first-run guide, dismiss-all behavior, resize-safe positioning, and accessibility controls.
- Modify: `components/layout/app-shell.tsx`  
  Owns global guide step registry and cross-page shell spacing.
- Modify: `app/page.tsx`  
  Command Center home page hierarchy and executive scan path.
- Modify: `app/tasks/page.tsx`  
  Task create/control UX, blocked states, and action wording.
- Modify: `app/racks/page.tsx`  
  Storage tabs, blocked file-tree/recovery state, and overview hierarchy.
- Modify: `app/sync/page.tsx`  
  Sync strategy, latest status, and manual trigger UX.
- Modify: `app/search/page.tsx`  
  Search limitations, ES blocked state, result export, and file-index clarity.
- Modify: `scripts/e2e/test-header-ux-lift.ts`  
  Covers guide, tooltip, time format, hover/focus, and responsive code contracts.
- Modify: `scripts/e2e/test-route-page-integration.ts`  
  Covers page/API route alignment and auth-aware reachability.
- Modify: `scripts/e2e/test-tasks.ts`  
  Covers total-control task creation wording and API submission.
- Modify: `scripts/e2e/test-racks.ts`  
  Covers storage tab switching and blocked state text.
- Create: `docs/database-analysis/sprint-ui-command-center-requirements-review.md`  
  Requirements review for UI-only and API-connected interaction changes.

## Task 1: Shared UI Contract

**Files:**
- Modify: `components/platform/page-header.tsx`
- Modify: `components/platform/stat-card.tsx`
- Modify: `components/shared/empty-state.tsx`
- Test: `scripts/e2e/test-header-ux-lift.ts`

- [ ] **Step 1: Add failing UI contract assertions**

Add these checks to `scripts/e2e/test-header-ux-lift.ts`:

```ts
check("PageHeader exposes source/requirement badge slot", pageHeaderSource.includes("badge") && pageHeaderSource.includes("actions"))
check("StatCard clickable state has cursor and focus-visible", statCardSource.includes("cursor-pointer") && statCardSource.includes("focus-visible"))
check("EmptyState supports blocked/error/empty severity", emptySource.includes("severity") && emptySource.includes("blocked"))
```

- [ ] **Step 2: Run the targeted test and confirm failure**

Run:

```bash
set -a && source .env.local && set +a
pnpm e2e:header-ux-lift
```

Expected: fails on the new checks until shared components expose the contract.

- [ ] **Step 3: Implement shared component contracts**

Update `components/shared/empty-state.tsx` to accept:

```ts
type EmptyStateSeverity = "empty" | "blocked" | "error"
```

Use these styles:

```ts
const severityClass: Record<EmptyStateSeverity, string> = {
  empty: "border-slate-200 bg-white text-slate-600",
  blocked: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-800",
}
```

Update `components/platform/stat-card.tsx` clickable cards to include:

```tsx
className={cn("transition-colors duration-200", href && "cursor-pointer hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500")}
```

- [ ] **Step 4: Verify**

Run:

```bash
set -a && source .env.local && set +a
pnpm e2e:header-ux-lift
pnpm exec tsc --noEmit
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add components/platform/page-header.tsx components/platform/stat-card.tsx components/shared/empty-state.tsx scripts/e2e/test-header-ux-lift.ts
git commit -m "style(ui): standardize command center primitives"
```

## Task 2: Command Center Home Hierarchy

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/dashboard/command-center-panel.tsx`
- Test: `scripts/e2e/test-command-center.ts`

- [ ] **Step 1: Add failing command-center checks**

Add checks:

```ts
check("Command Center shows sync/control/search/security lanes", source.includes("同步") && source.includes("控制") && source.includes("检索") && source.includes("安全"))
check("Command Center exposes blocked/candidate wording", source.includes("strict") && source.includes("candidate"))
```

- [ ] **Step 2: Run failing test**

```bash
set -a && source .env.local && set +a
pnpm e2e:command-center
```

Expected: fails until hierarchy text and sections are present.

- [ ] **Step 3: Implement home scan path**

In `components/dashboard/command-center-panel.tsx`, group the page into four lanes:

```ts
const lanes = [
  { key: "sync", title: "同步", href: "/sync", evidence: "pg_dump 白名单 / Site Agent" },
  { key: "control", title: "控制", href: "/tasks?view=commands", evidence: "control_command / Agent poll" },
  { key: "search", title: "检索", href: "/search", evidence: "ES boundary / center index" },
  { key: "security", title: "安全", href: "/logs", evidence: "JWT / RBAC / audit hash" },
]
```

Display strict/candidate status:

```tsx
<Badge>strict 29/45</Badge>
<Badge variant="outline">candidate 45/45</Badge>
```

- [ ] **Step 4: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:command-center
pnpm e2e:dashboard
```

Expected: both pass, no mock markers.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/dashboard/command-center-panel.tsx scripts/e2e/test-command-center.ts
git commit -m "style(ui): sharpen command center hierarchy"
```

## Task 3: Task Control UX Closure

**Files:**
- Modify: `app/tasks/page.tsx`
- Modify: `scripts/e2e/test-tasks.ts`

- [ ] **Step 1: Add failing event checks**

Ensure `scripts/e2e/test-tasks.ts` verifies:

```ts
check("总控新建任务按钮存在", tasksPage.includes('data-testid="task-create-open"'))
check("总控新建任务调用 /api/tasks/create", tasksPage.includes("/api/tasks/create"))
check("不含节点跳转旧口径", !tasksPage.includes("节点新建任务") && !tasksPage.includes("/api/site-navigation/task-create"))
```

- [ ] **Step 2: Run failing test**

```bash
set -a && source .env.local && set +a
pnpm e2e:tasks
```

Expected: fails if any old node-jump wording remains.

- [ ] **Step 3: Implement total-control wording**

The task-create dialog must state:

```text
新建命令会写入控制队列，由站点 Agent 拉取后在站点库创建真实任务；总控不直接写 unified_tasks。
```

Submit toast must state:

```text
任务创建命令已提交到控制队列，等待站点 Agent 执行。
```

- [ ] **Step 4: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:tasks
pnpm e2e:task-create-control
```

Expected: both pass; Site Agent test inserts exactly one station task.

- [ ] **Step 5: Commit**

```bash
git add app/tasks/page.tsx scripts/e2e/test-tasks.ts
git commit -m "fix(tasks): align task creation with total control"
```

## Task 4: Racks Blocked-State Clarity

**Files:**
- Modify: `app/racks/page.tsx`
- Modify: `scripts/e2e/test-racks.ts`

- [ ] **Step 1: Add blocked-state checks**

Add:

```ts
check("存储浏览 blocked 不含 mock 目录", racksSource.includes("racks-storage-browse-blocked") && !racksSource.includes("mock 文件树"))
check("数据恢复 blocked 指向 Site Agent 闭环", racksSource.includes("racks-storage-restore-blocked") && racksSource.includes("Site Agent"))
```

- [ ] **Step 2: Run failing test**

```bash
set -a && source .env.local && set +a
pnpm e2e:racks
```

Expected: fails if blocked states are missing or old node-jump wording remains.

- [ ] **Step 3: Implement clear blocked states**

Use `EmptyState` severity `blocked` for:

```tsx
title="存储浏览暂未接入真实源端目录树"
title="数据恢复任务等待 Site Agent 闭环"
```

- [ ] **Step 4: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:racks
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add app/racks/page.tsx scripts/e2e/test-racks.ts
git commit -m "fix(racks): clarify blocked storage actions"
```

## Task 5: Responsive Guide and Accessibility Pass

**Files:**
- Modify: `components/shared/first-run-coach.tsx`
- Modify: `components/layout/app-shell.tsx`
- Modify: `scripts/e2e/test-header-ux-lift.ts`

- [ ] **Step 1: Add guide stability checks**

Add:

```ts
check("FirstRunCoach supports dismiss all", coachSource.includes("unified.firstRun.disabled"))
check("FirstRunCoach resize-safe fixed positioning", !coachSource.includes("window.scrollY") && !coachSource.includes("window.scrollX"))
check("AppShell guide covers all primary pages", ["/", "/sync", "/tasks", "/racks", "/search", "/logs", "/sites", "/settings", "/users", "/volumes"].every(route => appShellSource.includes(route === "/" ? 'pathname === "/"' : `pathname.startsWith("${route}")`)))
```

- [ ] **Step 2: Run failing test**

```bash
set -a && source .env.local && set +a
pnpm e2e:header-ux-lift
```

Expected: fails if guide coverage or dismiss-all support is missing.

- [ ] **Step 3: Implement guide controls**

In `FirstRunCoach`, store:

```ts
const DISABLED_KEY = "unified.firstRun.disabled"
```

Add a button:

```tsx
<Button onClick={dismissAll}>不再显示</Button>
```

- [ ] **Step 4: Verify**

```bash
set -a && source .env.local && set +a
pnpm e2e:header-ux-lift
pnpm e2e:route-page-integration
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add components/shared/first-run-coach.tsx components/layout/app-shell.tsx scripts/e2e/test-header-ux-lift.ts
git commit -m "fix(ui): stabilize first run guide"
```

## Task 6: Final Quality Gate

**Files:**
- Create: `docs/database-analysis/sprint-ui-command-center-requirements-review.md`
- Modify: `README.md`

- [ ] **Step 1: Write requirements review**

Create `docs/database-analysis/sprint-ui-command-center-requirements-review.md` with:

```md
# Sprint UI Command Center Requirements Review

## Requirement IDs

- REQ-4.2.1
- REQ-4.2.2
- REQ-4.3.1
- REQ-5.1.1
- REQ-6.3.1
- REQ-6.4.2

## Backend Reality

UI changes do not create new backend completion. Task creation uses POST /api/tasks/create and control_command. Racks storage/recovery blocked states do not claim source file tree or recovery success.

## UI Reality

All primary pages expose data source, blocked, empty, or error states. First-run guide covers primary routes and can be dismissed globally.

## Verdict

pass for UI clarity and event coverage; no requirements are upgraded solely by visual changes.
```

- [ ] **Step 2: Run full verification**

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
```

Expected: all pass.

- [ ] **Step 3: Security scan**

Run:

```bash
rg -n "(password|secret|token|DATABASE_URL|SITE_AGENT_SECRET|CLICKHOUSE_URL|SEARCH_ES_URL)" --glob '!node_modules/**' --glob '!.next/**' --glob '!.env.local' .
git status --short
```

Expected: no real secret values in tracked files; `.env.local` remains untracked/ignored.

- [ ] **Step 4: Commit and push**

```bash
git add README.md docs/database-analysis/sprint-ui-command-center-requirements-review.md docs/superpowers/plans/2026-06-20-command-center-ui-optimization.md
git commit -m "docs(ui): plan command center optimization"
git push
```

Expected: push succeeds on `main`.

## Self-Review

- Spec coverage: Covers shared UI, Command Center, Tasks total-control, Racks blocked states, first-run guide, README, verification, and security scan.
- Placeholder scan: The plan contains no deferred-work markers.
- Type consistency: Uses existing Next.js/React/Tailwind/Radix/Lucide patterns and current script names.
