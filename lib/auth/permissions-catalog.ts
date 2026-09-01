/**
 * 总控 RBAC 权限目录与内置角色矩阵（中期细粒度）
 *
 * - 菜单 / API / 按钮共用同一套权限码
 * - platform:read 仅作兼容别名：拥有它 ≈ 拥有全部业务 *:read
 * - 新角色禁止再授 platform:read（由 UI 字典不展示写入）
 */

/** 与 AuthRole 对齐；本文件不依赖 server 以免循环引用 */
export type BuiltinRoleCode =
  | "group_admin"
  | "site_admin"
  | "auditor"
  | "operator"
  | "viewer"

/** 业务只读权限（可被 legacy platform:read 展开） */
export const READ_PERMISSIONS = [
  "dashboard:read",
  "sites:list",
  "search:read",
  "sync:read",
  "tasks:read",
  "racks:read",
  "volumes:read",
  "cage_moves:read",
  "early_warning:read",
  "users:read",
  "audit:read",
] as const

export type ReadPermission = (typeof READ_PERMISSIONS)[number]

/** 写/操作类权限 */
export const WRITE_PERMISSIONS = [
  "sites:read", // 历史码：站点 SSO 跳转
  "sync:operate",
  "control:submit",
  "task:create",
  "racks:operate",
  "users:write",
  "user:manage",
  "platform:operate",
] as const

export const LEGACY_PERMISSIONS = ["platform:read"] as const

export const ALL_ASSIGNABLE_PERMISSIONS: string[] = [
  ...READ_PERMISSIONS,
  ...WRITE_PERMISSIONS,
]

export const PERMISSION_LABELS: Record<string, string> = {
  "dashboard:read": "查看控制台",
  "sites:list": "查看站点列表",
  "sites:read": "跳转站点系统",
  "search:read": "查看统一检索",
  "sync:read": "查看同步中心",
  "sync:operate": "触发数据同步",
  "tasks:read": "查看任务",
  "control:submit": "提交任务控制命令",
  "task:create": "创建任务",
  "racks:read": "查看设备",
  "volumes:read": "查看存储卷",
  "cage_moves:read": "查看盘笼移位",
  "racks:operate": "盘笼移位操作",
  "early_warning:read": "查看站点预警",
  "users:read": "查看用户与账号",
  "users:write": "维护账号映射",
  "user:manage": "管理 Auth 账号",
  "audit:read": "查看审计日志",
  "platform:operate": "平台配置写操作",
  "platform:read": "（兼容）旧版平台只读通行证",
}

/** UI 勾选分组：一级标题与侧栏菜单名对齐 */
export const PERMISSION_GROUPS: { id: string; label: string; permissions: string[] }[] = [
  {
    id: "dashboard",
    label: "控制台",
    permissions: ["dashboard:read"],
  },
  {
    id: "sites",
    label: "站点管理",
    permissions: ["sites:list", "sites:read"],
  },
  {
    id: "search",
    label: "统一检索",
    permissions: ["search:read"],
  },
  {
    id: "sync",
    label: "同步中心",
    permissions: ["sync:read", "sync:operate"],
  },
  {
    id: "tasks",
    label: "任务管理",
    permissions: ["tasks:read", "control:submit", "task:create"],
  },
  {
    id: "racks",
    label: "设备管理",
    permissions: ["racks:read"],
  },
  {
    id: "volumes",
    label: "存储卷管理",
    permissions: ["volumes:read"],
  },
  {
    id: "cage",
    label: "盘笼移位",
    permissions: ["cage_moves:read", "racks:operate"],
  },
  {
    id: "early_warning",
    label: "站点预警",
    permissions: ["early_warning:read"],
  },
  {
    id: "users",
    label: "用户与权限",
    permissions: ["users:read", "users:write", "user:manage"],
  },
  {
    id: "audit",
    label: "审计日志",
    permissions: ["audit:read"],
  },
  {
    id: "config",
    label: "系统配置",
    permissions: ["platform:operate"],
  },
]

/** 内置角色默认权限矩阵（迁移与种子共用） */
export const BUILTIN_ROLE_PERMISSIONS: Record<BuiltinRoleCode, string[]> = {
  group_admin: [
    ...ALL_ASSIGNABLE_PERMISSIONS,
  ],
  site_admin: [
    "dashboard:read",
    "sites:list",
    "sites:read",
    "search:read",
    "sync:read",
    "sync:operate",
    "tasks:read",
    "control:submit",
    "task:create",
    "racks:read",
    "volumes:read",
    "cage_moves:read",
    "racks:operate",
    "early_warning:read",
    "users:read",
  ],
  operator: [
    "dashboard:read",
    "search:read",
    "tasks:read",
    "control:submit",
    "task:create",
    "racks:read",
    "volumes:read",
    "cage_moves:read",
    "early_warning:read",
  ],
  auditor: ["audit:read"],
  viewer: [
    "dashboard:read",
    "sites:list",
    "search:read",
    "sync:read",
    "tasks:read",
    "racks:read",
    "volumes:read",
    "cage_moves:read",
    "early_warning:read",
  ],
}

export const RBAC_MIGRATION_FLAG = "rbac.menu_permissions_v1"
/** 清除 auth_role_permissions 中残留的 platform:read（UI 不展示但会展开为全部 *:read） */
export const RBAC_STRIP_PLATFORM_READ_FLAG = "rbac.strip_platform_read_v1"

/**
 * 角色编辑 / 列表展示用：去掉 UI 不展示的 legacy 码，避免「勾选不全但菜单全亮」。
 * 会话鉴权仍可通过 expandPermissions / hasPermission 兼容持有 platform:read 的旧会话。
 */
export function stripLegacyPermissionsForDisplay(permissions: string[]): string[] {
  return permissions.filter((p) => p !== "platform:read")
}

/**
 * 将会话权限展开为有效集合（兼容 platform:read）
 */
export function expandPermissions(permissions: string[]): Set<string> {
  const set = new Set(permissions)
  if (set.has("platform:read")) {
    for (const p of READ_PERMISSIONS) set.add(p)
  }
  return set
}

export function hasPermission(
  permissions: string[] | undefined | null,
  required: string,
): boolean {
  if (!permissions?.length) return false
  if (permissions.includes(required)) return true
  if (
    (READ_PERMISSIONS as readonly string[]).includes(required) &&
    permissions.includes("platform:read")
  ) {
    return true
  }
  return false
}

export function hasAnyPermission(
  permissions: string[] | undefined | null,
  required: string[],
): boolean {
  return required.some((p) => hasPermission(permissions, p))
}

export function formatPermissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission] ?? permission
}

export function groupPermissions(permissions: string[]): {
  groupId: string
  groupLabel: string
  items: { code: string; label: string }[]
}[] {
  const set = new Set(permissions)
  const used = new Set<string>()
  const groups = PERMISSION_GROUPS.map((g) => {
    const items = g.permissions
      .filter((p) => set.has(p))
      .map((code) => {
        used.add(code)
        return { code, label: formatPermissionLabel(code) }
      })
    return { groupId: g.id, groupLabel: g.label, items }
  }).filter((g) => g.items.length > 0)

  const other = permissions
    .filter((p) => !used.has(p))
    .map((code) => ({ code, label: formatPermissionLabel(code) }))
  if (other.length > 0) {
    groups.push({ groupId: "other", groupLabel: "其他", items: other })
  }
  return groups
}

/** 生成 SCHEMA / 迁移用的 INSERT 行 */
export function builtinRolePermissionInsertValues(): string {
  const rows: string[] = []
  for (const [role, perms] of Object.entries(BUILTIN_ROLE_PERMISSIONS)) {
    for (const p of perms) {
      rows.push(`('${role}', '${p}')`)
    }
  }
  return rows.join(",\n  ")
}
