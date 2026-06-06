/**
 * User/Site/Platform Types
 * Sprint 2E.2
 *
 * 注意: unified_users 是 Sprint 2B 时期已建的表, 列名固定:
 *   role (非 role_hint), department (非 department_id)
 * 这里只声明实际使用的列。
 */

export interface UnifiedUserRecord {
  source_site_id: string
  source_table: string
  source_id: string
  user_id: string | null
  username: string | null
  display_name: string | null
  status: string | null
  role: string | null
  department: string | null
  phone: string | null
  email: string | null
  raw_data: Record<string, unknown>
}

export interface UnifiedSiteRecord {
  source_site_id: string
  source_table: string
  source_id: string
  site_code: string | null
  site_name: string | null
  status: string | null
  location: string | null
  endpoint_url: string | null
  description: string | null
  raw_data: Record<string, unknown>
}

export interface UnifiedPlatformRecord {
  source_site_id: string
  source_table: string
  source_id: string
  platform_id: string | null
  platform_name: string | null
  platform_type: string | null
  status: string | null
  version: string | null
  endpoint_url: string | null
  raw_data: Record<string, unknown>
}

export type ImportTarget = 'users' | 'sites' | 'platforms' | 'all'