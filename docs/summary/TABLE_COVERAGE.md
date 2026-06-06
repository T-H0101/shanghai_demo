# Table Coverage

> **基于 Sprint 2D.1 分类矩阵**

## 总体统计

| 状态 | 数量 | 占比 |
|---|---|---|
| **done** | 10 | 7% |
| **partial** | 2 (file-index) | 1% |
| **not_started** | 124 | 89% |
| **hold** | 3 | 2% |
| **local** | 5+ | 1% |

**总表数**: 146 (139 静态 + 7 动态模板)

## A. PG17_FULL_SMALL — 30 张
详细列表见 `docs/database-analysis/sprint-2d1-table-sync-classification-matrix.md`
- P0 (10 张已 done): tbl_task, tbl_disc_lib, tbl_magzines, tbl_slots, tbl_hd_info, tbl_lib_task, tbl_disc, tbl_logical_volume, tbl_volume_slot, tbl_user_task
- P0 not_started: tbl_user, tbl_site, tbl_platform
- P1 not_started: tbl_role, tbl_fuc, tbl_user_role, tbl_depa, tbl_depa_user
- P2 not_started: 字典/配置表

## B. PG17_AGGREGATE — 18 张
- 任务/设备/容量/校验摘要
- 全部 not_started

## C. ES_INDEX — 10+ 张
- **partial (2)**: tbl_file, tbl_folder (file-index skeleton + E2E 完成)
- **not_started (8+)**: 7 动态模板表 + tbl_task_error_file + tbl_check_*

## D. CLICKHOUSE_LOG — 8 张
- 全部 not_started
- 重点: tbl_sys_log, tbl_api_log (高频)

## E. LOCAL_ONLY — 5+ 张
- 站点内部状态，不同步
- tbl_buffer_dir (20251212 废弃), tbl_back_window, tbl_user_mfa, tbl_escape, tbl_sys_env

## F. TODO_CONFIRM — 3 张
- hold 状态: tbl_device_device, tbl_meta_data, tbl_file_recover_info
- 需领导/站点确认字段含义

## 当前已 done 的 10 张小表 (详细)

| 源表 | unified_* | Importer | Package 支持 |
|---|---|---|---|
| tbl_task | unified_tasks | task-importer | ✅ Sprint 2D.3 |
| tbl_disc_lib | unified_devices | device-importer | ✅ Sprint 2D.3 |
| tbl_magzines | (devices join) | device-capacity-aggregator | ✅ Sprint 2D.3 |
| tbl_slots | (devices join) | device-capacity-aggregator | ✅ Sprint 2D.3 |
| tbl_hd_info | unified_hard_disks | hard-disk-importer | ✅ Sprint 2D.3 |
| tbl_lib_task | (tasks join) | task-device-aggregator | ✅ Sprint 2D.3 |
| tbl_disc | unified_disc_media | disc-media-importer | ✅ Sprint 2D.3 |
| tbl_logical_volume | unified_logical_volumes | volume-importer | ✅ Sprint 2D.3 |
| tbl_volume_slot | (volumes join) | volume-importer | ✅ Sprint 2D.3 |
| tbl_user_task | (tasks join) | task-user-aggregator | ✅ Sprint 2D.3 |
