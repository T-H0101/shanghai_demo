# Sprint 2C.18A - File Index Schema Skeleton

本目录只提供任务级 file/folder index schema patch，不执行任何 `tbl_file` / `tbl_folder` 数据导入。

## 文件

| 文件 | 说明 |
|------|------|
| `file-index-schema.sql` | 创建 `unified_file_index`、`unified_folder_index` |

## 执行

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-2c18/file-index-schema.sql
```

## 验证

```bash
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "\\d unified_file_index" -c "\\d unified_folder_index"
pnpm import:file-index
pnpm import:file-index -- TEST_CLEAN
pnpm import:file-index -- TEST_CLEAN 1 --limit 6000
pnpm import:file-index -- TEST_CLEAN 1 --from-id 0 --limit 1000
```

## 边界

- 这是任务级索引表，不是全量文件表。
- 不读取 `tbl_file`。
- 不读取 `tbl_folder`。
- 不写 `unified_file_index`。
- 不写 `unified_folder_index`。
- `raw_metadata` 只能存索引上下文，不存完整 records。
