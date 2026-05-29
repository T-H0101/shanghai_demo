# Sprint 2B.3 同步状态与日志查询接口实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 GET /api/sync/status 和 GET /api/sync/logs 两个查询接口，通过 API 直观看到同步状态和历史日志，不再需要进入数据库手动查询。

**Architecture:**
- lib/sync/dto.ts 定义 API 对外响应类型，与内部 types.ts 分离
- lib/sync/query.ts 封装查询逻辑，支持可选过滤参数
- app/api/sync/status/route.ts 和 app/api/sync/logs/route.ts 作为薄封装
- 所有数字字段显式 Number() 避免 pg 返回 string

**Tech Stack:** Next.js 16, TypeScript, PostgreSQL/pg, 无新增依赖

---

## 一、文件结构

### 1.1 新增文件

| 文件 | 职责 |
|------|------|
| `lib/sync/dto.ts` | API 对外 DTO 类型定义 |
| `lib/sync/query.ts` | queryProgress() 和 queryLogs() |
| `app/api/sync/status/route.ts` | GET /api/sync/status |
| `app/api/sync/logs/route.ts` | GET /api/sync/logs |

### 1.2 保留现有

| 文件 | 说明 |
|------|------|
| `lib/sync/types.ts` | 内部同步类型（不修改） |
| `lib/sync/tasks-sync.ts` | 同步主逻辑（不修改） |
| `lib/sync/sync-progress.ts` | 事务内更新（不修改） |
| `lib/sync/sync-job-log.ts` | 事务内更新（不修改） |

---

## 二、约束检查清单

| 约束 | 实现位置 |
|------|----------|
| limit clamp 到 1-100 | query.ts clamp + route 返回 clamp 后的值 |
| 数字字段 Number() | query.ts DTO 映射时 |
| 错误响应稳定结构 | route.ts 统一 `{ data: [], error }` 或 `{ data: [], limit, error }` |

---

## 三、任务列表

### Task 1: 创建 lib/sync/dto.ts

**Files:**
- Create: `lib/sync/dto.ts`

- [ ] **Step 1: 创建文件并写入 DTO 类型**

```typescript
// lib/sync/dto.ts

/**
 * 同步状态 DTO（API 对外响应）
 */
export interface SyncStatusDTO {
  siteId: string
  tableName: string
  lastSourceId: number
  lastSyncTime: string | null
  lastStatus: string
  syncedRows: number
  lastError: string | null
}

/**
 * 同步日志 DTO（API 对外响应）
 */
export interface SyncLogDTO {
  siteId: string
  tableName: string
  jobId: string
  status: 'success' | 'failed' | 'skipped' | 'running'
  rowsRead: number
  rowsUpserted: number
  rowsSkipped: number
  error: string | null
  startedAt: string
  finishedAt: string | null
}
```

- [ ] **Step 2: 验证文件创建**

Run: `cat lib/sync/dto.ts | head -5`
Expected: `// lib/sync/dto.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/sync/dto.ts
git commit -m "feat: 添加 sync API DTO 类型定义"
```

---

### Task 2: 创建 lib/sync/query.ts

**Files:**
- Create: `lib/sync/query.ts`
- Read: `lib/db.ts` (了解 query 函数签名)

- [ ] **Step 1: 阅读 lib/db.ts 确认 query 函数**

Run: `head -30 lib/db.ts`
Expected: `export async function query(sql: string, params?: any[])`

- [ ] **Step 2: 创建 query.ts 实现查询函数**

```typescript
// lib/sync/query.ts

import { query } from '@/lib/db'
import type { SyncStatusDTO, SyncLogDTO } from './dto'

interface ProgressFilters {
  site?: string
  table?: string
}

interface LogsFilters {
  site?: string
  table?: string
}

/**
 * 查询同步进度
 * - 默认返回所有站点和所有表
 * - 支持可选 site/table 过滤
 * - 所有数字字段显式 Number()
 */
export async function queryProgress(
  filters: ProgressFilters = {}
): Promise<SyncStatusDTO[]> {
  const conditions: string[] = []
  const params: any[] = []
  let paramIndex = 1

  if (filters.site) {
    conditions.push(`source_site_id = $${paramIndex++}`)
    params.push(filters.site)
  }
  if (filters.table) {
    conditions.push(`source_table = $${paramIndex++}`)
    params.push(filters.table)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const sql = `
    SELECT source_site_id, source_table, last_source_id, last_sync_time,
           last_status, synced_rows, last_error
    FROM sync_progress
    ${whereClause}
    ORDER BY source_site_id, source_table
  `

  const result = await query(sql, params)
  return result.rows.map((row: any) => ({
    siteId: row.source_site_id,
    tableName: row.source_table,
    lastSourceId: Number(row.last_source_id),
    lastSyncTime: row.last_sync_time ? new Date(row.last_sync_time).toISOString() : null,
    lastStatus: row.last_status,
    syncedRows: Number(row.synced_rows),
    lastError: row.last_error,
  }))
}

/**
 * 查询同步日志
 * - 默认返回最近 10 条
 * - 支持可选 site/table 过滤
 * - limit 自动 clamp 到 1-100
 * - 所有数字字段显式 Number()
 */
export async function queryLogs(
  filters: LogsFilters = {},
  limit: number = 10
): Promise<SyncLogDTO[]> {
  // clamp limit to 1-100
  const safeLimit = Math.min(Math.max(1, limit), 100)

  const conditions: string[] = []
  const params: any[] = []
  let paramIndex = 1

  if (filters.site) {
    conditions.push(`source_site_id = $${paramIndex++}`)
    params.push(filters.site)
  }
  if (filters.table) {
    conditions.push(`source_table = $${paramIndex++}`)
    params.push(filters.table)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const sql = `
    SELECT source_site_id, source_table, job_id, status,
           rows_read, rows_upserted, rows_skipped,
           error_message, started_at, finished_at
    FROM sync_job_log
    ${whereClause}
    ORDER BY started_at DESC
    LIMIT $${paramIndex}
  `

  params.push(safeLimit)

  const result = await query(sql, params)
  return result.rows.map((row: any) => ({
    siteId: row.source_site_id,
    tableName: row.source_table,
    jobId: row.job_id,
    status: row.status,
    rowsRead: Number(row.rows_read),
    rowsUpserted: Number(row.rows_upserted),
    rowsSkipped: Number(row.rows_skipped),
    error: row.error_message,
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
  }))
}

/**
 * 获取 clamp 后的 limit 值（供 route 层返回）
 */
export function clampLimit(limit: number): number {
  return Math.min(Math.max(1, limit), 100)
}
```

- [ ] **Step 3: TypeScript 检查**

Run: `pnpm exec tsc --noEmit lib/sync/query.ts`
Expected: 无编译错误

- [ ] **Step 4: Commit**

```bash
git add lib/sync/query.ts
git commit -m "feat: 添加 sync 查询模块 queryProgress/queryLogs"
```

---

### Task 3: 创建 GET /api/sync/status

**Files:**
- Create: `app/api/sync/status/route.ts`

- [ ] **Step 1: 创建 status route**

```typescript
// app/api/sync/status/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { queryProgress } from '@/lib/sync/query'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/status
 * 查询同步进度
 *
 * Query params:
 *   - site?: string (可选)
 *   - table?: string (可选)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const site = searchParams.get('site') ?? undefined
  const table = searchParams.get('table') ?? undefined

  try {
    const data = await queryProgress({ site, table })
    return NextResponse.json({ data })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { data: [], error: errorMessage },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: TypeScript 检查**

Run: `pnpm exec tsc --noEmit app/api/sync/status/route.ts`
Expected: 无编译错误

- [ ] **Step 3: Commit**

```bash
git add app/api/sync/status/route.ts
git commit -m "feat: 添加 GET /api/sync/status 接口"
```

---

### Task 4: 创建 GET /api/sync/logs

**Files:**
- Create: `app/api/sync/logs/route.ts`

- [ ] **Step 1: 创建 logs route**

```typescript
// app/api/sync/logs/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { queryLogs, clampLimit } from '@/lib/sync/query'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/logs
 * 查询同步日志
 *
 * Query params:
 *   - site?: string (可选)
 *   - table?: string (可选)
 *   - limit?: number (可选，默认 10，最大 100)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const site = searchParams.get('site') ?? undefined
  const table = searchParams.get('table') ?? undefined
  const rawLimit = parseInt(searchParams.get('limit') ?? '10', 10)
  const limit = clampLimit(rawLimit)

  try {
    const data = await queryLogs({ site, table }, limit)
    return NextResponse.json({ data, limit })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { data: [], limit, error: errorMessage },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: TypeScript 检查**

Run: `pnpm exec tsc --noEmit app/api/sync/logs/route.ts`
Expected: 无编译错误

- [ ] **Step 3: Commit**

```bash
git add app/api/sync/logs/route.ts
git commit -m "feat: 添加 GET /api/sync/logs 接口"
```

---

### Task 5: 全量构建检查

**Files:**
- Read: 所有新增文件

- [ ] **Step 1: TypeScript 编译检查**

Run: `pnpm exec tsc --noEmit`
Expected: 无编译错误

- [ ] **Step 2: Next.js 构建检查**

Run: `pnpm build`
Expected: 构建成功，无错误

- [ ] **Step 3: Commit（如有代码修改）**

```bash
git add -A
git commit -m "fix: Sprint 2B.3 构建修复（如有）"
```

---

### Task 6: API 手动测试

**Requires:** 开发服务器运行 (`pnpm dev`)

- [ ] **Step 1: 启动开发服务器**

Run: `pnpm dev &`
Expected: 服务启动在 localhost:3000

- [ ] **Step 2: 测试 status 全量查询**

Run: `curl http://localhost:3000/api/sync/status`
Expected: `{ "data": [{ "siteId": "SH01", "tableName": "tbl_task", ... }] }`

- [ ] **Step 3: 测试 status 站点过滤**

Run: `curl "http://localhost:3000/api/sync/status?site=SH01"`
Expected: 返回 SH01 的记录

- [ ] **Step 4: 测试 status 表过滤**

Run: `curl "http://localhost:3000/api/sync/status?table=tbl_task"`
Expected: 返回 tbl_task 的记录

- [ ] **Step 5: 测试 status 精确过滤**

Run: `curl "http://localhost:3000/api/sync/status?site=SH01&table=tbl_task"`
Expected: 返回单条记录

- [ ] **Step 6: 测试 status 无效站点**

Run: `curl "http://localhost:3000/api/sync/status?site=NO_SUCH_SITE"`
Expected: `{ "data": [] }`

- [ ] **Step 7: 测试 logs 全量查询**

Run: `curl http://localhost:3000/api/sync/logs`
Expected: `{ "data": [...], "limit": 10 }`

- [ ] **Step 8: 测试 logs limit 参数**

Run: `curl "http://localhost:3000/api/sync/logs?limit=5"`
Expected: `{ "data": [...], "limit": 5 }`

- [ ] **Step 9: 测试 logs limit 超限**

Run: `curl "http://localhost:3000/api/sync/logs?limit=999"`
Expected: `{ "data": [...], "limit": 100 }`
Note: 响应 limit 返回 100，不是 999

- [ ] **Step 10: 测试 logs 站点+表过滤**

Run: `curl "http://localhost:3000/api/sync/logs?site=SH01&table=tbl_task&limit=3"`
Expected: 只返回 SH01/tbl_task 的日志，limit=3

- [ ] **Step 11: 关闭开发服务器**

Run: `pkill -f "next dev" || true`

---

### Task 7: 撰写文档

**Files:**
- Create: `docs/database-analysis/sprint-2b3-summary.md`
- Create: `docs/testing/sprint-2b3-test-plan.md`

- [ ] **Step 1: 撰写 Sprint 2B.3 总结**

文件: `docs/database-analysis/sprint-2b3-summary.md`

```markdown
# Sprint 2B.3 总结

> 日期: 2026-05-30
> 状态: 完成

## 一、任务概述

实现同步状态与同步日志查询接口，不再每次进入数据库手动查询。

## 二、完成内容

### 2.1 新增文件

| 文件 | 说明 |
|------|------|
| `lib/sync/dto.ts` | SyncStatusDTO, SyncLogDTO |
| `lib/sync/query.ts` | queryProgress(), queryLogs(), clampLimit() |
| `app/api/sync/status/route.ts` | GET /api/sync/status |
| `app/api/sync/logs/route.ts` | GET /api/sync/logs |

### 2.2 接口说明

**GET /api/sync/status**
- 查询 sync_progress 表
- 支持 site/table 可选过滤
- 返回 data 数组

**GET /api/sync/logs**
- 查询 sync_job_log 表
- 支持 site/table 可选过滤
- 支持 limit 参数（默认 10，最大 100）
- 返回 data 数组和 limit 值

## 三、约束遵守

| 约束 | 状态 |
|------|------|
| 不连接真实源库 | ✅ |
| 不做定时任务 | ✅ |
| 不做前端 UI | ✅ |
| 不扩展 devices/volumes | ✅ |
| 不替换页面数据源 | ✅ |
| 不做 summary | ✅ |
| 不重构 tasks-sync | ✅ |

## 四、测试结果

| 测试项 | 结果 |
|--------|------|
| pnpm tsc | ✅ |
| pnpm build | ✅ |
| GET /api/sync/status | ✅ |
| GET /api/sync/logs | ✅ |
| limit clamp | ✅ |
| 空结果 | ✅ |

## 五、后续建议

### 5.1 Sprint 2B.3.1 代码架构梳理
- 统一站点配置管理
- 移除硬编码 SITE_CODE/SOURCE_TABLE

### 5.2 Sprint 2B.3.2 扩展第二个同步对象
- unified_devices
- unified_volumes
```

- [ ] **Step 2: 撰写测试计划**

文件: `docs/testing/sprint-2b3-test-plan.md`

```markdown
# Sprint 2B.3 测试计划

> 日期: 2026-05-30
> 目标: 验证同步状态与日志查询接口

## 一、测试环境

- 数据库: Docker PostgreSQL (unified_disc_postgres)
- 开发服务器: pnpm dev
- API Base: http://localhost:3000

## 二、测试用例

### 2.1 GET /api/sync/status

| ID | 测试项 | 命令 | 期望结果 |
|----|--------|------|----------|
| S1 | 全量查询 | `curl /api/sync/status` | data 数组非空 |
| S2 | 站点过滤 | `curl "?site=SH01"` | 只含 SH01 |
| S3 | 表过滤 | `curl "?table=tbl_task"` | 只含 tbl_task |
| S4 | 精确过滤 | `curl "?site=SH01&table=tbl_task"` | 单条 |
| S5 | 无效站点 | `curl "?site=NO_SUCH_SITE"` | data: [] |
| S6 | 无效表 | `curl "?table=NO_SUCH_TABLE"` | data: [] |

### 2.2 GET /api/sync/logs

| ID | 测试项 | 命令 | 期望结果 |
|----|--------|------|----------|
| L1 | 默认查询 | `curl /api/sync/logs` | limit=10 |
| L2 | 自定义 limit | `curl "?limit=5"` | limit=5 |
| L3 | limit=1 | `curl "?limit=1"` | limit=1 |
| L4 | limit=100 | `curl "?limit=100"` | limit=100 |
| L5 | limit 超限 | `curl "?limit=999"` | limit=100 |
| L6 | limit 负数 | `curl "?limit=-5"` | limit=1 |
| L7 | 站点过滤 | `curl "?site=SH01&limit=5"` | 只含 SH01 |
| L8 | 表过滤 | `curl "?table=tbl_task&limit=5"` | 只含 tbl_task |
| L9 | 空结果 | `curl "?site=NO_SUCH"` | data: [] |

### 2.3 错误响应

| ID | 测试项 | 命令 | 期望结果 |
|----|--------|------|----------|
| E1 | status 错误 | 停数据库后请求 | `{ "data": [], "error": "..." }` |
| E2 | logs 错误 | 停数据库后请求 | `{ "data": [], "limit": N, "error": "..." }` |

## 三、性能要求

- 响应时间 < 200ms
- limit=100 时查询正常

## 四、验收标准

- [ ] TypeScript 编译无错误
- [ ] Next.js 构建成功
- [ ] 所有 API 测试通过
- [ ] 文档已更新
```

- [ ] **Step 3: Commit 文档**

```bash
git add docs/database-analysis/sprint-2b3-summary.md docs/testing/sprint-2b3-test-plan.md
git commit -m "docs: 添加 Sprint 2B.3 总结和测试计划"
```

---

## 四、自查清单

完成所有任务后，执行以下检查：

- [ ] Spec 覆盖检查：每个 spec 章节都有对应任务
- [ ] Placeholder 检查：无 "TBD"、"TODO"、未完成步骤
- [ ] 类型一致性检查：DTO 字段名在整个 plan 中一致
- [ ] 约束检查：
  - limit clamp 在 query.ts 和 route.ts 中都生效
  - 所有数字字段使用 Number()
  - 错误响应结构稳定

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-30-sync-status-logs-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**