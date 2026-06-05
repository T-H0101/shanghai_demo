# Sprint 2C.13 — 文件/目录大表与任务详情接入计划

> **日期**: 2026-06-05
> **范围**: 只生成下一批接入计划，不改业务代码
> **基线**: 已接入 10 张源表：tbl_disc_lib、tbl_magzines、tbl_slots、tbl_hd_info、tbl_task、tbl_lib_task、tbl_disc、tbl_logical_volume、tbl_volume_slot、tbl_user_task
> **状态**: 已被 Sprint 2C.15 校准；禁止直接执行本文中的 tbl_file/tbl_folder 全量导入和 full-copy unified_files/unified_folders 方案。

**重要修正**：`tbl_file`、`tbl_folder` 属于文件级/目录级大表，不能按小表模式全量 UPSERT 到中心 PG17。后续以 `docs/database-analysis/sprint-2c15-file-folder-big-table-strategy-review.md` 为准。

---

## 一、接入优先级

| 优先级 | 最小单元 | 源表 | 目标 | 原因 |
|--------|----------|------|------|------|
| P0 | 目录索引 | tbl_folder | 新增 unified_folders | 任务详情和文件列表先需要目录树、路径、目录统计 |
| P0 | 文件索引 | tbl_file | 新增 unified_files | 任务详情需要按 task_id 查文件列表，不做全量业务复制 |
| P1 | 任务详情聚合 | tbl_lib_task + tbl_disc + tbl_user_task | 更新 /api/tasks/[id] DTO | 源表已导入，补齐任务设备、介质、操作员详情 |
| P2 | 文件列表 API | tbl_folder + tbl_file | 新增任务详情子资源 API | 支撑 Tasks 页面文件列表，不新增业务页面 |
| 暂缓 | 用户/部门/审计 | tbl_user、tbl_depa、tbl_audit | 后续 unified_users / unified_audit_logs | 不影响当前任务详情主链路 |

结论：下一批按 `tbl_folder` → `tbl_file` → 任务详情聚合 API 的顺序做；每次只接一个源表或一个最小聚合单元。

---

## 二、表级导入方式

### 2.1 tbl_folder

| 项 | 方案 |
|----|------|
| 数据量属性 | 大表，P0 只建可分页查询的目录索引 |
| 进入方式 | 独立中心表 `unified_folders` |
| 是否 schema patch | 是，新增 `databases/sprint-2c13/unified-folders.sql` |
| 主键/幂等键 | `UNIQUE(source_site_id, source_table, source_id)`，source_id = tbl_folder.id |
| 关联字段 | `id`、`parent`、`folder_path`、`disc_path` |
| DTO 映射 | `FolderDTO.id/sourceId/name/path/discPath/parentId/level/fileCount/subFolderCount/totalSize/sourceSiteId` |
| raw_data | 保留 tbl_folder 原始 9 字段 |
| COALESCE | UPDATE 时对 `name/path/parent_id/level/file_count/sub_folder_count/total_size` 使用 `COALESCE(EXCLUDED.col, unified_folders.col)` |

建议中心表字段：

```sql
CREATE TABLE IF NOT EXISTS unified_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_folder',
  source_id VARCHAR(100) NOT NULL,
  name VARCHAR(1000) NOT NULL,
  folder_path TEXT,
  disc_path TEXT,
  parent_source_id VARCHAR(100),
  level INTEGER,
  file_count INTEGER,
  sub_folder_count INTEGER,
  total_size BIGINT,
  raw_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_site_id, source_table, source_id)
);
```

### 2.2 tbl_file

| 项 | 方案 |
|----|------|
| 数据量属性 | 大表，P0 只建任务详情可用的文件索引；不把文件内容或全文检索塞进中心表 |
| 进入方式 | 独立中心表 `unified_files` |
| 是否 schema patch | 是，新增 `databases/sprint-2c13/unified-files.sql` |
| 主键/幂等键 | `UNIQUE(source_site_id, source_table, source_id)`，source_id = tbl_file.id |
| 关联字段 | `task_id` → unified_tasks.source_id；`folder_id` → unified_folders.source_id；`slot_id` → unified_disc_media.slot_id / tbl_slots |
| DTO 映射 | `FileDTO.id/sourceId/taskId/folderId/fileName/fileSize/contentType/status/slotId/createDate/hash/sourceSiteId` |
| raw_data | 保留 tbl_file 原始 19 字段 |
| COALESCE | UPDATE 时保护 `file_name/file_size/content_type/status/folder_source_id/task_source_id/slot_id/create_date` 旧值 |

建议中心表字段：

```sql
CREATE TABLE IF NOT EXISTS unified_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_file',
  source_id VARCHAR(100) NOT NULL,
  uuid VARCHAR(64),
  folder_source_id VARCHAR(100) NOT NULL,
  task_source_id VARCHAR(100),
  file_name VARCHAR(765),
  file_remark VARCHAR(765),
  file_disc_name VARCHAR(500),
  file_size BIGINT,
  hash VARCHAR(65),
  slot_id INTEGER,
  content_type VARCHAR(65),
  status INTEGER,
  burn_times INTEGER,
  create_date TIMESTAMPTZ,
  raw_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_site_id, source_table, source_id)
);
```

### 2.3 任务详情聚合单元

| 项 | 方案 |
|----|------|
| 源表 | tbl_lib_task、tbl_disc、tbl_user_task（均已接入/聚合） |
| 进入方式 | 不新增源表 import；只扩展查询聚合 |
| 是否 schema patch | 否，复用 unified_tasks、unified_disc_media、unified_devices |
| API | 更新 `/api/tasks/[id]` 为 database + mock fallback |
| DTO | TaskDetailDTO = TaskDTO + `devices[]` + `discMedia[]` + `filesSummary` + `source` |
| 关联 | unified_tasks.source_id = task_id；unified_disc_media.source_task_id = task_id；unified_devices.device_id = unified_tasks.device_id |
| fallback | 数据库失败或无记录时返回 mock，并带 `source: "mock-fallback"` |

### 2.4 文件列表最小 API

| 项 | 方案 |
|----|------|
| API | `GET /api/tasks/[id]/files?page&pageSize&folderId&keyword` |
| 目标 | 支撑任务详情文件列表，不新增前端页面 |
| 查询 | unified_files 按 `source_site_id + task_source_id` 分页 |
| 目录过滤 | folderId 对应 `folder_source_id`；后续再做递归目录 |
| DTO | `PaginatedResponse<FileDTO>` |
| fallback | mock 空列表，返回 `source: "mock-fallback"` |

---

## 三、验证标准

### 3.1 tbl_folder import

| 验证项 | SQL / 标准 |
|--------|------------|
| 记录数 | `SELECT count(*) FROM source_restore.tbl_folder;` 等于 `SELECT count(*) FROM unified_folders WHERE source_site_id = $site;` |
| 字段完整性 | `name` 非空；`source_id` 非空；`parent_source_id` 可空；`folder_path`/`disc_path` 保留原值 |
| 幂等性 | 连续执行 2 次 import，目标 count 不增加；`UNIQUE(source_site_id, source_table, source_id)` 无冲突报错 |
| COALESCE | 人工把一条 `folder_path` 改成非空旧值，再用源表空值覆盖时旧值不丢 |
| API 可用性 | 目录统计 API 或任务文件 API 可读取 folder 映射；失败时 fallback 带 source |

### 3.2 tbl_file import

| 验证项 | SQL / 标准 |
|--------|------------|
| 记录数 | `SELECT count(*) FROM source_restore.tbl_file;` 等于 `SELECT count(*) FROM unified_files WHERE source_site_id = $site;`；若首批限任务范围导入，则两边都加同一 `WHERE task_id IS NOT NULL` |
| 字段完整性 | `source_id`、`folder_source_id` 非空；`file_name`、`file_size`、`task_source_id`、`slot_id` 按源表保留 |
| 幂等性 | 连续执行 2 次 import，目标 count 不增加；同一 source_id 只保留 1 条 |
| COALESCE | 源表空值不会覆盖中心表已有 `file_name/file_size/content_type/task_source_id` |
| API 可用性 | `/api/tasks/[id]/files` 能分页返回真实文件；无数据库时 mock fallback 可用 |

### 3.3 任务详情聚合 API

| 验证项 | 标准 |
|--------|------|
| 主记录 | `/api/tasks/[id]` 能从 unified_tasks 返回真实任务 |
| 设备关联 | `deviceId/deviceName` 来自 unified_tasks + unified_devices |
| 介质关联 | `discMedia[]` 来自 unified_disc_media，按 disc_num 排序 |
| 文件摘要 | `filesSummary.fileCount/totalSize` 来自 unified_files 聚合 |
| fallback | DB 异常或无记录时返回 mock 详情，并显式 `source: "mock-fallback"` |

---

## 四、固定统计模板

```text
Sprint 2C.X 完成统计
====================
本次新增接入源表：X 张（示例：tbl_folder）
本次更新接入源表：X 张（示例：tbl_task 任务详情聚合）
本次同步/导入源表数量：X 张
当前累计接入源表数量：10 + X 张
当前累计设备域源表：4 张（tbl_disc_lib, tbl_magzines, tbl_slots, tbl_hd_info）
当前累计任务域源表：6 + X 张（tbl_task, tbl_lib_task, tbl_disc, tbl_logical_volume, tbl_volume_slot, tbl_user_task + 新增）
当前进入中心独立表的源表：X 张
当前仅聚合进入中心表的源表：X 张
当前暂不处理大表：无全量复制；tbl_file/tbl_folder 仅做索引化接入
本次新增中心表/schema patch：X 个
本次影响 API：X 个（示例：/api/tasks/[id], /api/tasks/[id]/files）
本次影响前端：X 个（示例：Tasks 页面文件列表读取 API；不新增页面）
```

---

## 五、操作顺序与 CLI 示例

### 5.1 tbl_folder

```bash
mkdir -p databases/sprint-2c13

# 1. 生成并执行 schema patch
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-2c13/unified-folders.sql

# 2. 验证 source_restore
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT count(*) FROM source_restore.tbl_folder;"
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT id, name, parent, folder_path FROM source_restore.tbl_folder ORDER BY id LIMIT 5;"

# 3. 运行 import
pnpm import:folders -- SITE_A

# 4. 验证中心表
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT count(*) FROM unified_folders WHERE source_site_id = 'SITE_A';"
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT source_id, name, parent_source_id, file_count, total_size FROM unified_folders WHERE source_site_id = 'SITE_A' ORDER BY source_id::bigint LIMIT 5;"

# 5. 幂等验证
pnpm import:folders -- SITE_A
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT source_site_id, source_id, count(*) FROM unified_folders GROUP BY source_site_id, source_id HAVING count(*) > 1;"
```

### 5.2 tbl_file

```bash
# 1. 执行 schema patch
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-2c13/unified-files.sql

# 2. 验证 source_restore
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT count(*) FROM source_restore.tbl_file;"
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT id, folder_id, task_id, file_name, file_size, slot_id FROM source_restore.tbl_file ORDER BY id LIMIT 5;"

# 3. 运行 import
pnpm import:files -- SITE_A

# 4. 验证中心表
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT count(*) FROM unified_files WHERE source_site_id = 'SITE_A';"
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT source_id, task_source_id, folder_source_id, file_name, file_size FROM unified_files WHERE source_site_id = 'SITE_A' ORDER BY source_id::bigint LIMIT 5;"

# 5. 幂等验证
pnpm import:files -- SITE_A
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT source_site_id, source_id, count(*) FROM unified_files GROUP BY source_site_id, source_id HAVING count(*) > 1;"
```

### 5.3 API 与前端验证

```bash
# 类型/构建
pnpm lint
pnpm build

# API 验证
curl "http://localhost:3000/api/tasks?page=1&pageSize=5"
curl "http://localhost:3000/api/tasks/SITE_A-1"
curl "http://localhost:3000/api/tasks/SITE_A-1/files?page=1&pageSize=20"
curl "http://localhost:3000/api/tasks/SITE_A-1/files?page=1&pageSize=20&keyword=.pdf"
```

---

## 六、阶段汇报文档草稿

### 6.1 本阶段完成目标

- 完成下一批真实数据接入设计，范围聚焦任务详情文件链路。
- 明确 `tbl_folder` 与 `tbl_file` 不做站点库全量复制，只做中心索引化接入。
- 明确任务详情聚合从已接入的 `tbl_lib_task`、`tbl_disc`、`tbl_user_task` 读取，不新增业务页面。

### 6.2 验证结果

- 已核对 schema inventory：`tbl_folder` 为 9 字段大表，`tbl_file` 为 19 字段大表。
- 已确认 `tbl_file.task_id` 可关联任务，`folder_id` 可关联目录，`slot_id` 可关联盘位/介质。
- 已确认当前 API 基线：`/api/tasks` 已读取 `unified_tasks`，`/api/tasks/[id]` 仍需改成数据库优先 + mock fallback。

### 6.3 遗留问题

- `tbl_file/tbl_folder` 实际记录数需在 `source_restore` 中再次确认。
- 大表是否允许一次性全量导入，需要领导确认；默认建议分批导入并保留分页游标。
- 文件全文检索、复杂目录递归、跨站点文件去重不纳入本阶段。

### 6.4 下一步建议

1. 先执行 `tbl_folder` schema patch + import + README 记录。
2. 再执行 `tbl_file` schema patch + import + README 记录。
3. 扩展 `/api/tasks/[id]`，补齐设备、介质、文件摘要。
4. 新增 `/api/tasks/[id]/files`，支撑 Tasks 页面文件列表。
5. 最后跑 `pnpm lint`、`pnpm build` 和 API curl 验证。

### 6.5 需要领导确认的事项

- 是否允许 `tbl_file/tbl_folder` 首批按全量索引导入；如数据量过大，是否先按 `task_id IS NOT NULL` 限范围。
- 文件列表是否只要求任务详情内展示，还是需要统一检索页面也接真实文件索引。
- 文件 hash、meta_data 是否允许进入中心库 raw_data；如有敏感字段，需要脱敏规则。
- 是否需要为文件索引预留 Elasticsearch / ClickHouse 外部检索通道。
