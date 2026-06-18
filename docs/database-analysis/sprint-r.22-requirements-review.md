# Sprint R.22 Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.22 |
| Sprint 标题 | 手动同步触发 fail-closed |
| 日期 | 2026-06-18 |
| 对应 requirement 节 | `requirements.md §2.3` |
| 关联文档 | `docs/source/requirements.md`, `docs/database-analysis/requirements-traceability.json` |
| 总控负责人 | Codex |
| 验证人 | Codex |

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-2.3.2 | 同步策略实时/定时/手动 | `partial` |

## 2. Requirement 原始文本

```text
同步策略: 支持实时同步、定时同步、手动同步等方式, 支持同步失败重试、断点续传。
```

## 3. 实现明细

| 文件 / API / 表 | 改动类型 |
|---|---|
| `app/api/sync/trigger/route.ts` | 新增 fail-closed API，返回 501 `blocked_by_site_change` |
| `app/sync/page.tsx` | 新增手动同步触发阻塞态说明卡 |
| `scripts/e2e/test-sync.ts` | 增加 API 和页面阻塞态断言 |
| `docs/database-analysis/requirements-traceability.*` | 更新 R.22 traceability |

未新增数据库表；不触发真实同步；不写 `sync_package_log`。

## 4. 后端真实能力

| 能力 | 真实来源 | 证据 |
|---|---|---|
| 手动同步触发边界 | `POST /api/sync/trigger` | HTTP 501, `source=not_implemented`, `blocker=blocked_by_site_change` |
| 安全替代说明 | API response `allowedAlternative` | 指向运维命令 `pnpm scheduler:sync:once -- --siteCode=<SITE>` |

本 Sprint 不宣称网页手动同步已实现。

## 5. UI 真实能力

| UI 元素 | 真实加载行为 | 是否误导用户 |
|---|---|---|
| `/sync` 手动同步触发卡 | 静态显示 blocked state 和 501 API 边界 | 否 |

无新增可点击同步按钮，无 toast。

## 6. Mock / Simulator / DRY_RUN / 真同步区分

| 项 | 状态 |
|---|---|
| Mock | 未使用 |
| Simulator | 未使用 |
| DRY_RUN | 未使用 |
| 真同步 | 未执行；明确 `blocked_by_site_change` |

## 7. Missing Pieces

| 缺失件 | Blocker Type |
|---|---|
| Site Agent manual-sync command 通道 | `blocked_by_site_change` |
| 网页触发全量/增量同步并写审计 | `blocked_by_site_change` |
| 同步触发后的延迟计时验收 | `partial` |

## 8. 需要的源端 / 站点 schema/API 变更清单

| 变更项 | 涉及表 / API | 决策人 |
|---|---|---|
| Agent 支持 `manual_sync` command | Site Agent command channel | 站点 Agent 负责人 |
| 总控触发后审计和结果回写 | `control_command` 或新的 sync command 语义 | 领导 + 架构 |

## 9. 事件测试清单

| 测试 | 命令 | 结果 |
|---|---|---|
| `/api/sync/trigger` fail-closed | `pnpm e2e:sync` | pass |
| `/sync` 页面阻塞态 | `pnpm e2e:sync` | pass |

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
- R.22 消除了悬空的手动同步 API 期望，转为可测试、可解释的 fail-closed 状态。
- 未伪造同步完成，不产生 mock / simulator / DRY_RUN 完成证据。
- 真实网页触发仍需要 Site Agent command 通道，因此不提升 complete 计数。
