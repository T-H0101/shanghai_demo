# Sprint R.39 Requirements Review

> REQ-2.3.2 同步策略, REQ-1.2.1 松耦合, REQ-6.1.3 同步时效
> 日期: 2026-06-20

## A. Requirement 对照

**REQ-2.3.2**: 支持手动全量/增量同步, 管理员触发后 Agent 异步执行
**REQ-1.2.1**: 松耦合: 统一管控平台与站点通过 API/消息队列交互
**REQ-6.1.3**: 单站点增量同步 ≤10s, 全量同步 ≤30min

## B. 交付

| # | 交付 | 文件 |
|---|---|---|
| 1 | sync_full/sync_incremental 命令类型 | lib/control/control-command.ts |
| 2 | site 目标类型 | lib/control/control-command.ts |
| 3 | sync_request_log 表 | databases/sprint-r39/sync-command-types.sql |
| 4 | sync request 服务层 | lib/sync/sync-request.ts |
| 5 | POST /api/sync/trigger | app/api/sync/trigger/route.ts (从 501 重写) |
| 6 | GET /api/sync/trigger | 同上, 查询同步请求列表 |
| 7 | 控制面板标签 | components/tasks/control-command-panel.tsx |

## C. 闭环流程

```
管理员点击 → POST /api/sync/trigger
  → createControlCommand (sync_full/sync_incremental)
  → createSyncRequest (status: command_sent)
  → Agent poll /api/site-control/commands
  → Agent 执行同步, POST /api/sync/package
  → Agent 回写结果
  → sync_request_log 更新为 completed/failed
```

## D. Mock/DRY_RUN 标记

全部 **真实**: control_command 写入, sync_request_log 跟踪, 审计写入。

## E. Verdict

**PASS** ✅
