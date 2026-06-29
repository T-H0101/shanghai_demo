# Site Agent 接入契约 (R.88 + ADR 0003)

> **目的**: 把"站点 app 接入总控"这件事用一份**可执行契约**固定下来, 让站点 app 团队按此实现, 不需要反复沟通。
>
> **依据**:
> - `requirements.md §4.2` 任务管理 (新建 / 暂停 / 恢复 / 重置 / 巡检 / 恢复任务)
> - `requirements.md §5.1` 日志采集
> - ADR 0003 (Site Agent pull-based 控制)
> - CLAUDE.md §四 (任务控制硬约束)
>
> **状态**: `complete` (契约文档落地)。**本 Sprint 不实现 Site Agent 任何代码** (R.88 scope 仅契约 + checklist + 凭证接口)。

---

## 0. 核心原则

1. **总控 = 队列 + 审计**; **站点 = 拉取 + 执行 + 回写** (ADR 0003)。
2. 站点 app **不需要**直接连总控的内部数据库; 通过 HTTP API 拉取 + 回写。
3. 站点 app **必须**保留本地决策权; 网络断连时降级为本地任务控制, 恢复后补同步。
4. 总控不伪造控制证据 (CLAUDE.md §七); 任务状态以站点回写为准。

---

## 1. 凭证与认证 (CredentialStorePort)

### 1.1 凭证类型

| 凭证 | 用途 | 存储 |
|---|---|---|
| `site_id` | 站点业务标识 (e.g. SH01 / BJ02) | 总控统一下发 |
| `agent_id` | 站点 app 实例标识 (UUID, 站点启动时生成, 持久化) | 站点本地 |
| `hmac_secret` | HMAC-SHA256 签名密钥 (R.2G.1 鉴权) | 站点本地 secret store (keychain / vault) |
| `agent_version` | 站点 app 版本字符串 (e.g. `site-agent/1.4.2`) | 站点本地 |

### 1.2 凭证获取 (开发期)

> 当前 Sprint (`blocked_by_auth`) 阶段:
>
> - 测试环境 (`localhost` / dev docker compose) 通过 `.env.local` 注入 `AGENT_HMAC_SECRET`。
> - 生产环境由**站点运维**提供; 走公司内部的 secret store (e.g. HashiCorp Vault / 阿里云 KMS), 站点 app 启动时拉取。
>
> 禁止:
> - ❌ 把 `hmac_secret` 提交到 git。
> - ❌ 通过环境变量明文写 `生产` 站点凭证 (开发环境除外)。
> - ❌ 通过邮件 / IM 传送凭证。

### 1.3 HMAC 签名规范

```
canonical = METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + BODY_SHA256
signature = base64(HMAC-SHA256(canonical, hmac_secret))

Header:
  X-Site-Id: SH01
  X-Agent-Id: 9c3a...-uuid
  X-Agent-Version: site-agent/1.4.2
  X-Timestamp: 2026-06-29T12:34:56Z
  X-Signature: base64-encoded-signature
```

服务端验签:
1. 检查 `X-Timestamp` 距当前时间 ≤ 5 分钟 (replay 防护)。
2. 重新计算 canonical 并 HMAC 比对 (constant-time)。
3. 失败 -> 401, 不返回具体错误细节。

---

## 2. Site Agent HTTP API (总控侧)

所有 endpoint 均要求 HMAC 头部。**总控是 server, 站点 app 是 client**。

### 2.1 拉取控制命令

```
GET /api/site-agent/control-commands?site_id=SH01&limit=50&status=pending
```

**响应** (200):

```json
{
  "code": 0,
  "data": {
    "commands": [
      {
        "id": "uuid",
        "command_type": "task.pause | task.resume | task.reset | patrol.start | restore.task",
        "target_type": "task | patrol | restore",
        "target_id": "string",
        "site_id": "SH01",
        "issued_at": "2026-06-29T12:34:56Z",
        "issued_by": "admin@example.com",
        "payload": { /* 业务负载 */ },
        "status": "pending"
      }
    ]
  }
}
```

### 2.2 确认接收 (ack)

```
POST /api/site-agent/control-commands/{id}/ack
Body: { "agent_id": "uuid", "accepted_at": "ISO-8601" }
```

**响应**: `{ "code": 0, "data": { "status": "acknowledged" } }`

### 2.3 报告执行结果

```
POST /api/site-agent/control-commands/{id}/result
Body: {
  "agent_id": "uuid",
  "executed_at": "ISO-8601",
  "outcome": "succeeded | failed | paused | rejected",
  "details": { /* 命令类型特定 */ },
  "error": { "code": "string", "message": "string" } | null
}
```

**响应**: 200, `{ "code": 0, "data": { "audit_log_id": "uuid" } }`

### 2.4 心跳

```
POST /api/site-agent/heartbeat
Body: {
  "agent_id": "uuid",
  "site_id": "SH01",
  "agent_version": "site-agent/1.4.2",
  "queue_depth": 3,
  "last_run_at": "ISO-8601",
  "load": { "cpu_pct": 12, "mem_pct": 41 }
}
```

**响应**: 200, `{ "code": 0, "data": { "ack": true, "next_poll_interval_seconds": 30 } }`

### 2.5 拉取文件索引 watermark

```
GET /api/site-agent/file-index-watermarks?site_id=SH01
```

**响应** (200):

```json
{
  "code": 0,
  "data": {
    "watermarks": [
      {
        "source_table": "tbl_file",
        "last_watermark_column": "id",
        "last_watermark_value": "123456",
        "status": "succeeded",
        "next_run_at": "2026-06-29T13:00:00Z"
      }
    ]
  }
}
```

(由 R.86 `file_index_jobs` 派生)

### 2.6 推送文件索引批次

```
POST /api/site-agent/file-index-batch
Body: {
  "site_id": "SH01",
  "source_table": "tbl_file",
  "watermark_from": "123456",
  "watermark_to": "123500",
  "documents": [ /* FileIndexDocument 数组 */ ]
}
```

**响应**: 200, `{ "code": 0, "data": { "accepted": 50, "rejected": 0 } }`

---

## 3. Site Agent 行为契约

### 3.1 启动时

1. 读取本地 `agent_id` (持久化 UUID); 不存在则生成并持久化。
2. 读取 `site_id` + `hmac_secret` (从本地 secret store)。
3. 启动 `heartbeat` 定时器 (默认 30s 一次)。
4. 启动 `control_commands` 拉取循环 (默认 5s 一次)。
5. 启动 `file_index_batch` 拉取循环 (默认 60s 一次)。

### 3.2 控制命令处理

| 步骤 | 行为 |
|---|---|
| 1. 拉取 | `GET .../control-commands?status=pending` |
| 2. ack | 收到命令后立刻 `POST .../ack` (≤ 5s) |
| 3. 执行 | 按 `command_type` 分发到本地执行器 |
| 4. 回写 | 执行完成后 `POST .../result` 携带 outcome + details |
| 5. 失败 | 执行异常也必须 `POST .../result` with outcome=failed |

### 3.3 网络断连降级

| 场景 | 行为 |
|---|---|
| 总控不可达 | 站点 app 切本地模式, 任务控制走本地系统, **仍记录审计日志** |
| 总控恢复 | 站点 app 把本地缓冲的 result / heartbeat 批量回放; 时间戳为本地时间 |
| ack 失败 | 重试 3 次, 失败后保留本地待重发 |
| result 失败 | 重试 5 次, 失败后入 dead-letter; 标记 `sync_loss` 触发告警 |

### 3.4 心跳与健康

| 信号 | 含义 | 总控侧处理 |
|---|---|---|
| 心跳 ≥ 90s 缺失 | 站点 app 可能挂 | 总控标记 site offline (走 §2.1 站点监控) |
| 心跳 queue_depth > 1000 | 站点处理不过来 | 总控告警 (R.87) |
| heartbeat agent_version 落后 ≥ 1 大版本 | 站点 app 过期 | 总控告警 (R.87) |

---

## 4. 控制命令 schema (中心库侧)

中心库表 `control_command` (R.4.5 已建) 字段 (本契约对应):

```sql
id              UUID
site_id         VARCHAR  -- 目标站点
command_type    VARCHAR  -- task.pause / task.resume / task.reset / patrol.start / restore.task
target_type     VARCHAR  -- task | patrol | restore
target_id       TEXT     -- 业务 ID
payload         JSONB    -- 命令负载
status          VARCHAR  -- pending -> acknowledged -> executed | failed | rejected
issued_at       TIMESTAMPTZ
issued_by       VARCHAR
acknowledged_at TIMESTAMPTZ
executed_at     TIMESTAMPTZ
outcome         VARCHAR
details         JSONB
error           JSONB
```

---

## 5. 审计与可追溯 (Requirements §5.1)

每条控制命令生命周期都进入 `audit_log` (R.2G 中心库):

| 事件 | 写入字段 |
|---|---|
| 中心下发命令 | `{ event: "control.issued", command_id, site_id, issued_by }` |
| 站点 ack | `{ event: "control.acknowledged", command_id, agent_id, ack_at }` |
| 站点执行结果 | `{ event: "control.executed", command_id, outcome, details, executed_at }` |
| 站点离线告警 | `{ event: "site.offline_detected", site_id, last_heartbeat }` |
| 凭证轮换 | `{ event: "credential.rotated", site_id, agent_id, rotated_by }` |

---

## 6. 总控侧已落地的端口

| 端口 | 落地位置 | Sprint |
|---|---|---|
| `SearchPort` (ES) | `lib/ports/search-port.ts` + OpenSearch adapter | R.85 |
| `SiteAgentPort` (本契约) | `lib/ports/site-agent-port.ts` (待建, R.88 后续) | R.88 |
| `CredentialStorePort` | `lib/ports/credential-store-port.ts` (待建, R.88 后续) | R.88 |

`SiteAgentPort` 与 `CredentialStorePort` 的代码契约**留待 R.88 后续 Sprint**, 本文档定义的是 HTTP 协议级契约。

---

## 7. 站点 app 团队交付清单 (开发阶段)

| 交付项 | 形式 | 责任 |
|---|---|---|
| 站点 app HTTP 客户端实现 | 任意语言 (Java / Go / Python) | 站点 app 团队 |
| HMAC 签名/验签 | 站点 app 库 | 站点 app 团队 |
| 本地 secret store 集成 | 站点 app 配置 | 站点 app 团队 |
| 心跳 / 控制命令 / 文件索引 watermark 三组循环 | 站点 app 进程 | 站点 app 团队 |
| 凭证轮换策略 | 站点 app 运维手册 | 站点 app 团队 |
| 断连降级 + 重连回放 | 站点 app 行为 | 站点 app 团队 |

总控团队交付:

| 交付项 | 形式 | 责任 |
|---|---|---|
| HTTP endpoint (`/api/site-agent/*`) | Next.js route handler | platform |
| HMAC 鉴权中间件 | Next.js middleware | platform |
| 控制命令写库 + 审计 | 总控 `control_command` 表 | platform |
| 文件索引 watermark 派生 | `file_index_jobs` -> SiteAgentPort | platform |
| 心跳健康监控 | R.87 接管 | platform (R.87) |

---

## 8. 与 R.86 增量同步的对接

`file_index_jobs` 是**中心库调度账本**; 站点 app 是**执行 worker**:

- 总控从 `file_index_jobs` 派生 `last_watermark_value`, 通过 `/api/site-agent/file-index-watermarks` 下发。
- 站点 app 按 watermark 拉取源表增量行, 映射成 `FileIndexDocument`, 通过 `/api/site-agent/file-index-batch` 推送。
- 总控在文件索引 batch 接收时, 通过 `SearchPort.indexFiles()` 写入 ES。
- 站点 app 不直接连 ES (避免暴露 ES endpoint)。

---

## 9. 禁止 (CLAUDE.md §一)

- ❌ 不允许站点 app 直连中心库 PG。
- ❌ 不允许把 `hmac_secret` 写日志 / 上报到 APM。
- ❌ 不允许把 `outcome` 写为 `succeeded` 当实际是 DRY_RUN / simulator。
- ❌ 不允许跳过 ack / result 直接改状态。
- ❌ 不允许把任务控制完成度说成 X% 而忽略站点 app 接入证据 (§4.2 沿用 partial + blocked_by_site_change)。

---

## 10. 验收 (R.88 后续 Sprint 接力)

```bash
# 总控侧 (R.88+ 开发)
pnpm e2e:site-agent-pull        # pull -> ack -> result 闭环
pnpm e2e:site-agent-auth        # HMAC 签名/验签 (正反例)
pnpm e2e:site-agent-heartbeat   # 心跳 + 离线检测
pnpm e2e:site-agent-file-index  # watermark -> batch -> ES 闭环
```

站点 app 团队:

```bash
# 站点 app 端 (他们自己的测试套件)
./site-agent-test --scenario ack-and-result
./site-agent-test --scenario disconnect-reconnect
./site-agent-test --scenario hmac-rotation
```

---

_End of R.88 site agent contract._