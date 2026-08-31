/**
 * 平台 RBAC 权限码 → 中文能力名称（短）
 * 用于 403 提示：缺少权限: {能力名称}
 */

import type { AuthRole } from "./server"

export const ROLE_LABELS: Record<AuthRole, string> = {
  group_admin: "集团管理员",
  site_admin: "站点管理员",
  auditor: "审计员",
  operator: "操作员",
  viewer: "只读用户",
}

/** auth_role_permissions.permission → 能力名称（短） */
export const PERMISSION_LABELS: Record<string, string> = {
  "platform:read": "平台数据查看",
  "platform:operate": "平台配置与写操作",
  "users:read": "用户与账号查看",
  "users:write": "账号映射维护",
  "user:manage": "Auth 账号管理",
  "sync:operate": "数据同步操作",
  "control:submit": "任务控制命令提交",
  "task:create": "任务创建",
  "racks:operate": "盘笼移位操作",
  "sites:read": "站点系统跳转",
  "audit:read": "审计日志查看",
}

export function formatPermissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission] ?? permission
}

export function formatRoleLabel(role: string): string {
  return ROLE_LABELS[role as AuthRole] ?? role
}
