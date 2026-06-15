# R.19D Node Jump and Pause/Resume Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicate central task creation with fail-closed node navigation and deliver a real Site Agent pause/resume loop against the SH01 restored database.

**Architecture:** Keep the control plane in PostgreSQL and HTTP, but move execution into the existing standalone Site Agent. The Agent depends on `SiteActionAdapter`, `ControlTransport`, `FileControlStore`, and the existing `SyncCoordinator`; PostgreSQL status details remain hidden behind `PostgresSiteActionAdapter`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.7, PostgreSQL 17, Node filesystem persistence, HMAC-SHA256, pnpm/tsx.

---

## File Map

Create:

- `lib/site-navigation/task-create.ts`: safe environment-driven node URL resolution.
- `app/api/site-navigation/task-create/route.ts`: safe navigation configuration API.
- `lib/site-agent/control/types.ts`: command, result, execution and pause-state contracts.
- `lib/site-agent/control/file-store.ts`: atomic execution/result/pause persistence.
- `lib/site-agent/control/transport.ts`: signed poll/ack/result HTTP client.
- `lib/site-agent/control/postgres-adapter.ts`: transactional SH01 task pause/resume adapter.
- `lib/site-agent/control/coordinator.ts`: replay, claim, ack, execute, result and resync orchestration.
- `lib/site-agent/nonce-store.ts`: reusable registered-site and nonce validation.
- `scripts/e2e/test-task-navigation.ts`: node navigation API/UI event verification.
- `scripts/e2e/test-site-agent-control-core.ts`: store, adapter and coordinator tests.
- `scripts/e2e/test-site-agent-control.ts`: real HTTP + restored DB + center DB control loop.

Modify:

- `.env.example`: node URL, control timing and future Auth key references.
- `.env.local`: add only missing non-secret configuration keys; keep ignored.
- `lib/site-agent/config.ts`: control interval and safe config refs.
- `lib/site-agent/hmac.ts`: support canonical path including query.
- `lib/site-agent/heartbeat-client.ts`: truthful control capabilities and last control state.
- `lib/control/control-command.ts`: atomic claim and final status support.
- `lib/auth/site-control-auth.ts`: replace direct-secret comparison with request HMAC.
- `app/api/site-control/commands/route.ts`: signed atomic claim.
- `app/api/site-control/commands/[id]/ack/route.ts`: signed ACK state transition.
- `app/api/site-control/commands/[id]/result/route.ts`: signed idempotent final result.
- `scripts/site-agent/run.ts`: schedule control coordinator and immediate resync.
- `app/tasks/page.tsx`: node navigation; pause/resume queue only; disable reset.
- `scripts/e2e/test-tasks.ts`: event and wording assertions.
- `scripts/e2e/test-site-agent.ts`: truthful capability evidence.
- `package.json`: targeted R.19D scripts and `e2e:all`.
- `docs/summary/PROJECT_STATUS.md`, `docs/summary/ROADMAP.md`,
  `docs/database-analysis/requirements-traceability.md`: current truth.
- `docs/database-analysis/sprint-r.19d-requirements-review.md`: strict review.

## Task 1: Fail-Closed Node Navigation

**Files:**
- Create: `lib/site-navigation/task-create.ts`
- Create: `app/api/site-navigation/task-create/route.ts`
- Create: `scripts/e2e/test-task-navigation.ts`
- Modify: `.env.example`
- Modify: `package.json`

- [ ] **Step 1: Write the failing navigation test**

Create a test that imports the desired resolver and asserts:

```typescript
assert.deepEqual(resolveTaskCreateNavigation("SH01", {}), {
  siteCode: "SH01",
  envKeyRef: "SITE_NODE_TASK_CREATE_URL_SH01",
  configured: false,
  url: null,
  reason: "node_task_create_url_not_configured",
})
assert.equal(
  resolveTaskCreateNavigation("SH01", {
    SITE_NODE_TASK_CREATE_URL_SH01: "https://sh01.internal/tasks/create",
  }).url,
  "https://sh01.internal/tasks/create"
)
assert.throws(() =>
  resolveTaskCreateNavigation("SH01", {
    SITE_NODE_TASK_CREATE_URL_SH01: "javascript:alert(1)",
  })
)
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
set -a && source .env.local && set +a
pnpm tsx scripts/e2e/test-task-navigation.ts
```

Expected: FAIL because `lib/site-navigation/task-create.ts` does not exist.

- [ ] **Step 3: Implement the resolver**

Use this contract:

```typescript
export interface TaskCreateNavigation {
  siteCode: string
  envKeyRef: string
  configured: boolean
  url: string | null
  reason: string | null
}

export function taskCreateUrlKey(siteCode: string): string {
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(siteCode)) {
    throw new Error("invalid siteCode")
  }
  return `SITE_NODE_TASK_CREATE_URL_${siteCode.toUpperCase()}`
}

export function resolveTaskCreateNavigation(
  siteCode: string,
  env: NodeJS.ProcessEnv = process.env
): TaskCreateNavigation {
  const envKeyRef = taskCreateUrlKey(siteCode)
  const raw = env[envKeyRef]?.trim()
  if (!raw) {
    return {
      siteCode,
      envKeyRef,
      configured: false,
      url: null,
      reason: "node_task_create_url_not_configured",
    }
  }
  const parsed = new URL(raw)
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("task create URL must use http or https")
  }
  return { siteCode, envKeyRef, configured: true, url: parsed.toString(), reason: null }
}
```

The API accepts one `siteCode` and returns only this safe object. Invalid URL returns HTTP 500 with `dataSource="error"`; invalid site code returns HTTP 400.

- [ ] **Step 4: Add environment templates**

Append safe empty keys:

```env
# Site task-create navigation. Empty means fail closed.
SITE_NODE_TASK_CREATE_URL_SH01=

# Site Agent control loop.
SITE_AGENT_CONTROL_POLL_INTERVAL_MS=5000
SITE_AGENT_CONTROL_LEASE_MS=30000
```

- [ ] **Step 5: Run navigation tests and verify GREEN**

Expected: resolver tests and API tests pass; API reports `configured=false` for SH01.

- [ ] **Step 6: Commit**

```bash
git add .env.example lib/site-navigation app/api/site-navigation scripts/e2e/test-task-navigation.ts package.json
git commit -m "feat(r19d): add fail-closed node task navigation [REQ-4.2.1]"
```

## Task 2: Request-Level Control HMAC and Atomic Claim

**Files:**
- Create: `lib/site-agent/nonce-store.ts`
- Modify: `lib/site-agent/hmac.ts`
- Modify: `lib/auth/site-control-auth.ts`
- Modify: `lib/control/control-command.ts`
- Modify: `app/api/site-control/commands/route.ts`
- Modify: `app/api/site-control/commands/[id]/ack/route.ts`
- Modify: `app/api/site-control/commands/[id]/result/route.ts`
- Create: `scripts/e2e/test-site-agent-control-core.ts`

- [ ] **Step 1: Write failing signed-route tests**

The test must prove:

```typescript
// New request-level headers are accepted.
expect(signedPoll.status).toBe(200)
// Missing, expired, tampered and replayed requests are rejected.
expect(unsigned.status).toBe(401)
expect(expired.status).toBe(401)
expect(tampered.status).toBe(401)
expect(replayed.status).toBe(409)
// Header site code must equal query/body site code.
expect(crossSite.status).toBe(401)
```

It signs the exact canonical target:

```typescript
const path = `/api/site-control/commands?siteCode=${siteCode}&limit=20`
```

- [ ] **Step 2: Run the targeted test and verify RED**

Expected: signed request fails because current control API expects `x-site-control-signature` equal to the raw secret.

- [ ] **Step 3: Extract nonce consumption**

Implement:

```typescript
export type ConsumeNonceResult =
  | { ok: true }
  | { ok: false; code: "UNKNOWN_SITE" | "REPLAYED_NONCE" }

export async function consumeSiteAgentNonce(
  siteCode: string,
  nonce: string
): Promise<ConsumeNonceResult>
```

Use one center transaction:

```sql
SELECT 1 FROM sync_sites WHERE site_code = $1;
DELETE FROM site_agent_nonce WHERE expires_at < NOW();
INSERT INTO site_agent_nonce(site_code, nonce, expires_at)
VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
ON CONFLICT DO NOTHING
RETURNING nonce;
```

Heartbeat and control routes must use the same helper.

- [ ] **Step 4: Replace simplified control authentication**

Make `verifySiteControlRequest` asynchronous and pass:

```typescript
{
  siteCode: request.nextUrl.searchParams.get("siteCode"),
  rawBody,
  path: `${request.nextUrl.pathname}${request.nextUrl.search}`,
}
```

Use `verifySiteAgentRequest`, then consume the nonce. Do not retain the raw-secret header path in strict mode.

- [ ] **Step 5: Implement atomic command claim**

Add:

```typescript
export async function claimControlCommands(input: {
  sourceSiteId: string
  limit: number
  leaseMs: number
}): Promise<ControlCommandRow[]>
```

Use a center transaction with `FOR UPDATE SKIP LOCKED`. Claim:

```sql
status = 'pending'
OR (status = 'pulled' AND pulled_at < NOW() - ($3 * INTERVAL '1 millisecond'))
```

Then update selected rows to `pulled`. ACK only allows `pulled -> running`.

- [ ] **Step 6: Make final results idempotent**

Allow `success`, `failed`, `cancelled`, and `unsupported`. If the command is already final, return the existing identical final row; reject a conflicting second final result with HTTP 409. Site Agent routes must reject `dry_run_success`.

- [ ] **Step 7: Run tests and verify GREEN**

Expected: signed poll/ack/result, replay rejection, cross-site rejection and claim lease tests pass.

- [ ] **Step 8: Commit**

```bash
git add lib/site-agent lib/auth/site-control-auth.ts lib/control/control-command.ts app/api/site-control scripts/e2e/test-site-agent-control-core.ts
git commit -m "feat(r19d): secure and lease Agent control commands [REQ-4.2.2]"
```

## Task 3: Durable Control Store and PostgreSQL Adapter

**Files:**
- Create: `lib/site-agent/control/types.ts`
- Create: `lib/site-agent/control/file-store.ts`
- Create: `lib/site-agent/control/postgres-adapter.ts`
- Modify: `scripts/e2e/test-site-agent-control-core.ts`

- [ ] **Step 1: Write failing store and real-DB adapter tests**

Insert a dedicated row:

```sql
INSERT INTO tbl_task(task_type, status, task_name, create_dt, update_dt)
VALUES (0, 19, $1, NOW(), NOW())
RETURNING id;
```

Assert:

```typescript
const paused = await adapter.execute(command("task_pause", id))
assert.equal(paused.status, "success")
assert.equal(paused.before.status, 19)
assert.equal(paused.after.status, 20)

const resumed = await adapter.execute(
  command("task_resume", id),
  { previousStatus: 19 }
)
assert.equal(resumed.after.status, 19)
```

Also assert status `0` cannot be paused and resume without persisted `previousStatus` is unsupported.

- [ ] **Step 2: Run and verify RED**

Expected: imports fail because control store and adapter do not exist.

- [ ] **Step 3: Implement focused types**

Define only:

```typescript
export type SupportedControlType = "task_pause" | "task_resume"
export interface AgentControlCommand { id: string; commandNo: string; sourceSiteId: string; commandType: string; targetId: string; payload: Record<string, unknown> }
export interface TaskSnapshot { id: string; taskType: number | null; status: number | null; updateDt: string | null }
export interface SiteActionResult { status: "success" | "failed" | "unsupported"; before: TaskSnapshot | null; after: TaskSnapshot | null; previousStatus?: number; blocker?: string; reason?: string }
```

- [ ] **Step 4: Implement atomic file persistence**

Use directories:

```text
<SITE_AGENT_STATE_DIR>/control/
  executions/<commandId>.json
  results/<commandId>.json
  paused/<targetId>.json
```

Validate IDs with `/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/`, use mode `0600`, temp-file + fsync + rename, and fail closed on corrupt JSON.

- [ ] **Step 5: Implement the adapter**

`task_pause`:

```sql
BEGIN;
SELECT id, task_type, status, update_dt
FROM tbl_task WHERE id = $1 FOR UPDATE;
UPDATE tbl_task SET status = 20, update_dt = NOW()
WHERE id = $1;
COMMIT;
```

Allowed running states:

- task types `0/2/3`: status `19`
- task type `1`: status `1` or `9`

`task_resume` requires current status `20` and a previous state allowed for that task type. Restore that exact status, never hard-code `0`.

- [ ] **Step 6: Verify GREEN and cleanup**

Delete only the dedicated test row in `finally`. Confirm original `tbl_task` count and rows remain unchanged.

- [ ] **Step 7: Commit**

```bash
git add lib/site-agent/control scripts/e2e/test-site-agent-control-core.ts
git commit -m "feat(r19d): add durable PostgreSQL pause-resume adapter [REQ-4.2.2]"
```

## Task 4: Control Transport and Coordinator

**Files:**
- Create: `lib/site-agent/control/transport.ts`
- Create: `lib/site-agent/control/coordinator.ts`
- Modify: `scripts/e2e/test-site-agent-control-core.ts`

- [ ] **Step 1: Write failing coordinator tests**

Use in-memory test doubles behind the real interfaces and prove:

```typescript
// ACK happens before execute.
assert.deepEqual(events.slice(0, 2), ["ack", "execute"])
// Execution and center resync complete before final result upload.
assert.deepEqual(events, ["ack", "execute", "save_execution", "enqueue_result", "resync", "result"])
// Failed result upload replays without another execute.
assert.equal(adapterExecutionCount, 1)
assert.equal(replayedResultCount, 1)
// Unsupported command never reaches adapter SQL.
assert.equal(resetResult.status, "unsupported")
```

- [ ] **Step 2: Run and verify RED**

Expected: transport/coordinator modules do not exist.

- [ ] **Step 3: Implement signed transport**

Expose:

```typescript
interface ControlTransport {
  poll(limit: number): Promise<AgentControlCommand[]>
  ack(commandId: string): Promise<void>
  result(commandId: string, result: SiteActionResult): Promise<void>
}
```

Every request uses `signSiteAgentRequest` with exact pathname + query, a random nonce and millisecond timestamp.

- [ ] **Step 4: Implement coordinator order**

Each cycle:

1. Replay pending result files.
2. Poll commands.
3. Reject unsupported command types with an `unsupported` result.
4. ACK.
5. If execution file exists, do not execute again.
6. Load pause state for resume.
7. Execute adapter.
8. Persist execution.
9. Persist pending result.
10. For success, trigger immediate task sync.
11. Upload result.
12. Remove pending result.
13. On resume success, clear pause state.

- [ ] **Step 5: Verify GREEN**

Expected: ordering, retry and no-double-execution tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/site-agent/control scripts/e2e/test-site-agent-control-core.ts
git commit -m "feat(r19d): orchestrate durable Agent controls [REQ-4.2.2]"
```

## Task 5: Integrate Control into the Standalone Agent

**Files:**
- Modify: `lib/site-agent/config.ts`
- Modify: `lib/site-agent/heartbeat-client.ts`
- Modify: `scripts/site-agent/run.ts`
- Modify: `deploy/site-agent/site-agent.env.example`
- Modify: `scripts/e2e/test-site-agent-client.ts`
- Create: `scripts/e2e/test-site-agent-control.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing runtime and end-to-end tests**

The real e2e must:

1. Verify `SH01` is already registered and fail closed if it is not.
2. Insert one dedicated `tbl_task` row at status `19` with a unique test marker.
3. Create a pause command through `/api/control/commands`.
4. Run Agent control once.
5. Verify source status `20`, center command `success`, audit before/after and center task `paused`.
6. Create resume command.
7. Run Agent control once.
8. Verify source status restored to `19`, not `0`.
9. Remove only the dedicated source row and its center command/audit/task rows in `finally`.

- [ ] **Step 2: Run and verify RED**

Expected: Agent heartbeat still advertises unsupported controls and run loop does not poll commands.

- [ ] **Step 3: Extend safe config**

Add:

```typescript
controlPollIntervalMs: integerEnv("SITE_AGENT_CONTROL_POLL_INTERVAL_MS", 5_000, 1_000),
controlLeaseMs: integerEnv("SITE_AGENT_CONTROL_LEASE_MS", 30_000, 5_000),
```

Safe startup logs show key refs and numeric intervals only.

- [ ] **Step 4: Integrate the coordinator**

Create one `FileControlStore`, `ControlHttpTransport`, `PostgresSiteActionAdapter`, and `ControlCoordinator`. Schedule control before sync. `--once` performs one control cycle, one sync cycle and one heartbeat.

Heartbeat capabilities become:

```typescript
task_pause: { supported: true, adapter: "postgres", evidence: "tbl_task.status=20 with validated running pre-state" },
task_resume: { supported: true, adapter: "postgres", evidence: "restores persisted pre-pause status" },
```

`lastControlAt` comes from durable control state, not the current clock.

- [ ] **Step 5: Run targeted tests and verify GREEN**

Run:

```bash
pnpm e2e:site-agent-control-core
pnpm e2e:site-agent-control
pnpm e2e:site-agent-client
pnpm e2e:site-agent
```

- [ ] **Step 6: Commit**

```bash
git add lib/site-agent scripts/site-agent deploy/site-agent scripts/e2e package.json
git commit -m "feat(r19d): run control loop in Site Agent [REQ-4.2.2]"
```

## Task 6: Tasks UI Truthful Integration

**Files:**
- Modify: `app/tasks/page.tsx`
- Modify: `scripts/e2e/test-tasks.ts`
- Modify: `scripts/e2e/test-control.ts`

- [ ] **Step 1: Write failing UI event/source assertions**

Assert:

```typescript
assert(!tasksSource.includes("/api/control/commands/${cmdId}/execute"))
assert(tasksSource.includes("/api/site-navigation/task-create"))
assert(tasksSource.includes("节点任务创建地址未配置"))
assert(tasksSource.includes("等待站点 Agent 执行"))
assert(!tasksSource.includes("setShowCreate(true)"))
```

API event checks must verify:

- SH01 navigation returns `configured=false`.
- New task button is disabled when no URL exists.
- Pause/resume only POST `/api/control/commands`.
- Reset does not POST a command.

- [ ] **Step 2: Run and verify RED**

Expected: current page still contains the direct execute endpoint and create dialog.

- [ ] **Step 3: Remove duplicate creation behavior**

Delete `handleCreate`, create-dialog state and the task creation dialog. Load navigation when the selected site changes. Button states:

- all sites: disabled, “请先选择站点”
- selected site without URL: disabled, “节点任务创建地址未配置”
- configured: opens URL with `window.open(url, "_blank", "noopener,noreferrer")`

- [ ] **Step 4: Remove direct execution**

`handleControlCommand` only creates the command and shows:

```text
暂停命令已提交到控制队列，等待站点 Agent 执行
继续命令已提交到控制队列，等待站点 Agent 执行
```

Do not optimistically change task state. Disable reset with an explicit unsupported tooltip.

- [ ] **Step 5: Run UI tests and verify GREEN**

Run:

```bash
pnpm e2e:tasks
pnpm e2e:control
```

- [ ] **Step 6: Commit**

```bash
git add app/tasks/page.tsx scripts/e2e/test-tasks.ts scripts/e2e/test-control.ts
git commit -m "feat(r19d): align Tasks UI with Agent control [REQ-4.2.1,REQ-4.2.2]"
```

## Task 7: Auth Configuration Boundary

**Files:**
- Create: `lib/auth/config.ts`
- Modify: `.env.example`
- Modify: `.env.local`
- Modify: `app/api/sync/config/route.ts`
- Modify: `scripts/e2e/test-settings.ts`

- [ ] **Step 1: Write failing safe-config tests**

Assert safe output contains only:

```typescript
{
  mode: "disabled",
  issuerUrlConfigured: false,
  clientIdConfigured: false,
  clientSecretKeyRef: "AUTH_CLIENT_SECRET",
  jwksUrlConfigured: false,
  ldapUrlConfigured: false,
  ldapBaseDnConfigured: false,
}
```

It must never include `AUTH_CLIENT_SECRET` value.

- [ ] **Step 2: Run and verify RED**

Expected: auth config module and API response do not exist.

- [ ] **Step 3: Implement config boundary**

Environment template:

```env
AUTH_MODE=disabled
AUTH_ISSUER_URL=
AUTH_CLIENT_ID=
AUTH_CLIENT_SECRET=
AUTH_CLIENT_SECRET_REF=AUTH_CLIENT_SECRET
AUTH_JWKS_URL=
AUTH_LDAP_URL=
AUTH_LDAP_BASE_DN=
```

Only `*_REF` and configured booleans may leave the server. Do not implement JWT issuance, mock tokens or RBAC writes.

- [ ] **Step 4: Verify GREEN**

Run `pnpm e2e:settings`; confirm the response contains no URL credentials or secret values.

- [ ] **Step 5: Commit**

```bash
git add .env.example lib/auth/config.ts app/api/sync/config/route.ts scripts/e2e/test-settings.ts
git commit -m "feat(auth): add replaceable secret-free config boundary [REQ-2.2.1]"
```

Do not add `.env.local` to Git.

## Task 8: Strict Review and Full Verification

**Files:**
- Create: `docs/database-analysis/sprint-r.19d-requirements-review.md`
- Modify: `docs/summary/PROJECT_STATUS.md`
- Modify: `docs/summary/ROADMAP.md`
- Modify: `docs/database-analysis/requirements-traceability.md`
- Create: `docs/testing/r19d-site-agent-control-whitebox-guide.md`

- [ ] **Step 1: Write the strict requirements review**

Record exact requirement text, implementation files, source/center SQL evidence, UI events, mock/simulator/DRY_RUN distinctions, missing reset/priority/inspection/recovery pieces and verdict.

- [ ] **Step 2: Update traceability truthfully**

Keep the parent requirements `partial` unless every missing piece is closed. Explicitly replace “resume status=0” evidence with “resume restores persisted pre-pause state”.

- [ ] **Step 3: Run all mandatory checks**

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
pnpm test:e2e:worker
pnpm e2e:site-agent-control-core
pnpm e2e:site-agent-control
```

Expected: every command exits 0. Any failure blocks commit.

- [ ] **Step 4: Commit documentation**

```bash
git add docs/database-analysis docs/summary docs/testing
git commit -m "docs(r19d): review Agent control closure [REQ-4.2.1,REQ-4.2.2]"
```

## Task 9: UI Consolidation Design Gate

Do not modify the broader UI in this control plan. After R.19D passes:

1. Persist the `ui-ux-pro-max` design system.
2. Audit navigation and page ownership.
3. Propose removal of the standalone control navigation entry by integrating command history into Tasks.
4. Separate Sites ownership, Sync Center ownership and Settings ownership.
5. Preserve existing blue/slate visual identity while improving typography, spacing, responsive tables, accessibility and loading states.
6. Write and confirm a separate UI consolidation spec before editing pages.
