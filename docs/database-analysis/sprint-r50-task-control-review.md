# Sprint R.50 — Task Control Atom Closure

> Requirement IDs: `REQ-4.2.1`, `REQ-4.2.2`, `REQ-4.2.3`
> Date: 2026-06-20

---

## A. Action Truth Table (冻结)

| action | 总控 UI | control_command | Agent 支持 | 站点 DB 写入 | 最终 UI 状态 | status |
|---|---|---|---|---|---|---|
| create backup/restore | jump to node | audit only | 站点页面创建 | 无中心 insert | 外部导航 | partial |
| pause | ✅ | ✅ | ✅ | `tbl_task.status=20` 真实写入 | command result | **complete** |
| resume | ✅ | ✅ | ✅ | `tbl_task.status=previousStatus` 真实恢复 | command result | **complete** |
| reset | ✅ | ✅ | ❌ 未实现 | — | — | not_started |
| priority restore | ✅ | ✅ | ❌ 无字段 | — | — | blocked_by_source_schema |
| inspect (巡检) | ✅ | ✅ | ❌ 无源数据 | — | — | blocked_by_source_schema |

## B. 实现证据

### Pause (REQ-4.2.2)

**文件**: `lib/site-agent/control/postgres-adapter.ts`
- `SELECT id, task_type, status FROM tbl_task WHERE id = $1 FOR UPDATE` (行锁)
- 检查 `allowedRunningStatuses(taskType)` — 只允许运行中的任务暂停
- `UPDATE tbl_task SET status = 20, update_dt = NOW()` (status=20 = paused)
- 返回 before/after 快照

### Resume (REQ-4.2.2)

**文件**: `lib/site-agent/control/postgres-adapter.ts`
- 从 `PauseState` 恢复 `previousStatus`
- 检查 `before.status === 20` (必须是 paused)
- `UPDATE tbl_task SET status = $previousStatus` (恢复原状态)

### Unsupported actions

**文件**: `lib/site-agent/control/coordinator.ts:93-100`
- 未知命令类型返回 `{ status: "unsupported", blocker: "unsupported_command_type" }`
- 不伪造成功

## C. 缺失项

| 缺失 | 原因 | 需要 |
|---|---|---|
| reset | 语义未定义 (重置到哪个状态?) | 领导定义 reset 语义 |
| priority restore | `tbl_task` 无 `priority` 字段 | `ALTER TABLE tbl_task ADD COLUMN priority SMALLINT` |
| inspect (巡检) | `tbl_check_patrol_task` 0 行, 无校验源 | 站点巡检系统配合 |

## D. Verdict

- **REQ-4.2.1** (任务控制框架): **complete** — control_command 队列 + Agent poll + execute + result 回传
- **REQ-4.2.2** (暂停/恢复): **complete** — pause/resume 真实写入 `tbl_task.status`
- **REQ-4.2.3** (巡检): **blocked_by_source_schema** — `tbl_check_*` 全部 0 行

---

Commit: `docs(r50): freeze task control action truth table [REQ-4.2.1,REQ-4.2.2,REQ-4.2.3]`
