# R.83 170 表治理矩阵

> 实查站点:`site_restore_full_postgres.star_storage_db`
> 维护命令:`pnpm tsx scripts/audit/generate-r83-matrix.ts`(重新生成本文档)
> 维护人:R.83 Sprint 系列
> 最近更新:2026-06-26 (R.83.3 桶落地: 检查巡检族 15 张)

## 分类规则

| 列 | 含义 |
|---|---|
| `src_table` | 源端 `star_storage_db` 的 `tbl_*` 表名 |
| `size` | `pg_total_relation_size` 人类可读值 |
| `target_storage` | 中心库落点:`pg17_small` / `opensearch` / `clickhouse` / `forbidden` / `out_of_scope` |
| `unified_table` | 中心库对应 `unified_<stripped>` 名;非 `pg17_small` 标 `—` |
| `blocker` | 阻塞类型:`none` / `blocked_by_source_schema` / `blocked_by_external_system` |
| `round` | 落地 Sprint 桶:`R.83.1` / `R.83.2` / `R.83.3` / `already` / `R.83.4+` / `deferred` / `never` |
| `notes` | 简要说明 |

## 分类规则优先级 (按顺序匹配)

1. `tbl_file*` / `tbl_folder*` → `forbidden`,`never`,阻塞 `blocked_by_source_schema`(Sprint 2D.1 + R.82 已锁定,走 ES/ClickHouse)
2. R.83.1 落地的 15 张新表 → `pg17_small`,`R.83.1`,阻塞 `none`
3. 既有白名单 13 张表 → `pg17_small`,`already`,阻塞 `none`
4. 表大小 < 32KB → `pg17_small`,`R.83.4+`,阻塞 `none`(业务小表,候选接入)
5. 表大小 32KB ~ 10MB → `pg17_small`,`R.83.4+`,阻塞 `none`(业务表,中等,候选)
6. 表大小 ≥ 10MB → `opensearch`,`deferred`,阻塞 `blocked_by_external_system`(大表,需 ES 接入)

## 桶分布

| 桶 | 计数 | 说明 |
|---|---:|---|
| `R.83.1` | 15 | Sprint R.83.1 已落地 (部门/项目/接收单 15 张) |
| `R.83.2` | 15 | Sprint R.83.2 已落地 (RBAC + 字典 + 日志 + 凭据 15 张) |
| `R.83.3` | 15 | Sprint R.83.3 已落地 (检查巡检族 15 张) |
| `already` | 13 | R.83.1 之前的 13 张白名单 |
| `R.83.4+` | 83 | 剩余业务表候选 (98 - 15 = 83 张,R.83.4+ 评估) |
| `deferred` | 0 | 大表 (≥10MB),走 ES,需外部系统接入 |
| `never` | 29 | tbl_file* / tbl_folder* 已锁定不进 PG |
| **合计** | **170** | **= star_storage_db 全部 tbl_* 表** |

## 矩阵表 (170 张)

| # | src_table | size | target_storage | unified_table | blocker | round | notes |
|---:|---|---|---|---|---|---|---|
| 1 | tbl_api_interface | 16 kB | pg17_small | unified_api_interface | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 2 | tbl_api_log | 16 kB | pg17_small | unified_api_log | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 3 | tbl_archives_level | 16 kB | pg17_small | unified_archives_level | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 4 | tbl_archives_type | 16 kB | pg17_small | unified_archives_type | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 5 | tbl_back_window | 16 kB | pg17_small | unified_back_window | none | R.83.4+ | 业务小表 (候选接入) |
| 6 | tbl_backup_db | 32 kB | pg17_small | unified_backup_db | none | R.83.4+ | 业务表 (中等,候选) |
| 7 | tbl_buffer_dir | 16 kB | pg17_small | unified_buffer_dir | none | R.83.4+ | 业务小表 (候选接入) |
| 8 | tbl_cd_cabinet | 16 kB | pg17_small | unified_cd_cabinet | none | R.83.4+ | 业务小表 (候选接入) |
| 9 | tbl_check_category | 16 kB | pg17_small | unified_check_category | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 10 | tbl_check_file | 24 kB | pg17_small | unified_check_file | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 11 | tbl_check_files | 16 kB | pg17_small | unified_check_files | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 12 | tbl_check_item | 16 kB | pg17_small | unified_check_item | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 13 | tbl_check_log | 32 kB | pg17_small | unified_check_log | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 14 | tbl_check_patrol_log | 24 kB | pg17_small | unified_check_patrol_log | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 15 | tbl_check_patrol_strategy | 16 kB | pg17_small | unified_check_patrol_strategy | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 16 | tbl_check_patrol_task | 16 kB | pg17_small | unified_check_patrol_task | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 17 | tbl_check_patrol_task_item | 24 kB | pg17_small | unified_check_patrol_task_item | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 18 | tbl_check_sector | 16 kB | pg17_small | unified_check_sector | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 19 | tbl_check_sub_category | 16 kB | pg17_small | unified_check_sub_category | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 20 | tbl_check_task | 16 kB | pg17_small | unified_check_task | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 21 | tbl_check_task_file | 16 kB | pg17_small | unified_check_task_file | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 22 | tbl_check_task_item | 24 kB | pg17_small | unified_check_task_item | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 23 | tbl_check_template | 16 kB | pg17_small | unified_check_template | none | R.83.3 | 检查巡检族 (R.83.3 已落地) |
| 24 | tbl_credible_prove | 16 kB | pg17_small | unified_credible_prove | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 25 | tbl_credible_verify | 16 kB | pg17_small | unified_credible_verify | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 26 | tbl_csv_details | 16 kB | pg17_small | unified_csv_details | none | R.83.4+ | 业务小表 (候选接入) |
| 27 | tbl_data_classification | 64 kB | pg17_small | unified_data_classification | none | R.83.4+ | 业务表 (中等,候选) |
| 28 | tbl_data_receive_list | 16 kB | pg17_small | unified_data_receive_list | none | R.83.4+ | 业务小表 (候选接入) |
| 29 | tbl_data_receive_log | 16 kB | pg17_small | unified_data_receive_log | none | R.83.4+ | 业务小表 (候选接入) |
| 30 | tbl_data_receive_tasks | 16 kB | pg17_small | unified_data_receive_tasks | none | R.83.4+ | 业务小表 (候选接入) |
| 31 | tbl_depa | 16 kB | pg17_small | unified_depa | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 32 | tbl_depa_user | 16 kB | pg17_small | unified_depa_user | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 33 | tbl_depa_user_info | 8192 bytes | pg17_small | unified_depa_user_info | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 34 | tbl_device_device | 16 kB | pg17_small | unified_device_device | none | R.83.4+ | 业务小表 (候选接入) |
| 35 | tbl_dict | 16 kB | pg17_small | unified_dict | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 36 | tbl_dict_category | 16 kB | pg17_small | unified_dict_category | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 37 | tbl_dict_item | 16 kB | pg17_small | unified_dict_item | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 38 | tbl_disc | 88 kB | pg17_small | unified_disc | none | already | 既有白名单 |
| 39 | tbl_disc_inspect | 16 kB | pg17_small | unified_disc_inspect | none | R.83.4+ | 业务小表 (候选接入) |
| 40 | tbl_disc_lib | 64 kB | pg17_small | unified_disc_lib | none | already | 既有白名单 |
| 41 | tbl_disc_print | 24 kB | pg17_small | unified_disc_print | none | R.83.4+ | 业务小表 (候选接入) |
| 42 | tbl_disc_type | 32 kB | pg17_small | unified_disc_type | none | R.83.4+ | 业务表 (中等,候选) |
| 43 | tbl_disk_check | 16 kB | pg17_small | unified_disk_check | none | R.83.4+ | 业务小表 (候选接入) |
| 44 | tbl_diskfile_check | 16 kB | pg17_small | unified_diskfile_check | none | R.83.4+ | 业务小表 (候选接入) |
| 45 | tbl_download_details | 16 kB | pg17_small | unified_download_details | none | R.83.4+ | 业务小表 (候选接入) |
| 46 | tbl_download_record | 16 kB | pg17_small | unified_download_record | none | R.83.4+ | 业务小表 (候选接入) |
| 47 | tbl_drivers | 64 kB | pg17_small | unified_drivers | none | R.83.4+ | 业务表 (中等,候选) |
| 48 | tbl_drivers_burn | 32 kB | pg17_small | unified_drivers_burn | none | R.83.4+ | 业务表 (中等,候选) |
| 49 | tbl_early_warning | 16 kB | pg17_small | unified_early_warning | none | R.83.4+ | 业务小表 (候选接入) |
| 50 | tbl_early_warning_feedback | 16 kB | pg17_small | unified_early_warning_feedback | none | R.83.4+ | 业务小表 (候选接入) |
| 51 | tbl_error_rate | 16 kB | pg17_small | unified_error_rate | none | R.83.4+ | 业务小表 (候选接入) |
| 52 | tbl_escape | 16 kB | pg17_small | unified_escape | none | R.83.4+ | 业务小表 (候选接入) |
| 53 | tbl_evidence_details | 16 kB | pg17_small | unified_evidence_details | none | R.83.4+ | 业务小表 (候选接入) |
| 54 | tbl_evidence_record_drp | 16 kB | pg17_small | unified_evidence_record_drp | none | R.83.4+ | 业务小表 (候选接入) |
| 55 | tbl_export_info | 16 kB | pg17_small | unified_export_info | none | R.83.4+ | 业务小表 (候选接入) |
| 56 | tbl_file | 80 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 57 | tbl_file_1 | 1040 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 58 | tbl_file_10000 | 96 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 59 | tbl_file_10001 | 96 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 60 | tbl_file_10002 | 96 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 61 | tbl_file_1_a | 552 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 62 | tbl_file_1_empty | 40 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 63 | tbl_file_1_error | 40 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 64 | tbl_file_1_repeat | 40 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 65 | tbl_file_2 | 12 MB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 66 | tbl_file_2_a | 5424 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 67 | tbl_file_2_empty | 40 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 68 | tbl_file_2_error | 40 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 69 | tbl_file_2_repeat | 40 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 70 | tbl_file_3 | 9464 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 71 | tbl_file_3_a | 6368 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 72 | tbl_file_3_empty | 40 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 73 | tbl_file_3_error | 40 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 74 | tbl_file_3_repeat | 40 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 75 | tbl_file_parts | 8192 bytes | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 76 | tbl_file_path_archive | 24 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 77 | tbl_file_path_restore | 24 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 78 | tbl_file_recover_info | 16 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 79 | tbl_file_stat | 16 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 80 | tbl_film_operat | 16 kB | pg17_small | unified_film_operat | none | R.83.4+ | 业务小表 (候选接入) |
| 81 | tbl_folder | 24 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 82 | tbl_folder_1 | 112 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 83 | tbl_folder_10000 | 64 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 84 | tbl_folder_2 | 1416 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 85 | tbl_folder_3 | 848 kB | forbidden | — | blocked_by_source_schema | never | 大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse) |
| 86 | tbl_ft_file | 24 kB | pg17_small | unified_ft_file | none | R.83.4+ | 业务小表 (候选接入) |
| 87 | tbl_ft_sys | 88 kB | pg17_small | unified_ft_sys | none | R.83.4+ | 业务表 (中等,候选) |
| 88 | tbl_fuc | 32 kB | pg17_small | unified_fuc | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 89 | tbl_hd_info | 152 kB | pg17_small | unified_hd_info | none | already | 既有白名单 |
| 90 | tbl_hd_manager | 32 kB | pg17_small | unified_hd_manager | none | R.83.4+ | 业务表 (中等,候选) |
| 91 | tbl_hd_power | 16 kB | pg17_small | unified_hd_power | none | R.83.4+ | 业务小表 (候选接入) |
| 92 | tbl_hot_backup_record | 16 kB | pg17_small | unified_hot_backup_record | none | R.83.4+ | 业务小表 (候选接入) |
| 93 | tbl_hot_restore_record | 16 kB | pg17_small | unified_hot_restore_record | none | R.83.4+ | 业务小表 (候选接入) |
| 94 | tbl_import_folder_data | 8192 bytes | pg17_small | unified_import_folder_data | none | R.83.4+ | 业务小表 (候选接入) |
| 95 | tbl_import_folder_log | 16 kB | pg17_small | unified_import_folder_log | none | R.83.4+ | 业务小表 (候选接入) |
| 96 | tbl_import_folder_title | 16 kB | pg17_small | unified_import_folder_title | none | R.83.4+ | 业务小表 (候选接入) |
| 97 | tbl_interface_task | 24 kB | pg17_small | unified_interface_task | none | R.83.4+ | 业务小表 (候选接入) |
| 98 | tbl_iso_location | 16 kB | pg17_small | unified_iso_location | none | R.83.4+ | 业务小表 (候选接入) |
| 99 | tbl_iso_task_sync | 8192 bytes | pg17_small | unified_iso_task_sync | none | R.83.4+ | 业务小表 (候选接入) |
| 100 | tbl_lib_group | 16 kB | pg17_small | unified_lib_group | none | R.83.4+ | 业务小表 (候选接入) |
| 101 | tbl_lib_task | 80 kB | pg17_small | unified_lib_task | none | already | 既有白名单 |
| 102 | tbl_logical_volume | 64 kB | pg17_small | unified_logical_volume | none | already | 既有白名单 |
| 103 | tbl_magzines | 64 kB | pg17_small | unified_magzines | none | already | 既有白名单 |
| 104 | tbl_meta_data | 16 kB | pg17_small | unified_meta_data | none | R.83.4+ | 业务小表 (候选接入) |
| 105 | tbl_monitor_path | 32 kB | pg17_small | unified_monitor_path | none | R.83.4+ | 业务表 (中等,候选) |
| 106 | tbl_mount_dir | 16 kB | pg17_small | unified_mount_dir | none | R.83.4+ | 业务小表 (候选接入) |
| 107 | tbl_platform | 16 kB | pg17_small | unified_platform | none | already | 既有白名单 |
| 108 | tbl_platform_monitor | 16 kB | pg17_small | unified_platform_monitor | none | R.83.4+ | 业务小表 (候选接入) |
| 109 | tbl_platform_type | 32 kB | pg17_small | unified_platform_type | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 110 | tbl_project | 16 kB | pg17_small | unified_project | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 111 | tbl_project_monitor_files | 24 kB | pg17_small | unified_project_monitor_files | none | R.83.4+ | 业务小表 (候选接入) |
| 112 | tbl_project_site | 16 kB | pg17_small | unified_project_site | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 113 | tbl_raid_group | 16 kB | pg17_small | unified_raid_group | none | R.83.4+ | 业务小表 (候选接入) |
| 114 | tbl_receipt | 16 kB | pg17_small | unified_receipt | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 115 | tbl_receipt_check | 16 kB | pg17_small | unified_receipt_check | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 116 | tbl_receipt_file | 16 kB | pg17_small | unified_receipt_file | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 117 | tbl_receipt_file_detail | 24 kB | pg17_small | unified_receipt_file_detail | none | R.83.4+ | 业务小表 (候选接入) |
| 118 | tbl_register_management | 16 kB | pg17_small | unified_register_management | none | R.83.4+ | 业务小表 (候选接入) |
| 119 | tbl_remote_backup | 32 kB | pg17_small | unified_remote_backup | none | R.83.4+ | 业务表 (中等,候选) |
| 120 | tbl_role | 32 kB | pg17_small | unified_role | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 121 | tbl_role_fuc | 24 kB | pg17_small | unified_role_fuc | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 122 | tbl_schedule_job | 16 kB | pg17_small | unified_schedule_job | none | R.83.4+ | 业务小表 (候选接入) |
| 123 | tbl_site | 16 kB | pg17_small | unified_site | none | already | 既有白名单 |
| 124 | tbl_site_monitor | 16 kB | pg17_small | unified_site_monitor | none | R.83.4+ | 业务小表 (候选接入) |
| 125 | tbl_slot_file_1000000 | 504 kB | pg17_small | unified_slot_file_1000000 | none | R.83.4+ | 业务表 (中等,候选) |
| 126 | tbl_slot_file_12 | 1992 kB | pg17_small | unified_slot_file_12 | none | R.83.4+ | 业务表 (中等,候选) |
| 127 | tbl_slot_file_13 | 3392 kB | pg17_small | unified_slot_file_13 | none | R.83.4+ | 业务表 (中等,候选) |
| 128 | tbl_slot_file_15 | 80 kB | pg17_small | unified_slot_file_15 | none | R.83.4+ | 业务表 (中等,候选) |
| 129 | tbl_slot_file_30 | 4768 kB | pg17_small | unified_slot_file_30 | none | R.83.4+ | 业务表 (中等,候选) |
| 130 | tbl_slot_file_31 | 1552 kB | pg17_small | unified_slot_file_31 | none | R.83.4+ | 业务表 (中等,候选) |
| 131 | tbl_slot_folder_1000000 | 96 kB | pg17_small | unified_slot_folder_1000000 | none | R.83.4+ | 业务表 (中等,候选) |
| 132 | tbl_slot_folder_12 | 336 kB | pg17_small | unified_slot_folder_12 | none | R.83.4+ | 业务表 (中等,候选) |
| 133 | tbl_slot_folder_13 | 320 kB | pg17_small | unified_slot_folder_13 | none | R.83.4+ | 业务表 (中等,候选) |
| 134 | tbl_slot_folder_15 | 48 kB | pg17_small | unified_slot_folder_15 | none | R.83.4+ | 业务表 (中等,候选) |
| 135 | tbl_slot_folder_30 | 368 kB | pg17_small | unified_slot_folder_30 | none | R.83.4+ | 业务表 (中等,候选) |
| 136 | tbl_slot_folder_31 | 152 kB | pg17_small | unified_slot_folder_31 | none | R.83.4+ | 业务表 (中等,候选) |
| 137 | tbl_slots | 104 kB | pg17_small | unified_slots | none | already | 既有白名单 |
| 138 | tbl_slots_part | 32 kB | pg17_small | unified_slots_part | none | R.83.4+ | 业务表 (中等,候选) |
| 139 | tbl_sys | 16 kB | pg17_small | unified_sys | none | R.83.4+ | 业务小表 (候选接入) |
| 140 | tbl_sys_env | 16 kB | pg17_small | unified_sys_env | none | R.83.4+ | 业务小表 (候选接入) |
| 141 | tbl_sys_log | 64 kB | pg17_small | unified_sys_log | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 142 | tbl_task | 72 kB | pg17_small | unified_task | none | already | 既有白名单 |
| 143 | tbl_task_certif_status | 16 kB | pg17_small | unified_task_certif_status | none | R.83.4+ | 业务小表 (候选接入) |
| 144 | tbl_task_check | 16 kB | pg17_small | unified_task_check | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 145 | tbl_task_files | 16 kB | pg17_small | unified_task_files | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 146 | tbl_task_folder | 32 kB | pg17_small | unified_task_folder | none | R.83.4+ | 业务表 (中等,候选) |
| 147 | tbl_task_items | 48 kB | pg17_small | unified_task_items | none | R.83.4+ | 业务表 (中等,候选) |
| 148 | tbl_task_print | 24 kB | pg17_small | unified_task_print | none | R.83.4+ | 业务小表 (候选接入) |
| 149 | tbl_task_projects | 16 kB | pg17_small | unified_task_projects | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 150 | tbl_task_receipts | 16 kB | pg17_small | unified_task_receipts | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 151 | tbl_temp_slots | 24 kB | pg17_small | unified_temp_slots | none | R.83.4+ | 业务小表 (候选接入) |
| 152 | tbl_upload_details | 16 kB | pg17_small | unified_upload_details | none | R.83.4+ | 业务小表 (候选接入) |
| 153 | tbl_upload_record | 16 kB | pg17_small | unified_upload_record | none | R.83.4+ | 业务小表 (候选接入) |
| 154 | tbl_user | 32 kB | pg17_small | unified_user | none | already | 既有白名单 |
| 155 | tbl_user_mfa | 16 kB | pg17_small | unified_user_mfa | none | R.83.2 | RBAC + 字典 + 日志 + 凭据族 (R.83.2 已落地) |
| 156 | tbl_user_role | 8192 bytes | pg17_small | unified_user_role | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 157 | tbl_user_task | 32 kB | pg17_small | unified_user_task | none | already | 既有白名单 |
| 158 | tbl_verify_details | 16 kB | pg17_small | unified_verify_details | none | R.83.4+ | 业务小表 (候选接入) |
| 159 | tbl_verify_record_drp | 16 kB | pg17_small | unified_verify_record_drp | none | R.83.4+ | 业务小表 (候选接入) |
| 160 | tbl_volume_dataclass | 8192 bytes | pg17_small | unified_volume_dataclass | none | R.83.4+ | 业务小表 (候选接入) |
| 161 | tbl_volume_depa | 8192 bytes | pg17_small | unified_volume_depa | none | R.83.4+ | 业务小表 (候选接入) |
| 162 | tbl_volume_group | 16 kB | pg17_small | unified_volume_group | none | R.83.4+ | 业务小表 (候选接入) |
| 163 | tbl_volume_slot | 64 kB | pg17_small | unified_volume_slot | none | already | 既有白名单 |
| 164 | tbl_volume_user | 24 kB | pg17_small | unified_volume_user | none | R.83.4+ | 业务小表 (候选接入) |
| 165 | tbl_volume_workspace | 8192 bytes | pg17_small | unified_volume_workspace | none | R.83.4+ | 业务小表 (候选接入) |
| 166 | tbl_wait_download_file | 16 kB | pg17_small | unified_wait_download_file | none | R.83.4+ | 业务小表 (候选接入) |
| 167 | tbl_wait_download_file_task | 8192 bytes | pg17_small | unified_wait_download_file_task | none | R.83.4+ | 业务小表 (候选接入) |
| 168 | tbl_workspace | 16 kB | pg17_small | unified_workspace | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 169 | tbl_workspace_user | 8192 bytes | pg17_small | unified_workspace_user | none | R.83.1 | 部门/项目/接收单 (R.83.1 已落地) |
| 170 | tbl_zip_file | 16 kB | pg17_small | unified_zip_file | none | R.83.4+ | 业务小表 (候选接入) |
