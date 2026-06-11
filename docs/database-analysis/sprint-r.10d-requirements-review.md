# Sprint R.10D Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.10D |
| Sprint 标题 | Racks API fail-closed |
| 日期 | 2026-06-11 |
| 对应 requirement 节 | `requirements.md §2.3`、`§4.3` |
| 验证人 | Codex |

## 1. Requirement IDs

| Req ID | 原文摘要 | 状态 |
|---|---|---|
| REQ-2.3.1 | 同步设备、文件、权限、任务 | `complete` |
| REQ-4.3.2 | 盘笼统一查询：在线/离线与导出 | `partial` |

## 2. Requirement 原始文本

> 同步范围覆盖设备、文件、权限、任务四类数据。

> 支持盘笼统一查询、在线/离线状态查看与导出。

## 3-10. 实现、真实性与缺失件

- `/api/racks` 真实读取 `unified_devices`，当前中心库 13 台，SH01 4 台。
- `apiRackProvider` 的列表、详情和统计移除 mock fallback。
- `/racks` API 模式空集显示 `empty`，失败显示 `error`，不填充 `mockRacks`。
- 浏览器验收 SH01 显示 4 台真实设备，其中 3 在线、1 离线。
- REQ-4.3.2 原标 `complete`，但真实导出未实现；本次修正为 `partial`，不降低需求文本。
- Mock：非 API 演示模式仍保留；API 模式不再 fallback。Simulator：无。DRY_RUN：本单元不使用。
- DB/schema 变更：无。

## 11. 完成率

- `complete` 由 7 调整为 6，`partial` 由 14 调整为 15。
- requirements 完成率从 15.6% 修正为 13.3%。
- 下降来自过度完成声明纠正，不是删除或降低需求。

## 12. Verdict

`pass`：Racks 真实读取链路 fail-closed；导出缺口已显式保留。

## 13. 提交前检查

- [x] Req ID、原文、状态、后端证据、缺失件已记录
- [x] API 模式未使用 mock fallback
- [x] 未把导出“开发中”宣称为完成
- [x] `e2e:racks` 覆盖真实 API、siteCode 与 fail-closed 源码约束
