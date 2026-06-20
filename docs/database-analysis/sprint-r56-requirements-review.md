# Sprint R.56 Requirements Review - ES/OpenSearch File Index Boundary

> Date: 2026-06-20
> Status: code path complete; strict-complete pending real ES deployment

---

## Requirement IDs

- REQ-4.1.1 (cross-dimension search)
- REQ-4.1.2 (search performance)
- REQ-5.2.1 (index export)

## Backend Reality

| Component | Status | Evidence |
|---|---|---|
| ES client | complete | `lib/search/es-client.ts` HTTP adapter, env-only config |
| Repository | complete | `lib/search/file-index-repository.ts` selects es > unified_file_index > blocked |
| API | complete | `app/api/search/route.ts` uses repository |
| Audit-only restore reader | retained | `lib/source/file-index-source.ts` (bounded, audit-only) |
| e2e disabled test | complete | `scripts/e2e/test-search-es.ts` asserts no `site_restore_db` source |

## Selection Rule

1. ES configured and reachable → query ES
2. ES not configured / query empty → query center `unified_file_index`
3. Both unavailable → return `blocked_by_external_system` with `blocker: es_unavailable_center_index_empty`

## UI Reality

- Racks/Search/Settings pages must show "数据源：总控库 unified_X" + optional "最近同步来源：SH01 restore 测试库".
- Never display "数据来自 site_restore_db" as a product source.

## Mock / Simulator / DRY_RUN

- No mock fallback. Disabled ES path returns `blocked_by_external_system`.

## Strict vs Candidate

| Req | Strict | Candidate | Notes |
|---|---|---|---|
| REQ-4.1.1 | complete | complete | cross-dimension search via ES or center index |
| REQ-4.1.2 | blocked_by_external_system | complete with ES deployed | performance evidence requires real ES |
| REQ-5.2.1 | partial | complete with ES or center index | export wired through repository |

## Verdict

**partial-pass**: ES boundary code is complete and the audit-only fallback is bounded. Strict upgrade of REQ-4.1.2 requires a real ES deployment and benchmark.

---

Commit: `feat(r56): add es-backed file search boundary`
