# Sprint 2B.4 - Devices 同步实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现第二个同步对象（devices），验证多同步对象模式，解决 UPSERT 重复

**Architecture:** 最小 sync-engine 封装公共逻辑，tasks-sync 重构使用新引擎，新增 devices-sync 验证多对象模式

**Tech Stack:** Next.js, PostgreSQL, TypeScript

---

## Phase 1: 重构 tasks-sync（必须先单独验收）

### Task 1: 创建 sync-engine.ts

**Files:**
- Create: `lib/sync/sync-engine.ts`

- [ ] **Step 1: 创建 sync-engine.ts**

```typescript
/**
 * 最小同步引擎
 * Sprint 2B.4 - 封装公共同步逻辑
 */

import type { SyncObjectConfig } from './config'
import type { SyncResult } from './types'
import {
  getOrCreateProgress,
  updateProgressInTransaction,
  updateProgressFailed,
} from './sync-progress'
import {
  createJobLog,
  updateJobLogSuccess,
  updateJobLogSkipped,
  updateJobLogFailed,
} from './sync-job-log'
import { transaction } from '@/lib/db'

interface SyncInput<T> {
  config: SyncObjectConfig
  readSource: (lastId: number) => Promise<T[]>
  mapToTarget: (source: T) => Record<string, unknown>
  getSourceId: (source: T) => number
  upsertBatch: (
    records: Record<string, unknown>[],
    onProgressUpdate: (maxSourceId: number, syncedRows: number) => Promise<void>
  ) => Promise<{ rowsUpserted: number; maxSourceId: number }>
}

/**
 * 通用同步引擎
 */
export async function runSync<T>(input: SyncInput<T>): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  let jobId: string | null = null
  let lastSourceIdBefore = 0

  try {
    // 1. 获取 sync_progress
    const progress = await getOrCreateProgress(
      input.config.sourceSiteCode,
      input.config.sourceTable
    )
    lastSourceIdBefore = progress?.last_source_id ?? 0

    // 2. 写入 sync_job_log（状态: running）
    jobId = await createJobLog(input.config.sourceSiteCode, input.config.sourceTable)

    // 3. 读取源数据
    const sourceRecords = await input.readSource(lastSourceIdBefore)
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
    const mappedRecords = sourceRecords.map((source) => input.mapToTarget(source))

    // 6. UPSERT + 更新游标（事务）
    const { rowsUpserted, maxSourceId } = await input.upsertBatch(
      mappedRecords,
      async (newMaxSourceId, syncedRows) => {
        await updateProgressInTransaction(
          {} as Parameters<typeof updateProgressInTransaction>[0], // placeholder
          input.config.sourceSiteCode,
          input.config.sourceTable,
          newMaxSourceId,
          syncedRows
        )
      }
    )

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

    if (jobId) {
      await updateJobLogFailed(jobId, errorMessage)
    }

    await updateProgressFailed(
      input.config.sourceSiteCode,
      input.config.sourceTable,
      errorMessage
    )

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

**注意**: 上述代码需要与 upsert 配合，第 6 步的 upsertBatch 调用方式待后续调整。

- [ ] **Step 2: 提交**

```bash
git add lib/sync/sync-engine.ts
git commit -m "feat: add minimal sync-engine"
```

---

### Task 2: 重构 tasks-sync.ts 使用 sync-engine

**Files:**
- Modify: `lib/sync/tasks-sync.ts`

- [ ] **Step 1: 读取现有 tasks-sync.ts 内容**

查看现有实现，理解：
- readSourceRecords 函数
- mapTasks 函数
- UPSERT 逻辑
- sync_progress 更新逻辑

- [ ] **Step 2: 重构 tasks-sync.ts**

将 tasks-sync.ts 改为使用 sync-engine：

```typescript
/**
 * Tasks 同步逻辑
 * Sprint 2B.4 - 重构使用 sync-engine
 */

import type { SyncResult } from './types'
import { DEFAULT_SITE_CODE, TASK_SYNC_CONFIG } from './config'
import { readSourceRecords } from './source-reader'
import { mapTasks } from './field-mapper'
import { upsertTasksInTransaction } from './upsert'
import { runSync } from './sync-engine'

/**
 * 同步 tasks 数据
 */
export async function syncTasks(): Promise<SyncResult> {
  return runSync({
    config: TASK_SYNC_CONFIG,
    readSource: readSourceRecords,
    mapToTarget: mapTasks,
    getSourceId: (source) => source.id,
    upsertBatch: upsertTasksInTransaction,
  })
}
```

- [ ] **Step 3: 验证类型正确性**

运行: `pnpm exec tsc --noEmit`

预期: 无错误

---

### Task 3: Phase 1 单独验收 tasks

**Files:**
- Test: `app/api/sync/tasks/route.ts`

- [ ] **Step 1: 准备干净环境**

```bash
pnpm db:down && pnpm db:up
pnpm db:init
pnpm db:init:sync
```

- [ ] **Step 2: 运行 tasks 同步**

```bash
curl -X POST http://localhost:3000/api/sync/tasks
```

预期返回:
```json
{
  "status": "success",
  "rowsRead": 3,
  "rowsUpserted": 3,
  "rowsSkipped": 0,
  "startedAt": "...",
  "finishedAt": "...",
  "lastSourceIdBefore": 0,
  "lastSourceIdAfter": 3,
  "message": undefined
}
```

- [ ] **Step 3: 验证数据**

```sql
SELECT * FROM unified_tasks;
SELECT * FROM sync_job_log WHERE source_table = 'tbl_task';
SELECT * FROM sync_progress WHERE source_table = 'tbl_task';
```

预期:
- unified_tasks 有 3 条记录
- sync_job_log 有 1 条记录，status='success'
- sync_progress last_source_id = 3

- [ ] **Step 4: 验证构建**

```bash
pnpm exec tsc --noEmit
pnpm build
```

预期: 全部通过

- [ ] **Step 5: 提交**

```bash
git add lib/sync/tasks-sync.ts
git commit -m "refactor: tasks-sync use sync-engine"
```

**Phase 1 完成标记**: tasks 同步行为与重构前完全一致

---

## Phase 2: 实现 devices 同步

### Task 4: 添加 DEVICE_SYNC_CONFIG

**Files:**
- Modify: `lib/sync/config.ts`

- [ ] **Step 1: 添加 DEVICE_SYNC_CONFIG**

```typescript
// lib/sync/config.ts 添加

export const DEVICE_SYNC_CONFIG = {
  sourceTable: 'tbl_disc_lib',
  targetTable: 'unified_devices',
  mockSourceTable: 'mock_tbl_disc_lib',
  sourceSiteCode: DEFAULT_SITE_CODE,
} as const
```

- [ ] **Step 2: 提交**

```bash
git add lib/sync/config.ts
git commit -m "feat: add DEVICE_SYNC_CONFIG"
```

---

### Task 5: 添加 types

**Files:**
- Modify: `lib/sync/types.ts`

- [ ] **Step 1: 添加 DeviceSourceRecord 类型**

```typescript
// lib/sync/types.ts 添加

/**
 * 源数据记录（mock_tbl_disc_lib）
 */
export interface DeviceSourceRecord {
  id: number
  device_no: string
  device_name: string
  device_type: string
  device_status: string
  ip_address: string
  location: string
  room: string
  floor: string
  total_capacity: number
  used_capacity: number
  last_heartbeat: Date
  operator: string
  created_at: Date
  updated_at: Date
}

/**
 * 统一设备记录（unified_devices）
 */
export interface UnifiedDeviceRecord {
  source_site_id: string
  source_table: string
  source_id: string
  synced_at: Date
  device_id: string
  device_name: string
  device_type: string
  status: string
  ip_address: string
  location: string
  room: string
  floor: string
  total_capacity: number
  used_capacity: number
  device_id_field?: string // 兼容
  raw_data: DeviceSourceRecord
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/sync/types.ts
git commit -m "feat: add DeviceSourceRecord and UnifiedDeviceRecord types"
```

---

### Task 6: 创建 mock_tbl_disc_lib

**Files:**
- Create: `databases/sprint-2b4/mock-tbl-disc-lib.sql`

- [ ] **Step 1: 创建 SQL 文件**

```sql
-- mock_tbl_disc_lib seed 数据
-- Sprint 2B.4

CREATE TABLE IF NOT EXISTS mock_tbl_disc_lib (
  id BIGSERIAL PRIMARY KEY,
  device_no VARCHAR(100) UNIQUE NOT NULL,
  device_name VARCHAR(200),
  device_type VARCHAR(50),
  device_status VARCHAR(50),
  ip_address VARCHAR(100),
  location VARCHAR(200),
  room VARCHAR(100),
  floor VARCHAR(50),
  total_capacity BIGINT DEFAULT 0,
  used_capacity BIGINT DEFAULT 0,
  last_heartbeat TIMESTAMPTZ,
  operator VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 幂等 seed 数据
INSERT INTO mock_tbl_disc_lib (device_no, device_name, device_type, device_status, ip_address, location, room, floor, total_capacity, used_capacity, last_heartbeat, operator)
VALUES
  ('DL-SH01-001', '光盘库-上海01', 'disc_library', 'online', '192.168.1.101', '上海数据中心', 'A区机房', '1楼', 10000000000000, 5000000000000, NOW(), '张三'),
  ('DL-SH01-002', '光盘库-上海02', 'disc_library', 'offline', '192.168.1.102', '上海数据中心', 'A区机房', '2楼', 8000000000000, 2000000000000, NOW(), '李四'),
  ('DL-SH02-001', '光盘库-苏州01', 'disc_library', 'online', '192.168.2.101', '苏州数据中心', 'B区机房', '1楼', 12000000000000, 8000000000000, NOW(), '王五')
ON CONFLICT (device_no) DO NOTHING;
```

- [ ] **Step 2: 创建数据库初始化脚本**

在 `package.json` 添加脚本或创建 `scripts/init-devices.sh`：

```bash
#!/bin/bash
psql -f databases/sprint-2b4/mock-tbl-disc-lib.sql
```

- [ ] **Step 3: 提交**

```bash
git add databases/sprint-2b4/mock-tbl-disc-lib.sql
git commit -m "feat: add mock_tbl_disc_lib seed data"
```

---

### Task 7: 实现 readDiscLibSource

**Files:**
- Modify: `lib/sync/source-reader.ts`

- [ ] **Step 1: 添加 readDiscLibSource 函数**

```typescript
// lib/sync/source-reader.ts 添加

import type { DeviceSourceRecord } from './types'
import { DEVICE_SYNC_CONFIG } from './config'

/**
 * 读取源数据（ID > lastSourceId）
 */
export async function readDiscLibSource(lastSourceId: number = 0): Promise<DeviceSourceRecord[]> {
  const sql = `
    SELECT id, device_no, device_name, device_type, device_status,
           ip_address, location, room, floor,
           total_capacity, used_capacity, last_heartbeat, operator,
           created_at, updated_at
    FROM ${DEVICE_SYNC_CONFIG.mockSourceTable}
    WHERE id > $1
    ORDER BY id ASC
  `

  const result = await query(sql, [lastSourceId])
  return result.rows as DeviceSourceRecord[]
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/sync/source-reader.ts
git commit -m "feat: add readDiscLibSource function"
```

---

### Task 8: 实现 mapDiscLibToTarget

**Files:**
- Modify: `lib/sync/field-mapper.ts`

- [ ] **Step 1: 添加 mapDiscLibToTarget 函数**

```typescript
// lib/sync/field-mapper.ts 添加

import type { DeviceSourceRecord } from './types'
import { DEVICE_SYNC_CONFIG, DEFAULT_SITE_CODE } from './config'

/**
 * 映射 disc_lib 源数据到 unified_devices 目标
 */
export function mapDiscLibToTarget(source: DeviceSourceRecord): Record<string, unknown> {
  // 扩展字段存入 raw_data
  const rawData = {
    device_status: source.device_status,
    last_heartbeat: source.last_heartbeat,
    operator: source.operator,
  }

  return {
    source_site_id: DEFAULT_SITE_CODE,
    source_table: DEVICE_SYNC_CONFIG.sourceTable,
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
    raw_data: rawData,
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/sync/field-mapper.ts
git commit -m "feat: add mapDiscLibToTarget function"
```

---

### Task 9: 实现 upsertDevice

**Files:**
- Modify: `lib/sync/upsert.ts`

- [ ] **Step 1: 添加 upsertDevice 函数**

```typescript
// lib/sync/upsert.ts 添加

import { query, transaction } from '@/lib/db'
import type { UnifiedDeviceRecord } from './types'

/**
 * UPSERT 单条记录到 unified_devices
 */
export async function upsertDevice(record: UnifiedDeviceRecord): Promise<number> {
  const sql = `
    INSERT INTO unified_devices (
      source_site_id, source_table, source_id, synced_at,
      device_id, device_name, device_type, status,
      ip_address, location, room, floor,
      total_capacity, used_capacity,
      raw_data
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
    )
    ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
      synced_at = EXCLUDED.synced_at,
      device_id = EXCLUDED.device_id,
      device_name = EXCLUDED.device_name,
      device_type = EXCLUDED.device_type,
      status = EXCLUDED.status,
      ip_address = EXCLUDED.ip_address,
      location = EXCLUDED.location,
      room = EXCLUDED.room,
      floor = EXCLUDED.floor,
      total_capacity = EXCLUDED.total_capacity,
      used_capacity = EXCLUDED.used_capacity,
      raw_data = EXCLUDED.raw_data,
      updated_at = NOW()
    RETURNING id
  `

  const result = await query(sql, [
    record.source_site_id,
    record.source_table,
    record.source_id,
    record.synced_at,
    record.device_id,
    record.device_name,
    record.device_type,
    record.status,
    record.ip_address,
    record.location,
    record.room,
    record.floor,
    record.total_capacity,
    record.used_capacity,
    JSON.stringify(record.raw_data),
  ])

  return result.rowCount ?? 0
}

/**
 * 批量 UPSERT（事务内）
 */
export async function upsertDevicesInTransaction(
  records: UnifiedDeviceRecord[],
  onProgressUpdate: (maxSourceId: number, syncedRows: number) => Promise<void>
): Promise<{ rowsUpserted: number; maxSourceId: number }> {
  if (records.length === 0) {
    return { rowsUpserted: 0, maxSourceId: 0 }
  }

  return transaction(async (client) => {
    let rowsUpserted = 0
    let maxSourceId = 0

    for (const record of records) {
      const sql = `
        INSERT INTO unified_devices (
          source_site_id, source_table, source_id, synced_at,
          device_id, device_name, device_type, status,
          ip_address, location, room, floor,
          total_capacity, used_capacity,
          raw_data
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
          synced_at = EXCLUDED.synced_at,
          device_id = EXCLUDED.device_id,
          device_name = EXCLUDED.device_name,
          device_type = EXCLUDED.device_type,
          status = EXCLUDED.status,
          ip_address = EXCLUDED.ip_address,
          location = EXCLUDED.location,
          room = EXCLUDED.room,
          floor = EXCLUDED.floor,
          total_capacity = EXCLUDED.total_capacity,
          used_capacity = EXCLUDED.used_capacity,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
        RETURNING id
      `

      const res = await client.query(sql, [
        record.source_site_id,
        record.source_table,
        record.source_id,
        record.synced_at,
        record.device_id,
        record.device_name,
        record.device_type,
        record.status,
        record.ip_address,
        record.location,
        record.room,
        record.floor,
        record.total_capacity,
        record.used_capacity,
        JSON.stringify(record.raw_data),
      ])

      if (res.rowCount && res.rowCount > 0) {
        rowsUpserted += res.rowCount
      }

      // 计算最大 source_id
      const sourceIdNum = parseInt(String(record.source_id), 10)
      if (sourceIdNum > maxSourceId) {
        maxSourceId = sourceIdNum
      }
    }

    // 更新 sync_progress
    await onProgressUpdate(maxSourceId, rowsUpserted)

    return { rowsUpserted, maxSourceId }
  })
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/sync/upsert.ts
git commit -m "feat: add upsertDevice and upsertDevicesInTransaction"
```

---

### Task 10: 创建 devices-sync.ts

**Files:**
- Create: `lib/sync/devices-sync.ts`

- [ ] **Step 1: 创建 devices-sync.ts**

```typescript
/**
 * Devices 同步逻辑
 * Sprint 2B.4 - 第二个同步对象
 */

import type { SyncResult } from './types'
import { DEVICE_SYNC_CONFIG } from './config'
import { readDiscLibSource } from './source-reader'
import { mapDiscLibToTarget } from './field-mapper'
import { upsertDevicesInTransaction } from './upsert'
import { runSync } from './sync-engine'

/**
 * 同步 devices 数据
 */
export async function syncDevices(): Promise<SyncResult> {
  return runSync({
    config: DEVICE_SYNC_CONFIG,
    readSource: readDiscLibSource,
    mapToTarget: mapDiscLibToTarget as (source: unknown) => Record<string, unknown>,
    getSourceId: (source) => (source as { id: number }).id,
    upsertBatch: upsertDevicesInTransaction as (
      records: Record<string, unknown>[],
      onProgressUpdate: (maxSourceId: number, syncedRows: number) => Promise<void>
    ) => Promise<{ rowsUpserted: number; maxSourceId: number }>,
  })
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/sync/devices-sync.ts
git commit -m "feat: add devices-sync module"
```

---

### Task 11: 创建 POST /api/sync/devices

**Files:**
- Create: `app/api/sync/devices/route.ts`

- [ ] **Step 1: 创建 devices sync API**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { syncDevices } from '@/lib/sync/devices-sync'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sync/devices
 * 触发 devices 同步
 */
export async function POST(request: NextRequest) {
  try {
    const result = await syncDevices()
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
git add app/api/sync/devices/route.ts
git commit -m "feat: add POST /api/sync/devices endpoint"
```

---

## Phase 3: 验收

### Task 12: 完整验收测试

- [ ] **Step 1: 准备干净环境**

```bash
pnpm db:down && pnpm db:up
pnpm db:init
pnpm db:init:sync

# 初始化 devices mock 数据
psql -f databases/sprint-2b4/mock-tbl-disc-lib.sql
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
pnpm exec tsc --noEmit
```

预期: 无错误

- [ ] **Step 3: 验证构建**

```bash
pnpm build
```

预期: 成功

- [ ] **Step 4: 同步 tasks**

```bash
curl -X POST http://localhost:3000/api/sync/tasks
```

预期: `status: "success"`, `rowsRead: 3`, `rowsUpserted: 3`

- [ ] **Step 5: 首次同步 devices**

```bash
curl -X POST http://localhost:3000/api/sync/devices
```

预期: `status: "success"`, `rowsRead: 3`, `rowsUpserted: 3`

- [ ] **Step 6: 第二次同步 devices（必须 skipped）**

```bash
curl -X POST http://localhost:3000/api/sync/devices
```

预期: `status: "skipped"`, `rowsRead: 0`, `rowsUpserted: 0`

- [ ] **Step 7: 验证 sync_progress 包含两类**

```bash
curl http://localhost:3000/api/sync/status
```

预期: 返回包含 `tbl_task` 和 `tbl_disc_lib`

- [ ] **Step 8: 验证 sync_job_log 包含两类**

```bash
curl http://localhost:3000/api/sync/logs
```

预期: 返回包含 `tbl_task` 和 `tbl_disc_lib` 的 job 记录

- [ ] **Step 9: 验证 raw_data**

```sql
SELECT device_id, raw_data FROM unified_devices LIMIT 1;
```

预期: raw_data 包含 `device_status`, `last_heartbeat`, `operator`

- [ ] **Step 10: 验证 ip_address 映射到主字段**

```sql
SELECT device_id, ip_address FROM unified_devices LIMIT 1;
```

预期: ip_address 有值（非 NULL）

---

### Task 13: 最终提交

- [ ] **Step 1: 确保所有验收通过后提交**

```bash
git status
git log --oneline -5
```

- [ ] **Step 2: 提交最终变更**

```bash
git add -A
git commit -m "feat: complete Sprint 2B.4 - devices sync implementation"
```

---

## 验收清单

| # | 检查项 | 预期结果 |
|---|--------|----------|
| 1 | pnpm exec tsc --noEmit | 通过 |
| 2 | pnpm build | 成功 |
| 3 | POST /api/sync/tasks | status: success, rowsRead: 3 |
| 4 | POST /api/sync/devices | status: success, rowsRead: 3 |
| 5 | 第二次 POST /api/sync/devices | status: skipped |
| 6 | GET /api/sync/status | 包含 tbl_task 和 tbl_disc_lib |
| 7 | GET /api/sync/logs | 包含两类 job |
| 8 | unified_devices raw_data | 包含 last_heartbeat/operator/device_status |
| 9 | unified_devices ip_address | 主字段有值 |

---

*计划完成: 2026-05-30*
*Phase 1 → Phase 2 → Phase 3 分步执行*
*Phase 1 验收通过后进入 Phase 2*