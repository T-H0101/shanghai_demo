# R.19C Hybrid Site Agent Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployable Site Agent that reads real small-table data from `SITE_DATABASE_URL`, sends mixed incremental/snapshot packages through the existing package API, and survives network/process interruption without losing synchronization state.

**Architecture:** The Agent uses focused ports for source reading, durable file state, spool storage, and HTTP transport. A coordinator replays durable packages before detecting new changes; state advances only after a successful or duplicated center response.

**Tech Stack:** TypeScript 5.7, Node.js filesystem/crypto/fetch, `pg`, Next.js existing package API, `tsx` white-box test scripts.

---

## File Map

- Create `lib/site-agent/sync/types.ts`: internal sync contracts and state types.
- Create `lib/site-agent/sync/stable-json.ts`: deterministic normalization and SHA-256.
- Create `lib/site-agent/sync/file-store.ts`: atomic state and package spool persistence.
- Create `lib/site-agent/sync/source-reader.ts`: whitelist-only PostgreSQL reads.
- Create `lib/site-agent/sync/package-builder.ts`: existing package-schema construction.
- Create `lib/site-agent/sync/package-transport.ts`: existing HMAC package transport.
- Create `lib/site-agent/sync/coordinator.ts`: replay and synchronization transaction boundary.
- Modify `lib/site-agent/config.ts`: safe synchronization configuration.
- Modify `lib/site-agent/heartbeat-client.ts`: real last sync and spool depth.
- Modify `scripts/site-agent/run.ts`: task/snapshot scheduling and `--once`.
- Create `scripts/e2e/test-site-agent-sync-core.ts`: deterministic/core white-box tests.
- Create `scripts/e2e/test-site-agent-sync.ts`: real DB/API/spool recovery e2e.
- Modify `package.json`: targeted commands and `e2e:all` inclusion.
- Modify `deploy/site-agent/site-agent.env.example`: blank, secret-free config keys.
- Modify `docs/summary/PROJECT_STATUS.md`: current R.19C evidence.
- Modify `docs/summary/ROADMAP.md`: R.19C milestone.
- Modify `docs/database-analysis/requirements-traceability.md`: evidence and remaining gaps.
- Create `docs/database-analysis/sprint-r.19c-requirements-review.md`: strict review.
- Create `docs/testing/r19c-site-agent-sync-whitebox-guide.md`: repeatable test instructions.

### Task 1: Deterministic State And Durable Spool

**Files:**
- Create: `lib/site-agent/sync/types.ts`
- Create: `lib/site-agent/sync/stable-json.ts`
- Create: `lib/site-agent/sync/file-store.ts`
- Create: `scripts/e2e/test-site-agent-sync-core.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing core test**

The test must assert:

```ts
const hashA = hashRecords([{ b: 2, a: 1 }, { id: 2 }])
const hashB = hashRecords([{ id: 2 }, { a: 1, b: 2 }])
assert.equal(hashA, hashB)

await store.saveState(expectedState)
assert.deepEqual(await store.loadState(), expectedState)

await store.enqueue(packagePayload, pendingCommit)
assert.equal((await store.listPending()).length, 1)
assert.deepEqual((await store.listPending())[0].pendingCommit, pendingCommit)
```

It must also verify forbidden table rejection, corrupted state fail-closed behavior, and that no temporary file remains after an atomic write.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm e2e:site-agent-sync-core
```

Expected: failure because the new sync modules do not exist.

- [ ] **Step 3: Implement minimal deterministic state and spool**

Use these contracts:

```ts
export interface TaskWatermark {
  maxId: string
  maxUpdateDt: string | null
}

export interface AgentSyncState {
  version: 1
  taskWatermark: TaskWatermark | null
  snapshotHashes: Partial<Record<AllowedPackageTable, string>>
  lastSyncAt: string | null
}

export interface PendingCommit {
  nextState: AgentSyncState
}
```

`FileSyncStore` must atomically save `sync-state.json`, atomically enqueue `<batchId>.json`, list packages in filename order, and delete a package only by validated batch ID. Corrupted JSON must throw and remain on disk.

- [ ] **Step 4: Run the core test and verify GREEN**

Run:

```bash
pnpm e2e:site-agent-sync-core
```

Expected: all core assertions pass.

### Task 2: Real Source Reader, Change Detection, Package Builder And Transport

**Files:**
- Create: `lib/site-agent/sync/source-reader.ts`
- Create: `lib/site-agent/sync/package-builder.ts`
- Create: `lib/site-agent/sync/package-transport.ts`
- Modify: `scripts/e2e/test-site-agent-sync-core.ts`

- [ ] **Step 1: Extend the failing core test**

Assert:

```ts
assert.deepEqual(reader.allowedTables, ALLOWED_PACKAGE_TABLES)
await assert.rejects(() => reader.readSnapshot("tbl_file" as never))

const rows = await reader.readTaskChanges({
  maxId: "37",
  maxUpdateDt: "2026-06-15T00:00:00.000Z",
}, 10_000)
assert(rows.every((row) => Number(row.id) > 37 || row.update_dt !== null))

const built = buildPackage(input)
assert.equal(built.mode, "mixed")
assert.equal(built.checksum.length, 64)
assert(!built.tables.some((table) => ["tbl_file", "tbl_folder"].includes(table.tableName)))
```

Start a local HTTP server and verify exact HMAC headers and that HTTP 200 `success`/`duplicated` are accepted while 207/4xx/5xx are rejected with retry classification.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
set -a && source .env.local && set +a
pnpm e2e:site-agent-sync-core
```

Expected: failure because reader, builder, and transport are missing.

- [ ] **Step 3: Implement minimal source and transport modules**

`PgSiteSourceReader` must:

- use one `pg.Client` per synchronization cycle;
- accept table names only from `ALLOWED_PACKAGE_TABLES`;
- use `SELECT * FROM <compile-time-whitelist-table>`;
- use parameterized values for task watermarks;
- order task changes by `COALESCE(update_dt, create_dt), id`;
- return PostgreSQL values without DTO remapping.

`buildSyncPackage()` must emit the existing `SyncPackagePayload`, compute a stable package SHA-256, and assign `incremental` to `tbl_task`, `full` to snapshot tables.

`PackageTransport.send()` must use `signSyncPackageBody()` and existing `x-site-code/x-timestamp/x-nonce/x-signature` headers.

- [ ] **Step 4: Run the core test and verify GREEN**

Run:

```bash
set -a && source .env.local && set +a
pnpm e2e:site-agent-sync-core
```

Expected: all reader, package, and transport assertions pass.

### Task 3: Coordinator, Retry, Scheduling And Heartbeat Reality

**Files:**
- Create: `lib/site-agent/sync/coordinator.ts`
- Modify: `lib/site-agent/config.ts`
- Modify: `lib/site-agent/heartbeat-client.ts`
- Modify: `scripts/site-agent/run.ts`
- Modify: `scripts/e2e/test-site-agent-sync-core.ts`
- Modify: `deploy/site-agent/site-agent.env.example`

- [ ] **Step 1: Extend the failing core test**

Use injected fake ports to verify:

```ts
await coordinator.syncOnce()
assert.deepEqual(events, ["replay", "read", "enqueue", "send", "commit", "delete"])

transport.failOnce()
await assert.rejects(() => coordinator.syncOnce())
assert.equal((await store.listPending()).length, 1)
assert.deepEqual(await store.loadState(), initialState)

transport.recover()
await coordinator.syncOnce()
assert.equal((await store.listPending()).length, 0)
assert.notDeepEqual(await store.loadState(), initialState)
```

Also assert no-change cycles do not enqueue/send and heartbeat reports the persisted `lastSyncAt` and current spool count.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm e2e:site-agent-sync-core
```

Expected: coordinator and runtime assertions fail because behavior is missing.

- [ ] **Step 3: Implement the coordinator and scheduler**

`SyncCoordinator.syncOnce()` order:

```ts
await replayPending()
const current = await store.loadState()
const changeSet = await detectChanges(current)
if (changeSet.tables.length === 0) return { status: "no_change" }
const pending = await store.enqueue(buildSyncPackage(changeSet), { nextState })
await sendWithRetry(pending)
await store.saveState(nextState)
await store.removePending(pending.batchId)
return { status: "success", lastSyncAt: nextState.lastSyncAt }
```

Retry only network and 5xx responses with bounded exponential delay. Authentication, validation, and partial responses fail without advancing state.

Add validated configuration defaults:

```ts
taskSyncIntervalMs: 5_000
snapshotSyncIntervalMs: 60_000
retryMaxAttempts: 5
retryBaseMs: 1_000
retryMaxMs: 30_000
overlapMs: 10_000
stateDir: required SITE_AGENT_STATE_DIR
```

`--once` runs one synchronization cycle and one heartbeat. Continuous mode uses one in-flight synchronization promise, never overlapping cycles.

- [ ] **Step 4: Run the core and existing Agent tests**

Run:

```bash
set -a && source .env.local && set +a
pnpm e2e:site-agent-sync-core
pnpm e2e:site-agent
pnpm e2e:site-agent-client
```

Expected: all pass; logs contain key refs but no secret or connection string.

### Task 4: Real DB/API White-Box Closure And Requirements Review

**Files:**
- Create: `scripts/e2e/test-site-agent-sync.ts`
- Modify: `package.json`
- Modify: `docs/summary/PROJECT_STATUS.md`
- Modify: `docs/summary/ROADMAP.md`
- Modify: `docs/database-analysis/requirements-traceability.md`
- Create: `docs/database-analysis/sprint-r.19c-requirements-review.md`
- Create: `docs/testing/r19c-site-agent-sync-whitebox-guide.md`

- [ ] **Step 1: Write the failing real e2e**

The script must use real `SITE_DATABASE_URL`, real center API, and temporary Agent state directory. It must verify:

```ts
// bootstrap
assert.equal(packageLog.status, "success")
assert.equal(tableLogs.length, 13)

// no-change
assert.equal(packageLogCountAfterNoChange, packageLogCountBeforeNoChange)

// task incremental
assert(taskTableLog.expected_record_count >= 1)

// outage and recovery
assert.equal(spoolDepthWhileOffline, 1)
assert.equal(spoolDepthAfterRecovery, 0)

// idempotency
assert.equal(replayResponse.status, "duplicated")
```

Any source mutation must be wrapped in a transaction and rolled back, or use a dedicated record that is cleaned in `finally`.

- [ ] **Step 2: Run the e2e and verify RED**

Run:

```bash
set -a && source .env.local && set +a
pnpm e2e:site-agent-sync
```

Expected: failure before the final integration is complete.

- [ ] **Step 3: Finish integration and documentation**

Add `e2e:site-agent-sync-core` and `e2e:site-agent-sync`; include both in `e2e:all`.

The requirements review must quote the original requirements, list backend/API/DB evidence, identify missing file-index/permission/alert pieces, and keep `REQ-2.3.1`, `REQ-2.3.2`, and `REQ-6.1.3` at `partial` unless every stated acceptance condition is proven.

- [ ] **Step 4: Run targeted verification**

```bash
set -a && source .env.local && set +a
pnpm e2e:site-agent-sync-core
pnpm e2e:site-agent-sync
pnpm e2e:site-agent
pnpm e2e:site-agent-client
```

Expected: zero failures.

- [ ] **Step 5: Run mandatory verification**

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
```

Expected: every command exits 0. Do not commit otherwise.

- [ ] **Step 6: Commit the complete requirement unit**

```bash
git add \
  lib/site-agent scripts/site-agent scripts/e2e \
  deploy/site-agent/site-agent.env.example package.json \
  docs/superpowers/plans/2026-06-15-r19c-hybrid-site-agent-sync.md \
  docs/summary/PROJECT_STATUS.md docs/summary/ROADMAP.md \
  docs/database-analysis/requirements-traceability.md \
  docs/database-analysis/sprint-r.19c-requirements-review.md \
  docs/testing/r19c-site-agent-sync-whitebox-guide.md
git commit -m "feat(r19c): add durable Site Agent hybrid sync"
```
