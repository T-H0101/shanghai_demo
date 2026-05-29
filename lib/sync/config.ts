/**
 * 同步模块统一配置
 * Sprint 2B.3.1 - 硬编码清理
 */

// 默认站点代码
export const DEFAULT_SITE_CODE = 'SH01'

// Tasks 同步对象配置
export const TASK_SYNC_CONFIG = {
  sourceTable: 'tbl_task',
  targetTable: 'unified_tasks',
  mockSourceTable: 'mock_tbl_task',
  sourceSiteCode: DEFAULT_SITE_CODE,
} as const

// 类型定义
export interface SyncObjectConfig {
  sourceTable: string
  targetTable: string
  mockSourceTable: string
  sourceSiteCode: string
}