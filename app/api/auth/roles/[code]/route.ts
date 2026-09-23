/**
 * PUT    /api/auth/roles/[code]  — 更新权限矩阵
 * PATCH  /api/auth/roles/[code]  — 更新名称/说明（仅非内置）
 * DELETE /api/auth/roles/[code]  — 删除自定义角色
 */

import { NextRequest, NextResponse } from "next/server"
import { query, transaction } from "@/lib/db/postgres"
import { ensureAuthSchema, type AuthRole } from "@/lib/auth/server"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { BUILTIN_ROLE_ORDER, formatRoleLabel } from "@/lib/auth/permission-labels"
import {
  ALL_ASSIGNABLE_PERMISSIONS,
  BUILTIN_ROLE_PERMISSIONS,
  groupPermissions,
} from "@/lib/auth/permissions-catalog"
import { menusForPermissions } from "@/lib/auth/menu-permissions"
import { writeAudit } from "@/lib/control/audit"

type Ctx = { params: Promise<{ code: string }> }

function normalizePermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const allowed = new Set(ALL_ASSIGNABLE_PERMISSIONS)
  const nextPerms = Array.from(
    new Set(
      raw
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.trim())
        .filter((p) => allowed.has(p)),
    ),
  )
  const ensureRead = (write: string, read: string) => {
    if (nextPerms.includes(write) && !nextPerms.includes(read)) nextPerms.push(read)
  }
  ensureRead("sync:operate", "sync:read")
  ensureRead("control:submit", "tasks:read")
  ensureRead("task:create", "tasks:read")
  ensureRead("racks:operate", "cage_moves:read")
  ensureRead("users:write", "users:read")
  ensureRead("user:manage", "users:read")
  return nextPerms.sort()
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "user:manage")
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ code: 500, error: "AUTH_ERROR" }, { status: 500 })
  }

  const { code } = await ctx.params
  const roleCode = code?.trim()
  if (!roleCode) {
    return NextResponse.json({ code: 400, error: "ROLE_REQUIRED" }, { status: 400 })
  }

  if (roleCode === "group_admin") {
    return NextResponse.json(
      { code: 403, error: "GROUP_ADMIN_LOCKED", message: "集团管理员权限矩阵不可修改" },
      { status: 403 },
    )
  }

  let body: { permissions?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 400, error: "INVALID_JSON" }, { status: 400 })
  }

  if (!Array.isArray(body.permissions)) {
    return NextResponse.json({ code: 400, error: "PERMISSIONS_ARRAY_REQUIRED" }, { status: 400 })
  }

  const nextPerms = normalizePermissions(body.permissions)

  try {
    await ensureAuthSchema()

    const before = await query<{ permission: string }>(
      `SELECT permission FROM auth_role_permissions WHERE role = $1 ORDER BY permission`,
      [roleCode],
    )
    const beforePerms = before.rows.map((r) => r.permission)

    const meta = await query<{ code: string; name: string; builtin: boolean }>(
      `SELECT code, name, builtin FROM auth_roles WHERE code = $1 LIMIT 1`,
      [roleCode],
    )
    const isBuiltin = BUILTIN_ROLE_ORDER.includes(roleCode as AuthRole)
    if (!meta.rows[0] && !isBuiltin && beforePerms.length === 0) {
      return NextResponse.json(
        { code: 404, error: "ROLE_NOT_FOUND", message: `角色不存在: ${roleCode}` },
        { status: 404 },
      )
    }

    await transaction(async (client) => {
      await client.query(`DELETE FROM auth_role_permissions WHERE role = $1`, [roleCode])
      for (const permission of nextPerms) {
        await client.query(
          `INSERT INTO auth_role_permissions(role, permission) VALUES ($1, $2)`,
          [roleCode, permission],
        )
      }
    })

    await writeAudit({
      action: "role_permissions_update",
      targetTable: "auth_role_permissions",
      targetId: roleCode,
      before: { permissions: beforePerms },
      after: { permissions: nextPerms },
      actor: session.username,
      siteCode: session.siteCode,
      result: "success",
    })

    const name = meta.rows[0]?.name ?? formatRoleLabel(roleCode)

    return NextResponse.json({
      code: 0,
      data: {
        code: roleCode,
        name,
        permissions: nextPerms,
        permissionGroups: groupPermissions(nextPerms),
        menus: menusForPermissions(nextPerms).map((m) => ({
          href: m.href,
          label: m.label,
        })),
        builtin: isBuiltin,
        editable: true,
        deletable: !isBuiltin,
        defaultMatrix: isBuiltin
          ? BUILTIN_ROLE_PERMISSIONS[roleCode as AuthRole]
          : undefined,
      },
      message: "角色权限已更新；相关用户重新登录后生效",
    })
  } catch (e) {
    return NextResponse.json(
      { code: 500, message: "未知异常", error: "UNKNOWN_EXCEPTION" },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "user:manage")
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ code: 500, error: "AUTH_ERROR" }, { status: 500 })
  }

  const { code } = await ctx.params
  const roleCode = code?.trim()
  if (!roleCode) {
    return NextResponse.json({ code: 400, error: "ROLE_REQUIRED" }, { status: 400 })
  }

  if (BUILTIN_ROLE_ORDER.includes(roleCode as AuthRole)) {
    return NextResponse.json(
      { code: 403, error: "BUILTIN_LOCKED", message: "内置角色名称与说明不可修改" },
      { status: 403 },
    )
  }

  let body: { name?: unknown; description?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 400, error: "INVALID_JSON" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const description =
    typeof body.description === "string" ? body.description.trim() : ""

  if (!name || name.length > 100) {
    return NextResponse.json(
      { code: 400, error: "INVALID_NAME", message: "请填写角色名称（≤100 字）" },
      { status: 400 },
    )
  }

  try {
    await ensureAuthSchema()
    const before = await query<{
      code: string
      name: string
      description: string | null
      builtin: boolean
    }>(
      `SELECT code, name, description, builtin FROM auth_roles WHERE code = $1 LIMIT 1`,
      [roleCode],
    )
    if (!before.rows[0] || before.rows[0].builtin) {
      return NextResponse.json(
        { code: 404, error: "ROLE_NOT_FOUND", message: `自定义角色不存在: ${roleCode}` },
        { status: 404 },
      )
    }

    await query(
      `UPDATE auth_roles
       SET name = $2, description = $3, updated_at = NOW()
       WHERE code = $1 AND builtin = FALSE`,
      [roleCode, name, description || null],
    )

    await writeAudit({
      action: "role_meta_update",
      targetTable: "auth_roles",
      targetId: roleCode,
      before: {
        name: before.rows[0].name,
        description: before.rows[0].description,
      },
      after: { name, description },
      actor: session.username,
      siteCode: session.siteCode,
      result: "success",
    })

    return NextResponse.json({
      code: 0,
      data: { code: roleCode, name, description },
      message: "角色信息已更新",
    })
  } catch (e) {
    return NextResponse.json(
      { code: 500, message: "未知异常", error: "UNKNOWN_EXCEPTION" },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "user:manage")
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ code: 500, error: "AUTH_ERROR" }, { status: 500 })
  }

  const { code } = await ctx.params
  const roleCode = code?.trim()
  if (!roleCode) {
    return NextResponse.json({ code: 400, error: "ROLE_REQUIRED" }, { status: 400 })
  }

  if (BUILTIN_ROLE_ORDER.includes(roleCode as AuthRole)) {
    return NextResponse.json(
      { code: 403, error: "BUILTIN_LOCKED", message: "内置角色不可删除" },
      { status: 403 },
    )
  }

  try {
    await ensureAuthSchema()
    const meta = await query<{ code: string; name: string; builtin: boolean }>(
      `SELECT code, name, builtin FROM auth_roles WHERE code = $1 LIMIT 1`,
      [roleCode],
    )
    if (!meta.rows[0] || meta.rows[0].builtin) {
      return NextResponse.json(
        { code: 404, error: "ROLE_NOT_FOUND", message: `自定义角色不存在: ${roleCode}` },
        { status: 404 },
      )
    }

    const inUse = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM auth_accounts WHERE role = $1`,
      [roleCode],
    )
    const count = Number.parseInt(inUse.rows[0]?.count ?? "0", 10)
    if (count > 0) {
      return NextResponse.json(
        {
          code: 409,
          error: "ROLE_IN_USE",
          message: `仍有 ${count} 个账号使用该角色，请先更换账号角色后再删除`,
        },
        { status: 409 },
      )
    }

    await transaction(async (client) => {
      await client.query(`DELETE FROM auth_role_permissions WHERE role = $1`, [roleCode])
      await client.query(`DELETE FROM auth_roles WHERE code = $1 AND builtin = FALSE`, [roleCode])
    })

    await writeAudit({
      action: "role_delete",
      targetTable: "auth_roles",
      targetId: roleCode,
      before: { code: roleCode, name: meta.rows[0].name },
      actor: session.username,
      siteCode: session.siteCode,
      result: "success",
    })

    return NextResponse.json({
      code: 0,
      data: { code: roleCode },
      message: "角色已删除",
    })
  } catch (e) {
    return NextResponse.json(
      { code: 500, message: "未知异常", error: "UNKNOWN_EXCEPTION" },
      { status: 500 },
    )
  }
}
