# R.94 Final Acceptance Closeout Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the merged `main` branch is a local-development deliverable candidate that leadership can deploy for testing without overstating production readiness.

**Architecture:** R.94 does not add new business capabilities. It strengthens acceptance evidence, cleans obsolete entrypoints, confirms from-zero local deployment, and documents exact blocker boundaries against `docs/source/requirements.md`.

**Tech Stack:** Next.js 16, React 19, PostgreSQL 17 via Docker, OpenSearch local profile, pnpm scripts.

---

## Task 1: Branch, Baseline, And Plan Record

**Files:**
- Create: `docs/superpowers/plans/2026-06-30-r94-final-acceptance-closeout.md`
- Modify: `docs/database-analysis/sprint-r94-final-acceptance-review.md`

- [ ] Create branch `codex/r94-final-acceptance-closeout` from merged `main`.
- [ ] Record this plan in `docs/superpowers/plans/2026-06-30-r94-final-acceptance-closeout.md`.
- [ ] Keep all claims tied to fresh command output from this branch.

## Task 2: Product Copy Audit Hardening

**Files:**
- Modify: `scripts/audit/product-copy.ts`
- Verify: `pnpm audit:product-copy`

- [ ] Extend product-copy audit to scan API response strings that are rendered by pages, starting with `/api/sync/config`.
- [ ] Fail on user-visible or API-visible text containing `不代表源端`, `tbl_site`, `source_restore`, `pg_dump`, `dispatcher`, `页面只宣称`, `状态来源`, `对应需求`, `凭据键引用`.
- [ ] Keep code-only occurrences as WARN, not FAIL, but list them in the final R.94 review.

## Task 3: Obsolete Script Cleanup

**Files:**
- Modify: `package.json`
- Modify: `docs/archive/DEPLOYMENT_GUIDE-sprint3.md` or R.94 review if historical note is needed

- [ ] Remove obsolete `test:r83.*:ui` echo scripts from `package.json`.
- [ ] Do not remove evidence docs, ADRs, requirements reviews, current e2e, or package scripts still used by README/deployment.
- [ ] Confirm no README/deployment/current gate references those obsolete scripts.

## Task 4: Docs And Requirements Review

**Files:**
- Modify: `README.md`
- Modify: `docs/operations/deployment.md`
- Modify: `docs/summary/PROJECT_STATUS.md`
- Modify: `docs/summary/ROADMAP.md`
- Create: `docs/database-analysis/sprint-r94-final-acceptance-review.md`

- [ ] Mark R.93 as merged baseline and R.94 as final development acceptance.
- [ ] Document requirements status by module: complete, partial, blocked, or out of scope.
- [ ] Keep blockers explicit: real task execution, enterprise SSO/RBAC, production cron/monitoring/HA.
- [ ] Include from-zero deployment evidence and page-copy audit evidence.

## Task 5: From-Zero Local Deployment Verification

**Commands:**
```bash
pnpm env:init --force
pnpm env:check
pnpm db:down:volumes
pnpm db:up
pnpm db:init
pnpm smoke:sync
pnpm export-and-push SH01
pnpm export-and-push BJ02
pnpm e2e:login
pnpm e2e:sync
pnpm e2e:racks
pnpm e2e:volumes
```

- [ ] Confirm admin seed exists and `admin / admin` logs in locally.
- [ ] Confirm `auth_accounts`, `sync_sites`, `file_index_jobs`, `control_command`, and R.93 identity migration exist after `pnpm db:init`.
- [ ] Confirm `TEST_SMOKE` leaves no center DB pollution.
- [ ] Confirm page business data comes from `export-and-push SH01/BJ02`, not from smoke residue.

## Task 6: Sync, Multi-Site, And ES Verification

**Commands:**
```bash
pnpm export-and-push SH01
pnpm export-and-push BJ02
pnpm check:sync-consistency -- --siteCode=SH01
pnpm check:sync-consistency -- --siteCode=BJ02
docker compose -f docker-compose.search.yml --env-file .env.local up -d
pnpm import:file-index-job-bootstrap -- --sites SH01
pnpm import:file-index-job-runner -- --site SH01 --table tbl_file --batch 100
pnpm e2e:search-r85
pnpm e2e:search-es
```

- [ ] Confirm center tables are bucketed by `source_site_id`.
- [ ] Confirm ES is local-development ready, while production cron/monitoring/dead-letter replay remains R.87.

## Task 7: Final Gate And Commit

**Commands:**
```bash
git diff --check origin/main...HEAD
pnpm env:check
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm cleanup:test-pollution
pnpm baseline:check
pnpm audit:center-db -- --strict --matrix
pnpm audit:classify-source-tables
pnpm audit:data-coverage
pnpm audit:page-scope
pnpm audit:product-copy
pnpm audit:api-mode-no-fallback
pnpm audit:page-no-todo
pnpm e2e:sync
pnpm e2e:racks
pnpm e2e:volumes
pnpm e2e:users
pnpm e2e:sites
pnpm e2e:logs
pnpm e2e:settings
pnpm e2e:route-page-integration
pnpm e2e:command-palette
pnpm e2e:security-boundaries
pnpm e2e:search-r85
pnpm e2e:search-es
```

- [ ] If all required gates pass, commit with `docs(r94): final acceptance closeout`.
- [ ] Do not claim production deployment complete.
