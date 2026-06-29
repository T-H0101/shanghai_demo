# R84-R85 Development Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the development-stage gaps found in `docs/database-analysis/sprint-r84-r85-requirements-review.md` before any production deployment work.

**Architecture:** Keep R.85 as a local ES development loop: `/search` -> `/api/search` -> `SearchPort` -> OpenSearch adapter. Keep R.84 classification shared by all audit scripts so center DB audit, source table audit, and documentation use one table decision set.

**Tech Stack:** Next.js 16, TypeScript, PostgreSQL 17, OpenSearch/ES, pnpm.

---

## Scope

This plan is development-stage only. Production deployment, monitoring, alerting, HA, and runbooks remain R.87+.

Deployment guide location for later production work:

```text
docs/operations/deployment.md
```

## Findings From Review

| Finding | Development fix |
|---|---|
| `audit:center-db` still reported 27 unclassified `tbl_*` tables | Share R.84 `FILE_INDEX_ES_TABLES` with center DB audit |
| `/search` still assumed old `not_implemented` envelope | Map R.85 `opensearch` / `blocked_by_external_system` response correctly |
| `/api/search` lost requirement metadata expected by existing e2e | Return `requirements` and `missingDimensions` in the R.85 envelope |
| `scripts/e2e/test-search.ts` did not accept `opensearch` | Add `opensearch` to accepted source list |
| R.84/R.85 review contained stale numbers and wording | Update 27/29 table counts and replace "control" wording with "search" wording |

## Task 1: Shared R.84 Classification

**Files:**
- Create: `lib/source/source-table-classification.ts`
- Modify: `scripts/audit/classify-source-tables.ts`
- Modify: `scripts/audit/center-db-integrity.ts`

- [x] **Step 1: Create the shared table list**

`lib/source/source-table-classification.ts` exports `FILE_INDEX_ES_TABLES` with all 29 `tbl_file*` / `tbl_folder*` source tables.

- [x] **Step 2: Reuse it in R.84 audit**

`scripts/audit/classify-source-tables.ts` maps `FILE_INDEX_ES_TABLES` into the `file_index_es` classification.

- [x] **Step 3: Reuse it in center DB audit**

`scripts/audit/center-db-integrity.ts` excludes `FILE_INDEX_ES_TABLES` from `unclassified tbl_* tables` and emits `file index ES classified tables: 29/29`.

## Task 2: R.85 Search UI/API Integration

**Files:**
- Modify: `app/api/search/route.ts`
- Modify: `app/search/page.tsx`
- Modify: `scripts/e2e/test-search.ts`

- [x] **Step 1: Restore API requirement metadata**

`/api/search` returns:

```json
{
  "requirements": ["REQ-4.1.1", "REQ-4.1.2", "REQ-5.2.1"],
  "missingDimensions": ["permission_filter_hardening", "incremental_watermark", "production_es_runbook"]
}
```

- [x] **Step 2: Map ES hits for the page**

`/search` maps `sourceSiteId`, `sourceRecordId`, `fileName`, `filePath`, `sizeBytes`, `discCode`, and `updatedAt` into the existing table model.

- [x] **Step 3: Preserve blocked semantics**

When `/api/search` returns `blocked_by_external_system`, `/search` shows the blocker banner and does not show a fake empty-success state.

- [x] **Step 4: Keep site filtering extensible**

The page passes `siteCode` for `SH01` / `BJ02`, and `all` omits `siteCode`.

## Task 3: Review And Documentation Correction

**Files:**
- Modify: `docs/database-analysis/r84-source-table-classification.md`
- Modify: `docs/database-analysis/sprint-r84-r85-requirements-review.md`

- [x] **Step 1: Fix table counts**

Use `file_index_es=29`, not `27`.

- [x] **Step 2: Fix capability wording**

Use "真检索" for `/api/search`; search is not a control capability.

- [x] **Step 3: Update evidence**

Record `audit:center-db` as `21 checks, 0 fail, 1 warn`, with `unclassified tbl_* tables=0`.

## Remaining Development Work

These are not production deployment tasks:

1. R.86: add `file_index_jobs` DDL, watermark, tombstone, retry/dead-letter states.
2. R.86: extend indexer from `tbl_file` sample to the classified file/folder table family.
3. R.88: add `docs/source/site-agent-contract.md` and `docs/operations/site-onboarding-checklist.md`.
4. R.89: inventory dead code before deleting anything.

## Exit Evidence

Development-stage checks already run:

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm audit:classify-source-tables
pnpm audit:center-db -- --strict --matrix
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:search
pnpm e2e:search-r85
pnpm e2e:sync
pnpm e2e:control
pnpm e2e:site-agent-control-core
pnpm e2e:site-agent-sync-core
```

## Handoff Prompt

```text
在 /Users/tian/Desktop/上海 的当前分支继续开发。
先读 AGENTS.md、CLAUDE.md、docs/source/requirements.md、docs/database-analysis/sprint-r84-r85-requirements-review.md、docs/superpowers/plans/2026-06-29-r84-r85-development-completion-plan.md。
当前只做开发阶段，不做生产部署和 R.87 硬化。
保持 tbl_file* / tbl_folder* 走 OpenSearch/ES，不加入 PG 全量同步。
保持 /search -> /api/search -> SearchPort -> OpenSearch adapter 的边界。
不要把 mock、模拟模式、控制队列框架或路线图包装成已落地能力。
下一步优先做 R.86 file_index_jobs、水位、tombstone 和索引器覆盖 29 张 file_index_es 表；再做 R.88 站点接入契约。
完成后跑 tsc/build/audit/search/sync/control 定向检查，并更新 requirements review。
```
