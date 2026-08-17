# 立即同步通知（总控 → 站点 NW → Central syncDB）

> 总控「同步中心」按钮通知站点业务系统执行一次全量推送。

## 流程

```text
1. 顶部选择具体所属站点（不可「全部」）
2. 点「立即同步」→ POST /api/sync/notify-push { siteCode }
3. 总控 HTTP POST http://{db_host}:{db_port}/unified-sync/trigger
4. NW 验密钥 → TCP syncDB_triggerPush → Central 异步 spawn sync-once.js
5. 总控写 sync_scheduler_log 一条（accepted / failed）
6. 推送结果仍看 sync_package_log（同步包列表）
```

## 鉴权

| 端 | 配置 |
|---|---|
| 总控 | `SITE_SSO_SECRET` 或 `SITE_SYNC_TRIGGER_SECRET`（优先） |
| NW | `unifiedDiscSso.secretKey`（须一致） |

请求头：`x-unified-sync-secret`、`x-site-code`。

## 站点接口

```http
POST /unified-sync/trigger
Content-Type: application/json
x-unified-sync-secret: <64hex>
x-site-code: CD01

{ "siteCode": "CD01", "action": "push_now", "runId": "...", "requestedBy": "admin" }
```

成功：`202 { accepted: true }`  
忙：`409`  
鉴权失败：`401`

## 文案约束

总控 toast：**「已通知站点执行推送」**，不得写「同步成功」。
