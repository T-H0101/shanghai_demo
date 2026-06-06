# Sync Architecture

> **总控中心 + 站点侧** 数据流

## 数据流

```
┌─────────────────────────────────────────────────────────┐
│                       站点侧 (source)                     │
│  tbl_task / tbl_disc_lib / tbl_magzines / tbl_slots /    │
│  tbl_hd_info / tbl_lib_task / tbl_disc /                 │
│  tbl_logical_volume / tbl_volume_slot / tbl_user_task   │
└─────────────────────────────────────────────────────────┘
                            │
                  站点定期导出 (每小时) → 推送 package
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    总控中心 (unified)                     │
│                                                           │
│  POST /api/sync/package                                   │
│         ↓                                                 │
│  validatePackagePayload()  (lib/sync/package-schema)      │
│         ↓                                                 │
│  findPackageByBatch() 幂等检查                            │
│         ↓                                                 │
│  createPackageLog + markPackageRunning                   │
│         ↓                                                 │
│  dispatchTable()  (lib/sync/package-dispatcher)         │
│         ↓                                                 │
│  ┌─────────────┬─────────────┬──────────────┐            │
│  │ mapRealTask │ mapRealDev  │ mapRealDisc  │  ...        │
│  │ upsertTasks │ upsertDevs  │ upsertDiscs  │            │
│  └─────────────┴─────────────┴──────────────┘            │
│         ↓                                                 │
│  createTableLog + markTableSuccess                       │
│         ↓                                                 │
│  markPackageSuccess / Failed                              │
│         ↓                                                 │
│  sync_package_log / sync_table_log                       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    中心库 (PG17)                          │
│  unified_tasks / unified_devices / unified_volumes /    │
│  unified_disc_media / unified_hard_disks                │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                       API 层                             │
│  /api/tasks  /api/racks  /api/volumes                    │
│  /api/tasks/[id]/files                                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      前端页面                             │
│  /tasks  /racks  /volumes  /logs                         │
└─────────────────────────────────────────────────────────┘
```

## 分层存储

| 数据类型 | 存储 | 理由 |
|---|---|---|
| 小表 / 关系 / 字典 | **PG17** | full snapshot + UPSERT |
| 大表 (文件/目录) | **ES** (待接入) | 全文检索、跨站点搜索 |
| 高频日志 | **ClickHouse** (待接入) | 列式压缩、长保留 |
| 站点原始数据 | **不复制** | PG17 不是站点副本 |

## 同步原则

1. **小表全量同步** — UPSERT 到 unified_*
2. **大表增量同步** — file-index taskId + watermark + limit
3. **文件表最后做 ES** — 不进 PG17
4. **每小时同步** — 站点定时推送
5. **总控定义协议** — package schema 由总控统一定义
6. **站点导出推送** — 站点只负责导出和推送
7. **总控接收校验** — 总控负责接收、校验、入库、日志
8. **不直接修改站点** — 总控不写回

## 包级别追踪

| 日志 | 字段 | 用途 |
|---|---|---|
| `sync_package_log` | site_code + batch_id | 包级唯一 |
| `sync_table_log` | site_code + batch_id + table_name | 表级唯一 |
| `unified_file_index` | source_site_id + source_table + source_id | 行级唯一 |
