/**
 * GET /api/auth/accounts - Auth 账号列表
 * POST /api/auth/accounts - 创建 Auth 账号
 *
 * Sprint R.27/R.28
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { ensureAuthSchema } from "@/lib/auth/server"
import { hashPassword } from "@/lib/auth/password"
import { writeAudit } from "@/lib/control/audit"

interface AccountRow {
  id: string
  username: string
  display_name: string | null
  role: string
  department: string | null
  accessible_sites: string[] | null
  status: string
  failed_attempts: number
  locked_until: string | null
  last_login_at: string | null
  created_at: string
}

export async function GET(req: NextRequest) {
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
    conditions.push(`(username ILIKE $${idx} OR display_name ILIKE $${idx})`)
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
        `SELECT id::text, username, display_name, role, department, accessible_sites,
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
      { error: e instanceof Error ? e.message : String(e), dataSource: "error" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  await ensureAuthSchema()

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const { username, displayName, role, department, accessibleSites, password } = body ?? {}

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "missing username" }, { status: 400 })
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 })
  }

  const validRoles = ["group_admin", "site_admin", "auditor", "operator", "viewer"]
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: `invalid role, must be one of ${validRoles.join(", ")}` }, { status: 400 })
  }

  try {
    const passwordHash = await hashPassword(password)
    const result = await query(
      `INSERT INTO auth_accounts (username, display_name, password_hash, role, department, accessible_sites, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending_activation')
       RETURNING id::text`,
      [
        username.trim().toLowerCase(),
        displayName ?? null,
        passwordHash,
        role ?? "viewer",
        department ?? null,
        Array.isArray(accessibleSites) ? accessibleSites : [],
      ],
    )

    await writeAudit({
      action: "create_account",
      targetTable: "auth_accounts",
      targetId: result.rows[0]?.id,
      after: { username, role: role ?? "viewer", status: "pending_activation" },
      actor: "admin",
      result: "success",
    })

    return NextResponse.json({
      ok: true,
      account: { id: result.rows[0]?.id, username, status: "pending_activation" },
    }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "username already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
