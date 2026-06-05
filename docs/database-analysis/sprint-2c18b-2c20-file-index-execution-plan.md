# Sprint 2C.18B-2C.20 — 任务级文件索引执行计划

> **日期**: 2026-06-06
> **前置上下文**: 2C.18A 已完成 `unified_file_index` / `unified_folder_index` schema patch 和 `import:file-index` CLI guard skeleton。
> **核心边界**: `tbl_file` / `tbl_folder` 只允许任务级索引，不允许 PG17 全量同步。

---

## 一、Sprint 切分计划

| Sprint | 目标 | 主要任务 | 操作文件 | 预期验证 |
|---|---|---|---|---|
| 2C.18B | 实现 file-index importer 基础链路，但只跑受控任务级分片 | 新增 reader/mapper/upsert/importer；强制 `siteCode + taskId + limit <= 5000`；`tbl_file` 只按 `task_id + id watermark` 读；`tbl_folder` 只按本批 `folder_id` 读；接入 package-log | `lib/import/file-index/types.ts`、`checksum.ts`、`file-index-reader.ts`、`folder-index-reader.ts`、`file-index-mapper.ts`、`folder-index-mapper.ts`、`file-index-upsert.ts`、`folder-index-upsert.ts`、`file-index-importer.ts`、`scripts/import-file-index.ts` | 缺参失败；`limit > 5000` 失败；源库无 `tbl_file/tbl_folder` 时记录 skipped；`pnpm exec tsc --noEmit`、`pnpm build` 通过 |
| 2C.18C | 单 task 小批量验证任务级索引幂等 | 用样本库或 `source_restore` 可用数据验证单 task 导入；验证 checksum、recordCount、batchId 幂等；重复 batch 不重复写；失败记录 table/package log | 同 2C.18B 文件；可加 `scripts/test-file-index-import.ts` 或 SQL 验证脚本 | `unified_file_index` 仅包含指定 `taskId`；`unified_folder_index` 仅包含关联目录；重复 batch 返回 duplicated/skipped；`sync_package_log/sync_table_log` 状态正确 |
| 2C.19 | 新增任务文件列表 API，只查中心索引表 | 实现 `GET /api/tasks/[id]/files`；按任务定位 `source_site_id + source_id`；分页查 `unified_file_index`；无索引返回空列表和 source 标记；不直连源库 | `app/api/tasks/[id]/files/route.ts`；可抽 `lib/api/file-index-query.ts`；必要时扩展 `lib/api/dto` | API 分页正常；无索引返回空结果不报错；`/api/tasks`、`/api/racks`、`/api/volumes` 回归 200；mock/fallback 不破坏 |
| 2C.20 | Tasks 前端后置接入文件列表 | 任务详情页增加文件索引区域；只在展开或 Tab 时请求文件 API；展示索引状态、分页文件列表、空状态；保留已有摘要字段 | `app/tasks/page.tsx`；必要时新增 `components/tasks/task-file-index-panel.tsx` | 首屏不被文件列表阻塞；无索引显示“文件索引未生成”；有索引时分页展示；响应式不破；`pnpm build` 通过 |

---

## 二、风险与防护

| Sprint | 主要风险 | 防护措施 |
|---|---|---|
| 2C.18B | 误全表扫描 `tbl_file` | reader SQL 必须包含 `WHERE task_id = $1 AND id > $2 LIMIT $3`；CLI 缺 taskId 直接退出 |
| 2C.18B | 中心库/源库混用 | reader 只 import `sourceQuery()`；upsert 只 import `query()` / `transaction()` |
| 2C.18B | 日志缺失但数据已写 | package-log 创建失败直接终止；table log 失败不继续 upsert |
| 2C.18B | PG17 被 raw_data 撑大 | `raw_metadata` 只存 `batchId/taskId/fromId/limit/storage_class/burn_times` 等最小元数据 |
| 2C.18C | 重复导入造成重复数据 | 三层幂等：`batchId`、`siteCode+batchId+tableName`、`source_site_id+source_table+source_id` |
| 2C.19 | API 变成源库在线查询代理 | API 只查 `unified_file_index/unified_folder_index`，不引入 `sourceQuery()` |
| 2C.20 | 文件列表拖慢任务详情首屏 | 文件列表后置加载，任务详情摘要继续使用现有 `unified_tasks/unified_disc_media/unified_devices` |

---

## 三、API / 前端接入建议

### 3.1 API

先做：

```text
GET /api/tasks/[id]/files?page&pageSize&keyword
```

返回建议：

```json
{
  "code": 0,
  "message": "ok",
  "source": "database",
  "indexStatus": "ready",
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 50,
    "total": 0
  }
}
```

无索引时：

```json
{
  "code": 0,
  "message": "ok",
  "source": "empty-index",
  "indexStatus": "missing",
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 50,
    "total": 0
  }
}
```

注意事项：
- API 不直连 `source_restore`。
- API 不触发导入。
- 默认 `pageSize` 建议 50，最大 200。

### 3.2 前端

Tasks 详情页继续优先展示已有真实字段：

- `file_count`
- `total_size`
- `disc_count`
- `deviceName`
- `operator`
- `status`

文件列表作为折叠区或 Tab 后置加载。

注意事项：
- 无索引时显示“文件索引未生成”，不要报错。
- 不要把 mock 文件列表标成真实数据。
- 文件列表失败不能影响任务详情首屏。

---

## 四、推进顺序

建议先做 2C.18B。

验收重点不是“导入多少文件”，而是：

1. 不会误扫大表。
2. 不会误写中心库。
3. 日志可追踪。
4. 失败可控。
5. 重复执行可幂等。

等 importer 护栏稳定，再做 2C.18C 的单 task 小批量验证。2C.19 和 2C.20 放在数据链路之后，避免前端先跑到索引链路前面。

