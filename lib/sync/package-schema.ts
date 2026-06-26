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