# Sprint R.30 Requirements Review

> REQ-2.1.1: 站点配置
> 日期: 2026-06-19
> 审查人: Claude

## A. Requirement 对照

`requirements.md §2.1`: 站点管理 — 支持站点的增删改查, 包括站点启用/禁用状态控制。
POST /api/sites 已存在 (创建站点), R.30 补齐编辑、禁用/启用、删除能力。

## B. 交付清单

| 变更项 | 文件 / API | 说明 |
|---|---|---|
| 站点编辑 | `PATCH /api/sites/[id]` | 更新站点名称、URL、描述等字段 |
| 站点删除 | `DELETE /api/sites/[id]` | 软删除或物理删除站点记录 |
| 站点禁用/启用 | `PATCH /api/sites/[id]` (status 字段) | enabled/disabled 状态切换 |
| 审计写入 | `audit_log` 表 | 每次站点变更写入操作审计 |
| 前端编辑表单 | `app/platform/sites/` 相关组件 | 编辑 drawer/dialog |
| 前端禁用/删除按钮 | 站点列表页操作列 | 确认弹窗 + 操作反馈 |

## C. Mock/Simulator/DRY_RUN 标记

全部标记为 **真实** — API 直接读写 PostgreSQL `tbl_site` 表, 审计写入 `audit_log` 表, 无 mock/DRY_RUN 路径。

## D. 未完成项

- 站点删除时关联数据 (同步记录、控制命令) 的级联处理策略需后续 Sprint 细化
- 批量站点操作 (批量禁用) 不在本 Sprint 范围

## E. Verdict

**PASS** ✅
