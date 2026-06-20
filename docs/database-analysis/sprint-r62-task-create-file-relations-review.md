# Sprint R.62 Requirements Review - Task Create with File Relations

> Date: 2026-06-20
> Status: adapter supports relation discovery; strict-complete pending real station

---

## Requirement IDs

- REQ-4.2.1 (task management — create with file relations)

## Backend Reality

| Component | Status | Evidence |
|---|---|---|
| Adapter with relation discovery | complete | `lib/site-agent/control/task-create-adapter.ts` |
| API accepts fileRefs | complete | `app/api/tasks/create/route.ts` |
| Service passes fileRefs | complete | `lib/control/task-create.ts` |
| Coordinator routes | complete | `lib/site-agent/control/coordinator.ts` task_create branch |

## Discovery Order

```
tbl_task_items
tbl_task_folder
tbl_task_files
tbl_file_path_restore
tbl_file_recover_info
```

If none exists, the adapter returns `blocked_by_source_schema` with
reason `no_relation_table_found`. It does not silently drop the
relation requirement.

## Strict vs Candidate

| Req | Strict | Candidate | Notes |
|---|---|---|---|
| REQ-4.2.1 (create with relations) | partial | complete | adapter is in place; full strict-complete needs a station DB where one of the relation tables exists |

## Verdict

**partial-pass**: code path complete. The adapter will succeed when
run against a station DB that has at least one of the five relation
tables. If none is present, the response is an explicit
`blocked_by_source_schema`, not a fake success.

---

Commit: `feat(r62): create backup and restore tasks with file relations`
