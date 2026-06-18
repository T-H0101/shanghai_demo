# Sprint R.20 Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.20 |
| Sprint 标题 | Command Center UI redesign + 日志检索完成 |
| 日期 | 2026-06-18 |
| 对应 requirement 节 | `requirements.md §5.1`, `§6.3`, `§6.4` |
| 关联文档 | `docs/source/requirements.md`, `docs/database-analysis/requirements-traceability.json` |
| 总控负责人 | Codex |
| 验证人 | Codex |

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-5.1.3 | 日志检索 | `complete` |
| REQ-6.3.1 | 前端兼容 | `partial` |
| REQ-6.4.1 | 日志分类 | `partial` |

## 2. Requirement 原始文本

```text
日志检索: 支持按关键字、错误码、设备ID、任务类型（刻录/回迁）等维度检索日志，支持日志内容模糊匹配，便于问题排查。

日志检索响应时间≤2秒，支持日志分页查看。

日志: 系统运行日志、错误日志、审计日志分类存储，支持按级别、任务类型（刻录/回迁）过滤，便于问题排查。
```

## 3. 需求状态枚举

| Req ID | 本 Sprint 状态 |
|---|---|
| REQ-5.1.3 | `complete` |
| REQ-6.3.1 | `partial` |
| REQ-6.4.1 | `partial` |

## 4. 实现明细

| Req ID | 文件 / API / 表 | 改动类型 |
|---|---|---|
| REQ-5.1.3 | `app/api/logs/route.ts` | 增加 `errorCode` / `deviceId` / `taskType` 过滤 |
| REQ-5.1.3 | `app/logs/page.tsx` | 增加 3 个结构化检索输入 |
| REQ-5.1.3 | `scripts/e2e/test-logs.ts` | 增加结构化过滤和 complete meta 验证 |
| REQ-6.3.1 | `components/dashboard/command-center-panel.tsx` | 新增 Command Center 首屏 |
| REQ-6.3.1 | `app/page.tsx` | 首页接入 Command Center |
| REQ-6.3.1 | `scripts/e2e/test-command-center.ts` | 新增白盒 + API 事件测试 |
| REQ-6.3.1 | `scripts/e2e/run-all.ts` | `e2e:all` 增加环境预检和自动 dev server |

## 5. 后端真实能力

| Req ID | 后端真实能力 | 证据 |
|---|---|---|
| REQ-5.1.3 | `GET /api/logs` 真实读取 6 类中心库日志: `sync_package_log`, `sync_table_log`, `sync_scheduler_log`, `sync_consistency_log`, `control_command`, `audit_log` | `pnpm e2e:logs` |
| REQ-5.1.3 | 支持 `keyword`, `errorCode`, `deviceId`, `taskType`, `siteCode`, `status`, `dateFrom/dateTo`, `limit/offset` | `GET /api/logs?type=all&errorCode=E&deviceId=DEV&taskType=task&limit=20` |
| REQ-6.3.1 | Command Center 不新增 API, 只消费现有真实接口 | `/api/dashboard/summary`, `/api/sync/sites/status`, `/api/sync/packages`, `/api/control/commands`, `/api/alerts` |

## 6. UI 真实能力

| Req ID | UI 元素 | 真实点击/加载行为 | 是否误导用户 |
|---|---|---|---|
| REQ-5.1.3 | `/logs` 筛选条 | 输入后 debounce 调 `GET /api/logs` | 否 |
| REQ-6.3.1 | `/` Command Center | 自动拉取真实 summary/site/package/control/alert API | 否, 明示 `real API only` 和 `无 mock fallback` |

## 7. Mock / Simulator 状态

| Req ID | Mock 模式 | Simulator | DRY_RUN | 真后端 |
|---|---|---|---|---|
| REQ-5.1.3 | ❌ | ❌ | ❌ | ✅ 中心库 6 类日志 |
| REQ-6.3.1 | ❌ | ❌ | ❌ | ✅ 真实 API 可视化 |

## 8. 缺失件

| Req ID | 缺失件 | 原因 |
|---|---|---|
| REQ-6.3.1 | Firefox/Edge 和 1920x1080 实机验收 | 本 Sprint 只做白盒/e2e, 未做浏览器矩阵 |
| REQ-6.4.1 | 完整运行日志/错误日志分类和留存策略 | 仍需日志平台或结构化运行日志方案 |
| REQ-5.1.1 | 站点刻录/回迁全量任务日志采集 | 属于日志采集需求, 不由 REQ-5.1.3 代替 |

## 9. Blocker 类型

| 缺失件 | Blocker Type | 解除条件 |
|---|---|---|
| Firefox/Edge 实测 | `not_started` | R.25 跨浏览器验收 |
| 完整运行/错误日志分类 | `partial` | 引入结构化运行日志方案 |
| 站点刻录/回迁全量日志采集 | `partial` | 站点 Agent/站点日志源接入 |

## 10. 需要的源端 / 站点 schema/API 变更清单

本 Sprint 不新增源端 schema/API 要求。

## 11. 是否影响 requirements 完成率

| 维度 | 数值 |
|---|---|
| 本 Sprint 涉及 Req ID 数 | 3 |
| `complete` | 1 |
| `partial` | 2 |
| `not_started` | 0 |
| `blocked_*` | 0 |
| `out_of_scope` | 0 |
| 全局完成率 (累计) | `4 / 45 = 8.9%` |

## 12. 最终判决

Verdict: `pass`

理由:
- REQ-5.1.3 后端、UI、e2e 均闭环, 无 mock / simulator / DRY_RUN。
- Command Center 只消费现有真实 API, 未新增页面/API/表。
- requirements 完成率从 `3/45 = 6.7%` 提升到 `4/45 = 8.9%`。

## 13. 提交前检查清单

- [x] Req ID 已列
- [x] 每个 Req ID 已打 8 状态枚举
- [x] 后端真实能力有 API/e2e 证据
- [x] 明确 mock / simulator / DRY_RUN / 真后端
- [x] 缺失件不隐藏
- [x] requirements 完成率已计算
- [x] 文件命名 `sprint-r.20-requirements-review.md`
