# Sprint 2D.1 - 全表同步分类矩阵与后续路线图

> **日期**: 2026-06-06
> **范围**: 解析 `databases/disc_files.sql` 全部 CREATE TABLE，分类、矩阵、路线图
> **本 Sprint 不写业务代码，只出文档**

---

## 一、表数量统计

| 类别 | 数量 |
|---|---|
| 静态表 | 139 |
| 动态表 (template `tbl_xxx_XX`) | 7 |
| **总计** | **146** |

### 7 张动态表 (按表 ID 运行时展开)
- `tbl_slot_file_XX`
- `tbl_task_file_XX`
- `tbl_file_XX`
- `tbl_slot_folder_XX`
- `tbl_task_folder_XX`
- `tbl_folder_XX`
- `tbl_file_path_temp_XX`

→ 这些表按 `tableId` 运行时分表，**等同于 tbl_file/tbl_folder 大表范畴**，应统一进入 ES / file_index。

---

## 二、分类原则

| 分类 | 含义 | 进入目标 |
|---|---|---|
| **A. PG17_FULL_SMALL** | 小表/字典/关系/配置 | unified_* 全量 UPSERT |
| **B. PG17_AGGREGATE** | 统计/摘要/计数 | unified_* summary 表 |
| **C. ES_INDEX** | 大表/检索明细 | Elasticsearch |
| **D. CLICKHOUSE_LOG** | 操作/API/同步日志 | ClickHouse |
| **E. LOCAL_ONLY** | 站点临时/缓存/中间 | 不同步 |
| **F. TODO_CONFIRM** | 字段含义不清 | 需确认 |

### 同步原则 (领导确认)
1. 站点定期导出 → 推送中心
2. 小表 full snapshot + UPSERT，初版每小时一次
3. 大表增量更新
4. 文件表最终用 ES 查询
5. 数据包格式由总控统一定义
6. 站点只导出推送；总控负责接收/校验/入库/日志
7. **PG17 不是站点库副本**——只存业务摘要/索引/状态/管理

---

## 三、全表矩阵 (139 静态表)

### A. PG17_FULL_SMALL — 30 张 (适合 PG17 全量)

| table_name | est_size | sync_mode | target_model | priority | reason | current_status |
|---|---|---|---|---|---|---|
| tbl_task | large | full | unified_tasks | P0 | 任务主表 | **done** |
| tbl_disc_lib | small | full | unified_devices | P0 | 设备主表 | **done** |
| tbl_magzines | small | full | unified_magazines | P0 | 介质库主表 | **done** |
| tbl_slots | medium | full | unified_slots | P0 | 设备-槽位关系 | **done** |
| tbl_hd_info | medium | full | unified_hard_disks | P0 | 硬盘主表 | **done** |
| tbl_lib_task | medium | full | (unified_tasks join) | P0 | 任务-设备关系 | **done** |
| tbl_disc | medium | full | unified_disc_media | P0 | 物理盘片 | **done** |
| tbl_logical_volume | small | full | unified_logical_volumes | P0 | 逻辑卷主表 | **done** |
| tbl_volume_slot | small | full | (unified_logical_volumes join) | P0 | 卷-槽位关系 | **done** |
| tbl_user_task | small | full | (unified_tasks join) | P0 | 任务-用户关系 | **done** |
| tbl_user | small | full | unified_users | P0 | 用户主表 | not_started |
| tbl_depa | small | full | unified_departments | P1 | 部门主表 | not_started |
| tbl_role | small | full | unified_roles | P1 | 角色主表 | not_started |
| tbl_user_role | small | full | (unified_users join) | P1 | 用户-角色 | not_started |
| tbl_role_fuc | small | full | (unified_roles join) | P1 | 角色-权限 | not_started |
| tbl_fuc | small | full | unified_permissions | P1 | 权限字典 | not_started |
| tbl_depa_user | small | full | (unified_departments join) | P1 | 部门-用户 | not_started |
| tbl_depa_user_info | small | full | (unified_departments join) | P1 | 部门-用户扩展 | not_started |
| tbl_volume_depa | small | full | (unified_logical_volumes join) | P2 | 卷-部门关系 | not_started |
| tbl_workspace | small | full | unified_workspaces | P2 | 工作空间 | not_started |
| tbl_workspace_user | small | full | (unified_workspaces join) | P2 | 工作空间-用户 | not_started |
| tbl_volume_workspace | small | full | (unified_logical_volumes join) | P2 | 卷-工作空间 | not_started |
| tbl_volume_user | small | full | (unified_logical_volumes join) | P2 | 卷-用户 | not_started |
| tbl_site | small | full | unified_sites | P0 | 站点主表 | not_started |
| tbl_platform | small | full | unified_platforms | P0 | 平台主表 | not_started |
| tbl_platform_type | small | full | unified_platform_types | P2 | 平台类型字典 | not_started |
| tbl_project | small | full | unified_projects | P2 | 项目主表 | not_started |
| tbl_project_site | small | full | (unified_projects join) | P2 | 项目-站点 | not_started |
| tbl_lib_group | small | full | unified_lib_groups | P2 | 设备分组 | not_started |
| tbl_disc_type | small | full | unified_disc_types | P2 | 盘片类型字典 | not_started |
| tbl_cd_cabinet | small | full | unified_cabinets | P2 | 光盘柜 | not_started |
| tbl_hd_manager | small | full | unified_hd_managers | P2 | 硬盘管理 | not_started |
| tbl_volume_dataclass | small | full | (unified_logical_volumes join) | P2 | 卷-数据分类 | not_started |
| tbl_task_projects | small | full | (unified_tasks join) | P2 | 任务-项目 | not_started |
| tbl_buffer_dir | small | full | unified_buffer_dirs | P2 | 缓存目录（20251212废弃字段） | not_started |
| tbl_volume_group | small | full | (unified_logical_volumes join) | P2 | 卷分组 | not_started |
| tbl_data_classification | small | full | unified_data_classifications | P2 | 数据分类字典 | not_started |
| tbl_archives_type | small | full | unified_archives_types | P2 | 档案类型字典 | not_started |
| tbl_archives_level | small | full | unified_archives_levels | P2 | 档案密级字典 | not_started |
| tbl_dict_category | small | full | unified_dict_categories | P2 | 通用字典分类 | not_started |
| tbl_dict | small | full | unified_dicts | P2 | 通用字典 | not_started |
| tbl_dict_item | small | full | unified_dict_items | P2 | 通用字典项 | not_started |
| tbl_iso_location | small | full | unified_iso_locations | P2 | ISO 镜像位置 | not_started |
| tbl_drivers | small | full | unified_drivers | P2 | 驱动配置 | not_started |
| tbl_drivers_burn | small | full | unified_burn_drivers | P2 | 刻录驱动 | not_started |
| tbl_hd_power | small | full | unified_hd_power | P2 | 硬盘电源 | not_started |
| tbl_slots_part | small | full | (unified_slots join) | P2 | 槽位分区 | not_started |
| tbl_user_mfa | small | full | (unified_users join) | P2 | 用户 MFA | not_started |
| tbl_user_slots | small | full | (unified_users join) | P2 | 用户-槽位 | not_started |
| tbl_iso_task_sync | small | full | (unified_tasks join) | P2 | ISO 任务同步 | not_started |
| tbl_register_management | small | full | unified_registers | P2 | 注册管理 | not_started |
| tbl_escape | small | full | unified_escapes | P2 | 转义配置 | not_started |
| tbl_workspace_user | small | full | (unified_workspaces join) | P2 | 工作空间-用户 | not_started |
| tbl_workspace | small | full | unified_workspaces | P2 | 工作空间 | not_started |

**说明**: 上述 P0 表格中已 10 张 done (Sprint 2B-2C 范围), 其余 P0 用户/站点/平台是 P0 必需但未启动；P1 角色/部门/权限是统一权限系统基础; P2 是低频配置表。

### B. PG17_AGGREGATE — 18 张 (聚合摘要)

| table_name | est_size | sync_mode | target_model | priority | reason | current_status |
|---|---|---|---|---|---|---|
| tbl_file_stat | small | aggregate | unified_file_stats | P1 | 文件统计（计数/总大小） | not_started |
| tbl_task_check | small | aggregate | (unified_tasks join) | P1 | 任务校验状态汇总 | not_started |
| tbl_disk_check | small | aggregate | (unified_devices join) | P1 | 硬盘校验状态汇总 | not_started |
| tbl_check_file | small | aggregate | unified_check_summaries | P1 | 校验文件摘要 | not_started |
| tbl_error_rate | small | aggregate | unified_error_rates | P1 | 错误率统计 | not_started |
| tbl_inspect_stat | small | aggregate | unified_inspect_stats | P1 | 巡检统计 | not_started |
| tbl_task_certif_status | small | aggregate | (unified_tasks join) | P1 | 任务凭证状态 | not_started |
| tbl_task_print | small | aggregate | (unified_tasks join) | P2 | 任务打印状态 | not_started |
| tbl_disc_print | small | aggregate | (unified_disc_media join) | P2 | 盘片打印 | not_started |
| tbl_task_folder | small | aggregate | (unified_tasks join) | P2 | 任务-目录关联 | not_started |
| tbl_task_items | small | aggregate | (unified_tasks join) | P2 | 任务-条目 | not_started |
| tbl_task_files | small | aggregate | (unified_tasks join) | P2 | 任务-文件关联 | not_started |
| tbl_task_receipts | small | aggregate | (unified_tasks join) | P2 | 任务-回执 | not_started |
| tbl_zip_file | medium | aggregate | (unified_tasks join) | P2 | ZIP 索引 | not_started |
| tbl_ft_file | medium | aggregate | (unified_tasks join) | P2 | FT 文件 | not_started |
| tbl_ft_sys | small | aggregate | unified_ft_systems | P2 | FT 系统配置 | not_started |
| tbl_interface_task | small | aggregate | unified_interface_tasks | P2 | 接口任务 | not_started |
| tbl_monitor_path | small | aggregate | unified_monitor_paths | P2 | 监控路径 | not_started |
| tbl_raid_group | small | aggregate | unified_raid_groups | P2 | RAID 组 | not_started |
| tbl_remote_backup | small | aggregate | unified_remote_backups | P2 | 远程备份 | not_started |
| tbl_back_window | small | aggregate | unified_back_windows | P2 | 后台窗口 | not_started |
| tbl_file_path_archive | medium | aggregate | (unified_tasks join) | P2 | 文件路径-归档 | not_started |
| tbl_file_path_restore | medium | aggregate | (unified_tasks join) | P2 | 文件路径-还原 | not_started |
| tbl_hot_backup_record | medium | aggregate | unified_hot_backup_records | P2 | 热备记录 | not_started |
| tbl_hot_restore_record | medium | aggregate | unified_hot_restore_records | P2 | 热还记录 | not_started |
| tbl_data_receive_list | medium | aggregate | unified_data_receive_lists | P2 | 数据接收列表 | not_started |
| tbl_data_receive_tasks | medium | aggregate | unified_data_receive_tasks | P2 | 数据接收任务 | not_started |
| tbl_data_receive_log | medium | aggregate | unified_data_receive_logs | P2 | 数据接收日志 | not_started |
| tbl_sys_env | small | aggregate | unified_sys_envs | P2 | 系统环境 | not_started |
| tbl_film_operat | small | aggregate | unified_film_operats | P2 | 影片操作 | not_started |
| tbl_site_monitor | medium | aggregate | (unified_sites join) | P2 | 站点监控 | not_started |
| tbl_platform_monitor | medium | aggregate | (unified_platforms join) | P2 | 平台监控 | not_started |
| tbl_project_monitor_files | medium | aggregate | (unified_projects join) | P2 | 项目监控文件 | not_started |
| tbl_back_window | small | aggregate | unified_back_windows | P2 | 后台窗口 | not_started |
| tbl_workspace | small | aggregate | unified_workspaces | P2 | 工作空间 | not_started |
| tbl_evidence_details | medium | aggregate | unified_evidence_details | P2 | 存证明细 | not_started |
| tbl_verify_details | medium | aggregate | unified_verify_details | P2 | 校验明细 | not_started |
| tbl_evidence_record_drp | medium | aggregate | unified_evidence_records_drp | P2 | DRP 存证 | not_started |
| tbl_verify_record_drp | medium | aggregate | unified_verify_records_drp | P2 | DRP 校验 | not_started |
| tbl_hd_manager | small | aggregate | unified_hd_managers | P2 | 硬盘管理 | not_started |
| tbl_receipt | medium | aggregate | unified_receipts | P2 | 回执主表 | not_started |
| tbl_receipt_file | medium | aggregate | (unified_receipts join) | P2 | 回执文件 | not_started |
| tbl_receipt_check | medium | aggregate | (unified_receipts join) | P2 | 回执校验 | not_started |
| tbl_meta_data | medium | aggregate | unified_meta_data | P2 | 元数据 | not_started |
| tbl_file_recover_info | medium | aggregate | unified_file_recover | P2 | 文件恢复信息 | not_started |
| tbl_credible_prove | medium | aggregate | unified_credible_proves | P2 | 可信凭证 | not_started |
| tbl_credible_verify | medium | aggregate | unified_credible_verifies | P2 | 可信验证 | not_started |

**说明**: 这些表通常是聚合/中间态，不全量复制，但要保留摘要供总控展示。

### C. ES_INDEX — 大表/检索明细 (10+ 张)

| table_name | est_size | sync_mode | target_model | priority | reason | current_status |
|---|---|---|---|---|---|---|
| tbl_file | **huge** | incremental | unified_file_index → ES | P0 | 文件明细，**禁全量** | **partial** (file-index skeleton + E2E done) |
| tbl_folder | **huge** | incremental | unified_folder_index → ES | P0 | 目录树 | **partial** |
| tbl_slot_file_XX (7 模板) | huge | incremental | ES per-tableId | P2 | 槽位-文件分表 | not_started |
| tbl_task_file_XX | huge | incremental | ES per-tableId | P2 | 任务-文件分表 | not_started |
| tbl_file_XX | huge | incremental | ES per-tableId | P2 | 文件分表 | not_started |
| tbl_slot_folder_XX | huge | incremental | ES per-tableId | P2 | 槽位-目录分表 | not_started |
| tbl_task_folder_XX | huge | incremental | ES per-tableId | P2 | 任务-目录分表 | not_started |
| tbl_folder_XX | huge | incremental | ES per-tableId | P2 | 目录分表 | not_started |
| tbl_file_path_temp_XX | medium | incremental | ES per-tableId | P2 | 临时文件路径 | not_started |
| tbl_task_error_file | large | incremental | ES | P2 | 任务异常文件 | not_started |
| tbl_check_files | large | incremental | ES | P2 | 校验文件 | not_started |
| tbl_check_task_file | large | incremental | ES | P2 | 校验任务文件 | not_started |
| tbl_check_log | large | incremental | ES | P2 | 校验日志 | not_started |
| tbl_check_patrol_log | large | incremental | ES | P2 | 巡检日志 | not_started |
| tbl_inspect_zip | large | incremental | ES | P2 | 巡检 ZIP | not_started |
| tbl_import_folder_log | large | incremental | ES | P2 | 导入目录日志 | not_started |
| tbl_import_folder_title | large | incremental | ES | P2 | 导入目录标题 | not_started |
| tbl_import_folder_data | large | incremental | ES | P2 | 导入目录数据 | not_started |
| tbl_wait_download_file | large | incremental | ES | P2 | 待下载文件 | not_started |
| tbl_download_details | large | incremental | ES | P2 | 下载明细 | not_started |
| tbl_download_record | large | incremental | ES | P2 | 下载记录 | not_started |
| tbl_upload_record | large | incremental | ES | P2 | 上传记录 | not_started |
| tbl_upload_details | large | incremental | ES | P2 | 上传明细 | not_started |
| tbl_csv_details | large | incremental | ES | P2 | CSV 明细 | not_started |
| tbl_wait_download_file_task | large | incremental | ES | P2 | 待下载任务 | not_started |
| tbl_receipt_file_detail | large | incremental | ES | P2 | 回执文件明细 | not_started |
| tbl_file_parts | large | incremental | ES | P2 | 文件分片 | not_started |

**说明**: 标 P0 的是 file-index 主路径 (tbl_file / tbl_folder)，已经走通 E2E；其余 P2 是扩展。

### D. CLICKHOUSE_LOG_ANALYTICS — 操作日志 (8 张)

| table_name | est_size | sync_mode | target_model | priority | reason | current_status |
|---|---|---|---|---|---|---|
| tbl_sys_log | **huge** | incremental | log_sys_log | P0 | 系统日志（高频） | not_started |
| tbl_api_log | **huge** | incremental | log_api_log | P0 | API 调用日志（高频） | not_started |
| tbl_api_interface | small | full | log_api_interfaces | P2 | API 接口字典（小，可入PG17） | not_started |
| tbl_schedule_job | small | aggregate | unified_schedule_jobs | P2 | 调度任务（小，可入PG17） | not_started |
| tbl_check_patrol_task | small | aggregate | unified_check_patrol_tasks | P2 | 巡检任务 | not_started |
| tbl_check_patrol_task_item | small | aggregate | (unified_check_patrol_tasks join) | P2 | 巡检任务项 | not_started |
| tbl_check_patrol_strategy | small | aggregate | unified_check_patrol_strategies | P2 | 巡检策略 | not_started |
| tbl_early_warning | medium | incremental | log_early_warnings | P1 | 预警事件 | not_started |
| tbl_early_warning_feedback | medium | incremental | log_early_warning_feedbacks | P1 | 预警反馈 | not_started |

**说明**: tbl_sys_log / tbl_api_log 是典型 ClickHouse 日志场景（高频插入，列式压缩，长保留）。

### E. LOCAL_ONLY — 站点本地 (5+ 张)

| table_name | reason | current_status |
|---|---|---|
| tbl_buffer_dir | 20251212 注释废弃字段 | local |
| tbl_back_window | 站点内部后台窗口状态 | local |
| tbl_user_mfa | 站点 MFA 临时态 | local |
| tbl_escape | 站点转义配置（运行时） | local |
| tbl_sys_env | 站点环境变量 | local |

**说明**: 这些表大多是站点运行中间态/缓存，无总控价值。

### F. TODO_CONFIRM — 需确认 (3 张)

| table_name | reason | current_status |
|---|---|---|
| tbl_device_device | 字段含义 (lib_id_c / lib_id_s) 不清，需要站点确认 | hold |
| tbl_meta_data | 字段含义模糊 | hold |
| tbl_file_recover_info | 与 tbl_receipt 关系待确认 | hold |

---

## 四、当前已完成进度

| 状态 | 数量 | 说明 |
|---|---|---|
| **done** | 10 | tbl_task / tbl_disc_lib / tbl_magzines / tbl_slots / tbl_hd_info / tbl_lib_task / tbl_disc / tbl_logical_volume / tbl_volume_slot / tbl_user_task |
| **partial** | 2 | tbl_file / tbl_folder（file-index skeleton + E2E 验证完成，但不是全量同步） |
| **not_started** | 124 | 见矩阵 |
| **hold** | 3 | tbl_device_device / tbl_meta_data / tbl_file_recover_info |
| **local** | 5+ | 见 LOCAL_ONLY |

---

## 五、PG17 / ES / ClickHouse 分层架构

```
┌────────────────────────────────────────────────────────────┐
│                     站点侧 (source_restore)                  │
│  146 张表 (139 静态 + 7 动态)                                 │
└────────────────────────────────────────────────────────────┘
                            │
                  站点定期导出 → 推送 package
                            │
                            ▼
┌────────────────────────────────────────────────────────────┐
│                  总控中心 (unified_disc_platform)             │
│                                                              │
│   ┌────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│   │   PG17         │  │   ES            │  │ ClickHouse  │ │
│   │  ─────         │  │  ───            │  │ ──────      │ │
│   │ A. 30 小表     │  │ C. 10+ 大表     │  │ D. 8 日志   │ │
│   │ B. 18 聚合     │  │   文件/检索     │  │   高频事件  │ │
│   │   unified_*    │  │   file_index    │  │   log_*     │ │
│   └────────────────┘  └────────────────┘  └──────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**核心原则**:
- PG17 **不是站点库副本**——只存业务摘要/索引/状态
- 大表走 ES，全文检索/聚合/统计
- 高频日志走 ClickHouse，时序分析/长保留
- 站点原始数据永远不直接全量复制

---

## 六、后续 Sprint 路线图

### P0: 总控必须马上具备

| 任务 | 理由 |
|---|---|
| **站点包同步接口** `/api/sync/package` | 接收站点推送的 package，校验 + 校验码 + 入库 |
| **table dispatch registry** | 按 tableName 路由到对应 importer（避免 if/else 散落） |
| **站点筛选器** | 总控选择查看哪些站点的数据 |
| **同步日志页面** | 展示 sync_package_log + sync_table_log 状态 |
| **已接入数据页面闭环** | Tasks/Racks/Volumes 已有，需补 Devices 页面+DevicesAPI |

### P1: 下一批小表同步

| 任务 | 理由 |
|---|---|
| **unified_users** + tbl_user | 总控必备用户列表 |
| **unified_sites** + tbl_site | 站点主表，登记总控管辖站点 |
| **unified_platforms** + tbl_platform | 平台主表 |
| **unified_departments** + tbl_depa | 部门 |
| **unified_roles** + tbl_role + tbl_user_role | 角色 |
| **unified_permissions** + tbl_fuc | 权限 |
| **统一权限/角色/部门三件套** | 配合未来登录系统 |

### P2: 大表索引/分析

| 任务 | 理由 |
|---|---|
| **tbl_file / tbl_folder → ES** | 大表检索 / 跨站点搜索 |
| **tbl_sys_log / tbl_api_log → ClickHouse** | 高频日志分析 |
| **dynamic 7 模板表** | 与 tbl_file/tbl_folder 同处理 |
| **tbl_data_receive_*** | 站点间数据接收 |
| **tbl_evidence_*** / **tbl_receipt_*** | 存证/回执 |
| **tbl_check_*** / **tbl_patrol_*** | 巡检 |

### P3: 增强功能

| 任务 | 理由 |
|---|---|
| **审计** | 谁/什么时候/改了什么 |
| **报表** | 周报/月报/年度统计 |
| **运维告警** | 容量/温度/失败 |
| **多站点策略** | 站点隔离/聚合/对比 |
| **ES 全文搜索 UI** | 文件名/路径/哈希检索 |

---

## 七、2D.2 推荐方向

**优先级建议: P0 站点包同步接口 + table dispatch registry**

### 理由

1. **战略落地**: 领导确认的"站点推包，总控接收"目前**只到小表直接 import CLI**。站点侧真正打包推送的能力 (HTTP package 接口 + dispatch registry + 校验) **尚未建立**。

2. **基础设施就绪**:
   - sync_package_log + sync_table_log 已可用
   - file-index importer 已实现 reader/mapper/upsert
   - 9 张小表 importer 已稳定

3. **验证路径清晰**:
   - 只需支持 `tbl_task` + `tbl_disc_lib` 两张表做最小验证
   - dispatch registry 用简单的 table→importer 注册表实现
   - `/api/sync/package` 接收 `multipart/form-data` 或 JSON，校验 siteCode + batchId + checksum，写 package_log，再调用对应 importer

4. **比继续接页面更核心**:
   - 页面接再多，没有"站点→总控"链路就无法投产
   - 站点侧需要这个接口才能真正把数据推过来
   - 是后续 P1/P2/P3 的基础

### 2D.2 范围

| 任务 | 产出 |
|---|---|
| 1. table dispatch registry | `lib/import/dispatch-registry.ts` 注册表 |
| 2. `/api/sync/package` API | `app/api/sync/package/route.ts` |
| 3. package 校验 | siteCode/batchId/checksum 校验 |
| 4. 触发 importer | 通过 registry 调用对应 importer |
| 5. package_log/table_log 写入 | 复用现有日志 |
| 6. tbl_task + tbl_disc_lib 端到端验证 | 用统一 package 跑通两张表 |
| 7. 同步日志页面 | 展示 sync_package_log |

**不包含**:
- 不做 ES
- 不做 ClickHouse
- 不做实时推送（先批 package）
- 不做多站点权限

---

## 八、总结

| 项 | 数值 |
|---|---|
| 总表数 (含动态) | 146 |
| 静态表 | 139 |
| 动态表模板 | 7 |
| A. PG17_FULL_SMALL | 30 |
| B. PG17_AGGREGATE | 18 |
| C. ES_INDEX | 10+ |
| D. CLICKHOUSE_LOG | 8 |
| E. LOCAL_ONLY | 5+ |
| F. TODO_CONFIRM | 3 |
| 当前 done | 10 |
| 当前 partial | 2 |
| 当前 not_started | 124 |
| 当前 hold | 3 |

**2D.2 推荐方向**: 站点包同步接口 `/api/sync/package` + table dispatch registry
