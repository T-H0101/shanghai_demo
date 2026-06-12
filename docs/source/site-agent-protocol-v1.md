# Site Agent Protocol v1

> 状态: R.18 冻结，R.19 实现
> 对应 requirements: §1.2、§2.1、§2.3、§4.2、§6.2、§6.4

## 1. 边界

- Agent 部署在站点网络内，读取本地站点数据库或调用站点 API。
- Agent 只主动访问总控 HTTPS API；总控不连接生产站点数据库。
- Agent 配置只引用环境变量 key，不保存数据库密码或 HMAC secret。
- 数据同步、控制执行和 heartbeat 使用独立客户端，但共享 siteCode、版本和签名模块。
- 本地执行通过 `SiteActionAdapter`，首期 PostgreSQL，后续可替换 HTTP/MQ/站点原生模块。

## 2. 同步协议

站点调用:

```http
POST /api/sync/package
x-site-code: SH01
x-sync-timestamp: 2026-06-12T10:00:00.000Z
x-sync-signature: <hmac>
content-type: application/json
```

payload 沿用 `lib/sync/package-schema.ts`。

要求:

- `batchId` 全局幂等。
- 小表使用 snapshot/hash diff 或可靠 watermark 增量。
- 失败进入本地 spool，按指数退避重试。
- `tbl_file/tbl_folder` 禁止进入 package。
- 文件索引读取必须有 `taskId + last_id + limit <= 5000`。

## 3. 控制协议

### 3.1 Poll

```http
GET /api/site-control/commands?siteCode=SH01&limit=20
x-site-control-signature: <v1 signature>
```

只返回该 siteCode 的 pending 命令。Agent 必须按 command id 本地去重。

### 3.2 Ack

```http
POST /api/site-control/commands/{id}/ack
content-type: application/json

{"siteCode":"SH01","agentId":"sh01-agent-01"}
```

ack 表示 Agent 已领取，不表示业务成功。

### 3.3 Result

```http
POST /api/site-control/commands/{id}/result
content-type: application/json

{
  "siteCode": "SH01",
  "status": "success",
  "affectedRows": 1,
  "before": {"status": 1},
  "after": {"status": 20},
  "errorCode": null,
  "errorMessage": null,
  "executedAt": "2026-06-12T10:00:05.000Z"
}
```

合法终态:

- `success`
- `failed`
- `unsupported`

`dry_run_success` 仅用于测试环境，不能作为生产完成证据。

## 4. Capability

Agent heartbeat 必须携带 capability:

```json
{
  "task_pause": {"supported": true, "adapter": "postgres", "evidence": "tbl_task.status=20"},
  "task_resume": {"supported": true, "adapter": "postgres", "evidence": "tbl_task.status=0"},
  "task_reset": {"supported": false, "blocker": "official_semantics_missing"},
  "task_priority_restore": {"supported": false, "blocker": "blocked_by_source_schema"},
  "inspect_start": {"supported": false, "blocker": "blocked_by_source_schema"},
  "recovery_start": {"supported": false, "blocker": "blocked_by_source_schema"}
}
```

总控 UI 只能对 `supported=true` 的动作开放真实执行入口。

## 5. Heartbeat

```http
POST /api/site-agent/heartbeat
content-type: application/json
```

```json
{
  "siteCode": "SH01",
  "agentId": "sh01-agent-01",
  "agentVersion": "1.0.0",
  "startedAt": "2026-06-12T09:00:00.000Z",
  "reportedAt": "2026-06-12T10:00:00.000Z",
  "databaseReachable": true,
  "lastSyncAt": "2026-06-12T09:59:30.000Z",
  "lastControlAt": "2026-06-12T09:58:00.000Z",
  "spoolDepth": 0,
  "capabilities": {}
}
```

禁止字段:

- 数据库 URL
- 用户名和密码
- secret/token 原值
- 原始环境变量值

## 6. 请求级 HMAC v1

R.19 heartbeat 采用:

```text
HMAC-SHA256(
  siteCode + "\n" +
  timestamp + "\n" +
  nonce + "\n" +
  method + "\n" +
  path + "\n" +
  sha256(body),
  secret
)
```

服务端校验:

- 时间偏差不超过 5 分钟。
- nonce 在时间窗内不可重放。
- header siteCode 与 body/query siteCode 一致。
- 使用 `timingSafeEqual`。

现有 site-control 简化签名在 R.25 前升级到同一协议。

## 7. 幂等和恢复

- package: `batchId` 幂等。
- command: `commandId` 本地执行记录幂等。
- result: 重复提交同一终态返回已有结果，不再次执行。
- Agent 重启后先恢复 spool，再开始新同步。
- Agent 领取命令后异常退出，租约超时后允许重新领取。

## 8. 生产验收

一个能力只有同时满足以下证据才可标 complete:

1. 总控命令或同步请求已记录。
2. Agent HTTP 交互日志存在。
3. 站点本地 before/after 或同步数据证据存在。
4. Agent result/heartbeat 已回传。
5. 中心库重新同步后状态一致。
6. UI 展示最终状态且事件 e2e 通过。
