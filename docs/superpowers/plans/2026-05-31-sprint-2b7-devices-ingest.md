# Sprint 2B.7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 POST /api/ingest/devices，接收站点推送的 devices 数据包，复用现有 mapper/upsert 和 ingest 基础设施。

**Architecture:** 复制 tasks-ingest 结构，替换字段映射为 mapDeviceForIngest（适配 siteCode），替换 upsert 为 upsertDevicesInTransaction。不修改任何现有文件。

**Tech Stack:** Next.js API Routes, PostgreSQL (pg), TypeScript

---

## 字段映射核对

### DeviceSourceRecord（types.ts）→ unified_devices（schema）

| 源字段 (DeviceSourceRecord) | unified_devices 列 | 处理方式 |
|-----|-----|-----|
| id | source_id | String(id) |
| device_no | device_id | 直接映射 |
| device_name | device_name | 直接映射 |
| device_type | device_type | 直接映射 |
| device_status | status | 重命名 |
| ip_address | ip_address | 直接映射 |
| location | location | 直接映射 |
| room | room | 直接映射 |
| floor | floor | 直接映射 |
| total_capacity | total_capacity | 直接映射 |
| used_capacity | used_capacity | 直接映射 |
| last_heartbeat | raw_data | 存入 raw_data |
| operator | raw_data | 存入 raw_data |
| created_at | — | 不写入目标（unified_devices 用 NOW()） |
| updated_at | — | 不写入目标 |

### unified_devices 有但源表无的字段（使用默认值）

| 列 | 默认值 |
|-----|--------|
| model | null |
| manufacturer | null |
| serial_no | null |
| site_code | null |
| slot_count | null |
| cage_count | 0 |
| mode | null |
| use_status | 0 |
| current_task_count | 0 |

**结论：unified_devices 现有 schema 足够，不需要 ALTER。**

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `lib/ingest/devices-ingest.ts` | devices ingest 核心服务 |
| `app/api/ingest/devices/route.ts` | POST /api/ingest/devices 路由 |

### 复用文件（不修改）

| 文件 | 复用内容 |
|------|----------|
| `lib/ingest/api-keys.ts` | validateApiKey、validateSiteCodeMatch |
| `lib/ingest/errors.ts` | 所有错误响应 helper |
| `lib/ingest/batch-log.ts` | calculatePayloadHash、getSuccessfulBatch、createBatchLog、updateBatchLogSuccess、updateBatchLogFailed |
| `lib/ingest/types.ts` | IngestRequest、IngestSuccessResponse |

### 不修改的文件

| 文件 | 原因 |
|------|------|
| `lib/ingest/tasks-ingest.ts` | 不破坏 tasks ingest |
| `app/api/ingest/tasks/route.ts` | 不破坏 tasks ingest |
| `lib/sync/*` | 不破坏现有 mock 同步 |
| `app/api/sync/*` | 不破坏现有接口 |

---

## Task 1: 创建 devices-ingest 核心服务

**Files:**
- Create: `lib/ingest/devices-ingest.ts`

**内容要点：**
- sourceTable = `'tbl_disc_lib'`
- ALLOWED_SOURCE_TABLES = `['tbl_disc_lib']`
- 字段映射：device_no → device_id，device_status → status，last_heartbeat/operator → raw_data
- 复用 upsertDevicesInTransaction（从 `@/lib/sync/upsert` 导入）
- 复用 batch-log 操作
- 不导入 mapDiscLibToTarget（因为需要适配 siteCode，写 mapDeviceForIngest）

- [ ] **Step 1: 创建 devices-ingest.ts**

```typescript
/**
 * Devices Ingest Service
 * Sprint 2B.7 - devices ingest 扩展
 *
 * 接收站点推送的 devices 数据包，经过校验、幂等、UPSERT 写入 unified_devices
 */

import { transaction } from '@/lib/db'
import { upsertDevicesInTransaction } from '@/lib/sync/upsert'
import type { DeviceSourceRecord, UnifiedDeviceRecord } from '@/lib/sync/types'
import type { IngestRequest, IngestSuccessResponse } from './types'
import {
  validationError,
  unsupportedSourceTableError,
  recordLimitExceededError,
  duplicateBatchError,
  databaseError,
} from './errors'
import {
  getSuccessfulBatch,
  createBatchLog,
  updateBatchLogSuccess,
  updateBatchLogFailed,
  calculatePayloadHash,
} from './batch-log'

// 允许的 sourceTable
const ALLOWED_SOURCE_TABLES = ['tbl_disc_lib']

// 最大记录数限制
const MAX_RECORDS = 10000

/**
 * 校验请求体
 */
function validateRequest(body: IngestRequest) {
  const errors: Array<{ field: string; expected?: unknown; actual?: unknown; message?: string }> = []

  if (!body.siteCode) {
    errors.push({ field: 'siteCode', message: 'siteCode is required' })
  }
  if (!body.sourceTable) {
    errors.push({ field: 'sourceTable', message: 'sourceTable is required' })
  }
  if (!body.batchId) {
    errors.push({ field: 'batchId', message: 'batchId is required' })
  }
  if (!body.snapshotAt) {
    errors.push({ field: 'snapshotAt', message: 'snapshotAt is required' })
  }
  if (body.recordCount === undefined || body.recordCount === null) {
    errors.push({ field: 'recordCount', message: 'recordCount is required' })
  }
  if (!Array.isArray(body.records)) {
    errors.push({ field: 'records', message: 'records must be an array' })
  }

  // recordCount 校验（只在 recordCount 未超过限制时检查 mismatch）
  if (body.recordCount !== undefined && body.recordCount !== null && body.recordCount <= MAX_RECORDS) {
    if (Array.isArray(body.records) && body.recordCount !== body.records.length) {
      errors.push({
        field: 'recordCount',
        expected: body.recordCount,
        actual: body.records.length,
        message: 'recordCount does not match records.length',
      })
    }
  }

  return errors
}

/**
 * Map device source record for ingest (uses API-provided siteCode)
 */
function mapDeviceForIngest(source: DeviceSourceRecord, siteCode: string, sourceTable: string): UnifiedDeviceRecord {
  return {
    source_site_id: siteCode,
    source_table: sourceTable,
    source_id: String(source.id),
    synced_at: new Date(),
    device_id: source.device_no,
    device_name: source.device_name,
    device_type: source.device_type,
    status: source.device_status,
    ip_address: source.ip_address,
    location: source.location,
    room: source.room,
    floor: source.floor,
    total_capacity: source.total_capacity,
    used_capacity: source.used_capacity,
    raw_data: {
      last_heartbeat: source.last_heartbeat,
      operator: source.operator,
    },
  }
}

/**
 * 处理 devices ingest
 */
export async function ingestDevices(
  body: IngestRequest,
  siteCode: string
): Promise<IngestSuccessResponse> {
  const { sourceTable, batchId, snapshotAt, records } = body

  // 1. 校验 sourceTable
  if (!ALLOWED_SOURCE_TABLES.includes(sourceTable)) {
    throw { response: unsupportedSourceTableError(sourceTable) }
  }

  // 2. 校验记录数限制
  if (body.recordCount > MAX_RECORDS) {
    throw { response: recordLimitExceededError(body.recordCount, MAX_RECORDS) }
  }

  // 3. 校验请求体
  const validationErrors = validateRequest(body)
  if (validationErrors.length > 0) {
    throw {
      response: validationError('Validation failed', validationErrors),
    }
  }

  // 4. 计算 payload hash 和检查 batchId 幂等（并行执行）
  const [payloadHash, existingBatch] = await Promise.all([
    calculatePayloadHash(body),
    getSuccessfulBatch(batchId, siteCode, sourceTable),
  ])

  if (existingBatch) {
    if (existingBatch.payload_hash === payloadHash) {
      return {
        status: 'success',
        duplicated: true,
        rowsUpserted: 0,
        batchId,
      }
    } else {
      throw { response: duplicateBatchError(batchId) }
    }
  }

  // 5. 创建 batch_log
  const logId = await createBatchLog(
    batchId,
    siteCode,
    sourceTable,
    snapshotAt,
    records.length,
    payloadHash
  )

  try {
    // 6. 转换为 DeviceSourceRecord
    const deviceRecords: DeviceSourceRecord[] = records.map((r) => ({
      id: r.id as number,
      device_no: r.device_no as string,
      device_name: r.device_name as string,
      device_type: r.device_type as string,
      device_status: r.device_status as string,
      last_heartbeat: r.last_heartbeat ? new Date(r.last_heartbeat as string) : null,
      operator: r.operator as string,
      ip_address: r.ip_address as string,
      location: r.location as string,
      room: r.room as string,
      floor: r.floor as string,
      total_capacity: r.total_capacity as number,
      used_capacity: r.used_capacity as number,
      created_at: new Date(r.created_at as string),
      updated_at: new Date(r.updated_at as string),
    }))

    // 7. 映射为统一格式
    const mappedRecords = deviceRecords.map((r) => mapDeviceForIngest(r, siteCode, sourceTable))

    // 8. 事务内 UPSERT
    const { rowsUpserted } = await transaction(async (client) => {
      return upsertDevicesInTransaction(mappedRecords, client)
    })

    // 9. 更新 batch_log 为 success
    await updateBatchLogSuccess(logId, rowsUpserted)

    return {
      status: 'success',
      duplicated: false,
      rowsUpserted,
      batchId,
    }
  } catch (error) {
    // 10. 失败处理
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await updateBatchLogFailed(logId, errorMessage)

    if (error && typeof error === 'object' && 'response' in error) {
      throw error
    }

    throw { response: databaseError(errorMessage) }
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `pnpm exec tsc --noEmit`
Expected: 通过

- [ ] **Step 3: Commit**

```bash
git add lib/ingest/devices-ingest.ts
git commit -m "feat: implement devices ingest service"
```

---

## Task 2: 创建 POST /api/ingest/devices 路由

**Files:**
- Create: `app/api/ingest/devices/route.ts`

- [ ] **Step 1: 创建路由文件**

```typescript
/**
 * POST /api/ingest/devices
 * 接收站点推送的 devices 数据包
 * Sprint 2B.7 - devices ingest 扩展
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, validateSiteCodeMatch } from '@/lib/ingest/api-keys'
import { ingestDevices } from '@/lib/ingest/devices-ingest'
import { authError, authMismatchError, validationError, createErrorResponse, ERROR_CODES } from '@/lib/ingest/errors'
import type { IngestRequest } from '@/lib/ingest/types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. 获取 API Key
    const apiKey = request.headers.get('x-api-key') || ''
    if (!apiKey) {
      return authError('x-api-key header is required')
    }

    // 2. 校验 API Key
    const matchedSiteCode = validateApiKey(apiKey)
    if (!matchedSiteCode) {
      return authError('Invalid API Key')
    }

    // 3. 解析请求体
    let body: IngestRequest
    try {
      body = await request.json()
    } catch {
      return validationError('Invalid JSON body')
    }

    // 4. 校验 siteCode 与已验证的 siteCode 匹配
    if (!validateSiteCodeMatch(matchedSiteCode, body.siteCode)) {
      return authMismatchError(body.siteCode)
    }

    // 5. 调用 ingest service
    const result = await ingestDevices(body, matchedSiteCode)

    // 6. 返回成功响应
    return NextResponse.json(result)
  } catch (error) {
    if (error && typeof error === 'object' && 'response' in error) {
      return (error as { response: NextResponse }).response
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Ingest Devices API Error]', error)
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR, errorMessage)
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `pnpm exec tsc --noEmit`
Expected: 通过

- [ ] **Step 3: Commit**

```bash
git add app/api/ingest/devices/route.ts
git commit -m "feat: add POST /api/ingest/devices endpoint"
```

---

## Task 3: 构建验证

- [ ] **Step 1: TypeScript 检查**

Run: `pnpm exec tsc --noEmit`
Expected: 通过

- [ ] **Step 2: 构建检查**

Run: `pnpm build`
Expected: 通过，`/api/ingest/devices` 出现在路由表

- [ ] **Step 3: 验证现有接口不受影响**

Run:
```bash
curl -s -X POST http://localhost:3000/api/ingest/tasks -H "Content-Type: application/json" -H "x-api-key: test-api-key-123" -d '{"siteCode":"SH01","sourceTable":"tbl_task","batchId":"verify-tasks","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
curl -s -X POST http://localhost:3000/api/sync/tasks
curl -s http://localhost:3000/api/sync/status
```

Expected: 全部正常返回

---

## Task 4: 验收测试

- [ ] **Step 1: 测试无 API Key**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_disc_lib","batchId":"d-1","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

Expected: 401

- [ ] **Step 2: 测试错误 API Key**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: wrong-key" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_disc_lib","batchId":"d-2","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

Expected: 401

- [ ] **Step 3: 测试 siteCode 不匹配**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"BJ01","sourceTable":"tbl_disc_lib","batchId":"d-3","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

Expected: 403

- [ ] **Step 4: 测试 recordCount 不匹配**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_disc_lib","batchId":"d-4","snapshotAt":"2026-05-31T10:00:00Z","recordCount":5,"records":[]}'
```

Expected: 400

- [ ] **Step 5: 测试 sourceTable 错误**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_invalid","batchId":"d-5","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

Expected: 400

- [ ] **Step 6: 测试 records 超过 10000**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_disc_lib","batchId":"d-6","snapshotAt":"2026-05-31T10:00:00Z","recordCount":10001,"records":[]}'
```

Expected: 413

- [ ] **Step 7: 测试成功 ingest**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{
    "siteCode": "SH01",
    "sourceTable": "tbl_disc_lib",
    "batchId": "devices-batch-001",
    "snapshotAt": "2026-05-31T10:00:00Z",
    "recordCount": 2,
    "records": [
      {
        "id": 5001,
        "device_no": "DEV-INGEST-001",
        "device_name": "光盘库X",
        "device_type": "optical_library",
        "device_status": "online",
        "last_heartbeat": "2026-05-31T09:00:00Z",
        "operator": "admin",
        "ip_address": "192.168.1.201",
        "location": "上海数据中心",
        "room": "B201",
        "floor": "2F",
        "total_capacity": 2000,
        "used_capacity": 800,
        "created_at": "2026-05-01T00:00:00Z",
        "updated_at": "2026-05-31T00:00:00Z"
      },
      {
        "id": 5002,
        "device_no": "DEV-INGEST-002",
        "device_name": "光盘库Y",
        "device_type": "optical_library",
        "device_status": "offline",
        "last_heartbeat": null,
        "operator": "admin",
        "ip_address": "192.168.1.202",
        "location": "上海数据中心",
        "room": "B202",
        "floor": "2F",
        "total_capacity": 3000,
        "used_capacity": 1200,
        "created_at": "2026-05-01T00:00:00Z",
        "updated_at": "2026-05-31T00:00:00Z"
      }
    ]
  }'
```

Expected: 200 + `{"status":"success","duplicated":false,"rowsUpserted":2,"batchId":"devices-batch-001"}`

- [ ] **Step 8: 测试重复 batchId（内容相同）**

重复 Step 7 的 curl。

Expected: 200 + `{"status":"success","duplicated":true,"rowsUpserted":0,"batchId":"devices-batch-001"}`

- [ ] **Step 9: 测试重复 batchId（内容不同）**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_disc_lib","batchId":"devices-batch-001","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

Expected: 409

- [ ] **Step 10: 验证 unified_devices 写入**

```bash
docker exec -i $(docker ps -q --filter "ancestor=postgres:17" | head -1) psql -U unified -d unified_disc_platform -c "SELECT source_site_id, source_id, device_id, device_name, status FROM unified_devices WHERE source_id IN ('5001', '5002');"
```

Expected: 2 条记录，source_site_id = 'SH01'

- [ ] **Step 11: 验证 ingest_batch_log**

```bash
docker exec -i $(docker ps -q --filter "ancestor=postgres:17" | head -1) psql -U unified -d unified_disc_platform -c "SELECT batch_id, site_code, source_table, status, rows_upserted, duplicated FROM ingest_batch_log WHERE source_table = 'tbl_disc_lib' ORDER BY created_at DESC LIMIT 3;"
```

Expected: 显示 devices 批次记录

- [ ] **Step 12: 验证现有接口不受影响**

```bash
curl -s -X POST http://localhost:3000/api/ingest/tasks -H "Content-Type: application/json" -H "x-api-key: test-api-key-123" -d '{"siteCode":"SH01","sourceTable":"tbl_task","batchId":"verify-after","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
curl -s -X POST http://localhost:3000/api/sync/tasks
curl -s http://localhost:3000/api/sync/status
```

Expected: 全部正常返回

---

## Sprint 2B.7 不做事项

| 不做 | 说明 |
|------|------|
| 不抽取通用 ingest-service | 过早抽象 |
| 不做 sites/volumes ingest | 后续 Sprint |
| 不接真实站点 | 用 curl 测试 |
| 不处理 tbl_file/tbl_folder | 大表暂不进入 |
| 不做 ES | 后续 Sprint |
| 不做 UI | 日志暂不展示 |
| 不改 /api/ingest/tasks | 不破坏 |
| 不改 /api/sync/* | 不破坏 |
| 不提交 .env.local | API Key 环境变量 |
| 不修改 unified_devices 表 | 现有 schema 足够 |

---

## 验收标准汇总

| 检查项 | 预期 |
|--------|------|
| tsc --noEmit | 通过 |
| pnpm build | 通过 |
| POST /api/ingest/devices（无 key） | 401 AUTH_ERROR |
| POST /api/ingest/devices（错误 key） | 401 AUTH_ERROR |
| POST /api/ingest/devices（key 正确但 siteCode 不匹配） | 403 AUTH_ERROR |
| POST /api/ingest/devices（recordCount 不匹配） | 400 VALIDATION_ERROR |
| POST /api/ingest/devices（sourceTable 错误） | 400 UNSUPPORTED_SOURCE_TABLE |
| POST /api/ingest/devices（records 超过 10000） | 413 RECORD_LIMIT_EXCEEDED |
| POST /api/ingest/devices（正确 key + 有效数据） | 200 success + 写入 unified_devices |
| POST /api/ingest/devices（重复 batchId 内容相同） | 200 success + duplicated: true |
| POST /api/ingest/devices（重复 batchId 内容不同） | 409 DUPLICATE_BATCH |
| POST /api/ingest/tasks | 照常工作 |
| POST /api/sync/tasks | 照常工作 |
| GET /api/sync/status | 照常工作 |
| ingest_batch_log 表（tbl_disc_lib 记录） | 有记录 |

---

*Plan created: 2026-05-31*
*Sprint 2B.7: devices ingest 扩展*