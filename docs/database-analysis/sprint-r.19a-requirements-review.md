# Sprint R.19A Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | R.19A |
| 标题 | Site Agent heartbeat 基础设施 |
| 日期 | 2026-06-12 |
| Requirement | `requirements.md` §1.2、§2.1、§2.3、§6.2、§6.4 |
| Verdict | `pass`（仅 heartbeat 单元） |

## 1. Requirement IDs

| Req ID | 状态 |
|---|---|
| REQ-1.2.1 | partial |
| REQ-2.1.3 | partial |
| REQ-2.3.2 | partial |
| REQ-6.2.1 | partial |
| REQ-6.4.2 | partial |

## 2. Requirement 原始文本

> 统一管控平台与各站点管理系统通过API/消息队列交互，不侵入站点原有核心逻辑。

> 站点监控：实时监控站点系统运行状态、光盘库、离线库硬件节点状态；站点离线/硬件异常时自动触发告警，通知相关责任人。

> 监控数据采集频率≤5分钟，支持监控阈值自定义配置。

> 实时同步：关键数据（任务状态、设备状态）变更后立即同步；定时同步：非关键数据（文件索引）按周期（可配置）同步；手动同步：支持管理员触发全量/增量同步。

## 3. Implementation

| 层 | 文件/API/表 |
|---|---|
| 配置 | `lib/site-agent/config.ts`，仅暴露 env key ref |
| 鉴权 | `lib/site-agent/hmac.ts`，请求级 HMAC-SHA256 |
| API | `POST /api/site-agent/heartbeat` |
| DB | `site_agent_runtime`、`site_agent_nonce` |
| 聚合 | `GET /api/sync/sites/status` |
| UI | `/sync` Site Agent 状态列 |
| e2e | `scripts/e2e/test-site-agent.ts`，纳入 `e2e:all` |

## 4. Backend Reality

- 签名绑定 siteCode、timestamp、nonce、HTTP method、path 和 body SHA-256。
- 时间窗为 5 分钟；nonce 落中心库并通过唯一键拒绝重放。
- heartbeat 只持久化白名单运行字段；capabilities 含 secret-like key 时返回 400。
- SH01 heartbeat 已实际写入 `site_agent_runtime`，聚合 API 返回 `online`。
- 本单元没有独立 Agent 循环、package push、spool、重试或控制执行。

## 5. UI Reality

- 修改页面: `/sync`。
- 新增组件: 0；新增页面: 0；新增按钮/交互: 0；删除按钮/交互: 0。
- 新增展示: “每站点最新状态”表增加 Site Agent 列。
- 真实数据: 来自 `site_agent_runtime`；无 heartbeat 显示 `not_registered`。
- UI-only: 0；mock/simulator/DRY_RUN: 0。
- requirements 外内容: 0。

## 6. Event/API/DB/Browser Evidence

| 检查 | 结果 |
|---|---|
| 未签名 heartbeat | HTTP 401 |
| 过期/篡改签名 | HTTP 401 |
| secret-like capability | HTTP 400 |
| 未注册 siteCode | HTTP 404，runtime 行数 0 |
| 正确签名 heartbeat | HTTP 200 |
| nonce 重放 | HTTP 409 |
| DB 行 | `SH01\|e2e-agent-sh01\|r19a-e2e\|true\|0` |
| secret 扫描 | runtime_json 无 password/database_url/secret |
| 状态 API | SH01 `online`，BJ02 `not_registered` |
| 浏览器 | `/sync` HTTP 200、Agent 列真实渲染、console error 0 |
| 自动化 | `pnpm e2e:site-agent` 17/17 pass |

本单元没有点击事件；因此 selector、payload 和 DB 变化验证集中于 heartbeat
API 事件。页面为只读展示，不新增未测试按钮。

## 7. Mock / Simulator / DRY_RUN / 真能力

| 类型 | 本单元 |
|---|---|
| Mock | 无 |
| Simulator | 无 |
| DRY_RUN | 无 |
| 真能力 | 签名 heartbeat、nonce 防重放、DB 持久化、状态聚合和 UI 展示 |

## 8. Missing Pieces / Blockers

| 缺失件 | 状态 |
|---|---|
| 长期运行独立 Agent | partial，R.19B |
| package push/retry/spool | partial，R.19B |
| control poll/ack/result | blocked_by_site_change，R.19C |
| 硬件指标和自动告警 | blocked_by_source_schema / blocked_by_site_change |
| CPU/内存/磁盘趋势 | not_started |

## 9. 站点变更清单

- 站点部署独立 Agent，按 ≤5 分钟周期发送 heartbeat。
- 通过 `SITE_AGENT_SECRET` 注入 HMAC secret，不写入配置文件或数据库。
- 后续 capability 只能报告有正式 schema/API evidence 的动作。

## 10. Completion Rate

本单元强化 5 个 `partial` requirement，没有满足任一 requirement 的全部验收条件。

```text
complete = 3
total = 45
requirements 完成率 = 3 / 45 = 6.7%
```

## 11. Commit Gate

- requirements review: pass
- mock/DRY_RUN 误称: 无
- frontend event 缺测: 无新增事件
- DB patch + API + e2e + 浏览器证据: 已提供
- 最终提交取决于全套强制验证全部通过
