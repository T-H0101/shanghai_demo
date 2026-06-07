# Sprint 2H.1 — 站点 Package Exporter 模拟器

> 状态: ✅ 完成
> 范围: 仅 scripts/ + docs/, 不改任何业务代码 (Dashboard / Tasks / Racks / Volumes / file-index / HMAC / dispatcher 全部不受影响)
> Sprint 目标: 把 `pnpm import:xxx` 验证方式替换为"站点导出 + HMAC 签名 + 推送"完整链路

---

## 1. 背景

总控侧已完成:

- `/api/sync/package` 接收 (Sprint 2D.2)
- 10 张小表 dispatcher (Sprint 2D.3)
- HMAC-SHA256 鉴权 (Sprint 2G.1)
- Dashboard / Sync Center 真实统计 (Sprint 2G.2)

但站点侧导出器缺失。当前验证链路:

```text
开发者手敲 pnpm import:tasks / import:devices / ...
↓
直接 INSERT 中心库
```

这不是生产模式。生产模式应为:

```text
站点侧 cron
   ↓
导出 package (从源站 DB 拉白名单表)
   ↓
计算 HMAC-SHA256
   ↓
POST /api/sync/package
   ↓
总控验证签名 + 幂等 + 派发入库
```

本 Sprint 提供"站点模拟导出器"作为可执行的占位。

## 2. 文件清单

| 文件 | 类型 |
|---|---|
| `scripts/export-package.ts` | 新增 (Step 1) |
| `scripts/push-package.ts` | 新增 (Step 3) |
| `scripts/export-and-push.ts` | 新增 (Step 4) |
| `scripts/sprint-2h1-verify-logs.ts` | 新增 (验证) |
| `package.json` | 新增 3 个 scripts |
| `docs/database-analysis/sprint-2h1-site-exporter-simulator.md` | 本文档 |

## 3. 使用方式

### 3.1 单独导出

```bash
# 导出 SH01 的 7 张白名单表到 exports/SH01/package.json
pnpm export:package SH01

# 导出时只取部分表
pnpm export:package SH01 --tables tbl_task,tbl_disc_lib

# 指定输出目录
pnpm export:package SH01 --out /tmp/exports

# 增量模式 (目前只是标记 mode, 实际仍全量)
pnpm export:package SH01 --mode incremental
```

输出结构:

```text
exports/SH01/
└── package.json
```

### 3.2 单独推送 (本地已导出, 重新推)

```bash
# 推送到默认 http://localhost:3000
pnpm push:package exports/SH01/package.json

# 推送到指定地址
pnpm push:package exports/SH01/package.json --url http://control.example.com
```

### 3.3 一键 export + push

```bash
pnpm export-and-push SH01
pnpm export-and-push TEST_CLEAN
pnpm export-and-push SH01 --url http://control.example.com
```

## 4. 站点如何导出

### 4.1 流程 (模拟器)

1. 读 `.env.local` → `SOURCE_DATABASE_URL` (源站库)
2. 守门:
   - 严禁 `tbl_file` / `tbl_folder` 在 tables 列表
   - 必须属于 Sprint 2H.1 白名单 (7 张)
3. 逐张 `SELECT * FROM <table>` 拉全量
4. 组装 package 对象:
   ```ts
   {
     siteCode: 'SH01',
     batchId: 'SH01-2026-06-07T10-24-28-302Z',
     snapshotAt: '2026-06-07T10:24:28.302Z',
     version: '2H.1-exporter',
     mode: 'full',
     checksum: null,
     tables: [
       { tableName: 'tbl_task', syncMode: 'full', recordCount: 37, records: [...] },
       ...
     ]
   }
   ```
5. 写入 `exports/<siteCode>/package.json`

### 4.2 生产实际导出 (替换路径)

| 步骤 | 模拟器 | 生产 |
|---|---|---|
| 1. 数据源 | `SELECT * FROM tbl_*` (本机) | 站点 DB 增量 dump / 视图 |
| 2. 守门 | 硬编码 7 张表 | 站点配置 + dispatcher 白名单 |
| 3. 调度 | 手动跑 | 站点 cron (每小时) |
| 4. 序列化 | `JSON.stringify(pkg)` | 同上 |
| 5. 存储 | 本地 `exports/*.json` | 站点文件 / 临时目录 |
| 6. 推送 | `POST /api/sync/package` | 同上 |

**生产**只需把 `export-package.ts` 内部 `fetchTable()` 替换为生产源站查询, 其它不变。

## 5. 站点如何签名 (HMAC)

### 5.1 签名前提

- 双方 (站点 / 总控) 共享 `SYNC_PACKAGE_SECRET` (32+ 字符随机串)
- 总控在 strict 模式 (默认) 强制验证

### 5.2 签名算法 (与 Sprint 2G.1 一致)

```text
signing_string = `${timestamp}.${nonce}.${rawBody}`
signature      = HMAC-SHA256(SECRET, signing_string) → hex (64 chars)
```

### 5.3 头说明

| 头 | 类型 | 例子 |
|---|---|---|
| `x-site-code` | string | `SH01` (必须与 payload.siteCode 一致) |
| `x-timestamp` | string | `1780827892830` (Unix 毫秒, 5 分钟内有效) |
| `x-nonce` | string | `9f3a7b2c1d8e4f5a` (16 hex chars) |
| `x-signature` | string | `<64 hex>` |

### 5.4 关键点

- 签名基于 `rawBody` (字节) — **不能用 `JSON.stringify(payload)` 重排**
- 服务器用 `crypto.timingSafeEqual` 比较 — 防时间侧信道
- 5 分钟时间窗 — 防重放
- `x-site-code` 与 `payload.siteCode` 不一致 → 401 SITE_CODE_MISMATCH

### 5.5 模拟器实现 (scripts/push-package.ts)

```ts
const rawBody = JSON.stringify(pkg)
const ts = Date.now()
const nonce = randomBytes(8).toString('hex')
const sig = createHmac('sha256', SECRET)
  .update(`${ts}.${nonce}.${rawBody}`, 'utf8')
  .digest('hex')
// headers: { 'x-site-code': pkg.siteCode, 'x-timestamp': String(ts), 'x-nonce': nonce, 'x-signature': sig }
// body: rawBody (必须完全一致, 不能用 JSON.stringify 重新序列化)
```

## 6. 站点如何推送

### 6.1 HTTP 调用

```http
POST /api/sync/package
Content-Type: application/json
x-site-code: SH01
x-timestamp: 1780827892830
x-nonce: 9f3a7b2c1d8e4f5a
x-signature: <64 hex>

{
  "siteCode": "SH01",
  "batchId": "SH01-2026-06-07T10-24-28-302Z",
  ...
}
```

### 6.2 响应 (Sprint 2G.1 鉴权后, Sprint 2D.2 业务)

**成功 (200)**:

```json
{
  "code": 0,
  "message": "package accepted",
  "status": "success",
  "duplicated": false,
  "summary": { "tableCount": 7, "totalRecordCount": 114, "successTableCount": 7, "failedTableCount": 0 },
  "tables": [
    { "tableName": "tbl_task", "status": "success", "received": 37, "upserted": 37 },
    ...
  ]
}
```

**重复 batchId (200 duplicated)**:

```json
{ "status": "duplicated", "duplicated": true, "summary": {...} }
```

**鉴权失败 (401)**:

| errorCode | 触发 |
|---|---|
| `MISSING_SIGNATURE` | strict 模式无 x-signature |
| `MISSING_HEADER` | 缺 x-timestamp / x-nonce / x-site-code |
| `EXPIRED_TIMESTAMP` | 超过 5 分钟 |
| `INVALID_SIGNATURE` | HMAC 不匹配 |
| `SITE_CODE_MISMATCH` | x-site-code ≠ payload.siteCode |
| `AUTH_NOT_CONFIGURED` | strict 模式但 SYNC_PACKAGE_SECRET 未设 |

**业务失败 (400/207)**:

- 未知表 → 400 validation
- `tbl_file` / `tbl_folder` → 400 forbidden
- `recordCount` 不匹配 → 400
- 部分表失败 → 207 partial

## 7. 生产如何替换

### 7.1 站点侧集成路径

1. **替换数据源**: `fetchTable(client, t)` 内部从 `SELECT * FROM` 改成:
   - 站点自有 DB 视图
   - 或 ETL 导出文件 (CSV / Parquet / JSON)
   - 或 REST API 调用
2. **替换调度**: 从手动 CLI 改成:
   - Linux cron: `0 * * * * /opt/exporter/run.sh SH01`
   - Kubernetes CronJob
   - 或 Airflow / DolphinScheduler
3. **替换密钥管理**: 从 `.env.local` 改成:
   - HashiCorp Vault
   - AWS Secrets Manager
   - 阿里云 KMS
4. **替换推送通道**: 从直接 `fetch()` 改成:
   - 失败重试 + 指数退避
   - 死信队列 (DLQ) 存储失败包
   - 监控告警 (Prometheus / Sentry)

### 7.2 模拟器 → 生产代码示例

```ts
// 模拟器 (scripts/export-package.ts)
import { Client } from 'pg'
const client = new Client({ connectionString: SOURCE_URL })
await client.connect()
const records = await fetchTable(client, 'tbl_task')

// 生产 (站点侧, 假设已经有 ETL)
import { fetchTaskSnapshot } from './etl/task-snapshot'
const records = await fetchTaskSnapshot({ siteCode, since: lastSnapshotAt })
```

模拟器保留 5 个文件原样, **生产只替换内部数据获取实现**。

## 8. 验证结果 (SH01 端到端)

### 8.1 一键命令

```bash
pnpm export-and-push SH01
```

### 8.2 导出结果

```text
[export-package] siteCode=SH01
[export-package] source=source_restore
[export-package]   tbl_task: 37 records
[export-package]   tbl_disc_lib: 4 records
[export-package]   tbl_magzines: 6 records
[export-package]   tbl_slots: 396 records
[export-package]   tbl_hd_info: 8 records
[export-package]   tbl_disc: 65 records
[export-package]   tbl_logical_volume: 3 records
  totalRecords: 519
  output: exports/SH01/package.json
```

### 8.3 推送结果

```text
HTTP 200
status: success
duplicated: false
summary: { tableCount: 7, totalRecordCount: 114, successTableCount: 7, failedTableCount: 0 }
tables:
  tbl_task: received 37, upserted 37, success
  tbl_disc_lib: received 4, upserted 4, success
  tbl_magzines: received 6, upserted 0, success
  tbl_slots: received 396, upserted 0, success
  tbl_hd_info: received 8, upserted 8, success
  tbl_disc: received 65, upserted 65, success
  tbl_logical_volume: received 3, upserted 0, success
```

### 8.4 sync_package_log

```text
batchId:  SH01-2026-06-07T10-24-28-302Z
status:   success
tableCount: 7
totalRecordCount: 114
successTableCount: 7
failedTableCount: 0
version:  2H.1-exporter
```

### 8.5 中心库 SH01 行数

| 统一表 | 行数 | 备注 |
|---|---|---|
| `unified_tasks` | 44 | 旧 7 + 新 37 |
| `unified_devices` | 6 | 旧 2 + 新 4 |
| `unified_hard_disks` | 8 | 新 |
| `unified_disc_media` | 65 | 新 |
| `unified_volumes` | 5 | 旧 |
| `unified_magazines` | 0 | dispatcher 已接收 6 条但未入库 (非 Sprint 2H.1 范围) |
| `unified_slots` | 0 | dispatcher 已接收 396 条但未入库 (非 Sprint 2H.1 范围) |

### 8.6 Dashboard (SH01)

```json
{
  "taskCount": 44,
  "deviceCount": 6,
  "volumeCount": 5,
  "userCount": 3,
  "packageCount": 2,
  "failedPackageCount": 1,
  "lastSyncAt": "2026-06-07T10:24:28.921Z",
  "successRate": 50
}
```

### 8.7 Sync Center

```text
SH01 | SH01-2026-06-07T10-24-28-302Z | success | 7/7 tables | 114 records
```

## 9. 已知限制 / 后续 Sprint

1. **3 张表未入库**: `tbl_magzines` / `tbl_slots` / `tbl_logical_volume` 走 dispatcher 成功接收但 `inserted_count=0`。**这不是本 Sprint 范围**, 而是 dispatcher 内部 source_id 字段映射问题。建议 2H.2 排查。
2. **全量模式**: 当前 `--mode incremental` 仅作为标签, 实际仍 `SELECT *`。增量需要源端有 `updated_at` watermark 机制, **本 Sprint 不做**。
3. **没有 retry / DLQ**: 失败时手动重跑 `pnpm push:package`。生产需要重试 + DLQ。
4. **没有 checksum**: `pkg.checksum = null`。生产可加 SHA-256 (Sprint 2G.1 已预留字段)。
5. **没有断点续传**: 推送失败整包重传, 大包会浪费。生产应支持 batchId 续传。

## 10. 安全注意

- `SYNC_PACKAGE_SECRET` 在 `.env.local`, **绝对不提交到 git**
- 生产密钥应通过密钥管理服务分发, **不要写进镜像或代码**
- 5 分钟时间窗足够防重放, 配合 nonce 防止同 batchId 重放
- strict 模式是默认, dev 模式仅本地测试
- 站点侧如发现 SECRET 泄露, 必须**重新生成**而非沿用
