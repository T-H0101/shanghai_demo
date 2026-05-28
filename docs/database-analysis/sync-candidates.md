# 同步候选表清单（修正版）

> 文档版本: v2.0
> 更新时间: 2026-05-28
> 说明: 缩减 P0 到核心表，分层管理

## 统计概览

| 优先级 | 数量 | 说明 |
|--------|------|------|
| **P0** | **10** | **第一批同步 - 核心业务表** |
| **P1** | **15** | **第二批同步 - 业务关联表** |
| **P2** | **40** | **后续同步 - 配置和明细表** |
| **P3** | **81** | **暂不同步 - 系统表/大表/暂缓** |

---

## P0: 核心业务表（第一批同步）

**原则**：只保留支撑首页统计、任务监控、设备管理、存储卷管理、告警管理的核心表。

| 表名 | 说明 | 主键 | 同步策略 |
|------|------|------|----------|
| `tbl_task` | **任务主表**（任务ID、类型、状态、名称、文件数、大小、创建时间） | `id` | 5分钟增量 |
| `tbl_disc_lib` | **设备信息表**（设备ID、状态、IP、类型、容量、片匣数） | `lib_id` | 5分钟增量 |
| `tbl_slots` | **盘位/介质表**（介质ID、序列号、容量、状态） | `slot_id` | 5分钟增量 |
| `tbl_magzines` | **盘笼/托盘表**（片匣ID、RFID、位置） | `mag_id` | 5分钟增量 |
| `tbl_drivers` | **光驱信息表**（光驱ID、序列号、状态、读写时间） | `driver_id` | 5分钟增量 |
| `tbl_hd_info` | **硬盘信息表**（序列号、型号、健康度、SMART状态） | `slot_id` | 5分钟增量 |
| `tbl_logical_volume` | **存储卷表**（卷ID、类型、容量、状态） | `volume_id` | 5分钟增量 |
| `tbl_early_warning` | **告警信息表**（告警ID、级别、类型、时间） | `id` | 1分钟增量 |
| `tbl_lib_group` | **设备分组表**（分组ID、名称、层级） | `id` | 10分钟增量 |
| `tbl_user` | **用户表**（用户ID、姓名、角色） | `user_id` | 10分钟增量 |

---

## P1: 业务关联表（第二批同步）

**原则**：与 P0 核心表关联的业务表，支撑完整业务流程。

| 表名 | 说明 | 关联 P0 表 | 同步策略 |
|------|------|------------|----------|
| `tbl_disc` | 光盘分配表（光盘ID、任务ID、分配信息） | `tbl_task` | 5分钟增量 |
| `tbl_hd_power` | 硬盘加电记录（加电时间、状态） | `tbl_hd_info` | 10分钟增量 |
| `tbl_drivers_burn` | 光驱刻录统计（刻录结果、数据量、时间） | `tbl_drivers` | 10分钟增量 |
| `tbl_disc_type` | 光盘类型表（类型ID、容量） | `tbl_slots` | 静态表 |
| `tbl_volume_slot` | 卷-介质关联表 | `tbl_logical_volume`, `tbl_slots` | 5分钟增量 |
| `tbl_early_warning_feedback` | 告警反馈表 | `tbl_early_warning` | 5分钟增量 |
| `tbl_user_role` | 用户角色关联表 | `tbl_user` | 10分钟增量 |
| `tbl_depa` | 部门表 | `tbl_user` | 静态表 |
| `tbl_role` | 角色表 | `tbl_user_role` | 静态表 |
| `tbl_iso_location` | ISO 存储位置表 | `tbl_task` | 5分钟增量 |
| `tbl_interface_task` | 接口任务表 | `tbl_task` | 5分钟增量 |
| `tbl_backup_db` | 异地备份配置表 | `tbl_task` | 静态表 |
| `tbl_hot_backup_record` | 热备记录表 | `tbl_task` | 5分钟增量 |
| `tbl_hot_restore_record` | 热备恢复记录表 | `tbl_task` | 5分钟增量 |
| `tbl_schedule_job` | 调度任务表 | `tbl_task` | 5分钟增量 |

---

## P2: 配置和明细表（后续同步）

**原则**：系统配置、任务明细、巡检配置等。

| 分类 | 表名 | 说明 |
|------|------|------|
| **任务明细** | `tbl_task_items` | 任务明细表 |
| | `tbl_task_files` | 任务文件关联 |
| | `tbl_task_folder` | 任务文件夹关联 |
| | `tbl_task_certif_status` | 任务校验状态 |
| | `tbl_task_check` | 任务校验表 |
| **巡检配置** | `tbl_check_task` | 四性检测任务 |
| | `tbl_check_task_item` | 检测任务细目 |
| | `tbl_check_patrol_task` | 巡检任务 |
| | `tbl_check_patrol_task_item` | 巡检任务项 |
| | `tbl_check_patrol_strategy` | 巡检策略 |
| | `tbl_check_template` | 检测模板 |
| | `tbl_check_category` | 检测类别 |
| | `tbl_check_sub_category` | 检测子类别 |
| | `tbl_check_item` | 检测项 |
| | `tbl_check_sector` | 检测扇区 |
| **磁盘检测** | `tbl_disk_check` | 磁盘检测表 |
| | `tbl_diskfile_check` | 磁盘文件检测 |
| **卷配置** | `tbl_volume_group` | 卷组 |
| | `tbl_volume_user` | 卷用户关联 |
| | `tbl_volume_depa` | 卷部门关联 |
| | `tbl_volume_dataclass` | 卷数据分类 |
| **其他** | `tbl_disc_inspect` | 光盘检测 |
| | `tbl_disc_print` | 光盘打印 |
| | `tbl_iso_task_sync` | ISO任务同步 |
| | `tbl_hd_manager` | 硬盘管理 |
| | `tbl_register_management` | 介质登记 |

---

## P3: 暂不同步（暂缓）

**分类**：

### 1. 疑似大表（文件级数据）
| 表名 | 说明 |
|------|------|
| `tbl_file` | 文件主表（可能几千万行） |
| `tbl_folder` | 文件夹表 |
| `tbl_zip_file` | 压缩包文件表 |
| `tbl_ft_file` | 文件传输表 |
| `tbl_file_parts` | 文件分片表 |
| `tbl_file_path_archive` | 归档文件路径 |
| `tbl_file_path_restore` | 恢复文件路径 |
| `tbl_task_files` | 任务文件关联（明细） |
| `tbl_task_folder` | 任务文件夹（明细） |
| `tbl_project_monitor_files` | 项目监控文件 |
| `tbl_check_file` / `tbl_check_files` | 检测文件表 |
| `tbl_check_task_file` | 检测任务文件 |
| `tbl_import_folder_*` | 导入文件夹日志 |
| `tbl_sys_log` | 系统日志（可能很大） |

### 2. 系统配置表（暂不需要）
| 表名 | 说明 |
|------|------|
| `tbl_dict` / `tbl_dict_category` / `tbl_dict_item` | 数据字典 |
| `tbl_platform` / `tbl_platform_type` | 平台配置 |
| `tbl_site` | 站点配置 |
| `tbl_sys_env` | 系统环境 |
| `tbl_api_interface` / `tbl_api_log` | API配置/日志 |

### 3. 导出/下载相关表（暂缓）
| 表名 | 说明 |
|------|------|
| `tbl_export_info` | 导出信息 |
| `tbl_download_record` / `tbl_download_details` | 下载记录 |
| `tbl_upload_record` / `tbl_upload_details` | 上传记录 |
| `tbl_wait_download_file` / `tbl_wait_download_file_task` | 待下载文件 |

### 4. 动态表名（分库分表）
| 表名 | 说明 |
|------|------|
| `tbl_file_{siteId}` | 按站点分库的文件表 |
| `tbl_folder_{siteId}` | 按站点分库的文件夹表 |
| `tbl_slot_file_{siteId}` | 槽位文件关联 |
| `tbl_slot_folder_{siteId}` | 槽位文件夹关联 |
| `tbl_task_file_{siteId}` | 任务文件关联 |
| `tbl_task_folder_{siteId}` | 任务文件夹关联 |
| `tbl_certif_record_{siteId}_{maxFileId}` | 证书记录 |

---

## 同步优先级决策树

```
这张表是否支撑以下功能？
├─ 首页统计（任务数、设备数、容量、告警数）
├─ 任务管理（任务列表、状态、进度）
├─ 设备管理（设备状态、在线/离线）
├─ 存储卷管理（卷容量、使用率）
└─ 告警管理（告警列表、处理状态）

如果是 → 进入 P0/P1
如果不是 → 检查是否是关联表
    ├─ 是关联表 → P1/P2
    └─ 不是 → 检查是否是大表/系统表
        ├─ 是 → P3
        └─ 不是 → P2
```
