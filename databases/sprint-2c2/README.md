# Sprint 2C.2 Schema Patch: used_slots

Sprint 2C.2 设备容量/盘位聚合所需 schema patch。

## 变更说明

新增 `unified_devices.used_slots` 列，存储设备已使用盘位数。

**数据来源**：`source_restore.tbl_slots` 聚合，`COUNT(*) WHERE max_cap > rest_cap`，通过 `tbl_magzines.lib_id` 关联到设备。

## 执行方式

```bash
# 在 unified_disc_platform 数据库中执行
psql -U unified -d unified_disc_platform -f add-used-slots.sql
```

或通过 Docker：

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < add-used-slots.sql
```

## 幂等性

该 SQL 使用 `IF NOT EXISTS`，可重复执行，不会报错。

## 依赖顺序

1. 先执行本 SQL
2. 确保 `source_restore` 中已有 `tbl_slots` 和 `tbl_magzines` 表
3. 运行 `pnpm import:devices -- <siteCode>` 写入聚合数据
