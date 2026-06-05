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
 * 严禁加入 tbl_file / tbl_folder
 */
export const ALLOWED_PACKAGE_TABLES = ['tbl_task', 'tbl_disc_lib'] as const
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