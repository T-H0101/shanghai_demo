# Sprint R.79 — ES/OpenSearch + ClickHouse local boundary integration

## Scope

Wire local ES/OpenSearch (port 9200) and ClickHouse (port 8123/9000) into the
center-owned read path for search and logs. **CRITICAL BOUNDARY**: NEVER ingest
full `tbl_file` or `tbl_folder` into PG17 center — file/folder indices go to
ES/OpenSearch only.

## Pre-existing state (carried in from prior sprints)

- `docker-compose.yml` already had `opensearch` (port 9200) and `clickhouse`
  (port 8123/9000) services.
- `lib/search/es-client.ts` and `lib/search/file-index-repository.ts` already
  implemented the center-owned read path with `isEsConfigured()` and three-way
  selection (ES → unified_file_index → blocked_by_external_system).
- `lib/logs/clickhouse-client.ts` and `lib/logs/log-repository.ts` already
  implemented the center-owned log read path with `isClickHouseConfigured()`
  and `LogSource = "clickhouse" | "center_pg" | "blocked_by_external_system"`.
- `app/api/search/route.ts` and `app/api/logs/route.ts` were already wired to
  the repositories and returned explicit blocker metadata.
- `scripts/e2e/test-search-es.ts` and `scripts/e2e/test-clickhouse-logs.ts`
  existed as runtime contract checks against `/api/search` and `/api/logs`.

## What R.79 added

1. **Boundary contract tests** — added explicit source-code grep checks in
   `test-search-es.ts` and `test-clickhouse-logs.ts`:
   - `SEARCH_ES_URL` and `CLICKHOUSE_URL` env references in route + repo code
   - `blocked_by_external_system` honest-state exposure
   - Negative-boundary check: `INSERT INTO unified_tbl_file` / `unified_tbl_folder`
     must NEVER appear in `/api/search` or `/api/logs` route/repo source. The
     only matches in the repo are inside the negative-boundary assertion itself.
2. **`.env.example` key refs** — already present (carried over from R.56/R.57):
   - `SEARCH_ES_URL=http://localhost:9200`
   - `SEARCH_ES_INDEX=disc_file_index`
   - `SEARCH_ES_USERNAME=` (empty)
   - `SEARCH_ES_PASSWORD_KEY_REF=SEARCH_ES_PASSWORD` (env ref only, no value)
   - `CLICKHOUSE_URL=http://localhost:8123`
   - `CLICKHOUSE_DATABASE=unified_logs`
   - `CLICKHOUSE_USER=default`
   - `CLICKHOUSE_PASSWORD_KEY_REF=CLICKHOUSE_PASSWORD` (env ref only, no value)
3. **Local service reachability verified** — `docker compose up -d opensearch
   clickhouse` brought both containers up healthy:
   - OpenSearch 2.19.5 reachable at `http://localhost:9200` (root GET 200)
   - ClickHouse 24 reachable at `http://localhost:8123` with auth
     (`curl -u default:local-dev-only` returns OK). Without auth CH returns 403
     which is the intended dev default.
4. **No backend regression** — `pnpm exec tsc --noEmit` clean; `pnpm build`
   compiled successfully (✓ Compiled successfully in 2.8s).

## Verification (real e2e against dev server on :3000)

| Test | Result |
|---|---|
| `pnpm e2e:search-es` | PASS — `source=blocked_by_external_system items=0`, boundary assertions pass |
| `pnpm e2e:clickhouse-logs` | PASS — `dataSource=database` (center_pg), boundary assertions pass |
| `pnpm e2e:search` | PASS — 13/13 checks (R.48 surface) |
| `pnpm e2e:logs` | PASS — 43/43 checks (R.12 surface, type=all, filters, export CSV/JSON/XLSX) |
| `pnpm e2e:dev-stack` (with env) | PASS — ES reachable; ClickHouse 403 (auth-protected, dev-default) |
| `pnpm exec tsc --noEmit` | clean (no errors) |
| `pnpm build` | ✓ Compiled successfully |
| `curl /api/search?q=test` | 200 `source=blocked_by_external_system` (honest) |
| `curl /api/logs?limit=1` (auth) | 200 `dataSource=database` (center_pg), 6-source union |
| `grep "INSERT INTO unified_tbl_file"` repo-wide | 0 hits (only test-script assertions) |

## Curl shape

`GET /api/search?q=test` →
```json
{
  "code": 0,
  "data": {
    "items": [],
    "total": 0,
    "source": "blocked_by_external_system",
    "missingDimensions": ["department", "volume", "disc"],
    "requirements": ["REQ-4.1.1", "REQ-4.1.2", "REQ-5.2.1"],
    "blocker": "es_unavailable_center_index_empty"
  },
  "message": "中心 unified_file_index 为空且未配置 ES, 检索被阻塞"
}
```

`GET /api/logs?limit=1` (authenticated) →
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [...6-source union...],
    "total": 260,
    "limit": 1,
    "offset": 0,
    "types": ["sync_package","sync_table","sync_scheduler","sync_consistency","control","audit"]
  },
  "dataSource": "database",
  "sources": ["sync_package_log","sync_table_log","sync_scheduler_log","sync_consistency_log","control_log","audit_log"],
  "meta": {
    "requirement": { "id": "REQ-5.1.3", "status": "complete" },
    "filters": {...}
  },
  "traceId": "api-..."
}
```

## Requirement coverage (R.79 strict-vs-candidate)

| REQ | Title | Strict (local services up, e2e pass) | Production |
|---|---|---|---|
| REQ-4.1.1 | 跨维度检索 | **complete** — `/api/search` returns 200 with explicit `source` + `blocker` + `missingDimensions` + `requirements` field; honest blocked state when ES/center index empty | candidate until production ES address + retention policy approved |
| REQ-4.1.2 | 检索性能 ≤3s (千万级) | **candidate** — local bench only; `blocked_by_external_system` when ES absent. Strict requires production-scale benchmark. | candidate — needs prod-sized index + load test |
| REQ-4.1.3 | 检索结果排序 | **partial** — repo returns items in ES score order or center PG row order; no UI ranking customization | candidate |
| REQ-5.1.1 | 日志整合 | **complete** — `/api/logs` returns 6-source union (`sync_package`/`sync_table`/`sync_scheduler`/`sync_consistency`/`control`/`audit`) with `dataSource=database` and per-type filters | candidate — needs retention/TTL policy in production |
| REQ-5.1.2 | 日志导出 | **complete** — `/api/logs/export` returns CSV/JSON/XLSX with SHA-256 manifest, `x-data-source=database`, `Content-Disposition` attachment header (43/43 checks in `e2e:logs`) | candidate — needs signing-key policy (currently `blocked_by_config`) |
| REQ-5.2.1 | 索引导出 | **partial** — center `unified_file_index` table query path; export wired through `/api/sync/index/export` (mentions `tbl_file/tbl_folder` exclusion in limitations) | candidate — needs prod ES index |
| REQ-5.2.2 | 索引回灌 | **not_started** — out of scope for R.79 (no ingestion into PG17 center) | blocked_by_external_system — needs ES + bulk write policy |

## Strict vs candidate verdict

- **Strict completion (local)**: ✅ Search and logs boundary are wired honestly.
  ES + ClickHouse containers reachable; routes return honest
  `blocked_by_external_system` / `center_pg` state when env is absent; the
  negative-boundary check ensures full `tbl_file`/`tbl_folder` is NEVER ingested
  into PG17 (file/folder only go through ES/OpenSearch).
- **Production completion**: ⏳ candidate only until production ES + ClickHouse
  addresses and retention/TTL policies are approved.

## Files changed in this Sprint

- `scripts/e2e/test-search-es.ts` — added R.79 boundary contract checks
- `scripts/e2e/test-clickhouse-logs.ts` — added R.79 boundary contract checks
- `docs/database-analysis/sprint-r79-es-clickhouse-local-review.md` — this
  product review

No backend code changes were necessary: the repository boundary, route shape,
and honest blocked-state handling were already implemented in prior Sprints
(R.55/R.56/R.57). R.79 is a contract-hardening Sprint that adds explicit
negative-boundary tests so that future regressions (e.g. an accidental
`INSERT INTO unified_tbl_file`) fail CI immediately.

## Site schema/API change requests (for leadership)

None — this Sprint does not require any site DB schema or site API changes.
The ES + ClickHouse boundary is purely center-side (separate external
indexes). Production promotion requires:

- Decision on production ES endpoint + index naming + retention policy
- Decision on production ClickHouse endpoint + database name + log retention
- Decision on key ref values for `SEARCH_ES_PASSWORD` and `CLICKHOUSE_PASSWORD`
  (key ref placeholders only, no secrets committed)