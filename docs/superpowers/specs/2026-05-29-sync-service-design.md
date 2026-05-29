# Sprint 2B.2 同步服务骨架设计规格

> 日期: 2026-05-29
> 状态: 草稿
> 目标: 验证同步机制，使用 tasks 作为第一个同步对象

---

## 一、设计目标

验证 PostgreSQL 中心库的数据同步闭环机制：
1. 从模拟源表读取数据
2. 字段映射到统一表结构
3. UPSERT 到 unified_tasks
4. 更新同步进度
5. 记录同步日志

**不是最终同步架构**，用于验证同步闭环，后续可迁移到通用 SyncService 架构。

---

## 二、约束条件

| 约束 | 说明 |
|------|------|
| 不连接真实源库 | 只使用本地模拟源表 |
| 不同步真实数据 | mock_tbl_task 表数据为虚构 |
| 不处理大表 | tbl_file, tbl_folder 等不进入中心库 |
| 不改 UI | 页面保持 mock 数据 |
| 不替换页面数据源 | API Mode 仍为 mock |
| 不重复插入 | 基于 UNIQUE(source_site_id, source_table, source_id) |

---

## 三、数据源设计

### 3.1 模拟源表 (mock_tbl_task)

```sql
-- databases/sprint-2b2/mock-tbl-task.sql

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

-- Seed 数据（5条记录，可重复执行）
INSERT INTO mock_tbl_task (task_no, task_name, task_type, status, phase, priority, data_classification, archive_name, source_path, package_path, operator, department)
VALUES
  ('TASK-001', '财务报表备份', 'backup', 'completed', 'finished', 'high', '财务数据', '2026-05-report', '/data/finance/reports', '/archive/backup/report.tar.gz', '张伟', '财务部'),
  ('TASK-002', '客户数据归档', 'archive', 'running', 'transferring', 'normal', '客户数据', 'customer-archive', '/data/customers', '/archive/pending/customer.tar.gz', '李娜', 'IT运维部'),
  ('TASK-003', '日志导出', 'export', 'failed', 'error', 'low', '系统日志', 'syslog-2026-05', '/var/log', '/export/pending/syslog.tar.gz', '赵强', 'IT运维部'),
  ('TASK-004', '备份验证', 'backup', 'pending', 'waiting', 'normal', '系统数据', 'backup-verify', '/data/backup', '/archive/verify.tar.gz', '王明', 'IT运维部'),
  ('TASK-005', '数据清理', 'export', 'pending', 'waiting', 'low', '临时数据', 'cleanup-2026', '/data/temp', '/export/cleanup.tar.gz', '刘芳', 'IT运维部')
ON CONFLICT (task_no) DO NOTHING;
```

**幂等性保证**:
- `task_no VARCHAR(100) NOT NULL UNIQUE` - 添加唯一约束
- `ON CONFLICT (task_no) DO NOTHING` - 重复执行不插入重复数据

### 3.2 数据读取逻辑

`source-reader.ts` 从 `mock_tbl_task` 表读取数据，使用 ID 游标：

```typescript
async function readSourceRecords(lastSourceId: number): Promise<SourceRecord[]> {
  // 读取 ID > lastSourceId 的记录
  const result = await query(
    'SELECT * FROM mock_tbl_task WHERE id > $1 ORDER BY id ASC',
    [lastSourceId]
  )
  return result.rows
}
```

---

## 四、字段映射

### 4.1 映射规则

| mock_tbl_task | unified_tasks |
|---------------|---------------|
| id | source_id |
| 'SH01' | source_site_id |
| 'tbl_task' | source_table |
| NOW() | synced_at |
| task_no | task_no |
| task_name | task_name |
| task_type | task_type |
| status | status |
| phase | phase |
| priority | priority |
| data_classification | data_classification |
| archive_name | archive_name |
| source_path | source_path |
| package_path | package_path |
| operator | operator |
| department | department |
| - | total_files: 0 |
| - | total_size: 0 |
| - | raw_data: {原始数据 JSON} |

### 4.2 映射实现

```typescript
// lib/sync/field-mapper.ts

interface TaskSourceRecord {
  id: number
  task_no: string
  task_name: string
  task_type: string
  status: string
  // ... 其他字段
}

function mapTask(source: TaskSourceRecord): UnifiedTaskRecord {
  return {
    source_site_id: 'SH01',
    source_table: 'tbl_task',
    source_id: String(source.id),
    synced_at: new Date(),
    task_no: source.task_no,
    task_name: source.task_name,
    task_type: source.task_type,
    status: source.status,
    // ... 其他字段
    total_files: 0,
    total_size: 0,
    raw_data: source,  // 保留原始数据
  }
}
```

---

## 五、同步主逻辑

### 5.1 执行流程

```
syncTasks()
    │
    ├─ 1. 获取 sync_progress（读取 last_source_id）
    │       ├─ 记录 lastSourceIdBefore
    │       └─ 如果不存在，创建初始记录
    │
    ├─ 2. 写入 sync_job_log（status: running）
    │
    ├─ 3. 读取源数据（id > last_source_id）
    │       ├─ rowsRead = 记录数
    │       └─ 如果无新记录，返回 skipped
    │
    ├─ 4. 字段映射
    │
    ├─ 5. UPSERT + 更新游标（事务）
    │       ├─ 开启事务
    │       ├─ UPSERT 到 unified_tasks
    │       ├─ rowsUpserted = 本次写入行数
    │       ├─ rowsSkipped = 0（使用游标后无重复）
    │       ├─ 更新 sync_progress（事务内）
    │       │       ├─ last_source_id = 最大 source_id
    │       │       ├─ last_sync_time = NOW()
    │       │       ├─ last_status = 'success'
    │       │       └─ synced_rows = rowsUpserted
    │       ├─ 提交事务
    │       └─ **UPSERT 和游标更新在同一事务内**
    │
    ├─ 6. 更新 sync_job_log（事务外）
    │       ├─ finished_at = NOW()
    │       ├─ status = 'success'
    │       ├─ rows_read = rowsRead
    │       ├─ rows_upserted = rowsUpserted
    │       └─ rows_skipped = 0
    │
    └─ 7. 返回结果
```

### 5.2 错误处理

```
同步失败时：
    │
    ├─ 1. 回滚事务（如果有开启）
    │
    ├─ 2. 更新 sync_job_log
    │       ├─ finished_at = NOW()
    │       ├─ status = 'failed'
    │       └─ error_message = 错误信息
    │
    └─ 3. sync_progress.last_status = 'failed'
            ├─ last_error = 错误信息
            └─ **不更新 last_source_id**（保留游标，下次重试）
```

### 5.3 核心原则

| 原则 | 说明 |
|------|------|
| 先写日志再同步 | job_log 记录同步开始 |
| UPSERT + 游标更新在同一事务 | 原子性，避免数据写入成功但游标未更新 |
| 失败不更新游标 | 保留游标，支持重试 |
| 幂等执行 | 重复执行不重复插入 |

### 5.4 Sprint 2B.2 范围说明

**本 Sprint 验证**:
- ✅ 新增记录的增量同步（基于 ID 游标）
- ✅ UPSERT 幂等性
- ✅ 同步日志记录

**后续增强（不在本 Sprint）**:
- ❌ 已同步记录的更新检测（需要 updated_at 或 hash）
- ❌ 批量处理优化
- ❌ 定时同步

---

## 六、文件结构

```
lib/sync/
├── types.ts              # 类型定义
│   ├── SyncResult        # 同步结果
│   ├── SourceRecord     # 源数据记录
│   └── UnifiedRecord    # 统一表记录
│
├── source-reader.ts      # 从 mock_tbl_task 读取源数据
│   └── readSourceRecords(lastSourceId: number): Promise<SourceRecord[]>
│
├── field-mapper.ts       # 字段映射
│   └── mapTask(source: TaskSource): UnifiedTaskRecord
│
├── upsert.ts             # UPSERT 操作
│   ├── upsertOne(table, record): Promise<UpsertResult>
│   └── upsertBatch(table, records): Promise<BatchResult>
│
├── sync-progress.ts      # sync_progress 表操作
│   ├── getProgress(siteCode, tableName): Promise<ProgressRecord>
│   └── updateProgress(siteCode, tableName, newSourceId): Promise<void>
│
├── sync-job-log.ts       # sync_job_log 表操作
│   ├── createJobLog(siteCode, tableName): Promise<string>  # 返回 job_id
│   └── updateJobLog(jobId, updates): Promise<void>
│
└── tasks-sync.ts         # 同步主逻辑
    └── syncTasks(): Promise<SyncResult>

app/api/sync/tasks/
└── route.ts             # POST /api/sync/tasks

databases/sprint-2b2/
├── mock-tbl-task.sql    # 模拟源表创建和数据
└── README.md            # 数据说明
```

---

## 七、API 设计

### 7.1 端点

```
POST /api/sync/tasks
```

### 7.2 请求

无请求体（从 sync_progress 读取游标）

### 7.3 响应

**成功:**
```json
{
  "status": "success",
  "rowsRead": 5,
  "rowsUpserted": 5,
  "rowsSkipped": 0,
  "startedAt": "2026-05-29T08:00:00.000Z",
  "finishedAt": "2026-05-29T08:00:00.500Z",
  "lastSourceIdBefore": 3,
  "lastSourceIdAfter": 5
}
```

**无新数据:**
```json
{
  "status": "skipped",
  "rowsRead": 0,
  "rowsUpserted": 0,
  "rowsSkipped": 0,
  "startedAt": "2026-05-29T08:00:00.000Z",
  "finishedAt": "2026-05-29T08:00:00.100Z",
  "lastSourceIdBefore": 5,
  "lastSourceIdAfter": 5,
  "message": "No new records to sync"
}
```

**失败:**
```json
{
  "status": "failed",
  "rowsRead": 3,
  "rowsUpserted": 0,
  "rowsSkipped": 0,
  "startedAt": "2026-05-29T08:00:00.000Z",
  "finishedAt": "2026-05-29T08:00:00.200Z",
  "lastSourceIdBefore": 3,
  "lastSourceIdAfter": 3,
  "error": "Database connection failed"
}
```

> **说明**: Sprint 2B.2 核心指标是 `rowsRead`、`rowsUpserted`、`rowsSkipped`，不区分 `rowsInserted`/`rowsUpdated`。后续如果需要精确区分，可扩展 upsert.ts 的返回结构。

---

## 八、数据验证

### 8.1 验证步骤

1. 执行 `pnpm db:init` 确保数据库干净
2. 执行 `pnpm db:init:sync` 或手动运行 mock-tbl-task.sql
3. 调用 `POST /api/sync/tasks`
4. 检查 unified_tasks 表是否有新记录
5. 检查 sync_progress 表是否更新了游标
6. 检查 sync_job_log 表是否有日志记录
7. 再次调用 `POST /api/sync/tasks`，验证 rowsSkipped > 0

### 8.2 预期结果

| 步骤 | 预期 |
|------|------|
| 首次同步 | rowsRead=5, rowsUpserted=5, rowsSkipped=0 |
| 再次同步 | rowsRead=0, rowsSkipped=0, status=skipped (无新数据) |
| 增加 mock_tbl_task 新记录 | rowsRead=N, rowsUpserted=N |
| 查询 unified_tasks | 应包含所有同步的记录 |
| 查询 sync_progress | last_source_id = 最大 ID |
| 查询 sync_job_log | 有对应的运行记录 |

---

## 九、后续可迁移性

### 9.1 当前结构 → 通用架构

```
当前                          未来
lib/sync/tasks-sync.ts   →   lib/sync/handlers/tasks-handler.ts
(lib/sync/)              →   lib/sync/handlers/devices-handler.ts
                            lib/sync/handlers/volumes-handler.ts
                            lib/sync/base-handler.ts      # 提取通用逻辑
                            lib/sync/sync-service.ts     # 统一调度
```

### 9.2 可迁移性要点

| 模块 | 当前 | 未来 |
|------|------|------|
| route.ts | 薄封装 | 保持不变 |
| tasks-sync.ts | 主逻辑 | 迁移为 TasksHandler |
| field-mapper.ts | mapTask | 每个 Handler 自己的映射 |
| upsert.ts | 通用 | 保持通用 |
| sync-progress.ts | 通用 | 保持通用 |
| sync-job-log.ts | 通用 | 保持通用 |
| source-reader.ts | 读取 mock_tbl_task | 可扩展为读取真实源库 |

---

## 十、测试计划

### 10.1 单元测试

- field-mapper: 验证字段映射正确
- upsert: 验证幂等性
- sync-progress: 验证读写逻辑

### 10.2 集成测试

- 首次同步：验证数据写入
- 重复同步：验证 rowsSkipped
- 增量同步：验证新记录被同步
- 错误恢复：验证失败后游标不前进

### 10.3 手动验证

参见第八节"数据验证"

---

## 十一、相关文档

| 文档 | 用途 |
|------|------|
| `docs/testing/sprint-2b1-db-verification-guide.md` | 数据库本地验证流程 |
| `docs/database-analysis/sprint-2b1-summary.md` | Sprint 2B.1 总结 |
| `databases/sprint-2b2/mock-tbl-task.sql` | 模拟源表数据 |

---

*规格创建: 2026-05-29*
*Sprint 2B.2 - 同步服务骨架*