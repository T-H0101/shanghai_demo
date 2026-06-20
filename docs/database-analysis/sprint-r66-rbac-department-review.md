# Sprint R.66 Requirements Review - RBAC Department Permission Sync Candidate

> Date: 2026-06-20
> Status: code path complete; strict-complete pending real station auth

---

## Requirement IDs

- REQ-3.2.1 (enterprise RBAC assignment)
- REQ-3.2.2 (permission transaction sync/rollback)
- REQ-3.3.1 (department)
- REQ-3.3.2 (permission audit)

## Backend Reality

| Component | Status | Evidence |
|---|---|---|
| RBAC model | complete | `lib/auth/rbac-policy.ts` (site/device/volume/dept, role inheritance, deny-by-default) |
| Permissions API | implemented_candidate | `app/api/auth/permissions/route.ts` |
| Departments API | implemented_candidate | `app/api/auth/departments/route.ts` (tbl_depa empty) |
| Permission sync API | implemented_candidate | `app/api/auth/permission-sync/route.ts` |
| Audit | complete | writeAudit permission_sync_queued |

## Behavior

- All three APIs return `status: implemented_candidate` with explicit blockers.
- RBAC evaluation logic is data-driven and produces real
  allow/deny decisions based on the current user's role.
- The department endpoint detects the empty `tbl_depa` and reports it
  as the blocker; it does not return a fake empty list.

## Strict vs Candidate

| Req | Strict | Candidate | Notes |
|---|---|---|---|
| REQ-3.2.1 | blocked_by_auth | implemented_candidate | RBAC UI/API present, station enforcement pending |
| REQ-3.2.2 | blocked_by_auth | implemented_candidate | transaction+rollback logic in code; station auth schema missing |
| REQ-3.3.1 | blocked_by_source_schema | implemented_candidate | tbl_depa empty |
| REQ-3.3.2 | blocked_by_auth | implemented_candidate | audit writes work; enterprise RBAC changes pending |

## Verdict

**partial-pass**: code complete and honest about blockers. Strict `complete` requires real station auth schema + populated `tbl_depa`.

---

Commit: `feat(r66): add rbac department permission candidate`
