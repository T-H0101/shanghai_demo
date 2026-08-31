# Sprint R.101 — 站点预警同步修复与跨站只读列表

## Requirement IDs

- REQ-2.1 站点监控 / 告警相关（站点运行与异常可见）— `partial`
- 站点业务表 `tbl_early_warning` 镜像展示（非 SRS「调度/平台告警」同一对象）

## Requirement 原始文本（摘录）

> 站点监控：1. 实时监控站点系统运行状态、光盘库、离线库硬件节点状态；2. 站点离线/硬件异常时自动触发告警，通知相关责任人。

本 Sprint **不宣称** 完成「自动通知责任人」；仅完成站点预警表跨站只读可见。

## Implementation

| 项 | 内容 |
|---|---|
| 同步映射 | `lib/sync/package-dispatcher.ts`：`type→warning_type`，`s_level→warning_level`，`title→message`，`create_date→triggered_at`，`status`/`lib_id`；反馈 `early_warning_id→warning_id`，`content→feedback_text`，`user_name` |
| DDL | `databases/sprint-r101/01-early-warning-columns.sql`；已登记 `init-docker.sh` |
| API | `GET /api/early-warning` 支持 siteCode/type/status/level/keyword + warningId 拉反馈 |
| UI | `/early-warning` 只读列表；侧栏「站点预警」；控制台告警文案改为「调度告警」 |

## Backend reality

- 中心库 `unified_early_warnings` / `unified_early_warning_feedbacks` 真表 upsert（推包后）
- **映射修复前**历史行投影列可能为空；需站点重新推送 `tbl_early_warning` / feedback
- **无**总控写回站点状态；无站点 poll 处理

## UI reality

- 列表/详情/反馈只读；文案标明处理在站点
- 未提供「预警处理」按钮（避免误导）

## Mock / Simulator / DRY_RUN / 真控制

| 能力 | 标记 |
|---|---|
| 列表读取中心镜像 | 真实（依赖同步） |
| 预警处理写回 | **未做** |
| 与 `/api/alerts` 调度告警 | **分离** |

## Missing pieces

- 自动推送通知责任人（邮箱/AD）
- 总控处理写回站点 API
- 历史脏数据自动回填（需重推）

## Blocker type

- 通知与写回：`blocked_by_site_change` / 范围外本 Sprint
- 展示链路：依赖站点推包 — 映射已修复

## Verdict

`partial` — 同步字段对齐 + 跨站只读列表完成；处理/通知未宣称完成。

## 是否允许 commit

- 前端变更已披露：新增 `/early-warning` 页面与侧栏入口（需求主线：跨站预警可见）
- 禁止项无违反（无假「处理成功」toast）
- 本地：`tsc --noEmit`、DDL/display self-check 通过
- 部署：需执行 R.101 DDL（或 `pnpm db:init`）后重新同步预警表
