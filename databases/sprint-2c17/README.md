# Sprint 2C.17 - 站点数据包同步日志表

本目录只包含总控自身的同步运行日志 schema，不同步站点源系统业务日志大表。

## 文件

| 文件 | 说明 |
|------|------|
| `sync-package-log.sql` | 新增 `sync_package_log` 和 `sync_table_log` |

## 执行

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-2c17/sync-package-log.sql
```

## 验证

```bash
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "\\d sync_package_log" -c "\\d sync_table_log"
pnpm test:package-log
pnpm exec tsc --noEmit
pnpm build
```

## 边界

- 不接入 `tbl_file` / `tbl_folder`。
- 不同步站点业务日志大表。
- 不替代已有 `sync_job_log` 和 `ingest_batch_log`。
- 为后续 `POST /api/sync/package` 提供包级和表级审计基础。
