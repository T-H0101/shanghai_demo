# Sprint R.19E Frontend Integration Design

## Requirement Mapping

- `REQ-4.2.4`: 任务状态、进度和控制结果应在统一任务管理中查看。
- `REQ-6.3.1`: 前端需保持企业级桌面端兼容和清晰的信息层级。

## Problem

- `/tasks` 与 `/control` 分成两个一级入口，任务操作和命令结果割裂。
- 顶部搜索框没有提交事件，看起来可用但实际无行为。
- `/control` 仍展示旧的“站点 app 无 evidence”说明，与 R.19D Agent 现实不一致。

## Decision

1. `/tasks` 增加“任务列表 / 控制命令”双视图。
2. 控制命令视图读取真实 `GET /api/control/commands`，保留 5 秒刷新、筛选和最终状态。
3. 侧栏删除重复的 `/control` 一级入口。
4. `/control` 保留兼容路由，服务端重定向到 `/tasks?view=commands`。
5. 顶部无事件搜索框替换为明确的“统一检索（待 ES）”入口，点击真实导航到 `/search`。
6. 不新增 API、数据库表或业务页面，不改变现有蓝色/灰色视觉体系。

## Truth Boundary

- 控制命令列表是真实中心库数据，不代表所有控制动作都已完成。
- pause/resume 可展示 Agent 最终结果；reset/priority/inspect/recovery 仍按实际状态显示。
- 统一检索入口可访问，但页面继续明确 `blocked_by_external_system`，不伪造检索结果。

## Event Tests

- `/control` 返回重定向，目标为 `/tasks?view=commands`。
- `/tasks?view=commands` 可访问。
- 侧栏无重复 `/control` 链接。
- 任务中心存在两个视图按钮和真实命令面板。
- 顶部检索入口存在点击导航，旧无事件输入框不存在。
