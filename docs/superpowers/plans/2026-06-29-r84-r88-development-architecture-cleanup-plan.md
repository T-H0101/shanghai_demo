# R84-R88 Development Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the next deployable architecture for large-table search, site onboarding, and repository hygiene without turning the work into another verification-only sprint.

**Architecture:** Keep PostgreSQL as the center metadata store, move `tbl_file*` / `tbl_folder*` search into OpenSearch/ES, and isolate external systems behind ports/adapters. Development, architecture, and cleanup are separate tracks with shared requirements gates.

**Tech Stack:** Next.js 16, React 19, PostgreSQL 17, TypeScript, OpenSearch/Elasticsearch, Docker, pnpm.

---

## 0. Non-Goals

This is an implementation roadmap. Verification commands appear only as exit gates.

Do not:

- Claim ES search is complete before a real OpenSearch/ES instance is wired.
- Add `tbl_file*` / `tbl_folder*` to PG full sync.
- Add new UI pages without a `requirements.md` mapping.
- Hide blocked work behind "done" wording.
- Commit generated audit JSON, local env files, or real credentials.

## 1. Requirement Mapping

| Track | Requirement | Status Target |
|---|---|---|
| Development | `requirements.md §5.2` file index/search | `blocked_by_external_system` -> `partial` after local ES loop |
| Development | `requirements.md §2.3` sync scope | small/mid tables stay complete; large file tables stay ES-only |
| Architecture | `requirements.md §1.2` and `§6.4` | explicit deployment, recovery, and maintainability boundaries |
| Cleanup | `requirements.md §6.2` and `§6.4` | no secrets, no generated artifacts, no stale completion claims |
| Future Control | `requirements.md §4.2` | stays `partial` until site app poll/execute/writeback exists |

## 2. Target Work Breakdown

| Sprint | Name | Primary Output | Merge Rule |
|---|---|---|---|
| R.84 | Source Table Classification | source-table decision matrix + contracts | docs + audit script only |
| R.85 | Local ES Search Loop | ES mapping, indexer, search adapter, local docker profile | searchable local ES path |
| R.86 | Incremental Indexing | watermarks, tombstones, retry/dead-letter states | DB migration + recovery runbook |
| R.87 | Production Hardening | metrics, alerting, auth filters, deployment runbook | security and load gates |
| R.88 | Site Onboarding Kit | agent config template, site contract, checklist | second-site onboarding evidence |
| R.89 | Repository Cleanup | stale docs/code cleanup, generated-file policy, ownership map | docs-only or small code PRs |

## 3. Development Plan

### Task 1: R.84 Source Table Classification

**Files:**
- Create: `docs/database-analysis/r84-source-table-classification.md`
- Create: `scripts/audit/classify-source-tables.ts`
- Modify: `docs/architecture/es-large-table-roadmap.md`
- Modify: `docs/architecture/README.md`

- [ ] **Step 1: Define the decision matrix**

Create `docs/database-analysis/r84-source-table-classification.md` with this table shape:

```markdown
# R.84 Source Table Classification

| Source table | Category | Target | Reason | Requirement | Owner |
|---|---|---|---|---|---|
| tbl_file | file_index | OpenSearch/ES | large file metadata table | §5.2 | platform |
| tbl_folder | file_index | OpenSearch/ES | large folder tree table | §5.2 | platform |
```

Categories must be exactly:

- `pg_unified`
- `file_index_es`
- `site_control`
- `source_only`
- `deprecated_or_empty`
- `needs_decision`

- [ ] **Step 2: Add an audit script**

Create `scripts/audit/classify-source-tables.ts` that reads the live site DB table list and compares it against the decision matrix. The script must fail only when a `tbl_*` table is missing from the matrix.

Expected command:

```bash
pnpm tsx scripts/audit/classify-source-tables.ts
```

Expected output shape:

```text
R.84 source classification
classified=170
missing=0
needs_decision=...
```

- [ ] **Step 3: Update ES roadmap**

Update `docs/architecture/es-large-table-roadmap.md` so R.84 points to the classification document and states that `needs_decision` blocks R.85.

- [ ] **Step 4: Commit R.84**

```bash
git add docs/database-analysis/r84-source-table-classification.md scripts/audit/classify-source-tables.ts docs/architecture/es-large-table-roadmap.md docs/architecture/README.md
git commit -m "docs: classify source tables for R84"
```

### Task 2: R.85 Local ES Search Loop

**Files:**
- Create: `lib/ports/search-port.ts`
- Create: `lib/adapters/opensearch/file-search-adapter.ts`
- Create: `lib/domain/search/file-index-document.ts`
- Create: `scripts/index/file-indexer.ts`
- Create: `docker-compose.search.yml`
- Modify: `app/api/search/route.ts`
- Modify: `docs/operations/deployment.md`

- [ ] **Step 1: Add the search port**

Create `lib/ports/search-port.ts`:

```ts
export type FileSearchQuery = {
  keyword: string
  siteCode?: string
  departmentIds?: string[]
  limit: number
  offset: number
}

export type FileSearchHit = {
  sourceSiteId: string
  sourceRecordId: string
  fileName: string
  filePath: string | null
  folderPath: string | null
  extension: string | null
  sizeBytes: number | null
  volumeCode: string | null
  discCode: string | null
  updatedAt: string | null
}

export type FileSearchResult = {
  hits: FileSearchHit[]
  total: number
  source: "opensearch"
}

export interface SearchPort {
  searchFiles(query: FileSearchQuery): Promise<FileSearchResult>
}
```

- [ ] **Step 2: Add the index document contract**

Create `lib/domain/search/file-index-document.ts`:

```ts
export type FileIndexDocument = {
  source_site_id: string
  source_table: string
  source_record_id: string
  file_name: string
  file_path: string | null
  folder_path: string | null
  extension: string | null
  size_bytes: number | null
  volume_code: string | null
  disc_code: string | null
  department_id: string | null
  task_id: string | null
  updated_at: string | null
  deleted: boolean
}
```

- [ ] **Step 3: Add a local ES compose profile**

Create `docker-compose.search.yml` with one OpenSearch service and no checked-in password. Use local-only environment placeholders and document production secret handling in `docs/operations/deployment.md`.

- [ ] **Step 4: Add the first indexer**

Create `scripts/index/file-indexer.ts`. It must:

- read `SITE_DATABASE_URL`
- fetch a bounded sample from `tbl_file` / `tbl_folder` when present
- map rows into `FileIndexDocument`
- write to OpenSearch bulk API
- print inserted/updated/skipped counts

- [ ] **Step 5: Wire `/api/search` to the port**

Modify `app/api/search/route.ts` so file-index search calls `SearchPort`. If ES is unavailable, return an explicit blocked response:

```json
{
  "status": "blocked_by_external_system",
  "message": "OpenSearch/ES file index is not configured"
}
```

- [ ] **Step 6: Commit R.85**

```bash
git add lib/ports/search-port.ts lib/adapters/opensearch/file-search-adapter.ts lib/domain/search/file-index-document.ts scripts/index/file-indexer.ts docker-compose.search.yml app/api/search/route.ts docs/operations/deployment.md
git commit -m "feat(search): add local ES file search loop"
```

### Task 3: R.86 Incremental Indexing

**Files:**
- Create: `databases/sprint-r86-file-index-jobs.sql`
- Create: `lib/domain/search/file-index-job.ts`
- Modify: `databases/sprint-2b0/init-docker.sh`
- Modify: `scripts/index/file-indexer.ts`
- Modify: `docs/operations/deployment.md`

- [ ] **Step 1: Add index job tables**

Create `databases/sprint-r86-file-index-jobs.sql`:

```sql
CREATE TABLE IF NOT EXISTS file_index_jobs (
  id BIGSERIAL PRIMARY KEY,
  site_code TEXT NOT NULL,
  source_table TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed')),
  last_source_id TEXT,
  last_updated_at TIMESTAMPTZ,
  scanned_count INTEGER NOT NULL DEFAULT 0,
  indexed_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_index_jobs_site_status
  ON file_index_jobs(site_code, status, created_at DESC);
```

- [ ] **Step 2: Register the migration**

Add the SQL file to `databases/sprint-2b0/init-docker.sh` migration list.

- [ ] **Step 3: Add tombstone handling**

Extend `scripts/index/file-indexer.ts` to support `deleted=true` documents and retry failed batches without duplicating successful records.

- [ ] **Step 4: Commit R.86**

```bash
git add databases/sprint-r86-file-index-jobs.sql databases/sprint-2b0/init-docker.sh lib/domain/search/file-index-job.ts scripts/index/file-indexer.ts docs/operations/deployment.md
git commit -m "feat(search): add incremental file indexing jobs"
```

### Task 4: R.88 Site Onboarding Kit

**Files:**
- Create: `docs/operations/site-onboarding-checklist.md`
- Create: `docs/source/site-agent-contract.md`
- Modify: `docs/operations/deployment.md`
- Modify: `README.md`

- [ ] **Step 1: Write the site contract**

Create `docs/source/site-agent-contract.md` with:

- required env keys
- HMAC signing requirements
- package push envelope
- control command poll/result endpoints
- file index batch behavior
- explicit statement that site DB credentials remain on the site side

- [ ] **Step 2: Write the onboarding checklist**

Create `docs/operations/site-onboarding-checklist.md` with stages:

1. register `sync_sites`
2. configure site agent
3. push heartbeat
4. push one sync package
5. run file-index sample
6. check audit logs
7. record blocker status

- [ ] **Step 3: Commit R.88**

```bash
git add docs/operations/site-onboarding-checklist.md docs/source/site-agent-contract.md docs/operations/deployment.md README.md
git commit -m "docs: add site onboarding kit"
```

## 4. Architecture Plan

### Task 5: Establish Architecture Decision Records

**Files:**
- Create: `docs/architecture/adr/0001-pg-for-metadata-es-for-file-index.md`
- Create: `docs/architecture/adr/0002-ports-and-adapters-boundary.md`
- Create: `docs/architecture/adr/0003-site-agent-pull-control.md`
- Modify: `docs/architecture/README.md`

- [ ] **Step 1: ADR 0001**

State that PG stores center metadata and ES stores large file index documents. Include consequences:

- PG queries remain predictable.
- ES outage blocks file search only.
- File-index writes must be idempotent.

- [ ] **Step 2: ADR 0002**

State that external systems are behind ports:

- `SearchPort`
- `SiteAgentPort`
- `CredentialStorePort`
- `AuditPort`

- [ ] **Step 3: ADR 0003**

State that site control is pull-based. The center queues commands; a site app/agent must poll, execute, and write result before the requirement can move to `complete`.

- [ ] **Step 4: Commit ADRs**

```bash
git add docs/architecture/adr docs/architecture/README.md
git commit -m "docs: record architecture decisions"
```

### Task 6: Move Toward Ports And Adapters

**Files:**
- Create: `lib/ports/README.md`
- Create: `lib/adapters/README.md`
- Create: `lib/domain/README.md`
- Modify: modules only when a Sprint touches that domain

- [ ] **Step 1: Document the target boundaries**

Add README files that define:

- `lib/domain`: business rules and state transitions
- `lib/ports`: TypeScript interfaces for external capabilities
- `lib/adapters`: implementations for PG, ES, site agent, credential stores

- [ ] **Step 2: Migrate only touched code**

Do not run a big-bang refactor. Each future feature moves only the domain it already changes.

- [ ] **Step 3: Commit boundary docs**

```bash
git add lib/ports/README.md lib/adapters/README.md lib/domain/README.md
git commit -m "docs: define domain port adapter boundaries"
```

### Task 7: Quality Attribute Scenarios

**Files:**
- Create: `docs/architecture/quality-attribute-scenarios.md`
- Modify: `docs/architecture/architecture-quality-roadmap.md`

- [ ] **Step 1: Write measurable scenarios**

Create scenarios for:

- performance: normal center DB query P95 <= 1s
- search performance: ES file search P95 <= 2s
- availability: ES down does not break dashboard/tasks/sync
- security: no cross-site file search leakage
- modifiability: one new source table changes mapper/contract only
- deployability: new site can be onboarded from checklist

- [ ] **Step 2: Commit scenarios**

```bash
git add docs/architecture/quality-attribute-scenarios.md docs/architecture/architecture-quality-roadmap.md
git commit -m "docs: add quality attribute scenarios"
```

## 5. Cleanup Plan

### Task 8: Repository Artifact Policy

**Files:**
- Create: `docs/operations/repository-cleanup-policy.md`
- Modify: `.gitignore`

- [ ] **Step 1: Define generated artifacts**

Document these as non-source artifacts:

- `audit/*.json`
- `docs/audit/consistency/consistency-*.json`
- local screenshots and traces
- `.env.local`
- database volumes
- exported reports generated by one-off scripts

- [ ] **Step 2: Keep source docs separate from generated docs**

Policy:

- stable architecture, deployment, requirements reviews stay in git
- transient audit matrices and local run output stay out of git
- stale historical docs move to `docs/archive/` only when still useful

- [ ] **Step 3: Commit policy**

```bash
git add docs/operations/repository-cleanup-policy.md .gitignore
git commit -m "docs: define repository cleanup policy"
```

### Task 9: Dead Code And Duplicate Script Inventory

**Files:**
- Create: `docs/database-analysis/r89-dead-code-inventory.md`
- No immediate code deletion in this task

- [ ] **Step 1: Inventory before deleting**

Create a table:

```markdown
| Path | Type | Evidence unused | Risk | Action |
|---|---|---|---|---|
```

Actions must be one of:

- `keep`
- `merge`
- `archive`
- `delete_after_pr`
- `needs_owner_decision`

- [ ] **Step 2: Define deletion rule**

Only delete source files when:

1. `rg` finds no imports or route references
2. no package script calls it
3. no requirements review depends on it
4. one PR is dedicated to the deletion

- [ ] **Step 3: Commit inventory**

```bash
git add docs/database-analysis/r89-dead-code-inventory.md
git commit -m "docs: inventory cleanup candidates"
```

### Task 10: Documentation Cleanup

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/README.md`
- Create: `docs/README.md`

- [ ] **Step 1: Add a docs index**

Create `docs/README.md` with these sections:

- requirements source
- architecture
- operations
- database analysis and sprint reviews
- implementation plans
- archived material

- [ ] **Step 2: Keep README short**

README remains an entry page. It must not absorb sprint reports, audit logs, or long deployment details.

- [ ] **Step 3: Commit docs cleanup**

```bash
git add README.md docs/README.md docs/architecture/README.md
git commit -m "docs: add compact documentation index"
```

### Task 11: Secret And Mock Boundary Cleanup

**Files:**
- Create: `docs/operations/security-and-mock-boundary.md`
- Modify: only offending files found by the scan

- [ ] **Step 1: Define allowed placeholders**

Document allowed placeholders:

- `wrong_password` only in negative auth tests
- `admin/admin` only in local development docs
- `credential_ref` names in DB rows
- env key names without values

- [ ] **Step 2: Define forbidden content**

Forbidden:

- real database URLs with passwords
- real tokens
- production hostnames tied to secrets
- copied `.env.local`
- mock data presented as live center DB evidence

- [ ] **Step 3: Commit boundary doc**

```bash
git add docs/operations/security-and-mock-boundary.md
git commit -m "docs: define security and mock boundaries"
```

## 6. Execution Order

Run in this order:

1. R.84 table classification.
2. Architecture ADRs.
3. Repository cleanup policy.
4. R.85 local ES loop.
5. R.86 incremental indexing.
6. R.88 site onboarding.
7. R.89 dead-code inventory and focused cleanup PRs.

Reason: classification and boundaries reduce rework before writing ES code.

## 7. Exit Gates

Each implementation PR must include:

- changed requirement IDs
- backend reality
- UI reality
- missing pieces
- blocker type
- no forbidden wording

Final command set for code-touching PRs:

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm baseline:check
pnpm audit:center-db -- --strict --matrix
```

ES-touching PRs additionally run the local ES profile and the file-search e2e created in R.85.

## 8. Handoff Prompt For Another Agent

```text
在 /Users/tian/Desktop/上海 执行 docs/superpowers/plans/2026-06-29-r84-r88-development-architecture-cleanup-plan.md。
先读 AGENTS.md、CLAUDE.md、docs/source/requirements.md。
这不是验证清单。优先交付开发计划、架构边界和清理计划中的具体产物。
不要把 mock、DRY_RUN、控制队列框架或路线图说成真实完成。
不要把 tbl_file* / tbl_folder* 加入 PG 全量同步。
每个 Sprint 独立 PR；代码变更才跑完整测试，文档变更至少跑 git diff --check 和禁用措辞扫描。
```

## 9. Self-Review

- Spec coverage: development, architecture, and cleanup are separated into independent tracks.
- Requirements coverage: `§2.3`, `§5.2`, `§6.2`, `§6.4`, and blocked `§4.2` are explicitly mapped.
- Placeholder scan: no unresolved placeholder labels are used.
- Risk control: tests are exit gates only, not the plan's main content.
