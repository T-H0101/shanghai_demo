# Sprint 2C.9 Schema Patch: unified_disc_media

新增 `unified_disc_media` 表，存储从站点 tbl_disc 同步的光盘/介质数据。

## 执行方式

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < unified-disc-media.sql
```

## 幂等性

使用 `IF NOT EXISTS`，可重复执行。

## 依赖顺序

1. 先执行本 SQL
2. 确保 source_restore 中已有 tbl_disc 表
3. 运行 `pnpm import:discs -- <siteCode>`
