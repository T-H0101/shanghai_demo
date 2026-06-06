/**
 * User/Site/Platform Mapper
 * Sprint 2E.2
 *
 * 脱敏敏感字段: pwd, root_pwd, password, password_salt, token, secret, key
 * 不伪造字段: 源表没有的字段统一 null
 */

import type { UnifiedUserRecord, UnifiedSiteRecord, UnifiedPlatformRecord } from './types'

const SENSITIVE_FIELDS = new Set([
  'password',
  'pwd',
  'passwd',
  'root_pwd',
  'token',
  'secret',
  'key',
  'password_salt',
  'password_algo',
  'face_path',
])

/**
 * 脱敏 raw_data: 移除敏感字段
 */
export function sanitizeRawData(row: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (SENSITIVE_FIELDS.has(k.toLowerCase())) {
      clean[k] = '[REDACTED]'
    } else {
      clean[k] = v
    }
  }
  return clean
}

/**
 * mapUser
 * 源表字段: user_id, name, display_name, role_id, login_status, user_type, department, phone, email, pwd, ...
 */
export function mapUser(
  row: Record<string, unknown>,
  siteCode: string
): UnifiedUserRecord {
  return {
    source_site_id: siteCode,
    source_table: 'tbl_user',
    source_id: String(row.user_id ?? ''),
    user_id: row.user_id != null ? String(row.user_id) : null,
    username: (row.name as string) ?? null,
    display_name: (row.display_name as string) ?? (row.real_name as string) ?? null,
    status: mapUserStatus(row.login_status as number | null | undefined),
    role: row.role_id != null ? String(row.role_id) : null,
    department: (row.department as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    raw_data: sanitizeRawData(row),
  }
}

function mapUserStatus(value: number | null | undefined): string | null {
  if (value == null) return null
  if (value === 0) return 'normal'
  if (value === 1) return 'locked'
  return 'unknown'
}

/**
 * mapSite
 * 源表字段: site_id, site_name, s_level, parent, cmt
 */
export function mapSite(
  row: Record<string, unknown>,
  siteCode: string
): UnifiedSiteRecord {
  return {
    source_site_id: siteCode,
    source_table: 'tbl_site',
    source_id: String(row.site_id ?? ''),
    site_code: row.site_id != null ? String(row.site_id) : null,
    site_name: (row.site_name as string) ?? null,
    status: 'active', // 源表无 status 字段
    location: null, // 源表无
    endpoint_url: null, // 源表无
    description: (row.cmt as string) ?? null,
    raw_data: sanitizeRawData(row),
  }
}

/**
 * mapPlatform
 * 源表字段: plat_id, type_id, plat_name, ip, port, user_name, pwd, cmt
 */
export function mapPlatform(
  row: Record<string, unknown>,
  siteCode: string
): UnifiedPlatformRecord {
  const ip = (row.ip as string) ?? null
  const port = (row.port as string) ?? null
  const endpointUrl = ip && port ? `http://${ip}:${port}` : null

  return {
    source_site_id: siteCode,
    source_table: 'tbl_platform',
    source_id: String(row.plat_id ?? ''),
    platform_id: row.plat_id != null ? String(row.plat_id) : null,
    platform_name: (row.plat_name as string) ?? null,
    platform_type: row.type_id != null ? String(row.type_id) : null,
    status: 'active', // 源表无 status 字段
    version: null, // 源表无
    endpoint_url: endpointUrl,
    raw_data: sanitizeRawData(row),
  }
}