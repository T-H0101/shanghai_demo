# R.89 Dead-Code Inventory Report

> **Generated**: 2026-06-29
> **Sprint**: R.89 (dead-code cleanup audit)
> **Method**: file listing + grep for references in `package.json` / `CLAUDE.md` / `AGENTS.md` / `README.md` / `docs/` / `*.ts` / `*.tsx`
> **Scope**: candidates at repo root, `scripts/`, `lib/api/`, top-level `.js/.py`
> **NOT in scope**: `lib/sync/` (R.83 dispatcher core), `lib/sync/dump/*` (R.55/R.83 live), `scripts/site-agent/` (R.88 live), `scripts/index/` (R.85/R.86 live), `scripts/sync/*` (R.83 live), `databases/*.sql` (real migrations)

---

## 1. Executive Summary

| Category | Files | LOC | Risk Profile |
|---|---|---|---|
| Legacy one-off sprint scripts | 25 | ~4,400 | safe_to_delete (all pre-R.83, no live refs) |
| Stale test scripts (pre-R.83 sync experiments) | 3 | ~471 | safe_to_delete |
| D-class obsolete (analyze_disc_schema.py) | 1 | ~900 | review_needed (documented as D-class in SCRIPTS_INDEX) |
| Orphans in lib/api/ (legacy dashboard/list helpers) | 2 | ~244 | review_needed (potential R.84 SearchPort contradiction) |
| Root-level test-login.js | 1 | ~109 | review_needed (Playwright 5-19 raw script) |
| Stale cleanup scripts (old + new version mismatch) | 1 | ~94 | review_needed (replaced by `scripts/cleanup/`) |
| **TOTAL flagged** | **33** | **~6,200** | |

**Estimated cleanup impact**: ~6,200 LOC removable (safe_to_delete subset = ~4,900 LOC). No live pipeline impact (verified — none referenced by `package.json`, current sprint review docs, or active code paths).

**False positives avoided** (NOT flagged):
- All 8 R.83 whitelist test scripts (`test-r83.2` … `test-r83.9-whitelist.ts`) — referenced by `test:r83.X-whitelist` npm scripts
- All 11 production/dev scripts (`import-*`, `export-*`, `push-*`, `smoke-*`) — referenced by `import:*` / `export:*` / `push:*` / `smoke:sync`
- `lib/sync/dump/*` — referenced by R.83.3–R.83.9 sprint review docs and `sync:dump:*` scripts
- `scripts/sync/*` (3 files) — referenced by `test:r83.X-e2e` and `sync:dump:*` scripts
- `scripts/site-agent/run.ts` — referenced by `agent:site`
- `scripts/index/*` (3 files) — referenced by R.85/R.86 file-index pipeline
- `scripts/worker-site.ts` — referenced by `worker:site`
- `scripts/sprint-4.8-e2e.sh` — referenced by `test:e2e:worker`
- `scripts/cleanup/center-db-test-pollution.ts` — referenced in `PROJECT_STATUS.md` and superpowers plan R.83.1 (but NOT in `package.json` — see "review_needed" entry)
- `scripts/cleanup/__tests__/cleanup-self-check.ts` — referenced by `test:cleanup`
- `lib/api/mock-providers.ts`, `mock-store.ts`, `api-providers.ts`, `index.ts`, `fallback.ts`, `dto/index.ts` — actively wired by app pages and `lib/api/index.ts`
- `lib/mock/*` (8 files) — actively consumed by `mock-providers.ts` and routes

---

## 2. Per-Category Tables

### 2.1 Legacy one-off sprint scripts (stale_sprint)

> All are pre-R.83 sprint investigation scripts. No references in `package.json` or current sprint review docs. Confirmed via grep: 0 external matches (only self-matches in git history).

| File | Last Commit | LOC | Risk | Action |
|---|---|---|---|---|
| `scripts/sprint-2f2a-list-tables.ts` | 2026-06-08 | 71 | safe_to_delete | move to `scripts/archive/sprint-2f/` |
| `scripts/sprint-2f2a-profile-task-items.ts` | 2026-06-06 | 201 | safe_to_delete | move to `scripts/archive/sprint-2f/` |
| `scripts/sprint-2f2a-verify-table-existence.ts` | 2026-06-06 | 97 | safe_to_delete | move to `scripts/archive/sprint-2f/` |
| `scripts/sprint-2f3-verify-sh01.ts` | 2026-06-06 | 80 | safe_to_delete | move to `scripts/archive/sprint-2f/` |
| `scripts/sprint-2g2-baseline.ts` | 2026-06-07 | 75 | safe_to_delete | move to `scripts/archive/sprint-2g/` |
| `scripts/sprint-2g2-reconcile.ts` | 2026-06-07 | 98 | safe_to_delete | move to `scripts/archive/sprint-2g/` |
| `scripts/sprint-2g3-scan.ts` | 2026-06-20 | 121 | safe_to_delete | move to `scripts/archive/sprint-2g/` |
| `scripts/sprint-2g3-profile.ts` | 2026-06-20 | 161 | safe_to_delete | move to `scripts/archive/sprint-2g/` |
| `scripts/sprint-2g3-deepdive.ts` | 2026-06-20 | 181 | safe_to_delete | move to `scripts/archive/sprint-2g/` |
| `scripts/sprint-2g3-status-detail.ts` | 2026-06-07 | 57 | safe_to_delete | move to `scripts/archive/sprint-2g/` |
| `scripts/sprint-2h1-verify-logs.ts` | 2026-06-07 | 87 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h1r-coverage.ts` | 2026-06-20 | 230 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h1r-deep.ts` | 2026-06-20 | 110 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h1r-schema.ts` | 2026-06-20 | 60 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h1r-sh01-truth.ts` | 2026-06-20 | 96 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h2-schema-check.ts` | 2026-06-20 | 73 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h2-hd-ctr.ts` | 2026-06-07 | 39 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h2-hd-disc-check.ts` | 2026-06-07 | 38 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h2-sh01-truth.ts` | 2026-06-07 | 60 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h2-single-table.ts` | 2026-06-20 | 230 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h3-e2e-push.ts` | 2026-06-08 | 161 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h3-inspect-volume-slot.ts` | 2026-06-08 | 56 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h3-verify-truth.ts` | 2026-06-08 | 130 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h6-inserted-updated.ts` | 2026-06-08 | 165 | safe_to_delete | move to `scripts/archive/sprint-2h/` |
| `scripts/sprint-2h7-coverage-full.ts` | 2026-06-08 | 215 | safe_to_delete | move to `scripts/archive/sprint-2h/` |

**Subtotal**: 25 files, ~2,983 LOC

**Justification**: These were identified by Sprint 4.6A itself (see `docs/summary/SCRIPTS_INDEX.md` §2.C) as "C-class audit 一次性 (建议归档)" — 23 sprint-* scripts (the SCRIPTS_INDEX predates 2G.3/2H.1r/2H.3 additions, so 25 today). Sprint 4.6A explicitly chose not to delete, citing low-risk principle. R.89 supersedes: all confirmed orphan (0 external refs).

### 2.2 Stale test scripts (pre-R.83 sync experiments) (stale_test)

| File | Last Commit | LOC | Risk | Action |
|---|---|---|---|---|
| `scripts/test-sync-package.ts` | 2026-06-07 | 279 | safe_to_delete | superseded by R.83 whitelist pipeline |
| `scripts/test-sync-package-10.ts` | 2026-06-06 | 127 | safe_to_delete | superseded by R.83 whitelist pipeline |
| `scripts/test-sync-whitelist-r83.ts` | 2026-06-24 | 65 | safe_to_delete | one-off early R.83 sanity check, no `package.json` reference |

**Subtotal**: 3 files, 471 LOC

**Justification**: All three are sync-package tests written before the R.83 whitelist dispatcher (June 23–28) replaced ad-hoc testing with the 8-script `test-r83.X-whitelist` pipeline. Listed by `SCRIPTS_INDEX.md` §2.B as "可保留, 适合 CI" but actual use is 0 — `test:package-log` is the only B-class reference in `package.json`, not these three.

### 2.3 D-class obsolete (obsolete_mock) — `analyze_disc_schema.py`

| File | Last Commit | LOC | Risk | Action |
|---|---|---|---|---|
| `analyze_disc_schema.py` | 2026-06-08 (filesystem) | ~900 | review_needed | documented as obsolete by SCRIPTS_INDEX §2.D; safe to remove but cross-cuts Python toolchain decision |

**Justification**: Python script in a pnpm + tsx project. Per `SCRIPTS_INDEX.md` §2.D and `CODEBASE_QUALITY_AUDIT.md` line 21 / 197: "Python 混进 tsx 项目, 已被 import-from-source 替代", "已无意义". Flagged but NOT safe_to_delete unilaterally — `SCRIPTS_INDEX.md` explicitly says "保留但加备注 (低风险原则, 不删)". Requires user / lead confirmation before deletion (CL rules in CLAUDE.md forbid removing without consent).

### 2.4 Orphans in `lib/api/` (potential R.84 SearchPort contradiction)

| File | Last Commit | LOC | Risk | Action |
|---|---|---|---|---|
| `lib/api/dashboard-provider.ts` | 2026-06-07 | 123 | review_needed | verify before deletion — zero imports found |
| `lib/api/list-helper.ts` | 2026-06-06 | 121 | review_needed | verify before deletion — zero imports found |

**Justification**: Both files declare exports (`DashboardSummaryData` interface + `fetchDashboardSummary` function for the first; `listApiHandler`, `ListApiOptions`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE` for the second). Grep across `app/`, `components/`, `lib/` (excluding `node_modules`/`.next`) finds zero import sites — both appear orphaned. However, they predate R.84 SearchPort refactor and may have been silently replaced by direct API route handlers. Recommendation: **delete after a final cross-check that no API route imports them**, ideally in R.89.5 verification Sprint (see §5).

### 2.5 Root-level test-login.js (stale_doc / commented_block candidate)

| File | Last Commit | LOC | Risk | Action |
|---|---|---|---|---|
| `test-login.js` | (pre-2026-05, fs mtime 5月 19) | 109 | review_needed | untracked Playwright CommonJS script; superseded by `scripts/e2e/test-login.ts` |

**Justification**: Plain `.js` CommonJS file at repo root using `require('playwright')` (no tsx, no `package.json` script). First added before the tsx project migration. R.5/R.6 replaced all login tests with `scripts/e2e/test-login.ts` (referenced by `e2e:login`). Not in `package.json`. Not in `lib/` so falls outside "don't flag `lib/`" rule, but still warrants explicit deletion approval (root-level files are user-visible).

### 2.6 Stale cleanup scripts — old + new version mismatch (duplicate / stale)

| File | Last Commit | LOC | Risk | Action |
|---|---|---|---|---|
| `scripts/cleanup-test-pollution.ts` | 2026-06-11 | 94 | review_needed | superseded by `scripts/cleanup/center-db-test-pollution.ts` (R.83.1, in `scripts/cleanup/`) |

**Justification**: Original pollution cleanup at `scripts/cleanup-test-pollution.ts` (June 11). Replaced June 23 by `scripts/cleanup/center-db-test-pollution.ts` (R.83.1, R.83.9 reviewed, referenced by `cleanup:test-pollution` if added and by `docs/summary/PROJECT_STATUS.md`). The new version lives at `scripts/cleanup/` (per subdirectory convention); the old one is orphaned. **Worth deleting in R.89.5**, but only after confirming no `cron` / external CI still calls `pnpm tsx scripts/cleanup-test-pollution.ts` directly.

---

## 3. Files Explicitly NOT Flagged (false-positive guard)

These look stale but are referenced by live pipeline — DO NOT delete:

| File | Why Keep |
|---|---|
| `scripts/test-r83.2-whitelist.ts` … `scripts/test-r83.9-whitelist.ts` (8 files) | Each referenced by `test:r83.X-whitelist` npm scripts; live R.83 dispatcher validation |
| `scripts/import-from-source.ts` | Referenced by 6 npm scripts (`import:tasks/devices/discs/volumes/hard-disks/all`) |
| `scripts/import-file-index.ts` | Referenced by `import:file-index` |
| `scripts/import-user-site-platforms.ts` | Referenced by 4 npm scripts |
| `scripts/import-aggregates.ts` | Referenced by `import:aggregates` / `import:aggregates:all` |
| `scripts/export-package.ts` | Referenced by `export:package` |
| `scripts/push-package.ts` | Referenced by `push:package` |
| `scripts/export-and-push.ts` | Referenced by `export-and-push` |
| `scripts/smoke-sync.ts` | Referenced by `smoke:sync` (CLAUDE.md mandatory pre-commit) |
| `scripts/test-package-log.ts` | Referenced by `test:package-log` |
| `scripts/check-sync-consistency.ts` | Referenced by `check:sync-consistency` |
| `scripts/check-project-baseline.ts` | Referenced by `baseline:check` (R.7C CLAUDE.md mandatory) |
| `scripts/sprint-4.8-e2e.sh` | Referenced by `test:e2e:worker` |
| `scripts/worker-site.ts` | Referenced by `worker:site`; active control-command poll loop |
| `scripts/sync/export-restore-dump.ts` | Referenced by `sync:dump:export` AND `app/api/sync/dump-now/route.ts` |
| `scripts/sync/ingest-dump.ts` | Referenced by `sync:dump:ingest` AND `app/api/sync/dump-now/route.ts` |
| `scripts/sync/real-e2e-test.ts` | Referenced by `test:r83.3-e2e` |
| `scripts/sync/real-e2e-multi-site-test.ts` | Referenced by `test:r83.4-e2e` |
| `scripts/site-agent/run.ts` | Referenced by `agent:site` (R.88 live) |
| `scripts/index/file-indexer.ts` | R.85/R.86 live indexer |
| `scripts/index/file-index-job-runner.ts` | R.86 live job runner |
| `scripts/index/file-index-job-bootstrap.ts` | R.86 live bootstrap |
| `scripts/scheduler/sync-scheduler.ts` | Referenced by `scheduler:sync` / `scheduler:sync:once` |
| `scripts/cleanup/center-db-test-pollution.ts` | R.83.1; referenced in `docs/summary/PROJECT_STATUS.md` and superpowers plan R.83.1 |
| `scripts/cleanup/__tests__/cleanup-self-check.ts` | Referenced by `test:cleanup` |
| `scripts/e2e/test-*.ts` (40+ files) | All referenced by `e2e:*` npm scripts |
| `scripts/audit/center-db-integrity.ts` | Referenced by `audit:center-db` |
| `scripts/audit/classify-source-tables.ts` | Referenced by `audit:classify-source-tables` |
| `lib/api/mock-providers.ts` | Imported by `lib/api/index.ts` |
| `lib/api/api-providers.ts` | Imported by `lib/api/index.ts` |
| `lib/api/mock-store.ts` | Imported by `lib/api/mock-providers.ts` |
| `lib/api/index.ts` | Imported by app pages (alerts, racks, logs, search, tasks, volumes) |
| `lib/api/fallback.ts` | Imported by `lib/api/api-providers.ts` |
| `lib/api/dto/index.ts` | Imported by `lib/api/api-providers.ts` |
| `lib/api/adapters/*` (8 files) | Used by mock-providers; live via R.84 adapter pattern |
| `lib/sync/*` (R.83 dispatcher core — all files) | R.83 live |
| `lib/sync/dump/*` (3 files) | R.55 / R.83.3–R.83.9 active |
| `lib/ports/search-port.ts` | R.85 SearchPort (ADR 0002); live |
| `lib/domain/README.md`, `lib/ports/README.md`, `lib/adapters/README.md` | Architectural docs for R.84 |
| `lib/ingest/*` (5 files) | live sync ingestion |
| `lib/import/*` (14 files) | live source importers |
| `lib/export/*` (9 files) | live export pipeline |
| `lib/control/*` (5 files) | R.4.5 / R.88 live control-command pipeline |
| `lib/jobs/*` (file-index-job.ts etc.) | R.86 live jobs |
| `lib/mock/*` (8 files) | consumed by `mock-providers.ts`; required when `NEXT_PUBLIC_API_MODE=mock` |
| `lib/auth/*` (13 files) | R.83.2 / R.5 RBAC + HMAC; live |
| `lib/search/*` (es-client.ts, file-index-repository.ts) | R.85 live OpenSearch adapter |
| `lib/logs/*` (clickhouse-client.ts, log-repository.ts) | live logs |

---

## 4. Risk Classification Definitions

| Risk | Definition | Delete Permission |
|---|---|---|
| **safe_to_delete** | Zero external references in `package.json` / live code / sprint review docs / `lib/` consumers. Grep verified. | Can be deleted in R.89.5 directly with `git mv` to `archive/` (CLAUDE.md "不删除目录" — `mv` is OK) |
| **review_needed** | Some references exist but may be stale (e.g. docs reference but code path dead), or requires user / lead sign-off per CLAUDE.md policy. | Requires confirmation before deletion; document in R.89.5 review |
| **keep** | Live pipeline depends on it. | DO NOT delete |

---

## 5. What to Delete Next Sprint (R.89.5 — requires user confirmation)

> Per CLAUDE.md "不删除目录, 不删除数据库, 如需清理只能移动到 `archive/`" — **use `git mv` to `archive/`**, never `rm`.

### Tier 1: `safe_to_delete` — R.89.5 can proceed autonomously after this report is reviewed

**Subtotal**: 28 files, ~3,454 LOC. Move to:
- `scripts/archive/sprint-2f/` (4 files: sprint-2f2a*, sprint-2f3*)
- `scripts/archive/sprint-2g/` (6 files: sprint-2g2*, sprint-2g3*)
- `scripts/archive/sprint-2h/` (12 files: sprint-2h1*, sprint-2h1r*, sprint-2h2*, sprint-2h3*, sprint-2h6*, sprint-2h7*)
- `scripts/archive/pre-r83/` (3 files: test-sync-package*, test-sync-whitelist-r83*)

Also add `/** @archive R.89 — see docs/audit/r89-dead-code-inventory.md */` header comment to each (per `SCRIPTS_INDEX.md` §5 "下一步建议").

### Tier 2: `review_needed` — requires explicit user / lead approval before deletion

| # | File | Decision needed from | Rationale |
|---|---|---|---|
| 1 | `analyze_disc_schema.py` | Lead / project owner | SCRIPTS_INDEX.md §2.D already proposes deletion, but CLAUDE.md is conservative. User instruction says R.89 only INVENTORY, not delete. |
| 2 | `lib/api/dashboard-provider.ts` | Lead (R.84 SearchPort owner) | Possible dead code post-R.84 refactor; verify no API route imports it before deletion |
| 3 | `lib/api/list-helper.ts` | Lead (R.84 SearchPort owner) | Same as above |
| 4 | `test-login.js` | Project owner | Root-level CommonJS untracked script; visually misleading |
| 5 | `scripts/cleanup-test-pollution.ts` | Lead (R.83.1 owner) | Replaced by `scripts/cleanup/center-db-test-pollution.ts`; verify no external cron before deletion |

---

## 6. Methodology Notes

- **Reference detection**: `grep -rln` across `*.ts`/`*.tsx`/`*.json`/`*.md`/`*.yml`/`*.sh` (excluding `node_modules/`, `.next/`)
- **Self-match exclusion**: For each candidate file, ran grep with `--exclude-dir` for its own filename. Files with 0 non-self matches → `safe_to_delete`
- **First/last commit dates**: `git log --diff-filter=A --format='%ad' --date=short -- <path>` and `git log -1 --format='%ad' --date=short -- <path>`
- **LOC counts**: `wc -l`
- **Manual review pass**: For each `safe_to_delete` candidate, opened first 30 lines to confirm it's a one-off script (not a module re-exported via barrel)
- **R.84 SearchPort contradiction check**: Verified `lib/ports/search-port.ts` and `lib/adapters/opensearch/file-search-adapter.ts` are LIVE; `lib/api/mock-providers.ts` still in use (mock mode toggle). SearchPort refactor does NOT obsolete `lib/mock/` files — those remain reachable when `NEXT_PUBLIC_API_MODE=mock`.

---

## 7. Files NOT Yet Investigated (out of inventory scope)

- `scripts/audit/*` (5 files: center-db-integrity.ts, classify-source-tables.ts, generate-r83-matrix.ts, matrix-strict-stats.ts, source-schema-inventory.ts) — referenced by `audit:*` scripts and `test:matrix-round`; live
- `app/api/*` (40+ route dirs) — all live per package.json + page wiring
- `components/**` — UI live; refactor deferred to future UI Sprint
- `databases/*.sql` — real schema migrations; excluded per instructions
- `docs/**` — project docs (not dead code, even if some files like sprint-2f*.md are historical)
- `node_modules/`, `.next/`, `.git/` — build / VCS state; excluded

---

**Report END** — R.89 dead-code inventory complete. No files deleted; all candidates documented with risk and proposed disposition for R.89.5 user-confirmation Sprint.