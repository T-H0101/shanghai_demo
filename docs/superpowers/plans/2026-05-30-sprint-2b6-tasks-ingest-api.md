# Sprint 2B.6：最小 Tasks Ingest API 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现最小 ingest API 原型，接收站点推送的 tasks 数据包，经过校验、幂等、UPSERT 写入中心库。

**Architecture:** 新建 `lib/ingest/` 模块，实现 tasks-ingest-service，复用现有 mapper/upsert 能力，新建 ingest_batch_log 表记录批次日志，使用环境变量管理 API Key，单独实现不复用 sync-engine。

**Tech Stack:** Next.js API Routes, PostgreSQL (pg), TypeScript, 环境变量认证

---

## 文件结构

### 新增文件

| 文件路径 | 职责 |
|----------|------|
| `lib/ingest/types.ts` | ingest 相关类型定义 |
| `lib/ingest/api-keys.ts` | API Key 校验逻辑 |
| `lib/ingest/tasks-ingest.ts` | tasks ingest 核心服务 |
| `lib/ingest/batch-log.ts` | ingest_batch_log 读写 |
| `lib/ingest/errors.ts` | 统一错误响应格式 |
| `app/api/ingest/tasks/route.ts` | POST /api/ingest/tasks 接口 |
| `databases/sprint-2b6/ingest-batch-log.sql` | ingest_batch_log 建表 SQL |

### 修改文件

| 文件路径 | 变更说明 |
|----------|----------|
| `.env.example` | 添加 INGEST_API_KEY 占位 |

---

## Task 1: 创建 ingest_batch_log 表

**Files:**
- Create: `databases/sprint-2b6/ingest-batch-log.sql`

- [ ] **Step 1: 创建 SQL 文件**

```sql
-- ============================================================
-- ingest_batch_log - 站点推送批次日志表
-- Sprint 2B.6 - Ingest API 基础设施
-- ============================================================
CREATE TABLE IF NOT EXISTS ingest_batch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id VARCHAR(100) NOT NULL,
  site_code VARCHAR(20) NOT NULL,
  source_table VARCHAR(50) NOT NULL,
  snapshot_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/running/success/failed/skipped
  rows_received INTEGER DEFAULT 0,
  rows_upserted INTEGER DEFAULT 0,
  error_message TEXT,
  duplicated BOOLEAN DEFAULT FALSE,
  payload_hash VARCHAR(64),  -- 用于判断同 batchId 重复推送时内容是否一致
  batch_source VARCHAR(20) DEFAULT 'provided',  -- provided/generated
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (batch_id, site_code, source_table)
);

CREATE INDEX IF NOT EXISTS idx_ingest_batch_log_site_table ON ingest_batch_log(site_code, source_table);
CREATE INDEX IF NOT EXISTS idx_ingest_batch_log_status ON ingest_batch_log(status);
CREATE INDEX IF NOT EXISTS idx_ingest_batch_log_received_at ON ingest_batch_log(received_at);
```

- [ ] **Step 2: 执行建表**

Run: `psql -h localhost -p 5432 -U postgres -d optical_disc_central -f databases/sprint-2b6/ingest-batch-log.sql`

- [ ] **Step 3: 验证表创建**

Run: `psql -h localhost -p 5432 -U postgres -d optical_disc_central -c "\d ingest_batch_log"`

Expected: 显示表结构，包含 batch_id, site_code, source_table 等字段

- [ ] **Step 4: Commit**

```bash
git add databases/sprint-2b6/ingest-batch-log.sql
git commit -m "feat: add ingest_batch_log table schema"
```

---

## Task 2: 创建 ingest 类型定义

**Files:**
- Create: `lib/ingest/types.ts`

- [ ] **Step 1: 创建类型文件**

```typescript
/**
 * Ingest 相关类型定义
 * Sprint 2B.6 - Tasks Ingest API
 */

/**
 * Ingest 请求体
 */
export interface IngestRequest {
  siteCode: string
  sourceTable: string
  batchId: string
  snapshotAt: string
  recordCount: number
  records: Record<string, unknown>[]
}

/**
 * Ingest 成功响应
 */
export interface IngestSuccessResponse {
  status: 'success'
  duplicated: boolean
  rowsUpserted: number
  batchId: string
}

/**
 * Ingest 错误响应
 */
export interface IngestErrorResponse {
  status: 'error'
  code: string
  message: string
  errors?: Array<{
    field: string
    expected?: unknown
    actual?: unknown
    message?: string
  }>
}

/**
 * ingest_batch_log 记录
 */
export interface IngestBatchLog {
  id: string
  batch_id: string
  site_code: string
  source_table: string
  snapshot_at: Date | null
  received_at: Date
  processed_at: Date | null
  status: string
  rows_received: number
  rows_upserted: number
  error_message: string | null
  duplicated: boolean
  payload_hash: string | null
  batch_source: string
  created_at: Date
}

/**
 * API Key 配置
 */
export interface ApiKeyConfig {
  siteCode: string
  apiKey: string
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/ingest/types.ts
git commit -m "feat: add ingest types definition"
```

---

## Task 3: 创建 ingest 错误响应格式

**Files:**
- Create: `lib/ingest/errors.ts`

- [ ] **Step 1: 创建错误响应模块**

```typescript
/**
 * Ingest 统一错误响应格式
 * Sprint 2B.6 - Tasks Ingest API
 */

import { NextResponse } from 'next/server'
import type { IngestErrorResponse } from './types'

/**
 * 错误码枚举
 */
export const ERROR_CODES = {
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_BATCH: 'DUPLICATE_BATCH',
  UNSUPPORTED_SOURCE_TABLE: 'UNSUPPORTED_SOURCE_TABLE',
  RECORD_LIMIT_EXCEEDED: 'RECORD_LIMIT_EXCEEDED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

/**
 * HTTP 状态码映射
 */
const HTTP_STATUS_MAP: Record<string, number> = {
  [ERROR_CODES.AUTH_ERROR]: 401,
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.DUPLICATE_BATCH]: 409,
  [ERROR_CODES.UNSUPPORTED_SOURCE_TABLE]: 400,
  [ERROR_CODES.RECORD_LIMIT_EXCEEDED]: 413,
  [ERROR_CODES.DATABASE_ERROR]: 500,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  code: string,
  message: string,
  errors?: IngestErrorResponse['errors']
): NextResponse<IngestErrorResponse> {
  const statusCode = HTTP_STATUS_MAP[code] || 500

  const response: IngestErrorResponse = {
    status: 'error',
    code,
    message,
    ...(errors && { errors }),
  }

  return NextResponse.json(response, { status: statusCode })
}

/**
 * 认证失败
 */
export function authError(message: string = 'API Key missing or invalid') {
  return createErrorResponse(ERROR_CODES.AUTH_ERROR, message)
}

/**
 * siteCode 与 API Key 不匹配
 */
export function authMismatchError(siteCode: string) {
  return createErrorResponse(
    ERROR_CODES.AUTH_ERROR,
    `API Key does not match siteCode: ${siteCode}`,
  )
}

/**
 * 字段校验失败
 */
export function validationError(
  message: string,
  errors?: IngestErrorResponse['errors']
) {
  return createErrorResponse(ERROR_CODES.VALIDATION_ERROR, message, errors)
}

/**
 * 批次重复但内容不一致
 */
export function duplicateBatchError(batchId: string) {
  return createErrorResponse(
    ERROR_CODES.DUPLICATE_BATCH,
    `Batch ${batchId} already processed with different content`
  )
}

/**
 * 不支持的源表
 */
export function unsupportedSourceTableError(table: string) {
  return createErrorResponse(
    ERROR_CODES.UNSUPPORTED_SOURCE_TABLE,
    `Unsupported source table: ${table}`
  )
}

/**
 * 超过记录数限制
 */
export function recordLimitExceededError(count: number, limit: number) {
  return createErrorResponse(
    ERROR_CODES.RECORD_LIMIT_EXCEEDED,
    `Record count ${count} exceeds limit ${limit}`,
    [
      {
        field: 'records',
        expected: limit,
        actual: count,
        message: 'Records array length exceeds maximum limit',
      },
    ]
  )
}

/**
 * 数据库错误
 */
export function databaseError(message: string) {
  return createErrorResponse(ERROR_CODES.DATABASE_ERROR, message)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/ingest/errors.ts
git commit -m "feat: add ingest error response helpers"
```

---

## Task 4: 创建 API Key 校验模块

**Files:**
- Create: `lib/ingest/api-keys.ts`

- [ ] **Step 1: 创建 API Key 校验模块**

```typescript
/**
 * API Key 校验
 * Sprint 2B.6 - Tasks Ingest API
 *
 * 使用环境变量配置 API Key，格式：
 * INGEST_API_KEY_{siteCode}=your-secret-key
 */

/**
 * 校验 API Key 是否有效
 * @returns 有效返回 siteCode，无效返回 null
 */
export function validateApiKey(apiKey: string): string | null {
  if (!apiKey) {
    return null
  }

  // 遍历环境变量，查找匹配的 API Key
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('INGEST_API_KEY_') && value === apiKey) {
      // 提取 siteCode: INGEST_API_KEY_SH01 -> SH01
      const siteCode = key.replace('INGEST_API_KEY_', '')
      if (siteCode && siteCode.length > 0) {
        return siteCode
      }
    }
  }

  return null
}

/**
 * 校验 siteCode 是否与 API Key 匹配
 */
export function validateSiteCodeMatch(
  apiKey: string,
  siteCode: string
): boolean {
  const matchedSiteCode = validateApiKey(apiKey)
  return matchedSiteCode !== null && matchedSiteCode === siteCode
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/ingest/api-keys.ts
git commit -m "feat: add API key validation module"
```

---

## Task 5: 创建 ingest_batch_log 读写模块

**Files:**
- Create: `lib/ingest/batch-log.ts`

- [ ] **Step 1: 创建 batch-log 模块**

```typescript
/**
 * ingest_batch_log 读写操作
 * Sprint 2B.6 - Tasks Ingest API
 */

import { query, transaction } from '@/lib/db'
import type { PoolClient } from 'pg'

/**
 * 计算 payload hash (SHA-256)
 */
export async function calculatePayloadHash(payload: unknown): Promise<string> {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 检查 batchId 是否已成功处理
 * @returns 已成功返回记录，未找到返回 null
 */
export async function getSuccessfulBatch(
  batchId: string,
  siteCode: string,
  sourceTable: string
) {
  const sql = `
    SELECT id, batch_id, payload_hash
    FROM ingest_batch_log
    WHERE batch_id = $1
      AND site_code = $2
      AND source_table = $3
      AND status = 'success'
    ORDER BY created_at DESC
    LIMIT 1
  `
  const result = await query(sql, [batchId, siteCode, sourceTable])
  return result.rows[0] || null
}

/**
 * 创建 ingest_batch_log 记录
 * @returns 创建的记录 id
 */
export async function createBatchLog(
  batchId: string,
  siteCode: string,
  sourceTable: string,
  snapshotAt: string | null,
  rowsReceived: number,
  payloadHash: string,
  batchSource: string = 'provided'
): Promise<string> {
  const sql = `
    INSERT INTO ingest_batch_log (
      batch_id, site_code, source_table, snapshot_at,
      received_at, status, rows_received, payload_hash, batch_source
    ) VALUES ($1, $2, $3, $4, NOW(), 'pending', $5, $6, $7)
    RETURNING id
  `
  const result = await query(sql, [
    batchId,
    siteCode,
    sourceTable,
    snapshotAt,
    rowsReceived,
    payloadHash,
    batchSource,
  ])
  return result.rows[0].id
}

/**
 * 更新 batch_log 状态为 success
 */
export async function updateBatchLogSuccess(
  logId: string,
  rowsUpserted: number,
  duplicated: boolean = false
) {
  const sql = `
    UPDATE ingest_batch_log
    SET status = 'success',
        processed_at = NOW(),
        rows_upserted = $1,
        duplicated = $2
    WHERE id = $3
  `
  await query(sql, [rowsUpserted, duplicated, logId])
}

/**
 * 更新 batch_log 状态为 failed
 */
export async function updateBatchLogFailed(
  logId: string,
  errorMessage: string
) {
  const sql = `
    UPDATE ingest_batch_log
    SET status = 'failed',
        processed_at = NOW(),
        error_message = $1
    WHERE id = $2
  `
  await query(sql, [errorMessage, logId])
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/ingest/batch-log.ts
git commit -m "feat: add ingest batch log CRUD operations"
```

---

## Task 6: 创建 tasks-ingest 核心服务

**Files:**
- Create: `lib/ingest/tasks-ingest.ts`

- [ ] **Step 1: 创建 tasks-ingest 服务**

```typescript
/**
 * Tasks Ingest Service
 * Sprint 2B.6 - 最小 ingest API 原型
 *
 * 接收站点推送的 tasks 数据包，经过校验、幂等、UPSERT 写入 unified_tasks
 */

import { transaction } from '@/lib/db'
import { mapTask } from '@/lib/sync/field-mapper'
import { upsertTasksInTransaction } from '@/lib/sync/upsert'
import type { TaskSourceRecord } from '@/lib/sync/types'
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
const ALLOWED_SOURCE_TABLES = ['tbl_task']

// 最大记录数限制
const MAX_RECORDS = 10000

/**
 * 校验请求体
 */
function validateRequest(body: IngestRequest) {
  const errors: Array<{ field: string; expected?: unknown; actual?: unknown; message?: string }> = []

  // 必填字段
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

  // recordCount 校验
  if (Array.isArray(body.records) && body.recordCount !== body.records.length) {
    errors.push({
      field: 'recordCount',
      expected: body.recordCount,
      actual: body.records.length,
      message: 'recordCount does not match records.length',
    })
  }

  // 记录数限制
  if (Array.isArray(body.records) && body.records.length > MAX_RECORDS) {
    errors.push({
      field: 'records',
      expected: MAX_RECORDS,
      actual: body.records.length,
      message: `Records array length exceeds maximum limit ${MAX_RECORDS}`,
    })
  }

  return errors
}

/**
 * 处理 tasks ingest
 */
export async function ingestTasks(
  body: IngestRequest,
  siteCode: string
): Promise<IngestSuccessResponse> {
  const { sourceTable, batchId, snapshotAt, records } = body

  // 1. 校验 sourceTable
  if (!ALLOWED_SOURCE_TABLES.includes(sourceTable)) {
    throw { response: unsupportedSourceTableError(sourceTable) }
  }

  // 2. 校验请求体
  const validationErrors = validateRequest(body)
  if (validationErrors.length > 0) {
    throw {
      response: validationError('Validation failed', validationErrors),
    }
  }

  // 3. 计算 payload hash
  const payloadHash = await calculatePayloadHash(body)

  // 4. 检查 batchId 幂等
  const existingBatch = await getSuccessfulBatch(batchId, siteCode, sourceTable)
  if (existingBatch) {
    // 检查 payload hash 是否一致
    if (existingBatch.payload_hash === payloadHash) {
      // 内容一致，返回 duplicated
      return {
        status: 'success',
        duplicated: true,
        rowsUpserted: 0,
        batchId,
      }
    } else {
      // 内容不一致，返回 409
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
    // 6. 转换为 UnifiedTaskRecord
    const taskRecords: TaskSourceRecord[] = records.map((r) => ({
      id: r.id as number,
      task_no: r.task_no as string,
      task_name: r.task_name as string,
      task_type: r.task_type as string,
      status: r.status as string,
      phase: r.phase as string,
      priority: r.priority as string,
      data_classification: r.data_classification as string,
      archive_name: r.archive_name as string,
      source_path: r.source_path as string,
      package_path: r.package_path as string,
      operator: r.operator as string,
      department: r.department as string,
      created_at: new Date(r.created_at as string),
      updated_at: new Date(r.updated_at as string),
    }))

    // 7. 映射为统一格式
    const mappedRecords = taskRecords.map(mapTask)

    // 8. 事务内 UPSERT
    const { rowsUpserted } = await transaction(async (client) => {
      return upsertTasksInTransaction(mappedRecords, client)
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

    // 如果是已知错误响应，直接抛出
    if (error && typeof error === 'object' && 'response' in error) {
      throw error
    }

    throw { response: databaseError(errorMessage) }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/ingest/tasks-ingest.ts
git commit -m "feat: implement tasks ingest service"
```

---

## Task 7: 创建 POST /api/ingest/tasks 接口

**Files:**
- Create: `app/api/ingest/tasks/route.ts`

- [ ] **Step 1: 创建 API 路由**

```typescript
/**
 * POST /api/ingest/tasks
 * 接收站点推送的 tasks 数据包
 * Sprint 2B.6 - 最小 ingest API 原型
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, validateSiteCodeMatch } from '@/lib/ingest/api-keys'
import { ingestTasks } from '@/lib/ingest/tasks-ingest'
import { authError, authMismatchError, validationError, databaseError } from '@/lib/ingest/errors'
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

    // 4. 校验 siteCode 与 API Key 匹配
    if (!validateSiteCodeMatch(apiKey, body.siteCode)) {
      return authMismatchError(body.siteCode)
    }

    // 5. 调用 ingest service
    const result = await ingestTasks(body, matchedSiteCode)

    // 6. 返回成功响应
    return NextResponse.json(result)
  } catch (error) {
    // 如果是已知错误响应
    if (error && typeof error === 'object' && 'response' in error) {
      return (error as { response: NextResponse }).response
    }

    // 未知错误
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return databaseError(errorMessage)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/ingest/tasks/route.ts
git commit -m "feat: add POST /api/ingest/tasks endpoint"
```

---

## Task 8: 更新 .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: 添加 INGEST_API_KEY 占位**

在 `.env.example` 中添加：

```bash
# ============================================================
# Ingest API Keys
# 格式：INGEST_API_KEY_{siteCode}=your-secret-key
# 注意：不要提交真实 key 到 git
# ============================================================
INGEST_API_KEY_SH01=replace-with-site-api-key
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add INGEST_API_KEY placeholder to .env.example"
```

---

## Task 9: 构建验证

- [ ] **Step 1: TypeScript 检查**

Run: `pnpm exec tsc --noEmit`
Expected: 通过，无错误

- [ ] **Step 2: 构建检查**

Run: `pnpm build`
Expected: 通过，`/api/ingest/tasks` 路由出现在构建输出中

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: verify tsc and build pass"
```

---

## Task 10: 验收测试

- [ ] **Step 1: 测试无 API Key**

Run:
```bash
curl -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_task","batchId":"test-1","snapshotAt":"2026-05-30T10:00:00Z","recordCount":0,"records":[]}'
```

Expected: 401 `{"status":"error","code":"AUTH_ERROR","message":"x-api-key header is required"}`

- [ ] **Step 2: 测试错误 API Key**

Run:
```bash
curl -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: wrong-key" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_task","batchId":"test-1","snapshotAt":"2026-05-30T10:00:00Z","recordCount":0,"records":[]}'
```

Expected: 401 `{"status":"error","code":"AUTH_ERROR","message":"Invalid API Key"}`

- [ ] **Step 3: 测试 siteCode 不匹配**

Run:
```bash
curl -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"siteCode":"BJ01","sourceTable":"tbl_task","batchId":"test-1","snapshotAt":"2026-05-30T10:00:00Z","recordCount":0,"records":[]}'
```

Expected: 401 `{"status":"error","code":"AUTH_ERROR","message":"API Key does not match siteCode: BJ01"}`

- [ ] **Step 4: 测试成功 ingest**

Run:
```bash
curl -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "siteCode": "SH01",
    "sourceTable": "tbl_task",
    "batchId": "test-batch-001",
    "snapshotAt": "2026-05-30T10:00:00Z",
    "recordCount": 2,
    "records": [
      {
        "id": 100,
        "task_no": "INGEST-001",
        "task_name": "测试任务1",
        "task_type": "backup",
        "status": "pending",
        "phase": "preparing",
        "priority": "normal",
        "data_classification": "internal",
        "archive_name": "test-archive-1",
        "source_path": "/test/source1",
        "package_path": "/test/package1",
        "operator": "testuser",
        "department": "IT",
        "created_at": "2026-05-30T09:00:00Z",
        "updated_at": "2026-05-30T09:00:00Z"
      },
      {
        "id": 101,
        "task_no": "INGEST-002",
        "task_name": "测试任务2",
        "task_type": "restore",
        "status": "pending",
        "phase": "preparing",
        "priority": "high",
        "data_classification": "confidential",
        "archive_name": "test-archive-2",
        "source_path": "/test/source2",
        "package_path": "/test/package2",
        "operator": "testuser",
        "department": "IT",
        "created_at": "2026-05-30T09:00:00Z",
        "updated_at": "2026-05-30T09:00:00Z"
      }
    ]
  }'
```

Expected: 200 `{"status":"success","duplicated":false,"rowsUpserted":2,"batchId":"test-batch-001"}`

- [ ] **Step 5: 测试重复 batchId**

Run Step 4 命令再次执行。

Expected: 200 `{"status":"success","duplicated":true,"rowsUpserted":0,"batchId":"test-batch-001"}`

- [ ] **Step 6: 测试 recordCount 不匹配**

Run:
```bash
curl -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_task","batchId":"test-batch-002","snapshotAt":"2026-05-30T10:00:00Z","recordCount":5,"records":[]}'
```

Expected: 400 `{"status":"error","code":"VALIDATION_ERROR","message":"Validation failed","errors":[...]}`

- [ ] **Step 7: 测试 sourceTable 不支持**

Run:
```bash
curl -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_invalid","batchId":"test-batch-003","snapshotAt":"2026-05-30T10:00:00Z","recordCount":0,"records":[]}'
```

Expected: 400 `{"status":"error","code":"UNSUPPORTED_SOURCE_TABLE","message":"Unsupported source table: tbl_invalid"}`

- [ ] **Step 8: 测试超过记录数限制**

Run:
```bash
# 生成超过 10000 条记录的请求（此处用 recordCount 模拟）
curl -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_task","batchId":"test-batch-004","snapshotAt":"2026-05-30T10:00:00Z","recordCount":10001,"records":[]}'
```

Expected: 413 `{"status":"error","code":"RECORD_LIMIT_EXCEEDED","message":"Record count 10001 exceeds limit 10000"}`

- [ ] **Step 9: 验证 ingest_batch_log**

Run:
```bash
psql -h localhost -p 5432 -U postgres -d optical_disc_central -c "SELECT batch_id, site_code, source_table, status, rows_received, rows_upserted, duplicated, payload_hash FROM ingest_batch_log ORDER BY created_at DESC LIMIT 5;"
```

Expected: 显示测试批次记录，包含 batch_id、site_code、source_table、status、rows_received、rows_upserted、duplicated、payload_hash

- [ ] **Step 10: 验证 unified_tasks 写入**

Run:
```bash
psql -h localhost -p 5432 -U postgres -d optical_disc_central -c "SELECT source_id, task_no, task_name, status FROM unified_tasks WHERE source_id IN ('100', '101');"
```

Expected: 显示刚才 ingest 写入的 2 条记录

- [ ] **Step 11: 验证现有接口不受影响**

Run:
```bash
curl -X POST http://localhost:3000/api/sync/tasks
curl http://localhost:3000/api/sync/status
```

Expected: 正常返回，行为与 ingest 前一致

---

## Sprint 2B.6 不做事项

| 不做 | 说明 |
|------|------|
| 不做 /api/ingest/devices | 下个 Sprint |
| 不接真实站点 | 用 curl 测试 |
| 不处理 tbl_file/tbl_folder | 大表暂不进入 |
| 不做 ES | 后续 Sprint |
| 不做 UI | ingest 日志暂不展示 |
| 不改 /api/sync/* | 现有能力保留 |
| 不做 ingest 日志查询接口 | 只记录，查询后续再做 |
| 不做超 10000 条分包 | 超限直接拒绝 |
| 不做定时推送 | 只做接口 |
| 不提交 .env.local | API Key 用环境变量 |
| 不做 API Key 配置管理 UI | 环境变量管理 |

---

## 验收标准汇总

| 检查项 | 预期 |
|--------|------|
| tsc --noEmit | 通过 |
| pnpm build | 通过 |
| POST /api/ingest/tasks（无 key） | 401 AUTH_ERROR |
| POST /api/ingest/tasks（错误 key） | 401 AUTH_ERROR |
| POST /api/ingest/tasks（key 正确但 siteCode 不匹配） | 403 AUTH_ERROR |
| POST /api/ingest/tasks（正确 key + 有效数据） | 200 success + 写入 unified_tasks |
| POST /api/ingest/tasks（重复 batchId） | 200 success + duplicated: true |
| POST /api/ingest/tasks（同 batchId，内容不同） | 409 DUPLICATE_BATCH |
| POST /api/ingest/tasks（recordCount 不匹配） | 400 VALIDATION_ERROR |
| POST /api/ingest/tasks（sourceTable 错误） | 400 UNSUPPORTED_SOURCE_TABLE |
| POST /api/ingest/tasks（records 超过 10000） | 413 RECORD_LIMIT_EXCEEDED |
| POST /api/sync/tasks | 照常工作 |
| GET /api/sync/status | 照常工作 |
| ingest_batch_log 表 | 有记录，字段完整 |

---

*Plan created: 2026-05-30*
*Sprint 2B.6: 最小 Tasks Ingest API 实现计划*