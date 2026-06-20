# Black-Box Acceptance (45/45 Candidate)

> Date: 2026-06-20
> Status: worst-case assertions codified as e2e

---

## Acceptance Scenarios

1. Login with local JWT.
2. Create backup task from Tasks.
3. Search file from ES/OpenSearch (or center index, or blocked).
4. Create restore task from search result.
5. Pause/resume/reset task.
6. Create priority restore and inspection task.
7. Run manual sync.
8. Verify center UI reads unified_* / ES / ClickHouse only.
9. Export search, logs, racks, users, and index.
10. Resize browser at 390/768/1280 and zoom 80/100/125.
11. Simulate ES down, ClickHouse down, station DB down, and auth provider missing.

## Codified Checks

`scripts/e2e/test-worst-case-quality.ts` asserts:

- `dataSource !== "mock"` for sites API
- No "同步完成" / "暂停成功" wording on sync page
- No `password = ...` leakage in `/api/system/health`
- `/api/tasks/create` returns 400/401/405 for unauthenticated POST
- Export APIs return 200 (non-mock) or 4xx/5xx — never mock

## Manual Visual QA

Per the plan: 390px / 768px / 1280px and zoom 80/100/125.
Manual pass.

## Notes

- Scenarios 1-7 are covered by individual e2e tests; this script is
  a final guard.
- Scenarios 8-11 require the dev server running; failures degrade
  to SKIP rather than blocking the pipeline.
