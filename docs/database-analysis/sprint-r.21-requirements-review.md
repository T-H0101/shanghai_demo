# Sprint R.21 Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.21 |
| Sprint 标题 | 同步告警摘要闭环 |
| 日期 | 2026-06-18 |
| 对应 requirement 节 | `requirements.md §2.1`, `§2.3`, `§6.4` |
| 关联文档 | `docs/source/requirements.md`, `docs/database-analysis/requirements-traceability.json` |
| 总控负责人 | Codex |
| 验证人 | Codex |

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-2.1.3 | 站点监控实时 + 告警 | `partial` |
| REQ-2.3.2 | 同步策略实时/定时/手动 | `partial` |
| REQ-6.4.2 | CPU/内存/磁盘/接口监控 | `partial` |

## 2. Requirement 原始文本

```text
站点监控: 支持实时监控各站点运行状态, 采集频率≤5分钟, 支持异常告警。

同步策略: 支持实时同步、定时同步、手动同步等方式, 支持同步失败重试、断点续传。

监控: 支持 CPU、内存、磁盘、接口等运行状态监控, 支持告警。
```

## 3. 实现明细

| Req ID | 文件 / API / 表 | 改动类型 |
|---|---|---|
| REQ-2.1.3 | `app/sync/page.tsx` | 新增只读同步告警摘要卡 |
| REQ-2.3.2 | `app/sync/page.tsx` | 展示失败 package/table 告警 |
| REQ-2.3.2 | `scripts/e2e/test-sync.ts` | 增加 `/api/alerts` 和页面接线断言 |
| REQ-6.4.2 | `docs/database-analysis/requirements-traceability.*` | 更新监控证据和剩余缺口 |

未新增 API、页面、表；复用既有 `GET /api/alerts`。

## 4. 后端真实能力

| 能力 | 真实来源 | 证据 |
|---|---|---|
| 同步包失败告警 | `sync_package_log WHERE status IN ('failed','partial')` | `GET /api/alerts?pageSize=300` |
| 表级失败告警 | `sync_table_log WHERE status='failed' AND failed_count>0` | `GET /api/alerts?pageSize=300` |
| UI 数据源 | `/sync` fetch `/api/alerts` | `pnpm e2e:sync` |

本 Sprint 不接 ClickHouse / ES，不伪造硬件告警，不把站点离线告警标成完成。

## 5. UI 真实能力

| UI 元素 | 真实加载行为 | 是否误导用户 |
|---|---|---|
| `/sync` 同步告警摘要 | 自动拉取 `/api/alerts?pageSize=300`，只展示 `type=sync/table` | 否 |
| 告警来源说明 | 页面明示 `sync_package_log / sync_table_log` | 否 |

无新增按钮、无新增写操作、无 toast。

## 6. Mock / Simulator / DRY_RUN / 真控制区分

| 项 | 状态 |
|---|---|
| Mock | 未使用 |
| Simulator | 未使用 |
| DRY_RUN | 不作为完成证据；页面仅显示真实历史日志中的状态 |
| 真控制 | 本 Sprint 不涉及控制执行 |

## 7. Missing Pieces

| Req ID | 缺失件 | Blocker Type |
|---|---|---|
| REQ-2.1.3 | 生产站点长期部署、硬件指标、离线/硬件异常自动告警 | `blocked_by_source_schema` |
| REQ-2.3.2 | 设备状态实时延迟实测、页面触发 Agent 手动全量/增量、通知通道和责任人推送、生产部署 | `blocked_by_site_change` |
| REQ-6.4.2 | CPU/内存/磁盘完整监控、历史趋势和主机指标告警 | `partial` |

## 8. 需要的源端 / 站点 schema/API 变更清单

| 变更项 | 涉及表 / API | 决策人 |
|---|---|---|
| 站点离线/硬件指标上报 | 站点 Agent 或站点监控 API | 领导 + 站点运维 |
| 告警通知通道 | 邮件/IM/站点事件通道 | 领导 + 运维 |
| 手动全量/增量同步触发 | Site Agent command/API | 站点 Agent 负责人 |

## 9. 事件测试清单

| 测试 | 命令 | 结果 |
|---|---|---|
| 同步页面 200 | `pnpm e2e:sync` | pass |
| `/api/alerts` sync/table 告警 | `pnpm e2e:sync` | pass, `syncAlerts=15` |
| `/sync` 页面接线 | `pnpm e2e:sync` | pass, 含 `sync-alert-summary-card` |

## 10. requirements 完成率

| 维度 | 数值 |
|---|---|
| 本 Sprint 涉及 Req ID 数 | 3 |
| `complete` | 0 |
| `partial` | 3 |
| 全局完成率 (累计) | `4 / 45 = 8.9%` |

## 11. Verdict

Verdict: `partial-pass`

理由:
- 本 Sprint 真实补齐同步失败告警的 UI 可见性，后端来源为中心库真实日志。
- 未新增 API、页面或表，未泄露 secret，未伪造 ClickHouse/ES 或站点硬件告警。
- 生产部署、主机指标、通知通道和手动同步触发仍未完成，因此不提升 complete 计数。
