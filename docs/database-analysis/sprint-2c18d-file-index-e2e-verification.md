# Sprint 2C.18D - File Index 端到端验证报告

> **日期**: 2026-06-06
> **范围**: 独立测试源库端到端验证 file-index importer
> **前置**: Sprint 2C.18A-2C.20 已完成 (commit 843ea63 + 154be81)

---

## 一、为什么不用 source_restore

- source_restore **没有 tbl_file / tbl_folder 表**（仅有 9 张小表）
- `pg_restore_test.star_storage_db` 存在 4 条 tbl_file 样本（task_id=1）
- **schema 不匹配**：
  - 源库当前 mapper 假设 `parent_id` / `level` / `file_count` / `total_size`
  - 实际样本库是 `parent` / `s_level` / `sum_files` / `files` / `subs`
  - 实际样本库字段是 `create_date` 而非 `created_at`
- **不允许污染 source_restore**（CLAUDE.md 明确：进入真实源库 Sprint 前必须先做方案确认）
- **不允许全量导入生产级大表**（CLAUDE.md 明确：不处理 tbl_file/tbl_folder 大表）

**结论**: 使用 Docker PG 容器内**独立测试库** `source_restore_file_test`，不污染 source_restore / unified_disc_platform / pg_restore_test。

---

## 二、source_restore_file_test 创建

### 创建步骤

```bash
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "CREATE DATABASE source_restore_file_test"
```

### Schema 来源

`pg_dump -t tbl_file -t tbl_folder --schema-only` from `pg_restore_test.star_storage_db`

### Schema 兼容性

| reader SQL | 实际 schema | 状态 |
|---|---|---|
| `task_id` (bigint) | `task_id` (bigint) | ✅ 兼容 |
| `created_at` | `create_date` | ⚠️ 已修复（AS created_at） |
| `parent_id` (folder) | `parent` (bigint) | ⚠️ 已修复（AS parent_id） |
| `level` (folder) | `s_level` (integer) | ⚠️ 已修复（AS level） |
| `file_count` (folder) | `files` (integer) | ⚠️ 已修复（AS file_count） |
| `total_size` (folder) | `sum_files` (bigint) | ⚠️ 已修复（AS total_size） |

**最小修复**: 在 reader SQL 中用 `AS alias` 兼容真实 schema，无需修改下游 mapper/upsert 代码。

---

## 三、样本数据来源

| 源 | 数量 | 条件 |
|---|---|---|
| `tbl_file` | 4 行 | `task_id = 1` |
| `tbl_folder` | 0 行（原样本库） | — |
| `tbl_folder` (手动插入) | 1 行 | `id=2` (对应 file.folder_id) |

**说明**: 样本库 tbl_folder 为空。手动插入 1 条最小 folder 记录用于关联验证。如不插入，folder reader 会读 0 行，**folder missing 是预期路径**（不是失败）。

---

## 四、E2E 结果

### 4.1 第一次成功执行

```bash
SOURCE_DATABASE_URL="postgresql://<source_user>:<source_password>@localhost:5432/source_restore_file_test" \
  pnpm import:file-index -- TEST_CLEAN 1 --from-id 0 --limit 1000 --batch-id FILEIDX-TEST_CLEAN-1-E2E
```

| 阶段 | 结果 |
|---|---|
| CLI guard | ✅ 接受合法参数 |
| reader 读 file | 4 records |
| reader 读 folder | 1 record (folder_id=2) |
| mapper | 4 files + 1 folder |
| upsert | 4 + 1 写入 |
| package-log | status=success, total_record_count=5, success_table_count=2 |
| table-log tbl_file | status=success, processed=4, inserted=4 |
| table-log tbl_folder | status=success, processed=1, inserted=1 |
| 返回 | `{ status: 'success', fileCount: 4, folderCount: 1 }` |

### 4.2 幂等性 - 同 batchId 重跑

```bash
... --batch-id FILEIDX-TEST_CLEAN-1-E2E  # 第二次
```

| 阶段 | 结果 |
|---|---|
| 幂等检测 | `findPackageByBatch` 找到 |
| status | `duplicated` |
| message | `Batch already completed` |
| 写操作 | **零写**（跳过） |

✅ 同 batchId 二次执行不重复写。

### 4.3 新 batchId 重跑

```bash
... --batch-id FILEIDX-TEST_CLEAN-1-E2E-RERUN
```

| 阶段 | 结果 |
|---|---|
| 幂等检测 | 新 batchId 不在 package_log |
| reader | 4 + 1 |
| upsert | ON CONFLICT UPDATE |
| unified_file_index | 4 rows（替换 batch_id 为 RERUN） |
| unified_folder_index | 1 row（替换 batch_id 为 RERUN） |

✅ count 不增加，行被更新。

---

## 五、API 验证

### 5.1 数据库路径

```bash
curl /api/tasks/1/files?page=1&pageSize=20
```

```json
{
  "code": 0,
  "message": "ok",
  "source": "database",
  "indexStatus": "ready",
  "data": {
    "items": [
      {
        "id": "e23083c6-...",
        "source_id": "1",
        "file_name": "'file-2025-01-01'",
        "file_size": "123",
        "content_type": null,
        "hash": null,
        "folder_source_id": "2",
        "indexed_at": "2026-06-05 19:13:26.931+00",
        "batch_id": "FILEIDX-TEST_CLEAN-1-E2E-RERUN"
      }
      // ... 共 4 items
    ],
    "page": 1,
    "pageSize": 20,
    "total": 4
  }
}
```

✅ **不直连 source_restore**，仅查 unified_file_index。
✅ source=`database`, indexStatus=`ready` 正确。
✅ file_name / file_size / folder_source_id / batch_id 全部映射。

### 5.2 关键词搜索

```bash
curl /api/tasks/1/files?keyword=file
```
→ `total: 1, items: 1`（仅 file_name 包含 "file" 的）

### 5.3 分页

```bash
curl /api/tasks/1/files?page=2&pageSize=2
```
→ `page: 2, items: 2, total: 4`（4 条数据第 2 页）

### 5.4 不存在任务

```bash
curl /api/tasks/999/files
```
→ `source: 'empty-index', indexStatus: 'missing'`

### 5.5 回归 API

| Endpoint | 状态 |
|---|---|
| `GET /api/tasks` | 200 |
| `GET /api/racks` | 200 |
| `GET /api/volumes` | 200 |
| `GET /api/sites` | 200 |

---

## 六、tsc / build

| 检查 | 结果 |
|---|---|
| `pnpm exec tsc --noEmit` | exit 0 |
| `pnpm build` | ✅ 成功（19 路由） |

---

## 七、小表 import 回归

| 命令 | 行数 |
|---|---|
| `import:tasks SH01` | 37 |
| `import:devices SH01` | 4 |
| `import:discs SH01` | 65 |
| `import:volumes SH01` | 3 |
| `import:hard-disks SH01` | 8 |
| **合计** | **117** |

✅ 5 个 importer 全部正常。

---

## 八、是否发现 schema mismatch

✅ **是**。已做最小修复：

### file-index-reader.ts
- `f.created_at` → `f.create_date AS created_at`（实际字段是 create_date）

### folder-index-reader.ts
- 完整 alias 映射：parent / s_level / sum_files / files → 兼容 mapper 接口

**影响范围**: 仅 reader SQL，mapper / upsert / importer / API / 前端**无变更**。

---

## 九、生产策略（**不是**全量）

1. ✅ **禁止全量导入** tbl_file / tbl_folder
2. ✅ **taskId + watermark + limit** 强制护栏
3. ✅ **limit <= 5000** reader 内部硬性 throw
4. ✅ **CLI 显式触发**，不在 import:all 自动执行
5. ✅ **不修改** /api/tasks 主列表
6. ✅ **不修改** Racks/Volumes
7. ✅ **不**接 ES / ClickHouse
8. ✅ **不污染** source_restore

---

## 十、Commit 信息

```
fix: verify file index e2e with isolated source database

Sprint 2C.18D 端到端验证:

- file-index-reader: 兼容真实 schema (create_date)
- folder-index-reader: 兼容真实 schema (parent/s_level/sum_files)
- 使用独立测试库 source_restore_file_test, 不污染 source_restore

端到端验证结果:
- unified_file_index 4 rows 写入
- unified_folder_index 1 row 写入
- sync_package_log: status=success, 5 records
- sync_table_log: tbl_file success 4, tbl_folder success 1
- 同 batchId 重复: status=duplicated, 零写
- 新 batchId 重跑: count 不增加, ON CONFLICT UPDATE
- /api/tasks/1/files: source=database, indexStatus=ready, total=4
- 不直连 source_restore
- tsc/build 全部通过
- 小表 import 全部回归正常
```
