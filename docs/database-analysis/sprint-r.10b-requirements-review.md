# Sprint R.10B Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.10B |
| Sprint 标题 | Settings 真实只读化 |
| 日期 | 2026-06-11 |
| 对应 requirement 节 | `requirements.md §6.4` |
| 验证人 | Codex |

## 1. Requirement IDs

| Req ID | 原文摘要 | 状态 |
|---|---|---|
| REQ-6.4.2 | 监控 CPU/内存/磁盘/接口 | `partial` |
| REQ-6.4.3 | 关键参数支持页面配置 | `partial` |

## 2. Requirement 原始文本

> 监控：CPU、内存、磁盘、接口可用性等运行指标应可查看。

> 配置：关键参数（同步周期、告警阈值、权限规则、回迁数据有效期）支持页面配置，无需修改代码，降低运维成本。

## 3-10. 实现、真实性与缺失件

- `/settings` 删除 `defaultSettings` mock 和全部前端假写入状态。
- 页面真实读取 `GET /api/sync/config`、`GET /api/system/health`、`GET /api/system/db-health`。
- 仅展示同步周期、启用状态、凭据键引用、env key 名称及是否配置，不返回 secret 值。
- 配置写入、导出、邮件/Webhook 测试、JWT/RBAC/ADFS 和真实告警阈值显式标记 `not_implemented` 或 blocker。
- REQ-6.4.2 仍缺 CPU/内存/磁盘完整指标、历史趋势和告警。
- REQ-6.4.3 仍缺写 API、权限、审计和告警阈值真实来源。
- Mock：已从 Settings 移除。Simulator：无。DRY_RUN：本单元不使用。真后端：3 个只读 API。
- 源端 schema/API 变更：本单元无。

## 11. 完成率

- `complete` 仍为 7/45，requirements 完成率仍为 15.6%。
- 两项需求保持 `partial`，仅补真实 UI 证据，不降低原要求。

## 12. Verdict

`pass`：Settings 不再把 mock/local state 操作冒充真实配置，且安全地展示当前可验证配置与健康状态。

## 13. 提交前检查

- [x] Req ID、原文、状态、后端证据、缺失件已记录
- [x] mock/simulator/DRY_RUN/真后端已区分
- [x] 无 secret 值进入 API、页面或 git
- [x] 前端刷新事件有 `e2e:settings` 覆盖
