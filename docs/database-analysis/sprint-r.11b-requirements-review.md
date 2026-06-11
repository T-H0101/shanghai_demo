# Sprint R.11B Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.11B |
| Sprint 标题 | 同步日志真实导出与完整性摘要 |
| 日期 | 2026-06-11 |
| 对应 requirement 节 | `requirements.md §5.1` |
| 验证人 | Codex |

## 1. Requirement IDs

| Req ID | 原文摘要 | 状态变化 |
|---|---|---|
| REQ-5.1.2 | 日志导出：Excel/CSV + 数字签名 | `not_started` → `partial` |

## 2. Requirement 原始文本

> 支持按查询条件导出 Excel、CSV、JSON；大数据量分片导出；导出文件数字签名；日志默认保存不少于 2 年。

## 3-10. 实现、真实性与缺失件

- 新增 `GET /api/sync/export`，只允许 package、table、scheduler、consistency 四类白名单。
- 真实读取 `sync_package_log`、`sync_table_log`、`sync_scheduler_log`、`sync_consistency_log`。
- 支持 CSV、JSON 和 `siteCode` 过滤；单次最多 5000 条，避免无界查询。
- 响应包含附件文件名、真实数据源、类型、记录数和 SHA-256 内容摘要。
- `/sync` 可选择四类日志并触发真实 CSV 下载。
- 自动 e2e 读取附件正文并重算摘要；浏览器验收选择“一致性日志”后点击导出并出现成功提示。
- 当前验证记录数：package 100、table 199、scheduler 7、consistency 43；SH01 package CSV 9 条。
- SHA-256 是完整性摘要，不是基于证书或私钥的不可抵赖数字签名。
- Mock：无。Simulator：无。DRY_RUN：日志中可包含透明标记，但导出本身是真实读取。
- DB/schema 变更：无。
- 缺失件：Excel、证书数字签名、大数据分片/异步任务、两年留存策略和 `/logs` 页面真实化。

## 11. 完成率

- `partial`：15 → 16。
- `not_started`：7 → 6。
- `complete` 仍为 6，requirements 完成率保持 `6 / 45 = 13.3%`。

## 12. Verdict

`pass`：真实 CSV/JSON 导出与完整性验证完成；未完成项明确保留。

## 13. 提交前检查

- [x] 四类日志均来自中心库真实表
- [x] CSV/JSON、siteCode、记录数和摘要有 e2e
- [x] 前端类型选择与导出点击有浏览器事件验收
- [x] 未把 SHA-256 摘要宣称为完整数字签名
- [x] 未新增表或 secret
