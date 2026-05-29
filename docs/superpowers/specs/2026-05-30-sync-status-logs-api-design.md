# Sprint 2B.3 同步状态与日志查询接口设计规格

> 日期: 2026-05-30
> 状态: 已确认
> 目标: 实现同步状态与同步日志查询接口，不再每次进入数据库手动查询

---

## 一、设计目标

通过 API 查询 sync_progress 和 sync_job_log，直观看到同步状态和历史日志。

**不是最终监控面板**，只是查询接口，为后续 UI 或监控做好准备。

---

## 二、约束条件

| 约束 | 说明 |
|------|------|
| 不连接真实源库 | 只查询本地 PostgreSQL |
| 不做定时任务 | 只有查询接口 |
| 不做前端 UI | 接口已完成 |
| 不扩展 devices/volumes 同步 | 只做查询 |
| 不替换页面数据源 | 页面仍使用 mock |
| 不做 summary 接口 | 暂不需要 |
| 不重构 tasks-sync | 现有主逻辑不变 |
| 不大规模清理代码 | 保持现有结构 |

---

## 三、文件结构

### 3.1 新增文件

```
app/api/sync/
├── status/route.ts         # GET /api/sync/status
├── logs/route.ts          # GET /api/sync/logs
│
lib/sync/
├── dto.ts                 # SyncStatusDTO, SyncLogDTO
└── query.ts              # queryProgress(), queryLogs()
```

### 3.2 保留现有

```
app/api/sync/
├── tasks/route.ts         # POST /api/sync/tasks (已有)

lib/sync/
├── types.ts              # 内部同步类型 (已有)
├── tasks-sync.ts         # 同步主逻辑 (已有)
├── sync-progress.ts      # 事务内更新 (已有)
├── sync-job-log.ts       # 事务内更新 (已有)
├── source-reader.ts      # 源数据读取 (已有)
├── field-mapper.ts       # 字段映射 (已有)
└── upsert.ts             # UPSERT 操作 (已有)
```

---

## 四、DTO 设计

### 4.1 lib/sync/dto.ts

```typescript
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

### 4.2 字段映射规则

| 数据库字段 | DTO 字段 |
|-----------|----------|
| source_site_id | siteId |
| source_table | tableName |
| last_source_id | lastSourceId |
| rows_read | rowsRead |
| rows_upserted | rowsUpserted |
| rows_skipped | rowsSkipped |
| error_message | error |
| started_at | startedAt |
| finished_at | finishedAt |

---

## 五、查询逻辑

### 5.1 lib/sync/query.ts

```typescript
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
 */
export async function queryProgress(
  filters: ProgressFilters = {}
): Promise<SyncStatusDTO[]> {
  // 构建 WHERE 条件
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
    lastSourceId: row.last_source_id,
    lastSyncTime: row.last_sync_time ? new Date(row.last_sync_time).toISOString() : null,
    lastStatus: row.last_status,
    syncedRows: row.synced_rows,
    lastError: row.last_error,
  }))
}

/**
 * 查询同步日志
 */
export async function queryLogs(
  filters: LogsFilters = {},
  limit: number = 10
): Promise<SyncLogDTO[]> {
  // 限制 limit 范围
  const safeLimit = Math.min(Math.max(1, limit), 100)

  // 构建 WHERE 条件
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
    rowsRead: row.rows_read,
    rowsUpserted: row.rows_upserted,
    rowsSkipped: row.rows_skipped,
    error: row.error_message,
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
  }))
}
```

### 5.2 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| site | string | 否 | 返回所有 | 过滤站点 ID |
| table | string | 否 | 返回所有 | 过滤源表名 |
| limit | number | 否 | 10 | 日志条数限制 |

### 5.3 安全约束

- 使用参数化 SQL，禁止字符串拼接
- limit 最大 100，超出则截断
- 无记录时返回空数组，不是 404

---

## 六、API 设计

### 6.1 GET /api/sync/status

**端点:** `GET /api/sync/status`

**Query 参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| site | string | 可选，站点 ID |
| table | string | 可选，源表名 |

**响应:**
```json
{
  "data": [
    {
      "siteId": "SH01",
      "tableName": "tbl_task",
      "lastSourceId": 6,
      "lastSyncTime": "2026-05-29T16:00:00.000Z",
      "lastStatus": "success",
      "syncedRows": 6,
      "lastError": null
    }
  ]
}
```

**空结果:**
```json
{
  "data": []
}
```

**测试命令:**
```bash
# 查询所有
curl http://localhost:3000/api/sync/status

# 按站点过滤
curl "http://localhost:3000/api/sync/status?site=SH01"

# 按站点+表过滤
curl "http://localhost:3000/api/sync/status?site=SH01&table=tbl_task"

# 无效站点（空结果）
curl "http://localhost:3000/api/sync/status?site=NO_SUCH_SITE"
```

---

### 6.2 GET /api/sync/logs

**端点:** `GET /api/sync/logs`

**Query 参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| site | string | 可选，站点 ID |
| table | string | 可选，源表名 |
| limit | number | 可选，默认 10，最大 100 |

**响应:**
```json
{
  "data": [
    {
      "siteId": "SH01",
      "tableName": "tbl_task",
      "jobId": "sync-tbl_task-1748534400000",
      "status": "success",
      "rowsRead": 5,
      "rowsUpserted": 5,
      "rowsSkipped": 0,
      "error": null,
      "startedAt": "2026-05-29T16:00:00.000Z",
      "finishedAt": "2026-05-29T16:00:00.500Z"
    }
  ],
  "limit": 10
}
```

**测试命令:**
```bash
# 查询最近 10 条
curl http://localhost:3000/api/sync/logs

# 按站点过滤，限制 5 条
curl "http://localhost:3000/api/sync/logs?site=SH01&limit=5"

# 按站点+表过滤
curl "http://localhost:3000/api/sync/logs?site=SH01&table=tbl_task&limit=5"

# limit 超出最大值（截断到 100）
curl "http://localhost:3000/api/sync/logs?limit=999"
```

---

## 七、Route 实现

### 7.1 app/api/sync/status/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { queryProgress } from '@/lib/sync/query'

export const dynamic = 'force-dynamic'

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

### 7.2 app/api/sync/logs/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { queryLogs } from '@/lib/sync/query'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const site = searchParams.get('site') ?? undefined
  const table = searchParams.get('table') ?? undefined
  const limit = parseInt(searchParams.get('limit') ?? '10', 10)

  try {
    const data = await queryLogs({ site, table }, limit)
    return NextResponse.json({ data, limit })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { data: [], limit: 10, error: errorMessage },
      { status: 500 }
    )
  }
}
```

---

## 八、测试计划

### 8.1 TypeScript 检查

```bash
pnpm exec tsc --noEmit
```

期望: 无编译错误

### 8.2 Build 检查

```bash
pnpm build
```

期望: 构建成功

### 8.3 API 测试

| 测试项 | 命令 | 期望 |
|--------|------|------|
| status 全量 | `curl http://localhost:3000/api/sync/status` | data 数组 |
| status 站点过滤 | `curl "?site=SH01"` | 只含 SH01 |
| status 表过滤 | `curl "?table=tbl_task"` | 只含 tbl_task |
| status 精确过滤 | `curl "?site=SH01&table=tbl_task"` | 单条记录 |
| status 无效站点 | `curl "?site=NO_SUCH_SITE"` | data: [] |
| logs 全量 | `curl http://localhost:3000/api/sync/logs` | limit=10 |
| logs 限制 | `curl "?limit=5"` | limit=5 |
| logs limit 超限 | `curl "?limit=999"` | limit=100 |

---

## 九、后续步骤建议

### 9.1 Sprint 2B.3.1 代码架构梳理

现有 lib/sync 模块结构：

```
lib/sync/
├── types.ts          # 内部类型
├── dto.ts           # 新增：API DTO
├── query.ts         # 新增：查询逻辑
├── tasks-sync.ts    # tasks 同步主逻辑
├── sync-progress.ts # 事务内更新
├── sync-job-log.ts  # 事务内更新
├── source-reader.ts # 读取源数据
├── field-mapper.ts  # 字段映射
└── upsert.ts        # UPSERT 操作
```

潜在优化点：
- sync-progress.ts 和 sync-job-log.ts 硬编码 SITE_CODE/SOURCE_TABLE
- query.ts 需要同样逻辑但支持参数化
- 未来多站点/多表同步需要统一站点配置

### 9.2 Sprint 2B.3.2 扩展第二个同步对象

在 tasks 之后，可选：

- unified_devices 同步
- unified_volumes 同步

---

## 十、相关文档

| 文档 | 用途 |
|------|------|
| `docs/superpowers/specs/2026-05-29-sync-service-design.md` | Sprint 2B.2 同步服务设计 |
| `docs/database-analysis/sprint-2b1-summary.md` | Sprint 2B.1 总结 |
| `docs/database-analysis/sprint-2b3-summary.md` | Sprint 2B.3 总结（完成后） |
| `docs/testing/sprint-2b3-test-plan.md` | Sprint 2B.3 测试计划（完成后） |

---

*规格创建: 2026-05-30*
*Sprint 2B.3 - 同步状态与日志查询接口*