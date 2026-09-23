/**
 * GET /api/auth/account-mappings
 * POST /api/auth/account-mappings
 * REQ-2.2.2 集团 AD ↔ 站点本地账号映射（总控 PG，手改）
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { ensureAuthSchema } from "@/lib/auth/server"
import { requirePermission, requireSession } from "@/lib/auth/middleware"
import { writeAudit } from "@/lib/control/audit"
import type { SiteUserMappingRow } from "@/lib/auth/account-mapping"
import { findAuthAccountForMapping } from "@/lib/auth/account-mapping"

function normalizeOptional(value: unknown): string | null {
  if (typeof value !== "string") return null
  const t = value.trim()
  return t ? t : null
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
  const siteCode = url.searchParams.get("siteCode")?.trim()
  const keyword = url.searchParams.get("keyword")?.trim()
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500)
  const offset = Number(url.searchParams.get("offset") ?? 0)

  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1
  if (siteCode) {
    conditions.push(`m.site_code = $${idx}`)
    params.push(siteCode)
    idx++
  }
  if (keyword) {
    conditions.push(
      `(m.employee_id ILIKE $${idx} OR m.email ILIKE $${idx} OR m.site_local_username ILIKE $${idx} OR a.username ILIKE $${idx})`,
    )
    params.push(`%${keyword}%`)
    idx++
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  try {
    const [countResult, dataResult] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM auth_site_user_mappings m
         LEFT JOIN auth_accounts a ON a.id = m.auth_account_id
         ${where}`,
        params,
      ),
      query<SiteUserMappingRow>(
        `SELECT m.id::text, m.employee_id, m.email, m.auth_account_id::text,
                a.username AS account_username, m.site_code,
                m.site_local_username, m.note, m.created_at::text, m.updated_at::text
         FROM auth_site_user_mappings m
         LEFT JOIN auth_accounts a ON a.id = m.auth_account_id
         ${where}
         ORDER BY m.site_code, m.site_local_username
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
    ])
    return NextResponse.json({
      code: 0,
      dataSource: "database",
      data: {
        items: dataResult.rows,
        total: Number.parseInt(countResult.rows[0]?.count ?? "0", 10),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { code: 500, message: "未知异常" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "users:write")
  } catch (e) {
    if (e instanceof NextResponse) return e
    throw e
  }

  let body: {
    username?: string
    employeeId?: string
    email?: string
    authAccountId?: string
    siteCode?: string
    siteLocalUsername?: string
    note?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 400, message: "invalid json" }, { status: 400 })
  }

  const siteCode = body.siteCode?.trim() ?? ""
  const siteLocalUsername = body.siteLocalUsername?.trim() ?? ""
  const username = normalizeOptional(body.username)
  const authAccountId = normalizeOptional(body.authAccountId)
  if (!siteCode || !siteLocalUsername) {
    return NextResponse.json(
      { code: 400, message: "siteCode and siteLocalUsername are required" },
      { status: 400 },
    )
  }
  if (!username && !authAccountId) {
    return NextResponse.json(
      { code: 400, message: "username or authAccountId is required" },
      { status: 400 },
    )
  }

  await ensureAuthSchema()
  try {
    const account = await findAuthAccountForMapping({
      username,
      authAccountId,
    })
    if (!account) {
      return NextResponse.json({ code: 404, message: "auth account not found" }, { status: 404 })
    }
    const inserted = await query<SiteUserMappingRow>(
      `INSERT INTO auth_site_user_mappings (
         employee_id, email, auth_account_id, site_code, site_local_username, note
       ) VALUES ($1, $2, $3::uuid, $4, $5, $6)
       RETURNING id::text, employee_id, email, auth_account_id::text, site_code,
                 site_local_username, note, created_at::text, updated_at::text`,
      [
        account.employee_id,
        account.email,
        account.id,
        siteCode,
        siteLocalUsername,
        normalizeOptional(body.note),
      ],
    )
    const row = inserted.rows[0]
    const data = { ...row, account_username: account.username }
    await writeAudit({
      action: "create_account_mapping",
      targetTable: "auth_site_user_mappings",
      targetId: row?.id ?? "",
      before: null,
      after: data,
      actor: session.username,
      result: "success",
    })
    return NextResponse.json({ code: 0, data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ code: 409, message: "映射已存在" }, { status: 409 })
    }
    return NextResponse.json({ code: 500, message: "未知异常" }, { status: 500 })
  }
}
