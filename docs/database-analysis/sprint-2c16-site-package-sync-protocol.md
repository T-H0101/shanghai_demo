# Sprint 2C.16 — 站点数据包接收协议与小表全量同步接口设计

> **日期**: 2026-06-05
> **范围**: 设计和最小可执行计划，不直接大规模写代码
> **结论**: 小表每小时全量数据包推送；大表增量/索引化，`tbl_file` / `tbl_folder` 不进入 PG17 全量表。

---

## 一、领导确认的同步原则

1. 各站点定期导出总控需要的数据，打包推送到中心平台。
2. 小表数据量不大，使用全量同步，初版频率为每小时。
3. 大表如 `tbl_file` / `tbl_folder` 使用增量更新，最后做，长期走 ES / file index。
4. 数据包格式由总控统一定义，站点只按规范导出和调用。
5. 站点侧只负责导出和推送。
6. 总控负责接收、鉴权、校验、解析、入库、日志、错误返回。
7. 中心 PG17 不复制完整站点源库。

---

## 二、正式同步模式

| 类型 | 模式 | 入库策略 | 说明 |
|------|------|----------|------|
| 小表 | `full` | 同 `siteCode + tableName + source_id` UPSERT 覆盖 | 每小时推送全量快照，适用于当前 10 张关键小表 |
| 大表 | `incremental` | 按 watermark 分片处理 | 按 `id` / `create_date` / `update_dt` / `task_id` 分片 |
| 文件表 | `file_index` | 不进 PG17 全量表 | 后续写 ES / ClickHouse / 专用 file index |
| 包级幂等 | `batchId` | 同站点同 batchId 重复请求不重复入库 | payload checksum 一致返回 duplicated，不一致返回 409 |
| 表级幂等 | `siteCode + batchId + tableName` | 每张表单独记录结果 | 单表失败不应污染成功表统计 |

---

## 三、数据包格式

### 3.1 请求体

```json
{
  "siteCode": "SH01",
  "batchId": "SH01-20260605-1000",
  "snapshotAt": "2026-06-05T10:00:00+08:00",
  "mode": "full",
  "version": "1.0",
  "checksum": "sha256:PACKAGE_HASH",
  "tables": [
    {
      "tableName": "tbl_task",
      "syncMode": "full",
      "recordCount": 37,
      "checksum": "sha256:TBL_TASK_HASH",
      "records": [
        {
          "id": 1,
          "task_type": 0,
          "status": 0,
          "total_files": 3,
          "total_size": 527866374
        }
      ]
    }
  ],
  "errors": []
}
```

### 3.2 字段规则

| 字段 | 必填 | 规则 |
|------|------|------|
| siteCode | 是 | 必须与 API Key 绑定站点一致 |
| batchId | 是 | 包级幂等键，建议格式 `{siteCode}-{yyyyMMddHH}` |
| snapshotAt | 是 | 站点导出快照时间 |
| mode | 是 | `full` / `incremental` / `mixed` |
| version | 是 | 初版固定 `1.0` |
| checksum | 是 | 整包 canonical JSON SHA-256 |
| tables | 是 | 至少 1 张表 |
| tableName | 是 | 必须在总控白名单中 |
| syncMode | 是 | 小表为 `full`，大表预留 `incremental` / `file_index` |
| recordCount | 是 | 必须等于 `records.length` |
| records | 是 | 当前表原始记录数组 |
| table checksum | 是 | 单表 records canonical JSON SHA-256 |
| errors | 否 | 站点导出时的错误报告 |

### 3.3 错误报告格式

```json
{
  "siteCode": "SH01",
  "batchId": "SH01-20260605-1000",
  "status": "failed",
  "errors": [
    {
      "tableName": "tbl_slots",
      "code": "EXPORT_TIMEOUT",
      "message": "站点导出 tbl_slots 超时",
      "occurredAt": "2026-06-05T10:03:12+08:00"
    }
  ]
}
```

---

## 四、小表全量同步范围

| 源表 | 当前中心目标 | 当前 import 方式 | 纳入小表全量包 | 顺序依赖 |
|------|--------------|------------------|----------------|----------|
| tbl_task | `unified_tasks` | `import:tasks`，`mapRealTask` + `upsertTasksInTransaction` | 是 | 先于 `tbl_lib_task`、`tbl_disc`、`tbl_user_task` |
| tbl_disc_lib | `unified_devices` | `import:devices`，`mapRealDevice` + `upsertDevicesInTransaction` | 是 | 先于 `tbl_magzines`、`tbl_slots`、`tbl_lib_task` |
| tbl_magzines | 聚合到 `unified_devices.cage_count` | `import:devices` 内聚合 | 是 | 依赖 `tbl_disc_lib` |
| tbl_slots | 聚合到 `unified_devices` 容量/盘位字段 | `import:devices` 内聚合 | 是 | 依赖 `tbl_magzines` |
| tbl_hd_info | `unified_hard_disks` | `import:hard-disks` | 是 | 可独立，设备关联后续补 |
| tbl_lib_task | 聚合到 `unified_tasks.device_id` | `import:tasks` 内聚合 | 是 | 依赖 `tbl_task`、`tbl_disc_lib` |
| tbl_disc | `unified_disc_media` | `import:discs` | 是 | 依赖 `tbl_task`、`tbl_slots`、`tbl_magzines`、`tbl_disc_lib` |
| tbl_logical_volume | `unified_volumes` | `import:volumes` | 是 | 先于 `tbl_volume_slot` 聚合 |
| tbl_volume_slot | 聚合到 `unified_volumes.file_count`/slot_count | `import:volumes` 内聚合 | 是 | 依赖 `tbl_logical_volume` |
| tbl_user_task | 聚合到 `unified_tasks.operator` | `import:tasks` 内聚合 | 是 | 依赖 `tbl_task` |

推荐处理顺序：

```text
1. tbl_task
2. tbl_disc_lib
3. tbl_magzines
4. tbl_slots
5. tbl_lib_task
6. tbl_user_task
7. tbl_disc
8. tbl_logical_volume
9. tbl_volume_slot
10. tbl_hd_info
```

---

## 五、大表增量 / ES 策略

`tbl_file` / `tbl_folder` 不进入小表全量包，也不创建 PG17 full-copy 表。

后续策略：

1. 站点按 `task_id` / `create_date` / `id watermark` 导出增量分片。
2. 总控接收后写入 ES / ClickHouse / 专用 file index。
3. PG17 只保存任务级统计、索引状态、水位和错误信息。
4. 任务详情第一版不依赖文件表。
5. 如果短期必须展示文件列表，只允许按 `task_id` 分页读取或建立 `unified_file_index` 任务级索引，不做全站点全量。

建议大表包格式预留：

```json
{
  "tableName": "tbl_file",
  "syncMode": "incremental",
  "watermark": {
    "type": "id",
    "from": 1000000,
    "to": 1005000
  },
  "partition": {
    "taskId": 37,
    "page": 1,
    "pageSize": 5000
  },
  "recordCount": 5000,
  "records": []
}
```

---

## 六、总控接收接口设计

### 6.1 接口

```http
POST /api/sync/package
Header:
  x-api-key: <site-api-key>
Content-Type: application/json
```

### 6.2 职责

1. 校验 API Key。
2. 校验 `siteCode` 与 API Key 绑定站点一致。
3. 校验 `batchId` 幂等。
4. 校验 `version`、`mode`、`tables` 白名单。
5. 校验整包 `checksum`、单表 `checksum`。
6. 校验 `recordCount === records.length`。
7. 按 table dispatch registry 分发表处理。
8. 复用现有 mapper/upsert，不复制两套 mapper。
9. 写入 package 级和 table 级日志。
10. 返回每张表成功/失败统计。

### 6.3 成功响应示例

```json
{
  "status": "success",
  "siteCode": "SH01",
  "batchId": "SH01-20260605-1000",
  "duplicated": false,
  "summary": {
    "tablesReceived": 10,
    "tablesSucceeded": 10,
    "tablesFailed": 0,
    "rowsReceived": 768,
    "rowsUpserted": 768
  },
  "tables": [
    {
      "tableName": "tbl_task",
      "syncMode": "full",
      "status": "success",
      "rowsReceived": 37,
      "rowsUpserted": 37,
      "errorMessage": null
    }
  ],
  "traceId": "pkg-20260605-1000"
}
```

### 6.4 失败响应示例

```json
{
  "status": "error",
  "siteCode": "SH01",
  "batchId": "SH01-20260605-1000",
  "code": "TABLE_VALIDATION_FAILED",
  "message": "tbl_task recordCount does not match records.length",
  "tables": [
    {
      "tableName": "tbl_task",
      "status": "failed",
      "rowsReceived": 0,
      "rowsUpserted": 0,
      "errorMessage": "recordCount=37, records.length=36"
    }
  ],
  "traceId": "pkg-20260605-1000"
}
```

### 6.5 幂等规则

| 场景 | 返回 |
|------|------|
| 同 `siteCode + batchId` 首次推送 | 正常处理 |
| 重复推送且 checksum 一致 | `success + duplicated=true` |
| 重复推送但 checksum 不一致 | `409 BATCH_CONFLICT` |
| 单表重复且 checksum 一致 | 该表 `skipped`，整包可继续 |

---

## 七、日志设计

### 7.1 当前已有

| 表 | 状态 | 用途 |
|----|------|------|
| sync_job_log | 已有 | 本地 sync-engine 单表同步日志 |
| ingest_batch_log | 已有 | 单表 ingest 批次日志，当前适配 `/api/ingest/tasks`、`/api/ingest/devices` |

判断：已有 `ingest_batch_log` 是“单表批次日志”，不足以表达一个包内多张表的整体状态；不建议删除，保留兼容旧 JSON ingest。

### 7.2 最小新增日志

新增两张表即可：

```sql
CREATE TABLE sync_package_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_code VARCHAR(50) NOT NULL,
  batch_id VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  mode VARCHAR(20) NOT NULL,
  snapshot_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  table_count INT DEFAULT 0,
  rows_received INT DEFAULT 0,
  rows_upserted INT DEFAULT 0,
  checksum VARCHAR(100),
  error_message TEXT,
  duplicated BOOLEAN DEFAULT FALSE,
  raw_meta JSONB DEFAULT '{}',
  UNIQUE(site_code, batch_id)
);

CREATE TABLE sync_table_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_log_id UUID NOT NULL REFERENCES sync_package_log(id),
  site_code VARCHAR(50) NOT NULL,
  batch_id VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  sync_mode VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  row_count INT DEFAULT 0,
  rows_upserted INT DEFAULT 0,
  checksum VARCHAR(100),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  UNIQUE(site_code, batch_id, table_name)
);
```

### 7.3 状态枚举

```text
pending -> running -> success
pending -> running -> failed
pending -> skipped
```

状态含义：

| status | 含义 |
|--------|------|
| pending | 已收到，未处理 |
| running | 正在校验或入库 |
| success | 成功 |
| failed | 失败 |
| skipped | 幂等重复或该表暂不支持 |

---

## 八、与当前代码衔接

### 8.1 现有能力

| 命令 / 模块 | 当前职责 | 复用方式 |
|-------------|----------|----------|
| import:tasks | 从 source_restore 读 `tbl_task`，聚合 `tbl_lib_task` / `tbl_user_task` | 抽出 `mapRealTask` 和 task upsert 供 package 使用 |
| import:devices | 从 source_restore 读 `tbl_disc_lib`，聚合 `tbl_magzines` / `tbl_slots` | 抽出 device mapper/upsert；聚合表在 package 模式按 records 计算 |
| import:discs | 从 source_restore 读 `tbl_disc` 写 `unified_disc_media` | 抽出 `tbl_disc` records handler |
| import:volumes | 从 source_restore 读 `tbl_logical_volume` + `tbl_volume_slot` 写 `unified_volumes` | 抽出 volume records handler |
| import:hard-disks | 从 source_restore 读 `tbl_hd_info` 写 `unified_hard_disks` | 抽出 hard disk records handler |
| /api/ingest/tasks | 单表 JSON ingest | 保留兼容，未来可内部调用 package handler |
| /api/ingest/devices | 单表 JSON ingest | 保留兼容，未来可内部调用 package handler |

### 8.2 是否抽象 table dispatch registry

应该抽象，但在下一 Sprint 只做 1-2 张表验证。

建议 registry：

```ts
type PackageTableHandler = {
  tableName: string
  syncMode: "full" | "incremental" | "file_index"
  dependencies: string[]
  maxRecords: number
  handle: (input: {
    siteCode: string
    snapshotAt: string
    records: Record<string, unknown>[]
    allTables: Map<string, Record<string, unknown>[]>
  }) => Promise<{ rowsUpserted: number }>
}
```

第一批只注册：

```text
tbl_task
tbl_disc_lib
```

第二批再扩展：

```text
tbl_magzines
tbl_slots
tbl_lib_task
tbl_user_task
tbl_disc
tbl_logical_volume
tbl_volume_slot
tbl_hd_info
```

### 8.3 mapper/upsert 复用原则

- CLI import 和 package import 必须共用 mapper/upsert。
- 不复制两套字段映射。
- `source_restore` reader 和 package records parser 可以分开。
- mapper 输入保持 `Record<string, unknown>`，输出统一中心记录。
- 对直接 SQL importer（disc/volumes/hard-disks）后续应拆成 `map + upsert` 两段。

---

## 九、后续实现 Sprint 建议

推荐顺序：

1. **B. 实现 `sync_package_log` / `sync_table_log`**  
   先建日志基础，保证后续接收接口可审计、可回放、可排错。

2. **A. 实现 `POST /api/sync/package` 接收接口骨架**  
   只做鉴权、JSON 解析、batchId 幂等、checksum、recordCount、日志写入。

3. **C. 先只支持 1-2 张表做 package 流程验证**  
   先接 `tbl_task` 和 `tbl_disc_lib`，复用现有 mapper/upsert，跑通 package -> table dispatch -> UPSERT -> 日志。

4. **D. 站点筛选器**  
   等 package 流程闭环后再做，避免 UI 先行掩盖同步链路问题。

---

## 十、最小可执行计划

### Sprint 2C.17

- 新增 `databases/sprint-2c17/sync-package-log.sql`。
- 新增 package/table log helper。
- 不改现有 import scripts。
- 验证：重复执行 schema patch 幂等；`pnpm exec tsc --noEmit`；`pnpm build`。

### Sprint 2C.18

- 新增 `POST /api/sync/package` 骨架。
- 实现 package checksum、recordCount、batchId 幂等。
- 支持 `tbl_task`。
- 保留 `/api/ingest/tasks`。

### Sprint 2C.19

- package registry 扩展 `tbl_disc_lib`。
- 验证 `tbl_task + tbl_disc_lib` 同包成功和单表失败日志。
- 再决定是否扩展剩余小表。

