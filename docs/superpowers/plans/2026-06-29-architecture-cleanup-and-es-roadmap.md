# Architecture Cleanup And ES Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep README clean, remove generated repository noise, and land an executable architecture plan for ES-backed large-table search.

**Architecture:** README is the entrypoint; operations, architecture, and database evidence live in dedicated docs. Large file/folder tables are isolated behind an OpenSearch/ES search boundary so PostgreSQL remains the system-of-record for business metadata, not a full-text file index store.

**Tech Stack:** Next.js 16, React 19, PostgreSQL 17, OpenSearch/ES, Docker, pnpm 11.3.0.

---

### Task 1: Keep README As The Entry Point

**Files:**
- Modify: `README.md`
- Verify: `pnpm build`

- [x] **Step 1: Replace README with a short project entrypoint**

README must contain only:
- project positioning
- quick start
- local verification
- deployment pointer
- key docs links
- explicit forbidden claims

- [x] **Step 2: Run link sanity**

Run:

```bash
rg -n "docs/operations/deployment.md|docs/architecture/es-large-table-roadmap.md|docs/architecture/architecture-quality-roadmap.md" README.md
```

Expected: all three links are present.

### Task 2: Move Deployment Details Into Operations Docs

**Files:**
- Create: `docs/operations/deployment.md`
- Verify: `docker build -t unified-disc-platform:docs-check .`

- [x] **Step 1: Document local startup**

Use:

```bash
cp -n .env.example .env.local
pnpm install
pnpm db:up
pnpm db:init
pnpm dev
```

- [x] **Step 2: Document production secret rules**

Production docs must state that true secrets belong in secret manager / env files, not README, compose, SQL, test scripts, or git history.

- [x] **Step 3: Document site onboarding**

Register `sync_sites` with `credential_ref`; keep `SITE_DATABASE_URL` on the site Agent side.

### Task 3: Plan ES Large-Table Search

**Files:**
- Create: `docs/architecture/es-large-table-roadmap.md`
- Verify: `rg -n "tbl_file|tbl_folder|OpenSearch|R.84|blocked_by_external_system" docs/architecture/es-large-table-roadmap.md`

- [x] **Step 1: State the boundary**

PostgreSQL stores business metadata and job state. OpenSearch/ES stores file/folder search documents.

- [x] **Step 2: Define quality attributes**

Document performance, availability, modifiability, security, and testability scenarios with response measures.

- [x] **Step 3: Split delivery into R.84-R.87**

R.84 source classification, R.85 local ES index MVP, R.86 increment/deletion, R.87 production hardening.

### Task 4: Add Architecture Quality Roadmap

**Files:**
- Create: `docs/architecture/architecture-quality-roadmap.md`
- Reference: `/Users/tian/Desktop/大三下/大三下/软件架构设计/Chapter 3 _ Architecture Description.md`
- Reference: `/Users/tian/Desktop/大三下/大三下/软件架构设计/Chapter 4_ Quality Attributes.md`
- Reference: `/Users/tian/Desktop/大三下/大三下/软件架构设计/Chapter 5_ Architectural Design Principles.md`

- [x] **Step 1: Define layered boundaries**

UI -> API -> Domain -> Ports -> Adapters.

- [x] **Step 2: Add design smell checklist**

Map rigidity, fragility, immobility, viscosity, opacity, needless complexity, and repetition to concrete project rules.

- [x] **Step 3: Add release gate**

Use:

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm baseline:check
pnpm audit:center-db -- --strict --matrix
```

### Task 5: Clean Repository Noise

**Files:**
- Modify: `.gitignore`
- Remove from git index: `audit/center-db-matrix.json`
- Local cleanup: `.DS_Store`, stale untracked `docs/database-analysis/r83-comprehensive-review.md`

- [x] **Step 1: Ignore generated audit JSON**

Add:

```gitignore
audit/*.json
```

- [x] **Step 2: Remove generated matrix from git tracking**

Run:

```bash
git rm --cached audit/center-db-matrix.json
```

Expected: file is no longer tracked; future audit runs can regenerate it locally.

### Task 6: Verify And Publish

**Files:**
- All changed docs/config files

- [x] **Step 1: Run lightweight verification**

Run:

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm audit:center-db -- --strict --matrix
git diff --check
```

- [x] **Step 2: Check PR status**

Run:

```bash
gh pr checks 5 --repo T-H0101/shanghai_demo
```

Expected: GitGuardian latest result is pass; any older 2026-06-28 12:06 failure is historical only.

- [x] **Step 3: Commit**

Run:

```bash
git add README.md docs/operations/deployment.md docs/architecture/es-large-table-roadmap.md docs/architecture/architecture-quality-roadmap.md docs/superpowers/plans/2026-06-29-architecture-cleanup-and-es-roadmap.md .gitignore
git commit -m "docs: clean README and architecture roadmap"
```

### Self-Review

- Spec coverage: README cleanup, deployment clarity, ES large-table planning, architecture quality plan, and repository generated-file cleanup are covered.
- Placeholder scan: no unresolved placeholders.
- Type consistency: no code interfaces are introduced in this document; future `SearchPort` naming is consistent with the roadmap.
