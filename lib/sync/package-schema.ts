/**
 * Sync Package Schema
 * Sprint 2D.2 - 站点推包数据格式
 *
 * 最小支持：tbl_task + tbl_disc_lib
 * 严格禁止：tbl_file / tbl_folder
 */

export type PackageMode = 'full' | 'mixed' | 'incremental'
export type TableSyncMode = 'full' | 'incremental' | 'aggregate'
export type TableLogStatus = 'success' | 'failed' | 'skipped' | 'duplicated'

/**
 * 白名单：当前 package 接收的源表
 * Sprint 2D.3: 扩展到 10 张已接入小表
 * Sprint 2E.2: 扩展到 13 张 (含 tbl_user / tbl_site / tbl_platform)
 * R.83.1: 扩展到 28 张 (部门/项目/接收单 15 张)
 * R.83.2: 扩展到 43 张 (RBAC + 字典 + 日志 + 凭据 15 张)
 * R.83.3: 扩展到 58 张 (检查巡检族 15 张)
 * R.83.4: 扩展到 73 张 (存储卷 + 调度/接口 + 设备业务族 15 张)
 * R.83.5: 扩展到 88 张 (数据接收 + 告警 + 媒体族 15 张)
 * R.83.6: 扩展到 103 张 (ISO + 元数据 + 系统族 15 张)
 * R.83.7: 扩展到 118 张 (导入导出 + 监控 + 系统辅助族 15 张)
 * R.83.8: 扩展到 133 张 (任务详情 + 槽位管理族 15 张)
 * R.83.9: 扩展到 141 张 (收尾)
 * 严禁加入 tbl_file / tbl_folder
 */
export const ALLOWED_PACKAGE_TABLES = [
  'tbl_task',
  'tbl_disc_lib',
  'tbl_magzines',
  'tbl_slots',
  'tbl_hd_info',
  'tbl_lib_task',
  'tbl_disc',
  'tbl_logical_volume',
  'tbl_volume_slot',
  'tbl_user_task',
  'tbl_user',
  'tbl_site',
  'tbl_platform',
  // R.83.1 部门/项目/任务接收单 15 张
  'tbl_user_role',
  'tbl_depa',
  'tbl_workspace',
  'tbl_workspace_user',
  'tbl_depa_user',
  'tbl_depa_user_info',
  'tbl_project',
  'tbl_project_site',
  'tbl_task_projects',
  'tbl_task_receipts',
  'tbl_task_files',
  'tbl_task_check',
  'tbl_receipt',
  'tbl_receipt_check',
  'tbl_receipt_file',
  // R.83.2 RBAC + 字典 + 日志 + 凭据 15 张
  'tbl_role',
  'tbl_role_fuc',
  'tbl_fuc',
  'tbl_dict_category',
  'tbl_dict',
  'tbl_dict_item',
  'tbl_sys_log',
  'tbl_api_log',
  'tbl_api_interface',
  'tbl_user_mfa',
  'tbl_archives_type',
  'tbl_archives_level',
  'tbl_platform_type',
  'tbl_credible_prove',
  'tbl_credible_verify',
  // R.83.3 检查巡检族 15 张
  'tbl_check_category',
  'tbl_check_sub_category',
  'tbl_check_item',
  'tbl_check_sector',
  'tbl_check_template',
  'tbl_check_task',
  'tbl_check_task_item',
  'tbl_check_task_file',
  'tbl_check_file',
  'tbl_check_files',
  'tbl_check_log',
  'tbl_check_patrol_strategy',
  'tbl_check_patrol_task',
  'tbl_check_patrol_task_item',
  'tbl_check_patrol_log',
  // R.83.4 存储卷 + 调度/接口 + 设备业务族 15 张
  'tbl_volume_group',
  'tbl_volume_dataclass',
  'tbl_volume_depa',
  'tbl_volume_user',
  'tbl_volume_workspace',
  'tbl_schedule_job',
  'tbl_register_management',
  'tbl_interface_task',
  'tbl_hot_backup_record',
  'tbl_hot_restore_record',
  'tbl_device_device',
  'tbl_drivers',
  'tbl_drivers_burn',
  'tbl_raid_group',
  'tbl_hd_manager',
  // R.83.5 数据接收 + 告警 + 媒体族 15 张
  'tbl_data_receive_list',
  'tbl_data_receive_log',
  'tbl_data_receive_tasks',
  'tbl_data_classification',
  'tbl_early_warning',
  'tbl_early_warning_feedback',
  'tbl_disc_print',
  'tbl_disc_inspect',
  'tbl_disc_type',
  'tbl_evidence_details',
  'tbl_evidence_record_drp',
  'tbl_verify_details',
  'tbl_verify_record_drp',
  'tbl_download_record',
  'tbl_upload_record',
  // R.83.6 ISO + 元数据 + 系统族 15 张
  'tbl_iso_location',
  'tbl_iso_task_sync',
  'tbl_meta_data',
  'tbl_sys',
  'tbl_sys_env',
  'tbl_mount_dir',
  'tbl_buffer_dir',
  'tbl_cd_cabinet',
  'tbl_film_operat',
  'tbl_ft_file',
  'tbl_ft_sys',
  'tbl_back_window',
  'tbl_zip_file',
  'tbl_temp_slots',
  'tbl_lib_group',
  // R.83.7 导入导出 + 监控 + 系统辅助族 15 张
  'tbl_csv_details',
  'tbl_import_folder_data',
  'tbl_import_folder_log',
  'tbl_import_folder_title',
  'tbl_upload_details',
  'tbl_download_details',
  'tbl_export_info',
  'tbl_error_rate',
  'tbl_escape',
  'tbl_remote_backup',
  'tbl_monitor_path',
  'tbl_platform_monitor',
  'tbl_site_monitor',
  'tbl_project_monitor_files',
  'tbl_task_folder',
  // R.83.8 任务详情 + 槽位管理族 15 张
  'tbl_task_items',
  'tbl_task_print',
  'tbl_task_certif_status',
  'tbl_slot_file_1000000',
  'tbl_slot_file_12',
  'tbl_slot_file_13',
  'tbl_slot_file_15',
  'tbl_slot_file_30',
  'tbl_slot_file_31',
  'tbl_slot_folder_1000000',
  'tbl_slot_folder_12',
  'tbl_slot_folder_13',
  'tbl_slot_folder_15',
  'tbl_slot_folder_30',
  'tbl_slot_folder_31',
  // R.83.9 收尾 8 张 (备份辅助 + 磁盘/文件校验 + 硬盘 + 接收单明细 + 槽位分区 + 下载等待族)
  'tbl_backup_db',
  'tbl_disk_check',
  'tbl_diskfile_check',
  'tbl_hd_power',
  'tbl_receipt_file_detail',
  'tbl_slots_part',
  'tbl_wait_download_file',
  'tbl_wait_download_file_task',
] as const
export type AllowedPackageTable = (typeof ALLOWED_PACKAGE_TABLES)[number]

/**
 * 严格禁止的源表
 * 防止站点误推导致全表扫描大表
 */
export const FORBIDDEN_PACKAGE_TABLES = ['tbl_file', 'tbl_folder'] as const

/**
 * 单张表的 payload
 */
export interface SyncPackageTablePayload {
  tableName: AllowedPackageTable
  syncMode: TableSyncMode
  recordCount: number
  /**
   * 真实字段记录（与源表 tbl_task / tbl_disc_lib 字段对应）
   * 不接受 DTO 字段名
   */
  records: Record<string, unknown>[]
}

/**
 * Package 整体 payload
 */
export interface SyncPackagePayload {
  siteCode: string
  batchId: string
  snapshotAt: string
  mode: PackageMode
  version: string
  /**
   * 可选 checksum：站点计算的整包 SHA
   * 当前实现只校验长度非空，不做严格 SHA 校验（TODO: 接入 SHA-256）
   */
  checksum?: string
  tables: SyncPackageTablePayload[]
}

export interface PackageValidationError {
  field: string
  message: string
}

export interface PackageValidationResult {
  valid: boolean
  errors: PackageValidationError[]
}

/**
 * 校验 payload
 * 不通过时返回 400 错误
 */
export function validatePackagePayload(
  payload: unknown
): PackageValidationResult {
  const errors: PackageValidationError[] = []

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: [{ field: 'root', message: 'payload must be object' }] }
  }

  const p = payload as Record<string, unknown>

  if (!p.siteCode || typeof p.siteCode !== 'string') {
    errors.push({ field: 'siteCode', message: 'required string' })
  }
  if (!p.batchId || typeof p.batchId !== 'string') {
    errors.push({ field: 'batchId', message: 'required string' })
  }
  if (!p.snapshotAt || typeof p.snapshotAt !== 'string') {
    errors.push({ field: 'snapshotAt', message: 'required ISO string' })
  }
  if (!p.version || typeof p.version !== 'string') {
    errors.push({ field: 'version', message: 'required string' })
  }
  if (!p.mode || !['full', 'mixed', 'incremental'].includes(p.mode as string)) {
    errors.push({ field: 'mode', message: 'must be full/mixed/incremental' })
  }

  if (!Array.isArray(p.tables) || p.tables.length === 0) {
    errors.push({ field: 'tables', message: 'must be non-empty array' })
  } else {
    const seen = new Set<string>()
    for (let i = 0; i < p.tables.length; i++) {
      const t = p.tables[i] as Record<string, unknown>
      const tableField = `tables[${i}]`

      // 白名单
      if (!ALLOWED_PACKAGE_TABLES.includes(t.tableName as AllowedPackageTable)) {
        errors.push({
          field: `${tableField}.tableName`,
          message: `must be one of ${ALLOWED_PACKAGE_TABLES.join('/')}`,
        })
      }

      // 禁用
      if (FORBIDDEN_PACKAGE_TABLES.includes(t.tableName as never)) {
        errors.push({
          field: `${tableField}.tableName`,
          message: `${t.tableName} is forbidden in package (use file-index instead)`,
        })
      }

      // 重复检测
      if (seen.has(t.tableName as string)) {
        errors.push({
          field: `${tableField}.tableName`,
          message: `duplicate table ${t.tableName}`,
        })
      }
      seen.add(t.tableName as string)

      if (!['full', 'incremental', 'aggregate'].includes(t.syncMode as string)) {
        errors.push({
          field: `${tableField}.syncMode`,
          message: 'must be full/incremental/aggregate',
        })
      }

      if (typeof t.recordCount !== 'number') {
        errors.push({
          field: `${tableField}.recordCount`,
          message: 'must be number',
        })
      }

      if (!Array.isArray(t.records)) {
        errors.push({
          field: `${tableField}.records`,
          message: 'must be array',
        })
      } else if (typeof t.recordCount === 'number' && t.records.length !== t.recordCount) {
        errors.push({
          field: `${tableField}.records`,
          message: `recordCount (${t.recordCount}) !== records.length (${t.records.length})`,
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}