# 相关表清单

> 分析时间: 2026-05-28 00:13:31
> 疑似相关表数量: 133

## 任务管理 (24 张)

- `tbl_check_patrol_task_item` - 长期保存巡检任务档案包信息表 (评分: 122, 优先级: P0)
- `tbl_check_task_file` - 四性检测检测任务实际使用的检测文件 (评分: 94, 优先级: P1) ⚠️
- `tbl_check_patrol_task` - 长期保存巡检任务表 (评分: 93, 优先级: P0)
- `tbl_check_task_item` - 四性检测检测任务细目表 (评分: 87, 优先级: P0)
- `tbl_check_task` - 四性检测检测任务表 (评分: 83, 优先级: P0)
- `tbl_task_check` (评分: 63, 优先级: P0)
- `tbl_task` (评分: 62, 优先级: P0)
- `tbl_lib_task` (评分: 61, 优先级: P0)
- `tbl_schedule_job` - 数据分类对应卷 (评分: 55, 优先级: P0)
- `tbl_task_certif_status` (评分: 55, 优先级: P0)
- `tbl_interface_task` - for Restful API (评分: 54, 优先级: P0)
- `tbl_task_file_` (评分: 45, 优先级: P1) ⚠️
- `tbl_task_items` (评分: 40, 优先级: P0)
- `tbl_task_error_file` - 巡检任务包内错误文件表 (评分: 37, 优先级: P1) ⚠️
- `tbl_iso_task_sync` - iso任务同步表 (评分: 37, 优先级: P1)
- `tbl_user_task` (评分: 35, 优先级: P1)
- `tbl_task_projects` - 任务-项目关联表 (评分: 35, 优先级: P1)
- `tbl_task_folder` (评分: 34, 优先级: P1) ⚠️
- `tbl_wait_download_file_task` - 待下载文件和任务关联表 (评分: 32, 优先级: P1) ⚠️
- `tbl_task_print` - tbl_task_print (评分: 30, 优先级: P1)
- `tbl_task_folder_` (评分: 30, 优先级: P1) ⚠️
- `tbl_task_receipts` - 任务-接收单关联表 (评分: 27, 优先级: P1)
- `tbl_data_receive_tasks` (评分: 27, 优先级: P1)
- `tbl_task_files` (评分: 25, 优先级: P1) ⚠️

## 设备/盘架 (19 张)

- `tbl_disc_lib` - 扩展 设备信息表 (评分: 68, 优先级: P0)
- `tbl_drivers` - 光驱信息表 (评分: 62, 优先级: P0)
- `tbl_disc` - 文件刻录光盘分配表 (评分: 52, 优先级: P0)
- `tbl_hd_info` - 新增 硬盘详细信息 (评分: 51, 优先级: P0)
- `tbl_volume_slot` (评分: 38, 优先级: P1)
- `tbl_slot_file_` (评分: 38, 优先级: P1) ⚠️
- `tbl_drivers_burn` - 光盘刻录统计表 (评分: 36, 优先级: P1)
- `tbl_hd_power` - 新增 硬盘加电记录 (评分: 36, 优先级: P1)
- `tbl_user_slots` - 用户分配介质 (评分: 36, 优先级: P1)
- `tbl_slots` - 扩展 光盘信息，介质信息 (评分: 35, 优先级: P1)
- `tbl_disc_inspect` (评分: 32, 优先级: P1)
- `tbl_magzines` - 扩展 光盘盘笼，硬盘托盘 (评分: 29, 优先级: P1)
- `tbl_slot_folder_` (评分: 28, 优先级: P1) ⚠️
- `tbl_lib_group` - 设备分组 (评分: 25, 优先级: P1)
- `tbl_disc_type` (评分: 21, 优先级: P2)
- `tbl_device_device` - 设备关联表 (评分: 21, 优先级: P2)
- `tbl_disc_print` - 光盘打印表 (评分: 18, 优先级: P2)
- `tbl_slots_part` - 新增 硬盘分区信息 (评分: 15, 优先级: P2)
- `tbl_hd_manager` - 介质管理流程表 (评分: 15, 优先级: P2)

## 存储卷 (7 张)

- `tbl_logical_volume` (评分: 42, 优先级: P1) ⚠️
- `tbl_volume_group` - 新增 卷组 (评分: 20, 优先级: P2)
- `tbl_volume_user` (评分: 20, 优先级: P2)
- `tbl_volume_depa` - 部门卷关联表 (评分: 20, 优先级: P2)
- `tbl_volume_workspace` - 工作区卷关联表 (评分: 20, 优先级: P2)
- `tbl_volume_dataclass` - 数据分类对应卷 (评分: 12, 优先级: P2)
- `tbl_mount_dir` (评分: 10, 优先级: P2)

## 文件/数据 (26 张)

- `tbl_diskfile_check` (评分: 49, 优先级: P1) ⚠️
- `tbl_file_path_archive` - for Restful API (评分: 47, 优先级: P1) ⚠️
- `tbl_file_path_restore` - for Restful API (评分: 44, 优先级: P1) ⚠️
- `tbl_iso_location` - iso存储位置信息表 (评分: 40, 优先级: P0)
- `tbl_project_monitor_files` - 任务中每个设备对应的需下载的视频文件 (评分: 38, 优先级: P1) ⚠️
- `tbl_check_files` - 四性检测检测所使用的检测文件 (评分: 35, 优先级: P1) ⚠️
- `tbl_check_file` (评分: 34, 优先级: P1) ⚠️
- `tbl_ft_file` (评分: 29, 优先级: P1) ⚠️
- `tbl_file` (评分: 23, 优先级: P2) ⚠️
- `tbl_import_folder_log` - 导入目录检索文件记录表 (评分: 23, 优先级: P2) ⚠️
- `tbl_file_` (评分: 23, 优先级: P2) ⚠️
- `tbl_archives_type` - 档案类型表 (评分: 20, 优先级: P2)
- `tbl_archives_level` - 档案类型层级表 (评分: 20, 优先级: P2)
- `tbl_file_path_temp_` (评分: 19, 优先级: P2) ⚠️
- `tbl_zip_file` (评分: 17, 优先级: P2) ⚠️
- `tbl_file_recover_info` - 文件恢复记录表 (评分: 17, 优先级: P2) ⚠️
- `tbl_file_stat` - 文件类型统计 (评分: 14, 优先级: P2) ⚠️
- `tbl_receipt_file` (评分: 13, 优先级: P2) ⚠️
- `tbl_file_parts` (评分: 12, 优先级: P2) ⚠️
- `tbl_monitor_path` (评分: 10, 优先级: P2)
- `tbl_wait_download_file` - 待下载文件表 (评分: 10, 优先级: P2) ⚠️
- `tbl_folder` (评分: 8, 优先级: P2) ⚠️
- `tbl_receipt_file_detail` (评分: 8, 优先级: P2) ⚠️
- `tbl_folder_` (评分: 8, 优先级: P2) ⚠️
- `tbl_import_folder_title` - 导入目录检索表头字典 (评分: 5, 优先级: P3) ⚠️
- `tbl_import_folder_data` - 导入目录检索数据表 (评分: 5, 优先级: P3) ⚠️

## 告警/日志 (17 张)

- `tbl_check_patrol_log` - 长期保存巡检过程信息记录表 (评分: 77, 优先级: P1) ⚠️
- `tbl_check_log` - 四性检测检测过程信息记录表 (评分: 62, 优先级: P1) ⚠️
- `tbl_check_patrol_strategy` - 长期保存巡检策略 (评分: 55, 优先级: P0)
- `tbl_disk_check` (评分: 52, 优先级: P0)
- `tbl_check_item` - 四性检测检测项目表 (评分: 40, 优先级: P0)
- `tbl_check_sector` - 电子档案检测环节表，主要存储档案管理的环节及相关说明 (评分: 30, 优先级: P1)
- `tbl_check_template` - 电子档案检测模板表 (评分: 30, 优先级: P1)
- `tbl_check_category` - 电子档案检测类别表 (评分: 30, 优先级: P1)
- `tbl_check_sub_category` - 电子档案检测子类别表 (评分: 30, 优先级: P1)
- `tbl_receipt_check` (评分: 25, 优先级: P1)
- `tbl_inspect_zip` - 巡检包记录表 (评分: 24, 优先级: P2)
- `tbl_sys_log` - for Restful API (评分: 22, 优先级: P2) ⚠️
- `tbl_inspect_stat` - 巡检对象统计表 (评分: 15, 优先级: P2)
- `tbl_site_monitor` - 房间对应监控设备 (评分: 10, 优先级: P2)
- `tbl_platform_monitor` - 平台管理的所有监控设备getCamearaList (评分: 10, 优先级: P2)
- `tbl_data_receive_log` - 接收单操作记录 (评分: 10, 优先级: P2) ⚠️
- `tbl_api_log` - S3日志 (评分: 10, 优先级: P2) ⚠️

## 用户/权限 (10 张)

- `tbl_depa_user_info` - 部门用户权限表 (评分: 26, 优先级: P1)
- `tbl_depa` - 部门表 (评分: 21, 优先级: P2)
- `tbl_user` (评分: 18, 优先级: P2)
- `tbl_workspace` - 工作区 (评分: 17, 优先级: P2)
- `tbl_workspace_user` (评分: 16, 优先级: P2)
- `tbl_user_role` - 用户角色关联表 (评分: 16, 优先级: P2)
- `tbl_depa_user` - 部门用户关联表 (评分: 16, 优先级: P2)
- `tbl_user_mfa` - ====================================================== (评分: 13, 优先级: P2)
- `tbl_role` - 角色 (评分: 8, 优先级: P2)
- `tbl_role_fuc` - 角色对应权限 (评分: 8, 优先级: P2)

## 系统配置 (6 张)

- `tbl_sys_env` - 库房环境表 (评分: 10, 优先级: P2)
- `tbl_dict_category` - 数据字典分类 (评分: 10, 优先级: P2)
- `tbl_dict` - 数据字典 (评分: 10, 优先级: P2)
- `tbl_dict_item` - 数据字典项 (评分: 10, 优先级: P2)
- `tbl_project_site` - 任务对应房间 (评分: 8, 优先级: P2)
- `tbl_sys` - 系统信息 (评分: 3, 优先级: P3)

