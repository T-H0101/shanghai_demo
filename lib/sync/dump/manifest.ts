/**
 * lib/sync/dump/manifest.ts
 * Sprint R.55 — dump sync contract
 *
 * Whitelist of tables that may be ingested from a pg_dump table_backup.sql.
 * Hash/cipher fields may be carried through as source ciphertext, but must
 * never be decoded or logged as secrets.
 *
 * R.83.1 / R.83.2 / R.83.3: extend whitelist to 58 tables so the dump
 * path mirrors the JSON package path coverage. Forbidden tables
 * (tbl_file, tbl_folder) remain blocked.
 * R.83.4: extend whitelist to 73 tables (存储卷 + 调度/接口 + 设备业务族 15 张)
 * R.83.5: extend whitelist to 88 tables (数据接收 + 告警 + 媒体族 15 张)
 * R.83.6: extend whitelist to 103 tables (ISO + 元数据 + 系统族 15 张)
 */

export const DUMP_ALLOWED_TABLES = [
  // Sprint 2E.2 baseline (13)
  "tbl_task",
  "tbl_disc_lib",
  "tbl_magzines",
  "tbl_slots",
  "tbl_hd_info",
  "tbl_lib_task",
  "tbl_disc",
  "tbl_logical_volume",
  "tbl_volume_slot",
  "tbl_user_task",
  "tbl_user",
  "tbl_site",
  "tbl_platform",
  // R.83.1 部门/项目/任务接收单 15 张
  "tbl_user_role",
  "tbl_depa",
  "tbl_workspace",
  "tbl_workspace_user",
  "tbl_depa_user",
  "tbl_depa_user_info",
  "tbl_project",
  "tbl_project_site",
  "tbl_task_projects",
  "tbl_task_receipts",
  "tbl_task_files",
  "tbl_task_check",
  "tbl_receipt",
  "tbl_receipt_check",
  "tbl_receipt_file",
  // R.83.2 RBAC + 字典 + 日志 + 凭据 15 张
  "tbl_role",
  "tbl_role_fuc",
  "tbl_fuc",
  "tbl_dict_category",
  "tbl_dict",
  "tbl_dict_item",
  "tbl_sys_log",
  "tbl_api_log",
  "tbl_api_interface",
  "tbl_user_mfa",
  "tbl_archives_type",
  "tbl_archives_level",
  "tbl_platform_type",
  "tbl_credible_prove",
  "tbl_credible_verify",
  // R.83.3 检查巡检族 15 张
  "tbl_check_category",
  "tbl_check_sub_category",
  "tbl_check_item",
  "tbl_check_sector",
  "tbl_check_template",
  "tbl_check_task",
  "tbl_check_task_item",
  "tbl_check_task_file",
  "tbl_check_file",
  "tbl_check_files",
  "tbl_check_log",
  "tbl_check_patrol_strategy",
  "tbl_check_patrol_task",
  "tbl_check_patrol_task_item",
  "tbl_check_patrol_log",
  // R.83.4 存储卷 + 调度/接口 + 设备业务族 15 张
  "tbl_volume_group",
  "tbl_volume_dataclass",
  "tbl_volume_depa",
  "tbl_volume_user",
  "tbl_volume_workspace",
  "tbl_schedule_job",
  "tbl_register_management",
  "tbl_interface_task",
  "tbl_hot_backup_record",
  "tbl_hot_restore_record",
  "tbl_device_device",
  "tbl_drivers",
  "tbl_drivers_burn",
  "tbl_raid_group",
  "tbl_hd_manager",
  // R.83.5 数据接收 + 告警 + 媒体族 15 张
  "tbl_data_receive_list",
  "tbl_data_receive_log",
  "tbl_data_receive_tasks",
  "tbl_data_classification",
  "tbl_early_warning",
  "tbl_early_warning_feedback",
  "tbl_disc_print",
  "tbl_disc_inspect",
  "tbl_disc_type",
  "tbl_evidence_details",
  "tbl_evidence_record_drp",
  "tbl_verify_details",
  "tbl_verify_record_drp",
  "tbl_download_record",
  "tbl_upload_record",
  // R.83.6 ISO + 元数据 + 系统族 15 张
  "tbl_iso_location",
  "tbl_iso_task_sync",
  "tbl_meta_data",
  "tbl_sys",
  "tbl_sys_env",
  "tbl_mount_dir",
  "tbl_buffer_dir",
  "tbl_cd_cabinet",
  "tbl_film_operat",
  "tbl_ft_file",
  "tbl_ft_sys",
  "tbl_back_window",
  "tbl_zip_file",
  "tbl_temp_slots",
  "tbl_lib_group",
] as const

export const DUMP_FORBIDDEN_TABLES = ["tbl_file", "tbl_folder"] as const

export const HASH_OR_CIPHER_FIELDS = [
  "encrypt",
  "lib_pwd",
  "password",
  "pwd",
  "password_hash",
] as const

export type DumpAllowedTable = (typeof DUMP_ALLOWED_TABLES)[number]

export interface ParsedDumpTable {
  tableName: DumpAllowedTable
  columns: string[]
  rows: Record<string, string | null>[]
}