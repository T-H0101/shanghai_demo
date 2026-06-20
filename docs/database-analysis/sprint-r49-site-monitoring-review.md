# Sprint R.49 — Site Monitoring & Alert Closure

> Requirement IDs: `REQ-2.1.3`, `REQ-6.4.2`, `REQ-6.4.3`
> Date: 2026-06-20

---

## A. Requirement 对照

| Req ID | 原始文本 | Status |
|---|---|---|
| REQ-2.1.3 | 站点运行监控 (Agent 心跳 + 离线检测) | complete |
| REQ-6.4.2 | 运行时指标 (数据库连通性) | complete |
| REQ-6.4.3 | 可配置同步/告警设置 | complete |

## B. 现有 API 验证

| API | 状态 | 数据来源 |
|---|---|---|
| `GET /api/sync/sites/status` | ✅ 真实数据 | `sync_sites` + `site_agent_heartbeat` |
| `GET /api/alerts` | ✅ 真实聚合 | `sync_package_log` + `sync_table_log` + `control_command` |
| `POST /api/site-agent/heartbeat` | ✅ HMAC 验证 | 站点 Agent 上报 |

## C. 监控能力证据

### Agent 心跳 (REQ-2.1.3)

- `agentStatus()` 函数: `not_registered` → `online` (≤5min) → `degraded` (db unreachable) → `stale` (≤15min) → `offline`
- `agentReportedAt`: 最后心跳时间
- `agentDatabaseReachable`: 站点数据库连通性
- `agentSpoolDepth`: 队列深度

### 运行时指标 (REQ-6.4.2)

- 数据库连通性: `agentDatabaseReachable`
- Agent 版本: `agentVersion`
- 同步状态: `schedulerStatus`, `packageStatus`, `consistencyStatus`
- 匹配/不匹配表数: `matchedTableCount`, `mismatchedTableCount`

### 告警 (REQ-6.4.2)

- 同步失败: `sync_package_log` status IN ('failed','partial')
- 表级失败: `sync_table_log` status = 'failed'
- 控制失败: `control_command` status IN ('failed','cancelled')

### 可配置设置 (REQ-6.4.3)

- `GET /api/system/config` — 配置读取
- `GET /api/sync/config` — 同步配置
- `sync_sites.sync_interval_seconds` — 每站点同步间隔

## D. 不包含的监控项

| 项 | 原因 |
|---|---|
| 硬件指标 (CPU/内存/磁盘) | `tbl_device_device` 0 行, 无 sensor 接入 |
| 光驱状态 | 无实时探测接口 |

## E. Verdict

**complete** — 站点/Agent 级监控完整 (心跳、离线检测、运行时指标、告警聚合、可配置设置)。
硬件级监控标注 `blocked_by_source_schema` (不影响站点监控需求完成)。

---

Commit: `docs(r49): verify site monitoring completeness [REQ-2.1.3,REQ-6.4.2,REQ-6.4.3]`
