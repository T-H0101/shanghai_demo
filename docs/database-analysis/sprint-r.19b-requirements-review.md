# Sprint R.19B Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | R.19B |
| 标题 | 独立 Site Agent heartbeat client |
| 日期 | 2026-06-12 |
| Requirement | `requirements.md` §1.2、§2.1、§2.3、§6.2、§6.4 |
| Verdict | `pass`（仅独立 heartbeat client 单元） |

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

> 监控数据采集频率≤5分钟，支持监控阈值自定义配置。

> 实时同步：关键数据（任务状态、设备状态）变更后立即同步。

## 3. Implementation

| 层 | 文件 |
|---|---|
| Runtime config | `lib/site-agent/config.ts` |
| Heartbeat client | `lib/site-agent/heartbeat-client.ts` |
| 独立入口 | `scripts/site-agent/run.ts` / `pnpm agent:site` |
| 部署 | `deploy/site-agent/*` |
| 运维说明 | `docs/operations/site-agent-deployment.md` |
| e2e | `scripts/e2e/test-site-agent-client.ts` |

## 4. Backend Reality

- Agent 作为独立 Node 进程运行，站点侧执行 `SELECT 1` 探活后主动发送签名
  heartbeat。
- `--once` 用于验收；默认按 `SITE_AGENT_HEARTBEAT_INTERVAL_MS` 串行循环。
- 数据库 URL 和 HMAC secret 只从运行时环境读取，不写库、不打印。
- 初始 control capability 全部 `supported=false`，因为本单元没有 control adapter。
- 已实际执行 SH01 一次性进程，中心库记录
  `e2e-site-agent-client / r19b-e2e / database_reachable=true`。

## 5. UI Reality

本单元不修改页面、按钮或交互。R.19A 的 `/sync` Agent 状态列会读取本进程
产生的真实 heartbeat。

## 6. Event/API/DB Evidence

| 检查 | 结果 |
|---|---|
| 独立进程退出 | 0，日志含 `heartbeat_recorded` |
| 站点 DB 探活 | `database_reachable=true` |
| 中心库 runtime | SH01 agent/version 与进程配置一致 |
| 日志 secret 扫描 | 未命中 secret 值 |
| capability | pause/resume 均为 `supported=false` |
| systemd | EnvironmentFile + Restart=always |
| env 模板 | secret/DB URL 均为空值 |
| 浏览器 | `/sync` SH01 `online / r19b-e2e`，console error 0 |

## 7. Mock / Simulator / DRY_RUN / 真能力

| 类型 | 本单元 |
|---|---|
| Mock | 无 |
| Simulator | 无 |
| DRY_RUN | 无 |
| 真能力 | 独立进程、站点 DB 探活、签名 heartbeat、中心持久化 |

## 8. Missing Pieces / Blockers

| 缺失件 | 状态 |
|---|---|
| 生产站点实际安装并长期运行 | blocked_by_site_change |
| package push/retry/spool | partial，R.19C |
| control poll/ack/result | blocked_by_site_change，R.19D |
| CPU/内存/磁盘和自动告警 | not_started |
| Docker 镜像 | not_started |

## 9. Completion Rate

本单元强化已有 `partial` requirement，没有满足完整监控、同步或可维护性要求。

```text
complete = 3
total = 45
requirements 完成率 = 3 / 45 = 6.7%
```

## 10. Commit Gate

- 无业务页面/API/表变更。
- 无 mock/DRY_RUN 冒充。
- 进程级 e2e、secret 扫描、DB 证据和部署模板已覆盖。
- 最终提交取决于全套强制验证全部通过。
