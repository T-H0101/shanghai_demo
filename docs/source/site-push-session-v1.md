# 业务系统分阶段推送协议（push-session）

> 替代「一表一包」的单次 `POST /api/sync/package` 主路径（该接口仍保留兼容）。  
> 不依赖 Site Agent；站点业务脚本（如 MultimediumCentral `syncDB`）直接调用。

## 流程

```text
1. POST /api/sync/push/begin   → batchId, status=receiving
2. POST /api/sync/push/table   → 重复 N 次（一表一请求；大表日后可分片）
3. POST /api/sync/push/commit  → success | partial | failed，之后拒收
```

鉴权与 `POST /api/sync/package` 相同：HMAC-SHA256  
头：`x-site-code` / `x-timestamp` / `x-nonce` / `x-signature`  
签名串：`${timestamp}.${nonce}.${rawBody}`

## 1. begin

```http
POST /api/sync/push/begin
```

Body 示例：

```json
{
  "siteCode": "CD01",
  "siteName": "成都01",
  "site_host": "192.168.1.100",
  "site_port": 13000,
  "mode": "full",
  "version": "mm-syncDB/1.1",
  "roundId": "optional-client-round-id"
}
```

响应：`batchId`、`packageId`、`status: receiving`。

默认 `batchId` 格式（站点未自带时由总控生成）：

```text
{siteCode}-push-{yyyyMMddHHmmss}-{uuid}
```

时间戳为**北京时间**紧凑串，例如 `CD01-push-20260803142415-a1b2c3d4-…`。

## 2. table

```http
POST /api/sync/push/table
```

```json
{
  "siteCode": "CD01",
  "batchId": "<from begin>",
  "tableName": "tbl_task",
  "syncMode": "full",
  "records": [ { "...": "..." } ],
  "partIndex": null,
  "partTotal": null
}
```

- 仅当包状态为 `receiving` 时接受。  
- 同 `(siteCode, batchId, tableName)` 重推会覆盖表级日志并重新 dispatch。  
- `partIndex` / `partTotal` 预留；当前唯一键仍按整表名（分片落地需后续 DDL）。

## 3. commit

```http
POST /api/sync/push/commit
```

```json
{
  "siteCode": "CD01",
  "batchId": "<from begin>"
}
```

- 无表：`failed`  
- 全成功：`success`  
- 有成败混合：`partial`  
- 已收尾：幂等返回 `duplicated: true`  
- 收尾后对同 batch 的 `table` 返回 409

## 日志

仍写入 `sync_package_log` / `sync_table_log`。  
一轮同步 = **一条 package**（多行 table log）。
