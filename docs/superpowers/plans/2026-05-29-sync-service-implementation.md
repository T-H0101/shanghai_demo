# Sprint 2B.2 同步服务骨架实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 tasks 同步服务骨架，验证 PostgreSQL 中心库增量同步闭环机制

**Architecture:** 使用简单 API + 直接 UPSERT 架构。route.ts 薄封装调用同步服务，同步主逻辑在 lib/sync/tasks-sync.ts，字段映射、UPSERT、进度读写、日志写入各自封装。UPSERT 和游标更新在同一事务内保证原子性。

**Tech Stack:** Next.js API Routes, PostgreSQL (pg driver), TypeScript

---

## 文件结构

```
lib/sync/
├── types.ts              # 类型定义
├── source-reader.ts      # 从 mock_tbl_task 读取源数据
├── field-mapper.ts       # 字段映射
├── upsert.ts             # UPSERT 操作
├── sync-progress.ts      # sync_progress 表操作
├── sync-job-log.ts       # sync_job_log 表操作
└── tasks-sync.ts         # 同步主逻辑

app/api/sync/tasks/
└── route.ts             # POST /api/sync/tasks

databases/sprint-2b2/
├── mock-tbl-task.sql    # 模拟源表创建和数据
└── README.md            # 数据说明
```

---

## Task 1: 创建 lib/sync/types.ts 类型定义

**Files:**
- Create: `lib/sync/types.ts`

**参考:** `lib/db/postgres.ts` 的 query 返回类型

- [ ] **Step 1: 创建 lib/sync 目录**

```bash
mkdir -p lib/sync
```

- [ ] **Step 2: 编写 types.ts**

```typescript
// lib/sync/types.ts

/**
 * 同步结果
 */
export interface SyncResult {
  status: 'success' | 'skipped' | 'failed'
  rowsRead: number
  rowsUpserted: number
  rowsSkipped: number
  startedAt: string
  finishedAt: string
  lastSourceIdBefore: number
  lastSourceIdAfter: number
  message?: string
  error?: string
}

/**
 * 源数据记录（mock_tbl_task）
 */
export interface TaskSourceRecord {
  id: number
  task_no: string
  task_name: string
  task_type: string
  status: string
  phase: string
  priority: string
  data_classification: string
  archive_name: string
  source_path: string
  package_path: string
  operator: string
  department: string
  created_at: Date
  updated_at: Date
}

/**
 * 统一任务记录（unified_tasks）
 */
export interface UnifiedTaskRecord {
  source_site_id: string
  source_table: string
  source_id: string
  synced_at: Date
  task_no: string
  task_name: string
  task_type: string
  status: string
  phase: string
  priority: string
  data_classification: string
  archive_name: string
  source_path: string
  package_path: string
  operator: string
  department: string
  total_files: number
  total_size: number
  raw_data: TaskSourceRecord
}

/**
 * 同步进度记录
 */
export interface SyncProgress {
  id: string
  source_site_id: string
  source_table: string
  last_sync_time: Date | null
  last_source_id: number
  last_status: string
  synced_rows: number
  last_error: string | null
  created_at: Date
  updated_at: Date
}

/**
 * 同步任务日志
 */
export interface SyncJobLog {
  id: string
  job_id: string
  source_site_id: string
  source_table: string
  started_at: Date
  finished_at: Date | null
  status: string
  rows_read: number
  rows_upserted: number
  rows_skipped: number
  error_message: string | null
  created_at: Date
}
```

- [ ] **Step 3: 提交**

```bash
git add lib/sync/types.ts
git commit -m "feat: add sync service types"
```

---

## Task 2: 创建 lib/sync/source-reader.ts 数据读取

**Files:**
- Create: `lib/sync/source-reader.ts`

- [ ] **Step 1: 编写 source-reader.ts**

```typescript
// lib/sync/source-reader.ts

import { query } from '@/lib/db'
import type { TaskSourceRecord } from './types'

const SITE_CODE = 'SH01'
const SOURCE_TABLE = 'tbl_task'

/**
 * 读取源数据（ID > lastSourceId）
 * @param lastSourceId 上次同步的最大 ID
 * @returns 源数据记录数组
 */
export async function readSourceRecords(lastSourceId: number = 0): Promise<TaskSourceRecord[]> {
  const sql = `
    SELECT id, task_no, task_name, task_type, status, phase, priority,
           data_classification, archive_name, source_path, package_path,
           operator, department, created_at, updated_at
    FROM mock_tbl_task
    WHERE id > $1
    ORDER BY id ASC
  `

  const result = await query(sql, [lastSourceId])
  return result.rows as TaskSourceRecord[]
}

/**
 * 获取源表的最大 ID
 */
export async function getMaxSourceId(): Promise<number> {
  const sql = `SELECT COALESCE(MAX(id), 0) as max_id FROM mock_tbl_task`
  const result = await query(sql)
  return result.rows[0]?.max_id ?? 0
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/sync/source-reader.ts
git commit -m "feat: add source reader for mock_tbl_task"
```

---

## Task 3: 创建 lib/sync/field-mapper.ts 字段映射

**Files:**
- Create: `lib/sync/field-mapper.ts`

- [ ] **Step 1: 编写 field-mapper.ts**

```typescript
// lib/sync/field-mapper.ts

import type { TaskSourceRecord, UnifiedTaskRecord } from './types'

const SITE_CODE = 'SH01'
const SOURCE_TABLE = 'tbl_task'

/**
 * 将源数据映射到统一表结构
 */
export function mapTask(source: TaskSourceRecord): UnifiedTaskRecord {
  return {
    source_site_id: SITE_CODE,
    source_table: SOURCE_TABLE,
    source_id: String(source.id),
    synced_at: new Date(),
    task_no: source.task_no,
    task_name: source.task_name,
    task_type: source.task_type,
    status: source.status,
    phase: source.phase,
    priority: source.priority,
    data_classification: source.data_classification,
    archive_name: source.archive_name,
    source_path: source.source_path,
    package_path: source.package_path,
    operator: source.operator,
    department: source.department,
    total_files: 0,
    total_size: 0,
    raw_data: source,
  }
}

/**
 * 批量映射
 */
export function mapTasks(sources: TaskSourceRecord[]): UnifiedTaskRecord[] {
  return sources.map(mapTask)
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/sync/field-mapper.ts
git commit -m "feat: add field mapper for tasks"
```

---

## Task 4: 创建 lib/sync/upsert.ts UPSERT 操作

**Files:**
- Create: `lib/sync/upsert.ts`

**参考:** `lib/db/postgres.ts` 的 transaction 函数

- [ ] **Step 1: 编写 upsert.ts**

```typescript
// lib/sync/upsert.ts

import { query, transaction } from '@/lib/db'
import type { UnifiedTaskRecord } from './types'

/**
 * UPSERT 单条记录到 unified_tasks
 */
export async function upsertTask(record: UnifiedTaskRecord): Promise<number> {
  const sql = `
    INSERT INTO unified_tasks (
      source_site_id, source_table, source_id, synced_at,
      task_no, task_name, task_type, status, phase, priority,
      data_classification, archive_name, source_path, package_path,
      operator, department, total_files, total_size, raw_data
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19
    )
    ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
      synced_at = EXCLUDED.synced_at,
      task_no = EXCLUDED.task_no,
      task_name = EXCLUDED.task_name,
      task_type = EXCLUDED.task_type,
      status = EXCLUDED.status,
      phase = EXCLUDED.phase,
      priority = EXCLUDED.priority,
      data_classification = EXCLUDED.data_classification,
      archive_name = EXCLUDED.archive_name,
      source_path = EXCLUDED.source_path,
      package_path = EXCLUDED.package_path,
      operator = EXCLUDED.operator,
      department = EXCLUDED.department,
      total_files = EXCLUDED.total_files,
      total_size = EXCLUDED.total_size,
      raw_data = EXCLUDED.raw_data,
      updated_at = NOW()
    RETURNING id
  `

  const result = await query(sql, [
    record.source_site_id,
    record.source_table,
    record.source_id,
    record.synced_at,
    record.task_no,
    record.task_name,
    record.task_type,
    record.status,
    record.phase,
    record.priority,
    record.data_classification,
    record.archive_name,
    record.source_path,
    record.package_path,
    record.operator,
    record.department,
    record.total_files,
    record.total_size,
    JSON.stringify(record.raw_data),
  ])

  return result.rowCount ?? 0
}

/**
 * 批量 UPSERT（在同一事务内）
 */
export async function upsertTasksInTransaction(
  records: UnifiedTaskRecord[],
  onProgressUpdate: (newSourceId: number, syncedRows: number) => Promise<void>
): Promise<{ rowsUpserted: number; maxSourceId: number }> {
  if (records.length === 0) {
    return { rowsUpserted: 0, maxSourceId: 0 }
  }

  return transaction(async (client) => {
    let rowsUpserted = 0
    let maxSourceId = 0

    for (const record of records) {
      const sql = `
        INSERT INTO unified_tasks (
          source_site_id, source_table, source_id, synced_at,
          task_no, task_name, task_type, status, phase, priority,
          data_classification, archive_name, source_path, package_path,
          operator, department, total_files, total_size, raw_data
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
        ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
          synced_at = EXCLUDED.synced_at,
          task_no = EXCLUDED.task_no,
          task_name = EXCLUDED.task_name,
          task_type = EXCLUDED.task_type,
          status = EXCLUDED.status,
          phase = EXCLUDED.phase,
          priority = EXCLUDED.priority,
          data_classification = EXCLUDED.data_classification,
          archive_name = EXCLUDED.archive_name,
          source_path = EXCLUDED.source_path,
          package_path = EXCLUDED.package_path,
          operator = EXCLUDED.operator,
          department = EXCLUDED.department,
          total_files = EXCLUDED.total_files,
          total_size = EXCLUDED.total_size,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
        RETURNING id
      `

      const res = await client.query(sql, [
        record.source_site_id,
        record.source_table,
        record.source_id,
        record.synced_at,
        record.task_no,
        record.task_name,
        record.task_type,
        record.status,
        record.phase,
        record.priority,
        record.data_classification,
        record.archive_name,
        record.source_path,
        record.package_path,
        record.operator,
        record.department,
        record.total_files,
        record.total_size,
        JSON.stringify(record.raw_data),
      ])

      if (res.rowCount && res.rowCount > 0) {
        rowsUpserted += res.rowCount
      }

      // 计算最大 source_id
      const sourceIdNum = parseInt(record.source_id, 10)
      if (sourceIdNum > maxSourceId) {
        maxSourceId = sourceIdNum
      }
    }

    // 更新 sync_progress（事务内）
    await onProgressUpdate(maxSourceId, rowsUpserted)

    return { rowsUpserted, maxSourceId }
  })
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/sync/upsert.ts
git commit -m "feat: add upsert module for unified_tasks"
```

---

## Task 5: 创建 lib/sync/sync-progress.ts 进度读写

**Files:**
- Create: `lib/sync/sync-progress.ts`

- [ ] **Step 1: 编写 sync-progress.ts**

```typescript
// lib/sync/sync-progress.ts

import { query } from '@/lib/db'
import type { SyncProgress } from './types'

const SITE_CODE = 'SH01'
const SOURCE_TABLE = 'tbl_task'

/**
 * 获取同步进度
 */
export async function getProgress(): Promise<SyncProgress | null> {
  const sql = `
    SELECT id, source_site_id, source_table, last_sync_time,
           last_source_id, last_status, synced_rows, last_error,
           created_at, updated_at
    FROM sync_progress
    WHERE source_site_id = $1 AND source_table = $2
  `

  const result = await query(sql, [SITE_CODE, SOURCE_TABLE])
  return (result.rows[0] as SyncProgress) ?? null
}

/**
 * 获取或创建同步进度（如果不存在）
 */
export async function getOrCreateProgress(): Promise<SyncProgress> {
  let progress = await getProgress()

  if (!progress) {
    // 创建初始记录
    const sql = `
      INSERT INTO sync_progress (source_site_id, source_table, last_source_id, last_status)
      VALUES ($1, $2, 0, 'idle')
      ON CONFLICT (source_site_id, source_table) DO NOTHING
      RETURNING id, source_site_id, source_table, last_sync_time,
                last_source_id, last_status, synced_rows, last_error,
                created_at, updated_at
    `
    const result = await query(sql, [SITE_CODE, SOURCE_TABLE])
    progress = result.rows[0] as SyncProgress
  }

  return progress
}

/**
 * 更新同步进度（在事务内调用）
 */
export async function updateProgressInTransaction(
  client: any,
  newSourceId: number,
  syncedRows: number
): Promise<void> {
  const sql = `
    UPDATE sync_progress
    SET last_source_id = $1,
        last_sync_time = NOW(),
        last_status = 'success',
        synced_rows = $2,
        last_error = NULL,
        updated_at = NOW()
    WHERE source_site_id = $3 AND source_table = $4
  `

  await client.query(sql, [newSourceId, syncedRows, SITE_CODE, SOURCE_TABLE])
}

/**
 * 更新同步状态为失败
 */
export async function updateProgressFailed(error: string): Promise<void> {
  const sql = `
    UPDATE sync_progress
    SET last_status = 'failed',
        last_error = $1,
        updated_at = NOW()
    WHERE source_site_id = $2 AND source_table = $3
  `

  await query(sql, [error, SITE_CODE, SOURCE_TABLE])
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/sync/sync-progress.ts
git commit -m "feat: add sync progress module"
```

---

## Task 6: 创建 lib/sync/sync-job-log.ts 日志写入

**Files:**
- Create: `lib/sync/sync-job-log.ts`

- [ ] **Step 1: 编写 sync-job-log.ts**

```typescript
// lib/sync/sync-job-log.ts

import { query } from '@/lib/db'
import type { SyncJobLog } from './types'

const SITE_CODE = 'SH01'
const SOURCE_TABLE = 'tbl_task'

/**
 * 创建同步任务日志（状态: running）
 */
export async function createJobLog(): Promise<string> {
  const jobId = `sync-${SOURCE_TABLE}-${Date.now()}`
  const sql = `
    INSERT INTO sync_job_log (job_id, source_site_id, source_table, status)
    VALUES ($1, $2, $3, 'running')
    RETURNING id
  `

  await query(sql, [jobId, SITE_CODE, SOURCE_TABLE])
  return jobId
}

/**
 * 更新同步任务日志（成功）
 */
export async function updateJobLogSuccess(
  jobId: string,
  rowsRead: number,
  rowsUpserted: number,
  rowsSkipped: number
): Promise<void> {
  const sql = `
    UPDATE sync_job_log
    SET finished_at = NOW(),
        status = 'success',
        rows_read = $2,
        rows_upserted = $3,
        rows_skipped = $4
    WHERE job_id = $1
  `

  await query(sql, [jobId, rowsRead, rowsUpserted, rowsSkipped])
}

/**
 * 更新同步任务日志（失败）
 */
export async function updateJobLogFailed(
  jobId: string,
  errorMessage: string,
  rowsRead: number = 0
): Promise<void> {
  const sql = `
    UPDATE sync_job_log
    SET finished_at = NOW(),
        status = 'failed',
        rows_read = $2,
        rows_upserted = 0,
        rows_skipped = 0,
        error_message = $3
    WHERE job_id = $1
  `

  await query(sql, [jobId, rowsRead, errorMessage])
}

/**
 * 更新同步任务日志（跳过，无新数据）
 */
export async function updateJobLogSkipped(jobId: string): Promise<void> {
  const sql = `
    UPDATE sync_job_log
    SET finished_at = NOW(),
        status = 'skipped',
        rows_read = 0,
        rows_upserted = 0,
        rows_skipped = 0
    WHERE job_id = $1
  `

  await query(sql, [jobId])
}

/**
 * 获取最近的同步日志
 */
export async function getLatestJobLog(): Promise<SyncJobLog | null> {
  const sql = `
    SELECT id, job_id, source_site_id, source_table, started_at,
           finished_at, status, rows_read, rows_upserted, rows_skipped,
           error_message, created_at
    FROM sync_job_log
    WHERE source_table = $1
    ORDER BY created_at DESC
    LIMIT 1
  `

  const result = await query(sql, [SOURCE_TABLE])
  return (result.rows[0] as SyncJobLog) ?? null
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/sync/sync-job-log.ts
git commit -m "feat: add sync job log module"
```

---

## Task 7: 创建 lib/sync/tasks-sync.ts 同步主逻辑

**Files:**
- Create: `lib/sync/tasks-sync.ts`

**依赖:** Task 2-6 完成的模块

- [ ] **Step 1: 编写 tasks-sync.ts**

```typescript
// lib/sync/tasks-sync.ts

import type { SyncResult } from './types'
import { readSourceRecords } from './source-reader'
import { mapTasks } from './field-mapper'
import { upsertTasksInTransaction } from './upsert'
import { getOrCreateProgress, updateProgressInTransaction, updateProgressFailed } from './sync-progress'
import { createJobLog, updateJobLogSuccess, updateJobLogFailed, updateJobLogSkipped } from './sync-job-log'
import { transaction } from '@/lib/db'

/**
 * 同步 tasks 数据
 * 1. 读取源数据（ID > last_source_id）
 * 2. 字段映射
 * 3. UPSERT 到 unified_tasks（事务）
 * 4. 更新 sync_progress（事务内）
 * 5. 更新 sync_job_log
 */
export async function syncTasks(): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  let jobId: string | null = null
  let lastSourceIdBefore = 0

  try {
    // 1. 获取 sync_progress
    const progress = await getOrCreateProgress()
    lastSourceIdBefore = progress?.last_source_id ?? 0

    // 2. 写入 sync_job_log（状态: running）
    jobId = await createJobLog()

    // 3. 读取源数据
    const sourceRecords = await readSourceRecords(lastSourceIdBefore)
    const rowsRead = sourceRecords.length

    // 4. 如果无新记录，返回 skipped
    if (rowsRead === 0) {
      if (jobId) {
        await updateJobLogSkipped(jobId)
      }
      return {
        status: 'skipped',
        rowsRead: 0,
        rowsUpserted: 0,
        rowsSkipped: 0,
        startedAt,
        finishedAt: new Date().toISOString(),
        lastSourceIdBefore,
        lastSourceIdAfter: lastSourceIdBefore,
        message: 'No new records to sync',
      }
    }

    // 5. 字段映射
    const mappedRecords = mapTasks(sourceRecords)

    // 6. UPSERT + 更新游标（事务）
    const { rowsUpserted, maxSourceId } = await transaction(async (client) => {
      let rowsUpserted = 0
      let maxSourceId = lastSourceIdBefore

      for (const record of mappedRecords) {
        const sql = `
          INSERT INTO unified_tasks (
            source_site_id, source_table, source_id, synced_at,
            task_no, task_name, task_type, status, phase, priority,
            data_classification, archive_name, source_path, package_path,
            operator, department, total_files, total_size, raw_data
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19
          )
          ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
            synced_at = EXCLUDED.synced_at,
            task_no = EXCLUDED.task_no,
            task_name = EXCLUDED.task_name,
            status = EXCLUDED.status,
            phase = EXCLUDED.phase,
            updated_at = NOW()
          RETURNING id
        `

        const res = await client.query(sql, [
          record.source_site_id,
          record.source_table,
          record.source_id,
          record.synced_at,
          record.task_no,
          record.task_name,
          record.task_type,
          record.status,
          record.phase,
          record.priority,
          record.data_classification,
          record.archive_name,
          record.source_path,
          record.package_path,
          record.operator,
          record.department,
          record.total_files,
          record.total_size,
          JSON.stringify(record.raw_data),
        ])

        if (res.rowCount && res.rowCount > 0) {
          rowsUpserted += res.rowCount
        }

        const sourceIdNum = parseInt(record.source_id, 10)
        if (sourceIdNum > maxSourceId) {
          maxSourceId = sourceIdNum
        }
      }

      // 更新 sync_progress（事务内）
      const updateProgressSql = `
        UPDATE sync_progress
        SET last_source_id = $1,
            last_sync_time = NOW(),
            last_status = 'success',
            synced_rows = $2,
            last_error = NULL,
            updated_at = NOW()
        WHERE source_site_id = $3 AND source_table = $4
      `
      await client.query(updateProgressSql, [maxSourceId, rowsUpserted, 'SH01', 'tbl_task'])

      return { rowsUpserted, maxSourceId }
    })

    // 7. 更新 sync_job_log（事务外）
    await updateJobLogSuccess(jobId, rowsRead, rowsUpserted, 0)

    return {
      status: 'success',
      rowsRead,
      rowsUpserted,
      rowsSkipped: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      lastSourceIdBefore,
      lastSourceIdAfter: maxSourceId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // 回滚已经在 transaction 内自动处理

    // 更新 job_log 为失败
    if (jobId) {
      await updateJobLogFailed(jobId, errorMessage)
    }

    // 更新 sync_progress 为失败（不更新游标）
    await updateProgressFailed(errorMessage)

    return {
      status: 'failed',
      rowsRead: 0,
      rowsUpserted: 0,
      rowsSkipped: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      lastSourceIdBefore,
      lastSourceIdAfter: lastSourceIdBefore,
      error: errorMessage,
    }
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/sync/tasks-sync.ts
git commit -m "feat: add tasks sync main logic"
```

---

## Task 8: 创建 app/api/sync/tasks/route.ts API 端点

**Files:**
- Create: `app/api/sync/tasks/route.ts`

- [ ] **Step 1: 编写 route.ts**

```typescript
// app/api/sync/tasks/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { syncTasks } from '@/lib/sync/tasks-sync'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sync/tasks
 * 触发 tasks 同步
 */
export async function POST(request: NextRequest) {
  try {
    const result = await syncTasks()
    return NextResponse.json(result)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        status: 'failed',
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add app/api/sync/tasks/route.ts
git commit -m "feat: add POST /api/sync/tasks endpoint"
```

---

## Task 9: 创建 databases/sprint-2b2/mock-tbl-task.sql 模拟源表

**Files:**
- Create: `databases/sprint-2b2/mock-tbl-task.sql`

- [ ] **Step 1: 编写 mock-tbl-task.sql**

```sql
-- ============================================================
-- 模拟源表：mock_tbl_task
-- Sprint 2B.2 - 用于验证同步服务骨架
-- ============================================================
-- 幂等性保证：
-- - task_no VARCHAR(100) NOT NULL UNIQUE
-- - ON CONFLICT (task_no) DO NOTHING
-- ============================================================

-- 创建模拟源表
CREATE TABLE IF NOT EXISTS mock_tbl_task (
  id BIGSERIAL PRIMARY KEY,
  task_no VARCHAR(100) NOT NULL UNIQUE,
  task_name VARCHAR(200),
  task_type VARCHAR(50),
  status VARCHAR(50),
  phase VARCHAR(50),
  priority VARCHAR(20),
  data_classification VARCHAR(100),
  archive_name VARCHAR(200),
  source_path VARCHAR(1000),
  package_path VARCHAR(1000),
  operator VARCHAR(100),
  department VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_mock_task_id ON mock_tbl_task(id);
CREATE INDEX IF NOT EXISTS idx_mock_task_status ON mock_tbl_task(status);

-- 插入 Seed 数据（5条记录）
INSERT INTO mock_tbl_task (task_no, task_name, task_type, status, phase, priority, data_classification, archive_name, source_path, package_path, operator, department)
VALUES
  ('TASK-001', '财务报表备份', 'backup', 'completed', 'finished', 'high', '财务数据', '2026-05-report', '/data/finance/reports', '/archive/backup/report.tar.gz', '张伟', '财务部'),
  ('TASK-002', '客户数据归档', 'archive', 'running', 'transferring', 'normal', '客户数据', 'customer-archive', '/data/customers', '/archive/pending/customer.tar.gz', '李娜', 'IT运维部'),
  ('TASK-003', '日志导出', 'export', 'failed', 'error', 'low', '系统日志', 'syslog-2026-05', '/var/log', '/export/pending/syslog.tar.gz', '赵强', 'IT运维部'),
  ('TASK-004', '备份验证', 'backup', 'pending', 'waiting', 'normal', '系统数据', 'backup-verify', '/data/backup', '/archive/verify.tar.gz', '王明', 'IT运维部'),
  ('TASK-005', '数据清理', 'export', 'pending', 'waiting', 'low', '临时数据', 'cleanup-2026', '/data/temp', '/export/cleanup.tar.gz', '刘芳', 'IT运维部')
ON CONFLICT (task_no) DO NOTHING;

-- 验证数据
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'mock_tbl_task 创建完成';
  RAISE NOTICE '========================================';
  RAISE NOTICE '记录数: %', (SELECT COUNT(*) FROM mock_tbl_task);
  RAISE NOTICE 'ID 范围: % - %', (SELECT MIN(id) FROM mock_tbl_task), (SELECT MAX(id) FROM mock_tbl_task);
END $$;
```

- [ ] **Step 2: 编写 README.md**

```markdown
# mock_tbl_task 模拟源表

## 用途

用于 Sprint 2B.2 验证同步服务骨架，从 mock_tbl_task 表读取数据并同步到 unified_tasks。

## 幂等性

- `task_no VARCHAR(100) NOT NULL UNIQUE` - 唯一约束
- `ON CONFLICT (task_no) DO NOTHING` - 重复执行不插入重复数据

## 数据内容

| task_no | task_name | status | 说明 |
|---------|----------|--------|------|
| TASK-001 | 财务报表备份 | completed | 已完成备份 |
| TASK-002 | 客户数据归档 | running | 归档进行中 |
| TASK-003 | 日志导出 | failed | 导出失败 |
| TASK-004 | 备份验证 | pending | 待验证 |
| TASK-005 | 数据清理 | pending | 待清理 |

## 同步测试

1. 首次同步：`curl -X POST http://localhost:3000/api/sync/tasks`
   - 预期：rowsRead=5, rowsUpserted=5

2. 再次同步：
   - 预期：rowsRead=0, status=skipped

3. 新增记录后同步：
   - 预期：rowsRead=N, rowsUpserted=N

## 执行方式

```bash
# 使用 Docker psql
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-2b2/mock-tbl-task.sql
```
```

## 数据更新

如需添加新记录进行增量同步测试：

```sql
INSERT INTO mock_tbl_task (task_no, task_name, task_type, status, phase, priority, data_classification, archive_name, source_path, package_path, operator, department)
VALUES ('TASK-006', '新任务', 'backup', 'pending', 'waiting', 'normal', '测试数据', 'test-001', '/data/test', '/archive/test.tar.gz', '测试员', 'IT运维部')
ON CONFLICT (task_no) DO NOTHING;
```
```

- [ ] **Step 3: 提交**

```bash
git add databases/sprint-2b2/mock-tbl-task.sql databases/sprint-2b2/README.md
git commit -m "feat: add mock_tbl_task for sync verification"
```

---

## Task 10: 更新 package.json 添加同步 npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 更新 package.json**

在 scripts 中添加：

```json
{
  "db:init:sync": "docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-2b2/mock-tbl-task.sql"
}
```

- [ ] **Step 2: 提交**

```bash
git add package.json
git commit -m "feat: add db:init:sync npm script"
```

---

## Task 11: 验证同步功能

**Files:**
- 检查数据库状态

- [ ] **Step 1: 初始化 mock_tbl_task**

```bash
pnpm db:init:sync
```

预期输出：
```
NOTICE: ========================================
NOTICE: mock_tbl_task 创建完成
NOTICE: ========================================
NOTICE: 记录数: 5
NOTICE: ID 范围: 1 - 5
```

- [ ] **Step 2: 首次同步**

```bash
curl -X POST http://localhost:3000/api/sync/tasks
```

预期响应：
```json
{
  "status": "success",
  "rowsRead": 5,
  "rowsUpserted": 5,
  "rowsSkipped": 0,
  "lastSourceIdBefore": 0,
  "lastSourceIdAfter": 5
}
```

- [ ] **Step 3: 再次同步**

```bash
curl -X POST http://localhost:3000/api/sync/tasks
```

预期响应：
```json
{
  "status": "skipped",
  "rowsRead": 0,
  "rowsUpserted": 0,
  "rowsSkipped": 0,
  "message": "No new records to sync"
}
```

- [ ] **Step 4: 验证数据库**

```bash
# 查看 unified_tasks 记录数
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT COUNT(*) FROM unified_tasks;"

# 查看 sync_progress 游标
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT last_source_id, last_status FROM sync_progress WHERE source_table = 'tbl_task';"

# 查看 sync_job_log
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT job_id, status, rows_read, rows_upserted FROM sync_job_log ORDER BY created_at DESC LIMIT 2;"
```

- [ ] **Step 5: 增量同步测试**

```sql
-- 在 mock_tbl_task 中新增一条记录
INSERT INTO mock_tbl_task (task_no, task_name, task_type, status, phase, priority, data_classification, archive_name, source_path, package_path, operator, department)
VALUES ('TASK-006', '增量测试', 'backup', 'pending', 'waiting', 'normal', '测试', 'test-006', '/data/test', '/archive/test.tar.gz', '测试员', 'IT运维部');
```

```bash
curl -X POST http://localhost:3000/api/sync/tasks
```

预期响应：rowsRead=1, rowsUpserted=1

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "test: verify sync tasks functionality"
```

---

## 自检清单

完成实现后，运行以下检查：

- [ ] `pnpm exec tsc --noEmit` - TypeScript 类型检查
- [ ] `pnpm build` - 构建检查
- [ ] `curl http://localhost:3000/api/system/health` - 健康检查
- [ ] `curl -X POST http://localhost:3000/api/sync/tasks` - 同步测试

---

## 相关文档

| 文档 | 路径 |
|------|------|
| 设计规格 | `docs/superpowers/specs/2026-05-29-sync-service-design.md` |
| 实现计划 | `docs/superpowers/plans/2026-05-29-sync-service-implementation.md` |
| 数据库验证指南 | `docs/testing/sprint-2b1-db-verification-guide.md` |

---

*计划创建: 2026-05-29*
*Sprint 2B.2 - 同步服务骨架实现*