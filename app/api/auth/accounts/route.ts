/**
 * GET /api/auth/accounts - Auth 账号列表
 * POST /api/auth/accounts - 创建 Auth 账号
 *
 * REQ-3.1.3 账号生命周期管理
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { ensureAuthSchema, roleExists } from "@/lib/auth/server"
import { hashPassword } from "@/lib/auth/password"
import { writeAudit } from "@/lib/control/audit"
import { requireSession, requirePermission } from "@/lib/auth/middleware"

const VALID_BUILTIN_ROLES = ["group_admin", "site_admin", "auditor", "operator", "viewer"] as const

async function assertValidRole(role: string): Promise<string | null> {
  if (VALID_BUILTIN_ROLES.includes(role as (typeof VALID_BUILTIN_ROLES)[number])) return null
  if (await roleExists(role)) return null
  return `invalid role: ${role}`
}

interface AccountRow {
  id: string
  username: string
  display_name: string | null
  role: string
  department: string | null
  employee_id: string | null
  email: string | null
  accessible_sites: string[] | null
  status: string
  failed_attempts: number
  locked_until: string | null
  last_login_at: string | null
  created_at: string
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const t = value.trim()
  return t ? t : null
}

function uniqueConflictMessage(msg: string): string {
  if (msg.includes("idx_auth_accounts_employee_id")) return "employee_id already exists"
  if (msg.includes("idx_auth_accounts_email")) return "email already exists"
  if (msg.includes("username") || msg.includes("auth_accounts_username")) return "username already exists"
  return "username, employee_id or email already exists"
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "users:read")
  } catch (e) {
    if (e instanceof NextResponse) return e
    throw e
  }

  await ensureAuthSchema()

  const url = new URL(req.url)
  const keyword = url.searchParams.get("keyword") ?? undefined
  const status = url.searchParams.get("status") ?? undefined
  const role = url.searchParams.get("role") ?? undefined
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500)
  const offset = Number(url.searchParams.get("offset") ?? 0)

  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (keyword) {
    conditions.push(
      `(username ILIKE $${idx} OR display_name ILIKE $${idx} OR employee_id ILIKE $${idx} OR email ILIKE $${idx})`,
    )
    params.push(`%${keyword}%`)
    idx++
  }
  if (status) {
    conditions.push(`status = $${idx}`)
    params.push(status)
    idx++
  }
  if (role) {
    conditions.push(`role = $${idx}`)
    params.push(role)
    idx++
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  try {
    const [countResult, dataResult] = await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM auth_accounts ${where}`, params),
      query<AccountRow>(
        `SELECT id::text, username, display_name, role, department, employee_id, email, accessible_sites,
                status, failed_attempts, locked_until::text, last_login_at::text, created_at::text
         FROM auth_accounts
         ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
    ])

    return NextResponse.json({
      ok: true,
      data: {
        items: dataResult.rows,
        total: Number.parseInt(countResult.rows[0]?.count ?? "0", 10),
        limit,
        offset,
      },
      dataSource: "database",
    })
  } catch (e) {
    return NextResponse.json(
      { message: "未知异常", error: "UNKNOWN_EXCEPTION", dataSource: "error" },
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
    throw e
  }

  await ensureAuthSchema()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const username = body.username
  const displayName = body.displayName
  const role = body.role
  const department = body.department
  const accessibleSites = body.accessibleSites
  const password = body.password
  const status = body.status

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "missing username" }, { status: 400 })
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 })
  }

  const resolvedRole = typeof role === "string" ? role : "viewer"
  const roleError = await assertValidRole(resolvedRole)
  if (roleError) {
    return NextResponse.json({ error: roleError }, { status: 400 })
  }

  const resolvedStatus =
    status === "pending_activation" || status === "disabled" || status === "active"
      ? status
      : "active"

  const sites = Array.isArray(accessibleSites)
    ? accessibleSites.map(String)
    : resolvedRole === "group_admin"
      ? ["*"]
      : []

  try {
    const passwordHash = await hashPassword(password)
    const uname = username.trim().toLowerCase()
    const employeeId = optionalText(body.employeeId)
    const email = optionalText(body.email)
    const result = await query(
      `INSERT INTO auth_accounts (
         username, display_name, password_hash, role, department, accessible_sites, status,
         employee_id, email
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id::text`,
      [
        uname,
        typeof displayName === "string" ? displayName : null,
        passwordHash,
        resolvedRole,
        typeof department === "string" ? department : null,
        sites,
        resolvedStatus,
        employeeId,
        email,
      ],
    )

    await writeAudit({
      action: "create_account",
      targetTable: "auth_accounts",
      targetId: result.rows[0]?.id,
      after: {
        username: uname,
        role: resolvedRole,
        status: resolvedStatus,
        accessible_sites: sites,
        employee_id: employeeId,
        email,
      },
      actor: session.username,
      result: "success",
    })

    return NextResponse.json(
      {
        ok: true,
        account: {
          id: result.rows[0]?.id,
          username: uname,
          status: resolvedStatus,
          role: resolvedRole,
          employeeId,
          email,
        },
      },
      { status: 201 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: uniqueConflictMessage(msg), message: "账号信息冲突，请检查工号或邮箱" }, { status: 409 })
    }
    return NextResponse.json({ message: "未知异常", error: "UNKNOWN_EXCEPTION" }, { status: 500 })
  }
}
