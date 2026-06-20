# Sprint R.68 Requirements Matrix Backfill to 45/45 Candidate

> Date: 2026-06-20
> Status: 29/45 strict, 45/45 candidate

---

## Completion Formula

```
complete / (total - out_of_scope) * 100%
```

## Strict Verified Completion

| metric | before R.55 | after R.68 |
|---|---:|---:|
| complete | 28 | 29 |
| partial | 7 | 6 |
| blocked_by_source_schema | 3 | 3 |
| blocked_by_site_change | 1 | 1 |
| blocked_by_auth | 5 | 5 |
| blocked_by_external_system | 1 | 1 |
| **strict completion** | **28/45 = 62.2%** | **29/45 = 64.4%** |

The single +1 strict upgrade this round is **REQ-2.3.1** (synchronization range) — R.55 dump sync writes small whitelisted tables, and the center read path is now bounded to `unified_*` / ES / ClickHouse (no direct restore DB reads from product APIs).

## Implemented Candidate Completion

| Status | Count | Reqs |
|---|---:|---|
| strict `complete` | 29 | R.55-R.63 evidence |
| strict `partial` | 6 | some dimensions available, others blocked by source schema / external system |
| `blocked_by_source_schema` | 3 | tbl_depa empty, tbl_device_device empty, no cage move table |
| `blocked_by_site_change` | 1 | site app / cross-site messaging not implemented |
| `blocked_by_auth` | 5 | ADFS / LDAP / RBAC lifecycle / enterprise SSO |
| `blocked_by_external_system` | 1 | ES / ClickHouse deployment |
| **candidate total** | **45/45** | every req has a concrete code path or a candidate boundary |

## Evidence

- `pnpm exec tsc --noEmit` — pass
- `pnpm build` — pass
- `pnpm smoke:sync` — pass
- `pnpm baseline:check` — pass (R.55 update: search returns `es | unified_file_index | blocked_by_external_system`)
- new e2e: `e2e:sync-dump`, `e2e:sync-dump-parser`, `e2e:search-es`, `e2e:clickhouse-logs`, `e2e:task-create-control`, `e2e:dev-stack`, `e2e:worst-case`

## Strict vs Candidate Rule

- Strict number stays evidence-based.
- Candidate number is `45/45` because every requirement now has a concrete code path or a clearly labeled candidate boundary. The candidate count is the maximum reach of the codebase today; strict requires real ADFS/LDAP, ES/CH deployment, populated source tables, and a real station that accepts the jump token.

## Verdict

**29/45 strict = 64.4%**. **45/45 candidate**. The plan's R.55-R.68 work delivered the architectural baseline (center-owned read path, dump sync protocol, ES/CH boundary, center task control, cage move, enterprise auth candidate, RBAC candidate, worst-case guard) and pushed strict completion by 1.

---

Commit: `docs(r68): report strict and candidate requirements completion`
