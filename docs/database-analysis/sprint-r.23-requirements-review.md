# Sprint R.23 Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.23 |
| Sprint 标题 | 同步时效白盒证据 |
| 日期 | 2026-06-18 |
| 对应 requirement 节 | `requirements.md §6.1` |
| 关联文档 | `docs/source/requirements.md`, `docs/database-analysis/requirements-traceability.json` |
| 总控负责人 | Codex |
| 验证人 | Codex |

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-6.1.3 | 增量 ≤10s / 全量 ≤30min | `partial` |

## 2. Requirement 原始文本

```text
数据同步时效: 增量同步延迟≤10秒, 全量同步时间≤30分钟。
```

## 3. 实现明细

| 文件 / API / 表 | 改动类型 |
|---|---|
| `scripts/e2e/test-site-agent-sync.ts` | 增加任务增量 Agent→中心落库耗时断言 |
| `docs/database-analysis/requirements-traceability.*` | 更新 R.23 traceability |
| `docs/summary/PROJECT_STATUS.md` / `ROADMAP.md` | 记录 R.23 状态 |

未改同步生产逻辑，未新增 API、页面或数据库表。

## 4. 后端真实能力

| 能力 | 真实来源 | 证据 |
|---|---|---|
| 任务增量读取 | `PgSiteSourceReader` 读取 `SITE_DATABASE_URL` 恢复库 | `pnpm e2e:site-agent-sync` |
| 中心落库 | `PackageTransport` 调 `POST /api/sync/package` 写中心库 | `pnpm e2e:site-agent-sync` |
| 增量耗时断言 | `Date.now()` 包围 `coordinator.syncOnce({ includeSnapshots:false })` | 本次 `<100ms <= 10s` |

## 5. UI 真实能力

本 Sprint 不改 UI。`/sync` 仍展示每站点配置周期和最近状态，但不把白盒样本展示为生产 SLA。

## 6. Mock / Simulator / DRY_RUN / 真同步区分

| 项 | 状态 |
|---|---|
| Mock | 未使用 |
| Simulator | 未使用 |
| DRY_RUN | 未使用 |
| 真同步 | 恢复库 → 中心库真实 package 写入，动态测试站点清理后退出 |

## 7. Missing Pieces

| 缺失件 | Blocker Type |
|---|---|
| 生产站点持续增量时延样本 | `blocked_by_site_change` |
| 百万级文件索引全量同步 <=30min | `blocked_by_external_system` |
| R.25 正式性能报告 | `partial` |

## 8. 需要的源端 / 站点 schema/API 变更清单

| 变更项 | 涉及表 / API | 决策人 |
|---|---|---|
| 生产 Agent 持续运行并采样 | Site Agent 部署 | 领导 + 站点运维 |
| 百万级文件索引数据面 | ES / ClickHouse 或等价数据面 | 领导 + 架构 |

## 9. 事件测试清单

| 测试 | 命令 | 结果 |
|---|---|---|
| Site Agent 同步白盒 | `pnpm e2e:site-agent-sync` | pass, 14/14 |
| 增量耗时 | `pnpm e2e:site-agent-sync` | pass, `<100ms <=10s` |

## 10. requirements 完成率

| 维度 | 数值 |
|---|---|
| 本 Sprint 涉及 Req ID 数 | 1 |
| `complete` | 0 |
| `partial` | 1 |
| 全局完成率 (累计) | `4 / 45 = 8.9%` |

## 11. Verdict

Verdict: `partial-pass`

理由:
- R.23 给出可重复白盒时效证据，覆盖恢复库任务增量到中心落库链路。
- 没有生产站点持续样本和百万级全量测试，不能标 `complete`。
