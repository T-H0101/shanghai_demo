# 同步流程图

> 文档版本: v1.0
> 更新时间: 2026-05-28

---

## 一、整体同步流程

### 1.1 主流程

```mermaid
flowchart TD
    Start([定时任务触发<br/>每 1/5/10 分钟]) --> CheckStatus{检查同步状态}

    CheckStatus -->|有未完成同步| RetryLast[重试上次失败]
    CheckStatus -->|无未完成或已完成| QueryLastTime[查询 last_sync_time]

    RetryLast --> QueryLastTime
    QueryLastTime --> SelectTables[选择同步表]

    SelectTables --> ForEachTable{遍历每个表}

    ForEachTable -->|tbl_task| SyncTask[同步任务表]
    ForEachTable -->|tbl_disc_lib| SyncDevice[同步设备表]
    ForEachTable -->|tbl_slots| SyncSlot[同步盘位表]
    ForEachTable -->|tbl_early_warning| SyncAlert[同步告警表]
    ForEachTable -->|...| SyncOther[同步其他表]

    SyncTask --> WriteStaging[写入 Staging]
    SyncDevice --> WriteStaging
    SyncSlot --> WriteStaging
    SyncAlert --> WriteStaging
    SyncOther --> WriteStaging

    WriteStaging --> Transform[数据转换]
    Transform --> Merge[合并到 Mirror 表]

    Merge --> UpdateProgress[更新同步进度]
    UpdateProgress --> CheckComplete{检查是否全部完成}

    CheckComplete -->|有下一个表| ForEachTable
    CheckComplete -->|全部完成| Success[标记同步完成]
    Success --> End([同步结束])

    ForEachTable -->|出错| LogError[记录错误]
    LogError --> RetryCount{重试次数 < 3?}
    RetryCount -->|是| WaitRetry[等待 30 秒后重试]
    WaitRetry --> ForEachTable
    RetryCount -->|否| MarkFailed[标记同步失败]
    MarkFailed --> Alert([发送告警通知])
```

---

## 二、增量同步子流程

### 2.1 增量读取

```mermaid
flowchart LR
    A[查询 last_sync_time] --> B{判断同步模式}

    B -->|首次同步| C[全量查询]
    B -->|非首次| D[增量查询]

    C --> E[按 ID 分页]
    E --> F[每次 10000 条]
    F --> G[继续分页?]
    G -->|是| E
    G -->|否| H[写入 Staging]

    D --> I[WHERE update_dt > last_sync_time]
    I --> J[写入 Staging]

    H --> K([返回结果集])
    J --> K
```

---

## 三、首次同步（初始化）

### 3.1 分页初始化

```mermaid
sequenceDiagram
    participant Sync as 同步服务
    participant Source as 源数据库
    participant Staging as Staging Area
    participant Progress as 同步进度表

    Sync->>Progress: 查询同步进度
    Progress-->>Sync: last_id = 0, status = 'idle'

    Sync->>Source: SELECT * FROM tbl_task<br/>ORDER BY id LIMIT 10000 OFFSET 0
    Source-->>Sync: 返回第 1-10000 条

    loop 直到全部同步完成
        Sync->>Staging: 批量写入 10000 条
        Sync->>Progress: 更新进度<br/>last_id = 10000, synced_count += 10000
        Sync->>Source: SELECT * FROM tbl_task<br/>ORDER BY id LIMIT 10000 OFFSET 10000
        Source-->>Sync: 返回第 10001-20000 条
    end

    Sync->>Progress: 更新状态<br/>status = 'completed'
```

### 3.2 初始化注意事项

| 注意事项 | 说明 |
|----------|------|
| 分页大小 | 每次 10000 条，避免内存溢出 |
| 排序字段 | 必须有主键或索引字段，确保分页正确 |
| 断点续传 | 记录 last_id，失败后从断点继续 |
| 速度控制 | 限制并发，避免影响源数据库 |

---

## 四、增量同步子流程

### 4.1 增量同步

```mermaid
flowchart TD
    Start[开始增量同步] --> QueryTime[查询 last_sync_time]

    QueryTime --> BuildSQL[构建增量 SQL]
    BuildSQL --> ExecuteSQL[执行增量查询]

    ExecuteSQL --> CheckResult{结果数量}

    CheckResult -->|> 0| HasData[有新增数据]
    CheckResult -->|= 0| NoData[无新增数据]

    HasData --> BatchWrite[分批写入 Staging]

    NoData --> UpdateTime[更新时间戳]
    UpdateTime --> End1[同步结束]

    BatchWrite --> WriteBatch{写入批次}

    WriteBatch -->|批次 N| WriteN[写入第 N 批]
    WriteBatch -->|全部写入| UpdateTime

    WriteN --> CheckBatch{批次完成?}

    CheckBatch -->|否| WriteBatch
    CheckBatch -->|是| WriteLog[记录同步日志]
    WriteLog --> End1
```

### 4.2 增量 SQL 示例

```sql
-- 任务表增量同步
SELECT
    id,
    uuid,
    task_type,
    task_name,
    status,
    burn_status,
    total_files,
    total_size,
    create_dt,
    update_dt
FROM tbl_task
WHERE update_dt > '{{last_sync_time}}'
ORDER BY id;

-- 设备表快照同步
SELECT
    lib_id,
    name,
    device_status,
    type,
    IP,
    mags,
    slots,
    group_id,
    use_status
FROM tbl_disc_lib
ORDER BY lib_id;

-- 告警表增量同步（真实字段以 schema-inventory 为准）
SELECT
    id,
    title,
    type,
    status,
    s_level,
    create_date,
    lib_id,
    user_id
FROM tbl_early_warning
WHERE create_date > '{{last_sync_time}}'
   OR id > '{{last_sync_id}}';
```

说明：设备、盘位、盘笼、光驱等源表缺少可靠更新时间字段，一期按快照同步并通过 `source_hash` 判断是否更新。

---

## 五、错误处理流程

### 5.1 错误重试机制

```mermaid
flowchart TD
    Start[执行同步] --> Execute[执行 SQL]

    Execute --> CheckError{出错?}

    CheckError -->|否| Success[同步成功]
    Success --> End([结束])

    CheckError -->|是| LogError[记录错误日志]

    LogError --> RetryCount{重试次数}

    RetryCount -->|≤ 3| Wait[等待 30 秒]
    Wait --> Execute

    RetryCount -->|> 3| MarkFailed[标记同步失败]

    MarkFailed --> Alert[发送告警]
    Alert --> End
```

### 5.2 错误日志表

```sql
CREATE TABLE sync_errors (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    source_site_id VARCHAR(50),
    error_type VARCHAR(50),
    error_message TEXT,
    sql_statement TEXT,
    retry_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',  -- pending/retrying/resolved/ignored
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);
```

---

## 六、同步时间戳管理

### 6.1 时间戳追踪

```sql
-- 同步进度表
CREATE TABLE sync_progress (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    source_site_id VARCHAR(50),

    -- 增量同步时间戳
    last_sync_time TIMESTAMP,

    -- 分页同步进度
    last_sync_id BIGINT DEFAULT 0,
    total_count BIGINT DEFAULT 0,
    synced_count BIGINT DEFAULT 0,

    -- 状态
    status VARCHAR(20) DEFAULT 'idle',  -- idle/syncing/completed/failed
    error_msg TEXT,
    retry_count INT DEFAULT 0,

    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,

    UNIQUE(table_name, source_site_id)
);
```

### 6.2 更新时间戳逻辑

```sql
-- 伪代码
function updateSyncTime(tableName, sourceSiteId, newSyncTime):
    UPDATE sync_progress
    SET
        last_sync_time = newSyncTime,
        updated_at = NOW(),
        status = 'idle'
    WHERE table_name = tableName
      AND source_site_id = sourceSiteId;
```
