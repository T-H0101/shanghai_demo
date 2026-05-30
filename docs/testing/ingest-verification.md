# Ingest 验收文档

> POST /api/ingest/tasks 和 POST /api/ingest/devices 的完整验收流程。

---

## 前置条件

- Docker PostgreSQL 运行中 (`unified_disc_postgres`)
- Next.js dev server 运行中 (`localhost:3000`)
- `.env.local` 已配置 `INGEST_API_KEY_SH01=test-api-key-123`

## 环境验证

```bash
# 确认 DB 可连
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT 1;"

# 确认 dev server 可达
curl -s http://localhost:3000/api/sync/status
```

---

## 一、Tasks Ingest 验收

### T1: 无 API Key → 401

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_task","batchId":"t-1","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

**预期：** HTTP 401，`{"status":"error","code":"AUTH_ERROR","message":"x-api-key header is required"}`

### T2: 错误 API Key → 401

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: wrong-key" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_task","batchId":"t-2","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

**预期：** HTTP 401，`{"status":"error","code":"AUTH_ERROR","message":"Invalid API Key"}`

### T3: siteCode 不匹配 → 403

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"BJ01","sourceTable":"tbl_task","batchId":"t-3","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

**预期：** HTTP 403，`{"status":"error","code":"AUTH_ERROR","message":"API Key does not match siteCode: BJ01"}`

### T4: recordCount 不匹配 → 400

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_task","batchId":"t-4","snapshotAt":"2026-05-31T10:00:00Z","recordCount":5,"records":[]}'
```

**预期：** HTTP 400，`{"status":"error","code":"VALIDATION_ERROR",...}`

### T5: sourceTable 错误 → 400

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_invalid","batchId":"t-5","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

**预期：** HTTP 400，`{"status":"error","code":"UNSUPPORTED_SOURCE_TABLE","message":"Unsupported source table: tbl_invalid"}`

### T6: records 超过 10000 → 413

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_task","batchId":"t-6","snapshotAt":"2026-05-31T10:00:00Z","recordCount":10001,"records":[]}'
```

**预期：** HTTP 413，`{"status":"error","code":"RECORD_LIMIT_EXCEEDED","message":"Record count 10001 exceeds limit 10000"}`

### T7: 正确请求 → 200

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{
    "siteCode": "SH01",
    "sourceTable": "tbl_task",
    "batchId": "tasks-batch-001",
    "snapshotAt": "2026-05-31T10:00:00Z",
    "recordCount": 2,
    "records": [
      {
        "id": 1001,
        "task_no": "TASK-INGEST-001",
        "task_name": "数据备份任务A",
        "task_type": "backup",
        "status": "completed",
        "phase": "finished",
        "priority": "high",
        "data_classification": "机密",
        "archive_name": "20260531-备份A",
        "source_path": "/data/project-a",
        "package_path": "/archive/20260531/backup-a",
        "operator": "admin",
        "department": "IT",
        "created_at": "2026-05-31T08:00:00Z",
        "updated_at": "2026-05-31T09:30:00Z"
      },
      {
        "id": 1002,
        "task_no": "TASK-INGEST-002",
        "task_name": "数据恢复任务B",
        "task_type": "restore",
        "status": "in_progress",
        "phase": "restoring",
        "priority": "medium",
        "data_classification": "内部",
        "archive_name": "20260531-恢复B",
        "source_path": "/archive/20260531/backup-b",
        "package_path": "/data/restored-b",
        "operator": "admin",
        "department": "IT",
        "created_at": "2026-05-31T09:00:00Z",
        "updated_at": "2026-05-31T09:45:00Z"
      }
    ]
  }'
```

**预期：** HTTP 200，`{"status":"success","duplicated":false,"rowsUpserted":2,"batchId":"tasks-batch-001"}`

### T8: 重复 batchId（相同内容）→ duplicated

重复 T7 的 curl 命令。

**预期：** HTTP 200，`{"status":"success","duplicated":true,"rowsUpserted":0,"batchId":"tasks-batch-001"}`

### T9: 重复 batchId（不同内容）→ 409

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_task","batchId":"tasks-batch-001","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

**预期：** HTTP 409，`{"status":"error","code":"DUPLICATE_BATCH","message":"Batch tasks-batch-001 already processed with different content"}`

---

## 二、Devices Ingest 验收

### D1: 无 API Key → 401

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_disc_lib","batchId":"d-1","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

**预期：** HTTP 401，`{"status":"error","code":"AUTH_ERROR","message":"x-api-key header is required"}`

### D2: 错误 API Key → 401

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: wrong-key" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_disc_lib","batchId":"d-2","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

**预期：** HTTP 401，`{"status":"error","code":"AUTH_ERROR","message":"Invalid API Key"}`

### D3: siteCode 不匹配 → 403

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"BJ01","sourceTable":"tbl_disc_lib","batchId":"d-3","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

**预期：** HTTP 403，`{"status":"error","code":"AUTH_ERROR","message":"API Key does not match siteCode: BJ01"}`

### D4: recordCount 不匹配 → 400

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_disc_lib","batchId":"d-4","snapshotAt":"2026-05-31T10:00:00Z","recordCount":5,"records":[]}'
```

**预期：** HTTP 400，`{"status":"error","code":"VALIDATION_ERROR",...}`

### D5: sourceTable 错误 → 400

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_invalid","batchId":"d-5","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

**预期：** HTTP 400，`{"status":"error","code":"UNSUPPORTED_SOURCE_TABLE","message":"Unsupported source table: tbl_invalid"}`

### D6: records 超过 10000 → 413

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_disc_lib","batchId":"d-6","snapshotAt":"2026-05-31T10:00:00Z","recordCount":10001,"records":[]}'
```

**预期：** HTTP 413，`{"status":"error","code":"RECORD_LIMIT_EXCEEDED","message":"Record count 10001 exceeds limit 10000"}`

### D7: 正确请求 → 200

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

**预期：** HTTP 200，`{"status":"success","duplicated":false,"rowsUpserted":2,"batchId":"devices-batch-001"}`

### D8: 重复 batchId（相同内容）→ duplicated

重复 D7 的 curl 命令。

**预期：** HTTP 200，`{"status":"success","duplicated":true,"rowsUpserted":0,"batchId":"devices-batch-001"}`

### D9: 重复 batchId（不同内容）→ 409

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_disc_lib","batchId":"devices-batch-001","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

**预期：** HTTP 409，`{"status":"error","code":"DUPLICATE_BATCH","message":"Batch devices-batch-001 already processed with different content"}`

---

## 三、现有 Sync 接口回归

### S1: POST /api/ingest/tasks（有效空 records 快照）→ 200

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_task","batchId":"verify-tasks","snapshotAt":"2026-05-31T10:00:00Z","recordCount":0,"records":[]}'
```

**预期：** HTTP 200，`{"status":"success","duplicated":false,"rowsUpserted":0,"batchId":"verify-tasks"}`

> 注意：这是有效请求体 + 空 records 数组，不是空 JSON `{}`。

### S2: POST /api/sync/tasks → 200

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/sync/tasks
```

**预期：** HTTP 200

### S3: GET /api/sync/status → 200

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/api/sync/status
```

**预期：** HTTP 200

---

## 四、数据库验证

### 验证 unified_tasks 写入

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT source_site_id, source_id, task_no, task_name, status FROM unified_tasks ORDER BY created_at DESC LIMIT 5;"
```

**预期：** 显示 T7 写入的 2 条记录，source_site_id = 'SH01'

### 验证 unified_devices 写入

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT source_site_id, source_id, device_id, device_name, status FROM unified_devices ORDER BY created_at DESC LIMIT 5;"
```

**预期：** 显示 D7 写入的 2 条记录，source_site_id = 'SH01'

### 验证 ingest_batch_log 记录

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT batch_id, site_code, source_table, status, rows_upserted, duplicated FROM ingest_batch_log ORDER BY created_at DESC LIMIT 10;"
```

**预期：** 显示本验收过程产生的所有批次记录

### 验证 raw_data 内容

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT source_id, raw_data->>'last_heartbeat' as heartbeat, raw_data->>'operator' as operator FROM unified_devices WHERE source_id IN ('5001','5002');"
```

**预期：** 显示 last_heartbeat 和 operator 字段（从 raw_data 中提取）

---

## 五、通过标准

| 类别 | 项数 | 通过条件 |
|------|------|---------|
| Tasks Ingest | T1-T9 | 9 项全部通过 |
| Devices Ingest | D1-D9 | 9 项全部通过 |
| Sync 回归 | S1-S3 | 3 项全部通过 |
| DB 验证 | 4 项 | 数据正确写入 |

**总计：25 项验收**

---

## 六、验收记录模板

| 序号 | 测试项 | 预期 | 实际 | 结果 |
|------|--------|------|------|------|
| T1 | 无 API Key | 401 | | |
| T2 | 错误 API Key | 401 | | |
| T3 | siteCode 不匹配 | 403 | | |
| T4 | recordCount 不匹配 | 400 | | |
| T5 | sourceTable 错误 | 400 | | |
| T6 | records 超过 10000 | 413 | | |
| T7 | 正确请求 | 200 success | | |
| T8 | 重复 batchId（相同） | 200 duplicated | | |
| T9 | 重复 batchId（不同） | 409 | | |
| D1 | 无 API Key | 401 | | |
| D2 | 错误 API Key | 401 | | |
| D3 | siteCode 不匹配 | 403 | | |
| D4 | recordCount 不匹配 | 400 | | |
| D5 | sourceTable 错误 | 400 | | |
| D6 | records 超过 10000 | 413 | | |
| D7 | 正确请求 | 200 success | | |
| D8 | 重复 batchId（相同） | 200 duplicated | | |
| D9 | 重复 batchId（不同） | 409 | | |
| S1 | 有效空 records 快照 | 200 | | |
| S2 | sync/tasks | 200 | | |
| S3 | sync/status | 200 | | |
| DB1 | unified_tasks 数据 | 有记录 | | |
| DB2 | unified_devices 数据 | 有记录 | | |
| DB3 | batch_log 记录 | 有记录 | | |
| DB4 | raw_data 内容 | 字段正确 | | |

---

*文档创建: 2026-05-31*
*Sprint 2B.8: 验收文档*
