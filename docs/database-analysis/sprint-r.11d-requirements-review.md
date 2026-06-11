# Sprint R.11D Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.11D |
| Sprint 标题 | Settings 站点注册与调度状态集成 |
| 日期 | 2026-06-11 |
| 对应 requirement 节 | `requirements.md §2.1.1`、`§6.4.3` |
| 验证人 | Codex |

## 1. Requirement IDs

| Req ID | 原文摘要 | 状态 |
|---|---|---|
| REQ-2.1.1 | 站点配置 | `partial` |
| REQ-6.4.3 | 同步周期与告警阈值页面配置 | `partial` |

## 2. Requirement 原始文本

> 支持站点名称、IP、状态、联系人等配置。

> 支持同步周期、告警阈值等参数页面配置。

## 3-10. 实现、真实性与缺失件

- `/settings` 从 3 个真实接口扩展为 5 个，新增站点注册/派生与每站点最新状态。
- “站点注册/派生来源”展示 `/api/sites` 的 `dataSource` 和具体来源表。
- “中心调度配置”展示 `sync_sites` 周期、凭据键引用、最近调度和一致性状态。
- 页面声明 derived 仅表示从中心业务表发现站点编码，不等同于源端 `tbl_site` 真实注册。
- 浏览器验证当前 7 个 derived 站点、2 个中心调度配置站点；BJ02 为 `not_run`，SH01 为 `partial` / `matched 7/0`。
- 刷新按钮重新请求全部 5 个接口，未出现错误状态。
- 所有写操作继续禁用；不实现 JWT、RBAC、ADFS，不保存 secret。
- Mock：无。Simulator：无。DRY_RUN：状态展示保持透明。DB/schema 变更：无。
- 缺失件：真实 `tbl_site` 注册资料、IP/联系人、配置写 API、权限审计、真实告警阈值来源。

## 11. 完成率

- 两项需求均保持 `partial`。
- requirements 完成率保持 `6 / 45 = 13.3%`。

## 12. Verdict

`pass`：Settings 多站点只读视图真实且 provenance 清晰；写能力未越权实现。

## 13. 提交前检查

- [x] 站点注册/派生与中心调度配置分开展示
- [x] 最近调度和一致性状态来自真实日志
- [x] 无日志使用 `not_run`
- [x] 刷新事件有浏览器验收
- [x] 不返回或保存 secret
