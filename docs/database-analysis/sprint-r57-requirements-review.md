# Sprint R.57 Requirements Review - ClickHouse Log Repository Boundary

> Date: 2026-06-20
> Status: code path complete; strict-complete pending real CH deployment

---

## Requirement IDs

- REQ-5.1.1 (log management)
- REQ-5.1.3 (log search)

## Backend Reality

| Component | Status | Evidence |
|---|---|---|
| ClickHouse client | complete | `lib/logs/clickhouse-client.ts` HTTP adapter, env-only |
| Log repository | complete | `lib/logs/log-repository.ts` selects clickhouse > center_pg |
| API | complete | `/api/logs` already reads from center PG, repository wired |
| e2e | complete | `scripts/e2e/test-clickhouse-logs.ts` asserts no mock |

## Selection Rule

1. ClickHouse configured + query ok → return `clickhouse` source
2. ClickHouse not configured / error → query center `audit_log` etc → return `center_pg` source
3. Missing dimensions explicitly listed (`device_id`, `disc_no`, `file_list`, `level`) when CH is absent

## UI Reality

- Logs page must show "数据源：总控库 audit_log / 中心 PG 日志" when CH is not deployed
- When CH is deployed, the page must show "数据源：ClickHouse (CLICKHOUSE_URL)"

## Mock / Simulator / DRY_RUN

- No mock. Disabled CH path returns `center_pg` with `missingDimensions` and `blocker`.

## Strict vs Candidate

| Req | Strict | Candidate | Notes |
|---|---|---|---|
| REQ-5.1.1 | partial | complete with CH | log management works for center logs; large native task logs need CH |
| REQ-5.1.3 | complete | complete | log search via /api/logs union |

## Verdict

**partial-pass**: log repository boundary in place. Strict upgrade of REQ-5.1.1 requires a real ClickHouse deployment and ingestion of `task_logs`/`system_logs`.

---

Commit: `feat(r57): add clickhouse log repository boundary`
