# Sprint 2C.18 — 大表任务级索引 Skeleton 设计与执行计划

> **日期**: 2026-06-06
> **范围**: 只做文件结构、模块设计和下一阶段计划；不实现导入逻辑，不读取或写入 `tbl_file` / `tbl_folder` 原始数据。
> **核心原则**: `tbl_file` / `tbl_folder` 只做任务级索引，不做 PG17 全量复制。

---

## 一、当前完成上下文

### 1.1 数据库边界

| 角色 | 数据库 | 连接模块 | 用途 |
|------|--------|----------|------|
| 总控中心库 | `unified_disc_platform` | `lib/db/postgres.ts`，通过 `query()` / `transaction()` | 写入 `unified_*`、同步日志、API 查询 |
| 站点模拟库 | `source_restore` | `lib/db/source-pool.ts`，通过 `sourceQuery()` | 读取站点源表 |

风险点：
- `DATABASE_URL` 和 `SOURCE_DATABASE_URL` 必须保持分离。
- file/folder index importer 只能通过 `sourceQuery()` 读取源表，通过 `query()` 写中心索引表。
- 后续实现前应增加连接 guard：中心库必须存在 `unified_tasks`，源库必须存在 `tbl_task` 或 `tbl_file`。

### 1.2 已接入小表

| 域 | 源表 |
|----|------|
| 设备域 | `tbl_disc_lib`、`tbl_magzines`、`tbl_slots`、`tbl_hd_info` |
| 任务域 | `tbl_task`、`tbl_lib_task`、`tbl_disc`、`tbl_logical_volume`、`tbl_volume_slot`、`tbl_user_task` |

中心表：
- `unified_tasks`
- `unified_devices`
- `unified_disc_media`
- `unified_volumes`
- `unified_hard_disks`

日志：
- `sync_job_log`
- `ingest_batch_log`
- `sync_package_log`
- `sync_table_log`

---

## 二、设计目标

1. 设计 `tbl_file` / `tbl_folder` 任务级索引 skeleton。
2. 只支持按 `task_id`、`id watermark`、分页窗口读取。
3. 中心库只写 `unified_file_index` / `unified_folder_index` 最小索引，不保存完整大表 `raw_data`。
4. 用 `batchId`、checksum、recordCount 校验保护幂等和可审计性。
5. 使用 `package-log` 服务记录 package/table 状态。
6. 不影响现有 `/api/racks`、`/api/tasks`、`/api/volumes` 和前端 mock fallback。

风险点：
- `tbl_file` 生产可能是千万到亿级，任何无 `task_id` 或 watermark 的全表扫描都禁止。
- `tbl_folder` 没有 `task_id`，只能从 `tbl_file.folder_id` 反推相关目录，不能全量导入目录树。

---

## 三、中心索引表草案

### 3.1 `unified_file_index`

用途：保存任务详情文件列表需要的最小元数据。

建议字段：

```sql
CREATE TABLE unified_file_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_file',
  source_id VARCHAR(100) NOT NULL,
  task_source_id VARCHAR(100) NOT NULL,
  folder_source_id VARCHAR(100),
  slot_id INTEGER,
  file_name TEXT,
  file_size BIGINT,
  content_type VARCHAR(100),
  status INTEGER,
  hash VARCHAR(128),
  source_created_at TIMESTAMPTZ,
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  batch_id VARCHAR(100),
  checksum VARCHAR(128),
  raw_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_site_id, source_table, source_id)
);
```

索引：
- `(source_site_id, task_source_id, source_id)`
- `(source_site_id, folder_source_id)`
- `(source_site_id, batch_id)`

注意事项：
- `raw_metadata` 只存索引上下文，如 `watermark`、`storage_class`、`burn_times`，不存完整 records。
- `file_name/hash/meta_data` 可能敏感，正式实现前需确认脱敏规则。

### 3.2 `unified_folder_index`

用途：只保存任务相关文件涉及的目录，不保存全量目录树。

建议字段：

```sql
CREATE TABLE unified_folder_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_folder',
  source_id VARCHAR(100) NOT NULL,
  parent_source_id VARCHAR(100),
  name TEXT,
  folder_path TEXT,
  disc_path TEXT,
  level INTEGER,
  file_count INTEGER,
  total_size BIGINT,
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  batch_id VARCHAR(100),
  checksum VARCHAR(128),
  raw_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_site_id, source_table, source_id)
);
```

索引：
- `(source_site_id, source_id)`
- `(source_site_id, parent_source_id)`
- `(source_site_id, batch_id)`

注意事项：
- 目录索引必须由任务相关 `folder_id` 集合驱动。
- 不允许 `SELECT * FROM tbl_folder` 全量导入。

---

## 四、文件结构草案

```text
databases/sprint-2c18/
  file-index-schema.sql
  README.md

lib/import/file-index/
  types.ts
  checksum.ts
  file-index-reader.ts
  folder-index-reader.ts
  file-index-mapper.ts
  folder-index-mapper.ts
  file-index-upsert.ts
  folder-index-upsert.ts
  file-index-importer.ts

scripts/
  import-file-index.ts

app/api/tasks/[id]/files/
  route.ts          # 后续 Sprint，不在 skeleton 第一阶段实现
```

模块职责：

| 模块 | 职责 | 数据库边界 |
|------|------|------------|
| `file-index-reader.ts` | 按 `taskId + watermark + limit` 从 `tbl_file` 分页读取 | 只用 `sourceQuery()` |
| `folder-index-reader.ts` | 根据文件 `folder_id` 集合读取相关 `tbl_folder` | 只用 `sourceQuery()` |
| `file-index-mapper.ts` | 将源文件记录映射为 `unified_file_index` 最小字段 | 纯函数 |
| `folder-index-mapper.ts` | 将源目录记录映射为 `unified_folder_index` 最小字段 | 纯函数 |
| `checksum.ts` | 对 records 做 canonical checksum | 纯函数 |
| `file-index-upsert.ts` | 参数化 UPSERT 到中心表 | 只用 `query()` / `transaction()` |
| `file-index-importer.ts` | 编排 reader/mapper/upsert/package-log | 同时使用 `sourceQuery()` + `query()` |
| `import-file-index.ts` | CLI skeleton，要求显式 `siteCode + taskId` | 不允许无 taskId |

风险点：
- `file-index-importer.ts` 不应复用现有 `import:all`，避免误把大表纳入小表全量链路。
- CLI 必须拒绝缺失 `taskId` 的调用。

---

## 五、Importer Skeleton 设计

### 5.1 CLI 参数

```bash
pnpm import:file-index -- SH01 37 --from-id 0 --limit 5000
```

参数：
- `siteCode`: 必填。
- `taskId`: 必填。
- `from-id`: 可选，默认 0。
- `limit`: 可选，默认 1000，最大 5000。
- `batchId`: 可选，默认 `FILEIDX-{siteCode}-{taskId}-{timestamp}`。

注意事项：
- 缺 `taskId` 直接退出。
- `limit` 超过最大值直接拒绝。
- 不加入 `import:all`。

### 5.2 读取策略

`tbl_file`：

```sql
SELECT id, uuid, folder_id, file_name, file_size, hash, task_id,
       create_date, status, slot_id, content_type, storage_class, burn_times
FROM tbl_file
WHERE task_id = $1
  AND id > $2
ORDER BY id
LIMIT $3;
```

`tbl_folder`：

```sql
SELECT id, name, folder_path, disc_path, s_level, parent, sum_files, files, subs
FROM tbl_folder
WHERE id = ANY($1);
```

风险点：
- 源库当前可能缺 `tbl_file.task_id` 索引，生产执行前必须要求站点侧加索引或使用分区导出包。
- 如果源库无 `tbl_file` / `tbl_folder`，skeleton 应返回 `skipped`，不能报成中心库错误。

### 5.3 幂等与校验

| 校验项 | 规则 |
|--------|------|
| batchId | `sync_package_log(site_code,batch_id)` 幂等 |
| recordCount | `records.length === expectedRecordCount` |
| checksum | 读取页 records canonical JSON SHA-256 |
| source key | `UNIQUE(source_site_id, source_table, source_id)` |
| update | UPSERT，`COALESCE` 保护已有非空字段 |

注意事项：
- checksum 只覆盖本页或本任务分片，不覆盖全表。
- package/table log 只保存 metadata，不保存 records。

### 5.4 日志流

1. `createPackageLog({ siteCode, batchId, mode: "incremental", rawMetadata })`
2. `createTableLog(... tbl_file ...)`
3. `markTableSuccess/Failed`
4. `createTableLog(... tbl_folder ...)`
5. `markTableSuccess/Failed`
6. `markPackageSuccess/Failed`

状态建议：
- 没有源表：`skipped`
- 没有该任务文件：`success`，`processedRecordCount=0`
- 部分表失败：package 标记 `failed`

风险点：
- 文件索引失败不应影响 `unified_tasks` 等核心表。
- 日志写失败应阻断导入；没有审计就不要静默写索引。

---

## 六、API / 前端衔接计划

### 6.1 API 顺序

1. 先实现中心查询 API：

```text
GET /api/tasks/[id]/files?page&pageSize&keyword
```

数据来源：
- `unified_file_index`
- 通过 `unified_tasks.source_site_id + unified_tasks.source_id` 定位 `task_source_id`

2. 再实现索引状态 API：

```text
GET /api/tasks/[id]/file-index-status
```

数据来源：
- `sync_package_log`
- `sync_table_log`

风险点：
- API 必须有 mock/fallback，不能让文件索引缺失导致任务详情不可用。
- 默认分页必须小，比如 50。

### 6.2 前端顺序

1. Tasks 详情页先展示已有真实字段：
   - `fileCount`
   - `totalSize`
   - `discCount`
   - `deviceName`
   - `operator`
2. 文件列表作为折叠区或 Tab 后置加载。
3. 无索引时展示“索引未生成/暂无文件明细”，不报错。

风险点：
- 文件列表不要阻塞任务详情首屏。
- 不要把 mock 文件明细误标成真实 source。

---

## 七、下一阶段 Sprint 执行计划

### Sprint 2C.18：大表索引 Schema + Skeleton

目标：
- 建 `unified_file_index` / `unified_folder_index` schema patch。
- 新增 reader/mapper/upsert/importer skeleton。
- 不跑真实大表导入。

验收：
- `pnpm exec tsc --noEmit`
- `pnpm build`
- schema patch 幂等
- CLI 缺 taskId 时拒绝执行
- `tbl_file/tbl_folder` 不存在时返回 skipped 并记录日志

风险：
- `.gitignore` 忽略 `databases/`，schema patch 需要 `git add -f`。

### Sprint 2C.19：任务级文件索引最小验证

目标：
- 只对单个 `taskId`、小 limit 执行索引。
- 验证 `batchId/checksum/recordCount/package-log`。

验收：
- `unified_file_index` 只包含指定 taskId。
- `unified_folder_index` 只包含文件涉及目录。
- 重复 batch 不重复插入。

风险：
- `source_restore` 当前未包含 `tbl_file/tbl_folder`，可能需要在 `pg_restore_test` 样本库做只读验证，或先只测试 skipped。

### Sprint 2C.20：文件列表 API

目标：
- 新增 `GET /api/tasks/[id]/files`。
- 只查中心索引表，不直连源库。

验收：
- API 分页正常。
- 无索引时返回空列表 + source/status 标记。
- `/api/tasks`、`/api/racks`、`/api/volumes` 不受影响。

风险：
- 不要让文件索引 API 变成源库在线查询代理。

### Sprint 2C.21：前端任务详情接入

目标：
- Tasks 详情页后置加载文件列表。
- 无索引时展示可理解的状态。

验收：
- 任务详情首屏不依赖文件列表。
- mock fallback 保留。
- 大文件任务分页不卡顿。

风险：
- 文件列表 UI 不应诱导用户以为已支持全站文件检索。

---

## 八、固定统计模板

```text
Sprint 2C.X 完成统计
=====================
本次新增接入源表：X 张
本次更新接入源表：X 张
本次新增同步/导入源表数量：X 张
本次回归执行 import 覆盖源表：X 张
当前累计接入源表数量：10 张
当前累计设备域源表：4 张（tbl_disc_lib, tbl_magzines, tbl_slots, tbl_hd_info）
当前累计任务域源表：6 张（tbl_task, tbl_lib_task, tbl_disc, tbl_logical_volume, tbl_volume_slot, tbl_user_task）
当前暂不处理大表全量：tbl_file, tbl_folder
本次新增大表索引范围：taskId=X, fromId=X, limit=X
本次新增中心表/schema patch：X
本次影响 API：X
本次影响前端：X
本次 package log：success=X, failed=X, skipped=X
是否触碰 tbl_file/tbl_folder 原始数据：否
是否执行全量导入：否
```

---

## 九、实现建议摘要

- 继续使用 `sourceQuery()` 读源库、`query()` / `transaction()` 写中心库。
- 不把 `file-index` importer 加进 `import:all`。
- 所有 file/folder index 操作都必须带 `siteCode + taskId + limit`。
- `package-log` 是强依赖，不是可选旁路。
- 中心索引表只存任务详情需要的字段，不存完整大表 `raw_data`。
- API 和前端后置接入，先确保任务/设备/卷/硬盘核心链路稳定。

