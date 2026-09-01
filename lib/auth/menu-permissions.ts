/**
 * 侧栏菜单 ↔ 权限码映射（单一真相）
 * 菜单显隐由权限推导，不另存 role_menus。
 */

import { expandPermissions, hasAnyPermission } from "./permissions-catalog"

export type MenuDef = {
  href: string
  label: string
  /** 拥有其中任一权限即可看到该菜单 */
  anyOf: string[]
}

/** 与 components/dashboard/sidebar.tsx 菜单顺序对齐 */
export const PLATFORM_MENUS: MenuDef[] = [
  { href: "/", label: "控制台", anyOf: ["dashboard:read"] },
  { href: "/sites", label: "站点管理", anyOf: ["sites:list"] },
  { href: "/search", label: "统一检索", anyOf: ["search:read"] },
  { href: "/sync", label: "同步中心", anyOf: ["sync:read", "sync:operate"] },
  { href: "/tasks", label: "任务管理", anyOf: ["tasks:read"] },
  { href: "/racks", label: "设备管理", anyOf: ["racks:read"] },
  { href: "/volumes", label: "存储卷管理", anyOf: ["volumes:read"] },
  { href: "/cage-moves", label: "盘笼移位", anyOf: ["cage_moves:read", "racks:operate"] },
  { href: "/early-warning", label: "站点预警", anyOf: ["early_warning:read"] },
  { href: "/users", label: "用户与权限", anyOf: ["users:read"] },
  { href: "/logs", label: "审计日志", anyOf: ["audit:read"] },
]

export function menusForPermissions(permissions: string[]): MenuDef[] {
  return PLATFORM_MENUS.filter((m) => hasAnyPermission(permissions, m.anyOf))
}

export function canAccessPath(permissions: string[], pathname: string): boolean {
  const menu = matchMenuForPath(pathname)
  if (!menu) return true // 未登记路径：仅要求已登录（由 RouteGuard 处理）
  return hasAnyPermission(permissions, menu.anyOf)
}

export function matchMenuForPath(pathname: string): MenuDef | null {
  const path = pathname.split("?")[0] || "/"
  if (path === "/") {
    return PLATFORM_MENUS.find((m) => m.href === "/") ?? null
  }
  const ranked = PLATFORM_MENUS
    .filter((m) => m.href !== "/" && (path === m.href || path.startsWith(`${m.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)
  return ranked[0] ?? null
}

/** 无当前页权限时，跳转到第一个可访问菜单 */
export function firstAccessibleHref(permissions: string[]): string {
  const menus = menusForPermissions(permissions)
  return menus[0]?.href ?? "/login"
}

export function effectivePermissionList(permissions: string[]): string[] {
  return Array.from(expandPermissions(permissions)).sort()
}
