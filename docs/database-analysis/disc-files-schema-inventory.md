# Schema Source Inventory: disc_files.sql

> **文件**: `databases/disc_files.sql`
> **大小**: 154KB, 2842 行
> **日期**: 2026-05-27
> **来源**: 项目早期数据库字段文件 (MySQL → PG 兼容 DDL)

---

## 0. 概览

| 指标 | 值 |
|---|---|
| CREATE TABLE 语句 | 147 |
| 实际唯一表名 | ~135 (去掉动态表模板) |
| 包含 tbl_file/tbl_folder | ✅ |
| 包含控制/巡检/恢复表 | ✅ (11 张) |
| 与 star_storage_db (170 张) 差异 | star 多 29 张分区表 (tbl_file_1/2/3 等) |

## 1. 与 star_storage_db 对比

| 维度 | disc_files.sql | star_storage_db |
|---|---|---|
| 表数 | 147 | 170 (含分区表) |
| 差异 | 7 张不在 star (tbl_inspect_stat/zip, tbl_task_error_file 等) | 29 张分区表不在 disc_files.sql |
| 覆盖率 | 核心表 100% 覆盖 | 分区表额外扩展 |

## 2. 与 source_restore (13 表) 对比

| source_restore 表 | 在 disc_files.sql? |
|---|---|
| tbl_task | ✅ |
| tbl_disc_lib | ✅ |
| tbl_hd_info | ✅ |
| tbl_lib_task | ✅ |
| tbl_logical_volume | ✅ |
| tbl_magzines | ✅ |
| tbl_platform | ✅ |
| tbl_site | ✅ |
| tbl_slots | ✅ |
| tbl_disc | ✅ |
| tbl_user | ✅ |
| tbl_user_task | ✅ |
| tbl_volume_slot | ✅ |

**结论**: source_restore 13 表全部在 disc_files.sql 中。但 disc_files.sql 有 **122+ 张表** source_restore 没有。

## 3. 关键控制/巡检/恢复表 (disc_files.sql 有)

| 表名 | 用途 | star_storage_db 行数 |
|---|---|---|
| tbl_check_patrol_task | 巡检任务执行记录 | 0 |
| tbl_check_patrol_task_item | 巡检任务项 | — |
| tbl_check_patrol_log | 巡检日志 | — |
| tbl_check_patrol_strategy | 巡检策略 | — |
| tbl_hot_backup_record | 热备记录 | 0 |
| tbl_hot_restore_record | 热恢复记录 | 0 |
| tbl_data_receive_list | 数据接收列表 | 0 |
| tbl_data_receive_log | 数据接收日志 | — |
| tbl_data_receive_tasks | 数据接收任务 | — |
| tbl_interface_task | 接口任务 | 0 |
| tbl_schedule_job | 定时任务 | — |

## 4. Schema Source Priority (CLAUDE.md 附录 C)

| 优先级 | 来源 | 说明 |
|---|---|---|
| 1 | requirements.md | 需求最高标准 |
| 2 | disc_files.sql | 字段/表结构静态基线 |
| 3 | star_storage_db | 运行时真实数据 (170 表) |
| 4 | source_restore | 同步白名单/测试源 (13 表) |
| 5 | unified_disc_platform | 总控汇总结果 (可能含污染) |

**禁止**: 只看 source_restore 13 表下结论。
