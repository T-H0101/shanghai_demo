# ADR 0003: Site Agent Pull-Based Control

> Status: Accepted (Sprint 4.5 / reaffirmed R.85)
> Date: 2026-06-29 (reaffirmed); original 2026-06 Sprint 4.5
> Deciders: platform + 站点运维
> Requirements: `requirements.md §4.2 任务管理`

## Context

`requirements.md §4.2` 要求支持 6 个原子动作: 新建 / 暂停 / 恢复 / 重置 / 巡检 / 恢复任务。

中心服务不能直接 INSERT 站点库的 `tbl_task` (DB 写权限通常不开放给中心; 即使开放, 也会破坏站点 ACID 事务)。

当前实现:

- 总控提交命令 → `control_command` 写入 (✅ 中心有 audit_log)。
- 站点 app poll / 读新行 (❌ 无应用代码 evidence, 阻塞中)。
- 站点执行, 状态回写 `tbl_task.status` / `tbl_task.paused` (❌ 170 张表扫描 0 命中 `paused` / `priority` 字段, schema 阻塞)。
- 总控 audit + UI 展示最终状态 (⚠️ partial, audit_log 有但 final state 未回写)。

## Decision

- **中心 = 命令队列 + 审计**: 中心只把命令写到 `control_command` 表, 并通过 `AuditPort` 写 audit_log。
- **站点 = 拉取 + 执行 + 回写**: 站点 app/Agent 周期 poll `control_command` 新行, 执行后调用 `/api/site-control/commands/[id]/result` 回写最终状态。
- **pull-based 是契约**: 不允许中心反向 push 到站点数据库。中心只暴露 pull endpoint 给站点。
- **schema 由站点配合**: 真实控制完成需要 `tbl_task` 加 `paused BOOLEAN` / `priority SMALLINT` 字段, 由站点运维决策, 中心提交 DDL patch 建议清单 (CLAUDE.md 附录 A)。
- **未取得应用代码 evidence 之前**: `requirements.md §4.2` 继续保持 `partial` + `blocked_by_source_schema` + `blocked_by_site_change`, **禁止**宣称 "任务控制已完成"。

## Consequences

### Positive

- 中心不写站点 DB, 不破坏站点 ACID 事务。
- 站点断连时, 中心命令排队; 站点恢复后自动 poll 执行。
- 站点 app 拥有本地事务边界, 失败回滚由站点自己负责。
- 凭据由站点 app 持有, 中心永远不存 `SITE_DATABASE_URL` 明文。

### Negative

- 必须有站点 app 才能跑端到端, 当前没有第二个生产站点的 app 接入。
- 真实控制完成依赖 `tbl_task.paused` / `tbl_task.priority` schema 配合, 需要站点运维决策。

### Compliance

- ✅ `lib/sync/control-command.ts` / `control_command` 表存在。
- ✅ audit_log 写入路径存在 (`AuditPort` R.87 收敛)。
- ❌ 站点 app poll 代码不存在 (阻塞)。
- ❌ `tbl_task.paused` / `tbl_task.priority` 不存在 (阻塞, 170 张表扫描 0 命中)。
- ✅ CLAUDE.md 附录 A 已记录 schema patch 清单。

## Follow-ups

- R.86: `SiteAgentPort` + 站点 control command 拉取 adapter。
- R.88: `docs/operations/site-onboarding-checklist.md` + `docs/source/site-agent-contract.md`。
- 由领导决策: 是否启动第二个生产站点 app 接入 (跨站集群验证 §1.2)。

## Notes

CLAUDE.md §四 已经明确记录当前状态:

> 任务控制目前未真正完成, 标记 partial / blocked_by_source_schema / blocked_by_site_change。真实完成需站点表加字段 + 站点 app 配合, 由领导决策。

本 ADR 不改变该结论。
