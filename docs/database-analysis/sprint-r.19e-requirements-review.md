# Sprint R.19E Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint R.19E` |
| Sprint 标题 | 任务与控制前端信息架构整合 |
| 日期 | 2026-06-15 |
| 对应 requirement 节 | `requirements.md §4.2 / §6.3` |
| 关联设计 | `docs/superpowers/specs/2026-06-15-r19e-frontend-integration-design.md` |
| 验证方式 | TypeScript、HTTP、API、静态事件检查、全量 E2E |

## 1. Requirement IDs

| Req ID | 状态 |
|---|---|
| REQ-4.2.4 任务监控与提醒 | `partial` |
| REQ-6.3.1 前端兼容 | `partial` |

## 2. Requirement 原始文本

> 核心：实现统一任务管理（新建备份/恢复任务、任务暂停/重置 ）、任务查看、任务监控与提醒，提升任务管理效率。

> 1\. 查看与监控所有刻录、回迁任务的执行进度、状态；2. 任务完成/失败/超时自动推送提醒至责任人（AD账号绑定的邮箱）；3. 任务异常（失败/超时）自动触发告警。4.支持刻录成功或失败的详细日志导。

> 前端兼容：支持Chrome/Firefox/Edge最新版，兼容分辨率≥1920×1080，适配不同终端显示；刻录与回迁任务区分展示，界面适配。

## 3. Implementation

| 范围 | 实现 |
|---|---|
| 任务中心 | `/tasks` 增加“任务列表 / 控制命令”URL 驱动双视图 |
| 控制结果 | 新增 `ControlCommandPanel`，读取真实 `/api/control/commands`，5 秒刷新 |
| 导航 | 侧栏移除重复 `/control` 一级入口 |
| 兼容 | `/control` 服务端 307 到 `/tasks?view=commands` |
| 顶部检索 | 删除无事件输入框，改为真实 `/search` 导航并标“待 ES” |
| 测试 | 新增 `e2e:frontend-integration` 并纳入 `e2e:all` |

未新增 API、业务页面、数据库表或字段。

## 4. Backend Reality

- 控制视图读取中心库 `control_command` 的真实 API 数据。
- pause/resume 的最终 `success/failed` 来自 R.19D Site Agent result。
- 历史 DRY_RUN 和 unsupported 记录继续显式区分。
- 本 Sprint 只调整前端信息架构，不增加控制动作能力。

## 5. 前端变更 8 项披露

| 项 | 结果 |
|---|---|
| 新增页面/组件 | 新增任务内嵌 `ControlCommandPanel`；无新页面 |
| 修改按钮/交互 | 新增任务/命令视图切换；顶部检索入口真实导航 |
| 删除按钮/交互 | 删除侧栏重复控制入口；删除顶部无事件输入框 |
| UI-only | 视图切换和布局整合 |
| 真实后端能力 | 控制面板读取真实 API，并展示最终状态 |
| simulator/DRY_RUN | 不执行 simulator；只如实展示历史状态 |
| 需求外新增 | 无 |
| 误导检查 | 检索入口明确“待 ES”；控制说明区分已支持和 unsupported |

## 6. 事件测试 10 项

| 检查项 | 证据 |
|---|---|
| 点击元素 | `task-view-tasks`、`task-view-commands`、`global-search-entry` |
| 点击前状态 | 任务中心默认任务列表 |
| API | 命令视图 GET `/api/control/commands` |
| API 返回 | `ok=true`，真实 rows |
| DB 变化 | 本 Sprint 只读，无 DB 写入 |
| 页面刷新 | 命令视图每 5 秒刷新 |
| toast | 无新增 toast |
| mock/fallback | 命令面板无 mock fallback |
| 误导 | 检索标待 ES；历史 DRY_RUN 单独标识 |
| requirement | REQ-4.2.4 / REQ-6.3.1 |

## 7. Missing Pieces

| Req ID | 缺失件 | 状态 |
|---|---|---|
| REQ-4.2.4 | 失败/超时自动告警和 AD 邮件提醒 | `blocked_by_auth` |
| REQ-4.2.4 | 所有关键状态 ≤10 秒真实同步证明 | `partial` |
| REQ-6.3.1 | Firefox/Edge 和 1920×1080 实机验收 | `partial` |

## 8. 完成率

- 全局 requirements 完成率保持 `3/45 = 6.7%`。
- 本 Sprint 改善现有 partial 的 UI 闭环，不将任何父需求虚升为 complete。

## 9. Verdict

### `partial`

前端整合单元通过：重复入口已收敛、命令结果进入任务中心、伪搜索已移除。告警、邮件提醒和跨浏览器验收仍未完成。

## 10. 提交前检查

- [x] Req ID 与原文已列
- [x] API 和 UI 现实已区分
- [x] 前端事件测试已新增
- [x] 无 mock/DRY_RUN 冒充完成
- [x] Missing pieces 和 blocker 已披露
- [x] PROJECT_STATUS / ROADMAP / traceability 已同步
