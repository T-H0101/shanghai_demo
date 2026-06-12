# R.18-R.19 Site Agent Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze the requirements-driven Site Agent contract, then deliver a deployable Agent that pushes real small-table packages and consumes control commands over HTTP without the control platform directly connecting to a production site database.

**Architecture:** The Site Agent runs beside each site database. It reads local data, pushes signed packages to the control platform, polls signed control APIs, executes commands through a replaceable local adapter, and reports heartbeat and command results. Existing direct database execution remains test-only and is not used by the production Agent path.

**Tech Stack:** TypeScript, Node.js/tsx, Next.js route handlers, PostgreSQL 17, HMAC-SHA256, pnpm.

---

### Task 1: Close R.18 documentation baseline

**Files:**
- Create: `docs/database-analysis/sprint-r.18-requirements-review.md`
- Create: `docs/database-analysis/r18-requirement-table-integration-matrix.md`
- Create: `docs/database-analysis/r18-control-capability-matrix.md`
- Create: `docs/source/site-agent-protocol-v1.md`
- Create: `docs/testing/site-agent-web-acceptance-guide.md`
- Modify: `docs/database-analysis/requirements-traceability.json`
- Modify: `docs/database-analysis/requirements-traceability.md`
- Modify: `docs/summary/PROJECT_STATUS.md`
- Modify: `docs/summary/ROADMAP.md`

- [ ] Verify requirements text, current APIs, `disc_files.sql`, and `star_storage_db`.
- [ ] Record the production Agent boundary and test-only direct execution boundary.
- [ ] Record table storage classes and forbid full `tbl_file/tbl_folder` package ingestion.
- [ ] Record command capabilities: pause/resume candidate; reset/priority/inspect/recovery blocked.
- [ ] Update traceability reality without increasing the completion rate.
- [ ] Add browser/API/database acceptance instructions.
- [ ] Run all required checks and commit R.18.

### Task 2: Add failing Site Agent contract tests

**Files:**
- Create: `scripts/e2e/test-site-agent.ts`
- Modify: `package.json`

- [ ] Add tests for configuration validation without secret values in persisted config.
- [ ] Add tests for signed heartbeat rejection/acceptance.
- [ ] Add tests for HTTP command poll/ack/result behavior.
- [ ] Add tests proving the Agent does not query the center database directly.
- [ ] Run `pnpm e2e:site-agent` and confirm failure because implementation is missing.

### Task 3: Implement Agent heartbeat and runtime registry

**Files:**
- Create: `databases/sprint-r19/site-agent-runtime.sql`
- Create: `databases/sprint-r19/README.md`
- Create: `lib/site-agent/config.ts`
- Create: `lib/site-agent/hmac.ts`
- Create: `app/api/site-agent/heartbeat/route.ts`
- Modify: `app/api/sync/sites/status/route.ts`

- [ ] Implement environment-reference-only configuration.
- [ ] Implement request-level HMAC with site code, timestamp, nonce, method, path, and body hash.
- [ ] Store heartbeat runtime data without secrets.
- [ ] Expose Agent freshness/version/capabilities through the existing site status API.
- [ ] Run the targeted Agent tests until heartbeat cases pass.

### Task 4: Implement independent Site Agent sync client

**Files:**
- Create: `lib/site-agent/package-exporter.ts`
- Create: `lib/site-agent/platform-client.ts`
- Create: `scripts/site-agent.ts`
- Modify: `package.json`

- [ ] Reuse the 13-table package allowlist.
- [ ] Read the local site database only.
- [ ] Push packages through `/api/sync/package`.
- [ ] Add bounded retry and offline spool behavior.
- [ ] Ensure `tbl_file/tbl_folder` remain forbidden.
- [ ] Run targeted tests and `pnpm smoke:sync`.

### Task 5: Implement replaceable control adapter

**Files:**
- Create: `lib/site-agent/action-adapter.ts`
- Create: `lib/site-agent/postgres-action-adapter.ts`
- Create: `lib/site-agent/control-client.ts`
- Modify: `scripts/site-agent.ts`

- [ ] Implement capability discovery.
- [ ] Implement pause/resume only with official status values and state validation.
- [ ] Return unsupported for reset/priority/inspect/recovery.
- [ ] Poll/ack/execute/result exclusively through HTTP APIs.
- [ ] Make command execution idempotent locally.
- [ ] Run Agent and worker/control e2e tests.

### Task 6: Close R.19 documentation and browser acceptance

**Files:**
- Create: `docs/database-analysis/sprint-r.19-requirements-review.md`
- Modify: `docs/testing/site-agent-web-acceptance-guide.md`
- Modify: `docs/summary/PROJECT_STATUS.md`
- Modify: `docs/summary/ROADMAP.md`
- Modify: `docs/database-analysis/requirements-traceability.json`
- Modify: `docs/database-analysis/requirements-traceability.md`

- [ ] Document real backend, Agent, UI, mock/DRY_RUN boundary, blockers, and verdict.
- [ ] Run browser checks for `/sites`, `/sync`, `/tasks`, and `/control`.
- [ ] Run all mandatory verification commands.
- [ ] Commit R.19 separately.
