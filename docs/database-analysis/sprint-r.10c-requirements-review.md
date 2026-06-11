# Sprint R.10C Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.10C |
| Sprint 标题 | Users 真实只读化 |
| 日期 | 2026-06-11 |
| 对应 requirement 节 | `requirements.md §3.1`、`§3.2` |
| 验证人 | Codex |

## 1. Requirement IDs

| Req ID | 原文摘要 | 状态 |
|---|---|---|
| REQ-3.1.1 | 账号维度：Site 多对多、部门、角色 | `blocked_by_source_schema` |
| REQ-3.1.3 | 账号创建/启用/禁用/删除 | `blocked_by_auth` |
| REQ-3.2.1 | 站点→设备→数据权限分配 | `blocked_by_auth + blocked_by_source_schema` |

## 2. Requirement 原始文本

> 账号需支持 Site 多对多关系，并关联部门、角色。

> 支持账号创建、启用、禁用、删除等全生命周期管理。

> 权限分配需覆盖站点、设备与数据范围，并由真实认证授权体系保障。

## 3-10. 实现、真实性与缺失件

- `/api/users` 仅查询中心库 `unified_users`，移除 mock fallback。
- `/users` 仅展示真实同步账号字段，当前中心库有 4 条记录。
- 源端 role 是未标准化编码，Site 多对多、部门关系和权限树缺失；页面不推断。
- 移除前端假创建、假封禁、假删除、假密码重置和假权限同步。
- 账号写能力与权限分配明确为 `blocked_by_auth`，不实现 ADFS/JWT/RBAC。
- Mock：Users API/页面已移除。Simulator：无。DRY_RUN：本单元不使用。真后端：`unified_users` 只读。
- DB/schema 变更：无。

## 11. 完成率

- `complete` 仍为 7/45，requirements 完成率仍为 15.6%。
- 三项需求状态保持不变，只修正实现真实性和阻塞证据。

## 12. Verdict

`pass`：Users 页面不再把 mock 权限与 local state 写操作冒充真实能力。

## 13. 提交前检查

- [x] Req ID、原文、状态、后端证据、缺失件已记录
- [x] mock/simulator/DRY_RUN/真后端已区分
- [x] 未实现或暗示 ADFS/JWT/RBAC
- [x] `e2e:users` 覆盖 API 来源、页面读取和 blocker
