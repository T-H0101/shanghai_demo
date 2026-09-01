/**
 * RBAC 菜单/细粒度权限静态自检（不启浏览器）
 * 运行: pnpm exec tsx scripts/e2e/test-rbac-menus.ts
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  BUILTIN_ROLE_PERMISSIONS,
  hasPermission,
  stripLegacyPermissionsForDisplay,
} from "../../lib/auth/permissions-catalog"
import {
  canAccessPath,
  menusForPermissions,
} from "../../lib/auth/menu-permissions"

function check(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`OK  ${msg}`)
}

function main() {
  const auditorMenus = menusForPermissions(BUILTIN_ROLE_PERMISSIONS.auditor)
  check(
    auditorMenus.length === 1 && auditorMenus[0]?.href === "/logs",
    "审计员仅可访问审计日志菜单",
  )
  check(
    !canAccessPath(BUILTIN_ROLE_PERMISSIONS.auditor, "/tasks"),
    "审计员不可访问 /tasks",
  )
  check(
    canAccessPath(BUILTIN_ROLE_PERMISSIONS.auditor, "/logs"),
    "审计员可访问 /logs",
  )

  check(
    !BUILTIN_ROLE_PERMISSIONS.auditor.includes("platform:read"),
    "审计员种子不含 platform:read",
  )

  check(
    hasPermission(["platform:read"], "tasks:read"),
    "legacy platform:read 兼容展开 tasks:read",
  )
  check(
    !hasPermission(["audit:read"], "tasks:read"),
    "仅 audit:read 不能通过 tasks:read",
  )

  const withLegacy = stripLegacyPermissionsForDisplay([
    "audit:read",
    "platform:read",
  ])
  check(
    withLegacy.length === 1 && withLegacy[0] === "audit:read",
    "展示层剥离 platform:read",
  )
  check(
    menusForPermissions(withLegacy).length === 1 &&
      menusForPermissions(withLegacy)[0]?.href === "/logs",
    "剥离后菜单与勾选一致（仅审计）",
  )

  const adminMenus = menusForPermissions(BUILTIN_ROLE_PERMISSIONS.group_admin)
  check(adminMenus.length >= 10, `集团管理员菜单数 >= 10 (实际 ${adminMenus.length})`)

  const sidebar = readFileSync(
    resolve("components/dashboard/sidebar.tsx"),
    "utf8",
  )
  check(sidebar.includes("menusForPermissions"), "侧栏按权限过滤菜单")

  const guard = readFileSync(
    resolve("components/auth/route-guard.tsx"),
    "utf8",
  )
  check(guard.includes("canAccessPath"), "路由守卫校验菜单权限")

  console.log("\nAll rbac menu checks passed.")
}

main()
