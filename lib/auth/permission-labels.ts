/**
 * 平台 RBAC 权限码 → 中文能力名称
 * 实现已收敛到 permissions-catalog；本文件保留兼容导出。
 */

import type { AuthRole } from "./server"
import {
  formatPermissionLabel as catalogFormatPermissionLabel,
  groupPermissions as catalogGroupPermissions,
  PERMISSION_GROUPS as CATALOG_GROUPS,
  PERMISSION_LABELS as CATALOG_LABELS,
} from "./permissions-catalog"

export const ROLE_LABELS: Record<AuthRole, string> = {
  group_admin: "集团管理员",
  site_admin: "站点管理员",
  auditor: "审计员",
  operator: "操作员",
  viewer: "只读用户",
}

/** 内置角色展示顺序 */
export const BUILTIN_ROLE_ORDER: AuthRole[] = [
  "group_admin",
  "site_admin",
  "operator",
  "auditor",
  "viewer",
]

/** 内置角色说明 */
export const BUILTIN_ROLE_DESCRIPTIONS: Record<AuthRole, string> = {
  group_admin: "管理全部站点与平台配置，拥有最高操作权限。",
  site_admin: "管理授权站点内的同步、任务控制与盘笼移位等。",
  operator: "在授权站点内提交任务控制与创建相关操作。",
  auditor: "仅查看审计日志，不参与业务读写。",
  viewer: "只读查看业务数据，不可写操作。",
}

export const PERMISSION_LABELS = CATALOG_LABELS
export const PERMISSION_GROUPS = CATALOG_GROUPS

export function formatPermissionLabel(permission: string): string {
  return catalogFormatPermissionLabel(permission)
}

export function formatRoleLabel(role: string): string {
  return ROLE_LABELS[role as AuthRole] ?? role
}

export function groupPermissions(permissions: string[]) {
  return catalogGroupPermissions(permissions)
}
