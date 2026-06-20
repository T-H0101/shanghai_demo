# Sprint R.58 Requirements Review - Center-Created Station Task Control

> Date: 2026-06-20
> Status: command queue + adapter complete; strict-complete pending real station agent run evidence

---

## Requirement IDs

- REQ-4.2.1 (task management — create)
- REQ-1.2.1 (unified station access)

## Backend Reality

| Component | Status | Evidence |
|---|---|---|
| command_type "task_create" | complete | `lib/control/control-command.ts` COMMAND_TYPES |
| center service | complete | `lib/control/task-create.ts` createCenterTaskCommand |
| API route | complete | `app/api/tasks/create/route.ts` POST → 202 with queue wording |
| station adapter | complete | `lib/site-agent/control/task-create-adapter.ts` real INSERT into tbl_task |
| coordinator wiring | complete | `lib/site-agent/control/coordinator.ts` task_create branch |
| audit | complete | writeAudit task_create_queued |
| e2e | complete | `scripts/e2e/test-task-create-control.ts` |

## UI Reality

- Tasks page must show "任务创建命令已提交到控制队列, 等待站点 Agent 执行" after submit
- Must not say "创建成功" / "已创建" / "跳转站点"
- User must stay on the center platform; no station redirect

## Mock / Simulator / DRY_RUN

- Adapter inserts a real row into station `tbl_task` (or returns
  `blocked_by_source_schema` if columns are missing). No DRY_RUN path.

## Strict vs Candidate

| Req | Strict | Candidate | Notes |
|---|---|---|---|
| REQ-4.2.1 (create) | complete (with running agent evidence) | complete | real station INSERT + sync-back |
| REQ-1.2.1 | complete | complete | unified access from center |

## Verdict

**partial-pass**: command + adapter in place. Strict `complete` for
REQ-4.2.1 create path requires running the e2e end-to-end with a
live Site Agent that actually performs the INSERT; until then the
e2e logs a `skipped` warning if no row is found.

---

Commit: `feat(r58): create station tasks from center control`
