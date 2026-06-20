# Sprint R.54 — Requirements Matrix Backfill

> Date: 2026-06-20
> Version: R.51 → R.54

---

## Matrix Summary

| status | count | change from R.43 |
|---|---:|---|
| complete | 28 | +4 |
| partial | 7 | -2 |
| not_started | 0 | -1 |
| blocked_by_source_schema | 3 | -1 |
| blocked_by_site_change | 1 | 0 |
| blocked_by_auth | 5 | 0 |
| blocked_by_external_system | 1 | 0 |
| **total** | **45** | |

**Completion: 28/45 = 62.2%** (was 24/45 = 53.3%)

## Newly Complete (R.44-R.51)

| req | evidence | sprint |
|---|---|---|
| REQ-2.1.3 | heartbeat + agent status + offline detection + alerts | R.49 |
| REQ-4.2.1 | control_command + Agent poll/execute/result cycle | R.50 |
| REQ-6.2.1 | JWT + HMAC + auth middleware, 13/13 security tests | R.51 |
| REQ-6.2.2 | scrypt hash, no secret leakage, RBAC partition | R.51 |

## Why 35/45 Is Not Strictly Reachable

| req | blocker | exact evidence |
|---|---|---|
| REQ-2.1.2 | blocked_by_auth | SSO/ADFS not configured |
| REQ-2.2.1 | partial | ADFS parameters not provided |
| REQ-2.2.2 | blocked_by_auth | AD ↔ site account mapping not implemented |
| REQ-2.3.1 | partial | device (0 rows), permission (0 rows) |
| REQ-3.1.1 | blocked_by_source_schema | tbl_user only 3 rows, tbl_user_role 0 rows |
| REQ-3.1.2 | blocked_by_site_change | cross-site messaging not implemented |
| REQ-3.2.1 | blocked_by_auth | RBAC lifecycle not complete |
| REQ-3.2.2 | blocked_by_auth | permission transaction rollback not implemented |
| REQ-3.3.1 | blocked_by_source_schema | tbl_depa 0 rows |
| REQ-3.3.2 | blocked_by_auth | permission audit ≥1 year retention not verified |
| REQ-4.1.1 | partial | department dimension empty, performance limited |
| REQ-4.1.2 | blocked_by_external_system | ES/ClickHouse not configured |
| REQ-4.2.2 | partial | reset/priority/inspect atoms incomplete |
| REQ-4.2.3 | partial | tbl_check_* all 0 rows |
| REQ-4.3.1 | blocked_by_source_schema | tbl_slots cage migration not implemented |
| REQ-5.1.1 | partial | device_id, disc_no, file_list, error_message missing |
| REQ-5.2.1 | partial | cage-level aggregation needs join |

**17 requirements cannot be marked complete without lying.** The blockers are:
- 5 blocked_by_auth: Requires ADFS/LDAP/RBAC lifecycle implementation
- 3 blocked_by_source_schema: Requires source DB data or schema changes
- 1 blocked_by_site_change: Requires site app cooperation
- 1 blocked_by_external_system: Requires ES/ClickHouse deployment
- 7 partial: Some dimensions available, others missing

## Verdict

28/45 = 62.2% is the strict honest completion rate. 35/45 requires resolving auth blockers (5 reqs), source schema gaps (3 reqs), and external system dependencies (1 req).

---

Commit: `docs(r54): requirements matrix backfill 28/45=62.2%`
