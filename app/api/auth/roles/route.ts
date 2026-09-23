/**
 * GET /api/auth/roles — 角色列表
 * POST /api/auth/roles — 新建自定义角色
 */

import { NextRequest, NextResponse } from "next/server"
import { query, transaction } from "@/lib/db/postgres"
import { ensureAuthSchema, type AuthRole } from "@/lib/auth/server"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import {
  BUILTIN_ROLE_DESCRIPTIONS,
  BUILTIN_ROLE_ORDER,
  formatRoleLabel,
  groupPermissions,
} from "@/lib/auth/permission-labels"
import {
  ALL_ASSIGNABLE_PERMISSIONS,
  formatPermissionLabel,
  PERMISSION_GROUPS,
  stripLegacyPermissionsForDisplay,
} from "@/lib/auth/permissions-catalog"
import { menusForPermissions } from "@/lib/auth/menu-permissions"
import { writeAudit } from "@/lib/control/audit"

const ROLE_CODE_RE = /^[a-z][a-z0-9_]{1,47}$/

type RoleDto = {
  code: string
  name: string
  description: string
  builtin: boolean
  editable: boolean
  deletable: boolean
  permissions: string[]
  permissionGroups: ReturnType<typeof groupPermissions>
  menus: { href: string; label: string }[]
}

function normalizePermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const allowed = new Set(ALL_ASSIGNABLE_PERMISSIONS)
  const next = Array.from(
    new Set(
      raw
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.trim())
        .filter((p) => allowed.has(p)),
    ),
  )
  const ensureRead = (write: string, read: string) => {
    if (next.includes(write) && !next.includes(read)) next.push(read)
  }
  ensureRead("sync:operate", "sync:read")
  ensureRead("control:submit", "tasks:read")
  ensureRead("task:create", "tasks:read")
  ensureRead("racks:operate", "cage_moves:read")
  ensureRead("users:write", "users:read")
  ensureRead("user:manage", "users:read")
  return next.sort()
}

function toRoleDto(
  code: string,
  name: string,
  description: string,
  builtin: boolean,
  permissions: string[],
): RoleDto {
  // 去掉 UI 不可见的 platform:read，菜单与勾选同源
  const visible = stripLegacyPermissionsForDisplay(permissions)
  return {
    code,
    name,
    description,
    builtin,
    editable: !(builtin && code === "group_admin"),
    deletable: !builtin,
    permissions: visible,
    permissionGroups: groupPermissions(visible),
    menus: menusForPermissions(visible).map((m) => ({
      href: m.href,
      label: m.label,
    })),
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "users:read")
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ code: 500, error: "AUTH_ERROR" }, { status: 500 })
  }

  try {
    await ensureAuthSchema()
    const [roleMeta, permRows] = await Promise.all([
      query<{ code: string; name: string; description: string | null; builtin: boolean }>(
        `SELECT code, name, description, builtin
         FROM auth_roles
         WHERE status = 'active'
         ORDER BY builtin DESC, code ASC`,
      ),
      query<{ role: string; permission: string }>(
        `SELECT role, permission FROM auth_role_permissions ORDER BY role, permission`,
      ),
    ])

    const byRole = new Map<string, string[]>()
    for (const row of permRows.rows) {
      const list = byRole.get(row.role) ?? []
      list.push(row.permission)
      byRole.set(row.role, list)
    }

    const roles: RoleDto[] = []
    const seen = new Set<string>()

    for (const code of BUILTIN_ROLE_ORDER) {
      const meta = roleMeta.rows.find((r) => r.code === code)
      const permissions = byRole.get(code) ?? []
      roles.push(
        toRoleDto(
          code,
          meta?.name ?? formatRoleLabel(code),
          meta?.description ?? BUILTIN_ROLE_DESCRIPTIONS[code as AuthRole] ?? "",
          true,
          permissions,
        ),
      )
      seen.add(code)
    }

    for (const meta of roleMeta.rows) {
      if (seen.has(meta.code)) continue
      roles.push(
        toRoleDto(
          meta.code,
          meta.name,
          meta.description ?? "",
          Boolean(meta.builtin),
          byRole.get(meta.code) ?? [],
        ),
      )
      seen.add(meta.code)
    }

    // 仅有权限行、尚未进 auth_roles 的历史脏数据
    for (const [code, permissions] of byRole) {
      if (seen.has(code)) continue
      roles.push(toRoleDto(code, formatRoleLabel(code), "未登记角色元数据", false, permissions))
    }

    const catalog = PERMISSION_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      items: g.permissions.map((code) => ({
        code,
        label: formatPermissionLabel(code),
      })),
    }))

    return NextResponse.json({
      code: 0,
      data: {
        roles,
        total: roles.length,
        catalog,
        assignablePermissions: ALL_ASSIGNABLE_PERMISSIONS,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { code: 500, message: "未知异常", error: "UNKNOWN_EXCEPTION" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "user:manage")
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ code: 500, error: "AUTH_ERROR" }, { status: 500 })
  }

  let body: {
    code?: unknown
    name?: unknown
    description?: unknown
    permissions?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 400, error: "INVALID_JSON" }, { status: 400 })
  }

  const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : ""
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const description = typeof body.description === "string" ? body.description.trim() : ""

  if (!ROLE_CODE_RE.test(code)) {
    return NextResponse.json(
      {
        code: 400,
        error: "INVALID_ROLE_CODE",
        message: "角色编码须为小写字母开头，仅含字母数字下划线，长度 2–48",
      },
      { status: 400 },
    )
  }
  if (BUILTIN_ROLE_ORDER.includes(code as AuthRole)) {
    return NextResponse.json(
      { code: 409, error: "BUILTIN_CODE", message: "不能占用内置角色编码" },
      { status: 409 },
    )
  }
  if (!name || name.length > 100) {
    return NextResponse.json(
      { code: 400, error: "INVALID_NAME", message: "请填写角色名称（≤100 字）" },
      { status: 400 },
    )
  }

  // 新建时可暂不配权限，创建后在右侧勾选
  const permissions = normalizePermissions(body.permissions ?? [])

  try {
    await ensureAuthSchema()
    const exists = await query<{ code: string }>(
      `SELECT code FROM auth_roles WHERE code = $1 LIMIT 1`,
      [code],
    )
    if (exists.rows[0]) {
      return NextResponse.json(
        { code: 409, error: "ROLE_EXISTS", message: `角色编码已存在: ${code}` },
        { status: 409 },
      )
    }

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO auth_roles(code, name, description, builtin, status)
         VALUES ($1, $2, $3, FALSE, 'active')`,
        [code, name, description || null],
      )
      for (const permission of permissions) {
        await client.query(
          `INSERT INTO auth_role_permissions(role, permission) VALUES ($1, $2)
           ON CONFLICT (role, permission) DO NOTHING`,
          [code, permission],
        )
      }
    })

    await writeAudit({
      action: "role_create",
      targetTable: "auth_roles",
      targetId: code,
      after: { code, name, description, permissions },
      actor: session.username,
      siteCode: session.siteCode,
      result: "success",
    })

    return NextResponse.json(
      {
        code: 0,
        data: toRoleDto(code, name, description, false, permissions),
        message: "角色已创建",
      },
      { status: 201 },
    )
  } catch (e) {
    return NextResponse.json(
      { code: 500, message: "未知异常", error: "UNKNOWN_EXCEPTION" },
      { status: 500 },
    )
  }
}
