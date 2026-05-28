/**
 * User Adapter - 用户数据适配器
 * 将 Mock/DB 数据转换为 UserDTO
 */

import type { User } from "@/lib/types/user"
import type { UserDTO, UserStatsDTO } from "@/lib/api/dto"

// UserRole 映射 - 从 RoleType 转换
const ROLE_MAP: Record<string, UserDTO["role"]> = {
  super_admin: "admin",
  site_admin: "admin",
  operator: "operator",
  auditor: "operator",
  viewer: "viewer",
}

// 安全的类型转换
function safeAdaptRole(role: string): UserDTO["role"] {
  return ROLE_MAP[role] ?? "viewer"
}

function safeAdaptUserStatus(status: string): UserDTO["status"] {
  if (status === "active" || status === "enabled") return "active"
  if (status === "disabled" || status === "locked") return "disabled"
  return "active"
}

export function adaptUser(user: User): UserDTO {
  return {
    id: user.id,
    username: user.username ?? "",
    displayName: user.displayName ?? user.username ?? "",
    role: safeAdaptRole(user.role ?? "viewer"),
    department: user.department,
    email: user.email,
    phone: user.phone,
    accessibleSites: user.accessibleSites ?? [],
    status: safeAdaptUserStatus(user.status ?? "active"),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.lastLoginAt ?? new Date().toISOString(),
  }
}

export function adaptUserList(users: User[]): UserDTO[] {
  return users.map(adaptUser)
}

export function adaptUserStats(users: User[]): UserStatsDTO {
  const total = users.length
  const active = users.filter(u => u.status === "active").length
  const disabled = users.filter(u => u.status === "disabled" || u.status === "locked").length
  const admins = users.filter(u => u.role === "super_admin" || u.role === "site_admin").length

  return {
    total,
    active,
    disabled,
    admins,
  }
}
