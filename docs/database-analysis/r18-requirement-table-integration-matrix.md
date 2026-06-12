# R.18 Requirement to Table Integration Matrix

> Schema priority: requirements -> disc_files.sql -> star_storage_db -> source_restore -> unified center

## 1. 存储分类

| 数据域 | 源表 | star_storage_db 行数 | 中心策略 | Requirement | 优先级 |
|---|---|---:|---|---|---|
| 任务 | `tbl_task` | 37 | PG17 small/incremental | §2.3、§4.2 | 已接，稳定 |
| 设备 | `tbl_disc_lib` | 4 | PG17 small/snapshot | §2.1、§2.3 | 已接，稳定 |
| 盘匣/盘位 | `tbl_magzines/tbl_slots` | 6/396 | PG17 small/snapshot | §2.3、§4.3 | 已接，稳定 |
| 硬盘 | `tbl_hd_info` | 8 | PG17 small/snapshot | §2.1、§2.3 | 已接，稳定 |
| 光盘 | `tbl_disc` | 65 | PG17 small/incremental | §2.3、§4.3、§5.2 | 已接，稳定 |
| 卷/卷盘关系 | `tbl_logical_volume/tbl_volume_slot` | 3/161 | PG17 small + aggregate | §2.3、§4.1、§4.3 | 已接，稳定 |
| 用户任务关系 | `tbl_user_task` | 28 | PG17 relation | §3.1、§4.2 | 已接，稳定 |
| 用户 | `tbl_user` | 3 | PG17 small | §2.3、§3.1 | 已接，字段不足 |
| 角色/功能 | `tbl_role/tbl_fuc` | 4/53 | PG17 small/snapshot | §2.3、§3.2 | R.20 P1 |
| 用户角色 | `tbl_user_role` | 0 | PG17 relation | §2.3、§3.2 | R.20，empty |
| 部门关系 | `tbl_depa/tbl_depa_user` | 0/0 | PG17 relation | §3.1、§3.3 | R.20，empty |
| 驱动器 | `tbl_drivers` | 4 | PG17 small/snapshot | §2.1、§2.3 | R.20 P0 |
| 设备分组 | `tbl_lib_group` | 0 | PG17 small/snapshot | §2.1 | R.20，empty |
| 预警 | `tbl_early_warning` | 0 | PG17 append_incremental | §2.1、§4.2、§6.4 | R.20，empty |
| 文件 | `tbl_file` | 4 | 有界 PG17 index；完整数据 ES | §2.3、§4.1、§5.2 | 禁止 package |
| 目录 | `tbl_folder` | 0 | 有界 PG17 index；完整数据 ES | §2.3、§4.1、§5.2 | 禁止 package |
| 系统/API日志 | `tbl_sys_log/tbl_api_log` | 0/0 | 摘要 PG17；完整日志 ClickHouse | §5.1、§6.4 | 外部系统 |
| 巡检 | `tbl_check_patrol_task` | 0 | PG17 状态摘要 | §4.2.3 | 缺字段/行为 |
| 热恢复 | `tbl_hot_restore_record` | 0 | PG17 状态摘要 | §4.2.1/3 | 缺字段/行为 |
| 任务错误文件 | `tbl_task_error_file` | 运行库缺表 | 静态 schema 存在，待站点确认 | §4.2.4、§5.1 | blocked schema |

## 2. 接入门槛

每张表或最小聚合单元必须有:

1. requirements 映射。
2. 静态 schema 和运行库交叉验证。
3. 同步模式和 watermark 说明。
4. 中心目标表或 aggregate 说明。
5. mapper/dispatcher。
6. source/center SQL 结果。
7. API 和已有 UI 消费位置。
8. 一致性规则。
9. e2e 和 requirements review。

源表为 0 行时，只能验 schema、同步链路和 honest empty state。

## 3. 明确禁止

- 不把剩余 157 张表一次性加入白名单。
- 不建立全量 `unified_files/unified_folders`。
- 不用 `source_restore` 13 表代替完整站点库结论。
- 不为了表覆盖率新增页面或按钮。
- 不把空表链路标成业务 complete。
