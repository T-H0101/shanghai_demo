# 同步测试与自动化说明

## 模式说明

- `NEXT_PUBLIC_API_MODE=api`：Tasks、Racks、Volumes 读取中心 API，失败时保留 mock fallback。
- `NEXT_PUBLIC_API_MODE=mock`：页面只使用 mock provider，不请求真实数据 API。
- `/sync` 始终读取 `/api/sync/packages` 与表级日志接口。
- API 模式目前只支持设备数据展示；设备控制、挂载、介质写入和设备任务创建接口尚未接入，前端会明确提示。
- Racks 盘位明细读取中心库 `/api/racks/{rackId}/slots?siteCode=...`；无中心明细时显示空态，不回退成 mock 空闲格子。

## 手工同步

小表人工回归命令：

```bash
pnpm import:tasks
pnpm import:devices
pnpm import:discs
pnpm import:volumes
pnpm import:hard-disks
```

文件索引只能按任务受控执行，不得加入默认全量同步：

```bash
pnpm import:file-index -- <siteCode> <taskId> --from-id 0 --limit 1000
```

## Package 同步

站点向总控发送：

```http
POST /api/sync/package
Content-Type: application/json
x-site-code: <siteCode>
x-timestamp: <unix-ms-ms>
x-nonce: <random-hex>
x-signature: <hex-hmac-sha256>
```

当前白名单为已接入的 10 张小表。`tbl_file`、`tbl_folder` 禁止进入 package 全量同步。

### HMAC 鉴权 (Sprint 2G.1)

写入入口 `POST /api/sync/package` **强制 HMAC 鉴权**, 防止无签名请求污染中心库。

**签名内容**:

```text
signing_string = `${x-timestamp}.${x-nonce}.${rawBody}`
signature      = HMAC-SHA256(secret, signing_string) → hex
```

**请求头**:

| 头 | 类型 | 说明 |
|---|---|---|
| `x-site-code` | string | 站点代码, 必须与 `payload.siteCode` 一致 |
| `x-timestamp` | string | Unix 毫秒, 与服务器差不能超过 5 分钟 |
| `x-nonce` | string | 8+ 字节随机十六进制, 防重放 |
| `x-signature` | string | 64 字符十六进制 HMAC-SHA256 |

**关键点**:

- 签名基于 `rawBody` (字节), **不能用 `JSON.stringify(payload)` 重排** — Next.js `request.text()` 读取原始字节流, 哈希计算后再 JSON.parse。
- 服务器用 `crypto.timingSafeEqual` 比较签名, 防时间侧信道。
- 服务器先鉴权后解析 JSON, 401 时不进入业务逻辑。

**环境变量**:

```bash
# strict = 生产: 必须签名
# dev    = 开发: 允许无签名但响应带 warning
SYNC_PACKAGE_AUTH_MODE=strict
SYNC_PACKAGE_SECRET=replace-with-site-secret
```

**生成强密钥**:

```bash
openssl rand -hex 32
```

### 鉴权错误码

| 错误码 | HTTP | 触发条件 |
|---|---|---|
| `OK` | 200 | 通过 |
| `MISSING_SIGNATURE` | 401 | strict 模式下无 `x-signature` 头 |
| `MISSING_HEADER` | 401 | timestamp/nonce/site-code 头缺失 |
| `EXPIRED_TIMESTAMP` | 401 | timestamp 与服务器差 > 5 分钟 |
| `INVALID_TIMESTAMP` | 401 | timestamp 不可解析为数字 |
| `SITE_CODE_MISMATCH` | 401 | `x-site-code` 与 `payload.siteCode` 不一致 |
| `INVALID_SIGNATURE` | 401 | HMAC 不匹配 (含长度不一致) |
| `AUTH_NOT_CONFIGURED` | 401 | strict 模式但 `SYNC_PACKAGE_SECRET` 未设置 |
| `DEV_MODE_WARNING` | 200 | dev 模式无签名通过, 响应带 `x-auth-warning` 头 |

### 站点侧签名示例 (Node.js)

```js
const { createHmac, randomBytes } = require('crypto')
const ts = Date.now()
const nonce = randomBytes(8).toString('hex')
const rawBody = JSON.stringify(payload)
const sig = createHmac('sha256', process.env.SYNC_PACKAGE_SECRET)
  .update(`${ts}.${nonce}.${rawBody}`)
  .digest('hex')

await fetch('https://control.example.com/api/sync/package', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-site-code': payload.siteCode,
    'x-timestamp': String(ts),
    'x-nonce': nonce,
    'x-signature': sig,
  },
  body: rawBody,
})
```

### 测试脚本

```bash
pnpm test:sync-package
```

脚本同时验证:

1. 合法签名 → 200
2. 重复 batchId → duplicated
3. 未知表 → 400
4. tbl_file → 400 forbidden
5. recordCount 不匹配 → 400
6. 缺 siteCode → 400
7. strict 模式负例: 无签名/错签名/过期/mismatch → 401

处理结果写入：

- `sync_package_log`：包级状态、批次、站点、记录数。
- `sync_table_log`：表级状态、处理数、失败原因。

可在 `/sync` 或以下接口查看：

```text
GET /api/sync/packages
GET /api/sync/packages/{packageId}/tables
```

## 一键 Smoke Test

```bash
pnpm smoke:sync
```

脚本直接调用现有 package route/service 链路，不依赖浏览器或 dev server，验证：

1. 中心库为 `unified_disc_platform`。
2. 核心业务表和同步日志表存在。
3. `TEST_SMOKE` 的任务、设备各 1 条可以 UPSERT。
4. package log 和两条 table log 写入成功。
5. 相同 `batchId` 再次执行返回 `duplicated`。

脚本不读取或写入 `tbl_file`、`tbl_folder`，不触发 `import:all`。

盘位接口人工检查：

```bash
curl "http://localhost:3000/api/racks/1/slots?siteCode=TEST_CLEAN"
```

返回 `source=empty` 表示设备汇总存在、盘位明细尚未推送，不是接口失败。

## 每小时同步设计

1. 站点侧 cron 每小时执行小表导出、打包并调用 `POST /api/sync/package`。
2. 总控不主动直连或拉取站点数据库。
3. 总控接口负责校验、幂等判断、分表入库和日志记录。
4. 后续如增加中心调度，也只能调用站点导出接口，不直接操作站点数据库。
5. 开发环境使用 `pnpm smoke:sync` 验证接收、入库、日志和幂等链路。

## 已知限制

- 真实设备控制 API 未接入；API 模式下操作按钮只提示，不会伪造成功结果。
- `/volumes` 业务页面尚不存在，当前仅提供 `/api/volumes`。
- package checksum 当前保留字段，尚未实现严格 SHA-256 比对。
- `unified_slots` 当前只有 package 测试数据；真实 `tbl_slots` 明细尚未完成 package 字段映射。
- 任务实时 `progress/speed/remainingTime` 没有可靠站点来源，API mode 不做推算或动画。
