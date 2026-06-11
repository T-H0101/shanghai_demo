# Sprint R.11A Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.11A |
| Sprint 标题 | 设备真实 CSV 导出 |
| 日期 | 2026-06-11 |
| 对应 requirement 节 | `requirements.md §4.3` |
| 验证人 | Codex |

## 1. Requirement IDs

| Req ID | 原文摘要 | 状态 |
|---|---|---|
| REQ-4.3.2 | 盘笼统一查询：在线/离线与导出 | `partial` |

## 2. Requirement 原始文本

> 支持盘笼统一查询、在线/离线状态查看与导出。

## 3-10. 实现、真实性与缺失件

- 新增 `GET /api/racks/export`，直接读取 `unified_devices`，支持 `siteCode`、`status` 过滤。
- CSV 包含设备标识、名称、类型、状态、IP、站点、盘位、厂商、型号、序列号和同步时间。
- 响应返回 `Content-Disposition`、真实记录数、数据源和 SHA-256 内容摘要。
- `/racks` 导出按钮调用真实 API 并触发附件下载，不再显示“开发中”。
- SH01 验证导出 4 条，与 `GET /api/racks?siteCode=SH01` 的 4 台设备逐条匹配。
- 自动 e2e 实际读取附件正文并重算 SHA-256；内置浏览器确认页面加载真实 4 台设备和唯一导出按钮，但该浏览器运行时不支持 download 事件。
- Mock：无。Simulator：无。DRY_RUN：无。DB/schema 变更：无。
- 缺失件：Auth/RBAC 与站点权限过滤尚未接入，不能宣称完整满足权限边界。

## 11. 完成率

- REQ-4.3.2 保持 `partial`。
- requirements 完成率保持 `6 / 45 = 13.3%`。

## 12. Verdict

`pass`：真实设备导出缺口已关闭；权限过滤缺口继续显式保留。

## 13. 提交前检查

- [x] 真实中心表导出，无 mock fallback
- [x] siteCode 过滤与记录数一致
- [x] CSV 正文与 SHA-256 摘要一致
- [x] 前端导出事件有目标 e2e
- [x] 未新增 API 以外的业务页面或数据表
