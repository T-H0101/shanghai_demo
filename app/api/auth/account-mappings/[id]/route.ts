/**
 * PATCH / DELETE /api/auth/account-mappings/[id]
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { ensureAuthSchema } from "@/lib/auth/server"
import { requirePermission, requireSession } from "@/lib/auth/middleware"
import { writeAudit } from "@/lib/control/audit"
import type { SiteUserMappingRow } from "@/lib/auth/account-mapping"
import { findAuthAccountForMapping } from "@/lib/auth/account-mapping"

function normalizeOptional(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "string") return null
  const t = value.trim()
  return t ? t : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "users:write")
  } catch (e) {
    if (e instanceof NextResponse) return e
    throw e
  }

  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 400, message: "invalid json" }, { status: 400 })
  }

  await ensureAuthSchema()
  const existing = await query<SiteUserMappingRow>(
    `SELECT m.id::text, m.employee_id, m.email, m.auth_account_id::text,
            a.username AS account_username, m.site_code,
            m.site_local_username, m.note, m.created_at::text, m.updated_at::text
     FROM auth_site_user_mappings m
     LEFT JOIN auth_accounts a ON a.id = m.auth_account_id
     WHERE m.id = $1::uuid LIMIT 1`,
    [id],
  )
  const before = existing.rows[0]
  if (!before) {
    return NextResponse.json({ code: 404, message: "mapping not found" }, { status: 404 })
  }

  const username = normalizeOptional(body.username)
  const authAccountId = normalizeOptional(body.authAccountId)
  const siteCode = typeof body.siteCode === "string" ? body.siteCode.trim() : before.site_code
  const siteLocalUsername =
    typeof body.siteLocalUsername === "string" ? body.siteLocalUsername.trim() : before.site_local_username
  const note = normalizeOptional(body.note)

  try {
    let accountId = authAccountId === undefined ? before.auth_account_id : authAccountId
    let employeeId = before.employee_id
    let email = before.email
    let accountUsername = before.account_username ?? null
    if (username || authAccountId) {
      const account = await findAuthAccountForMapping({
        username: username ?? undefined,
        authAccountId: authAccountId ?? undefined,
      })
      if (!account) {
        return NextResponse.json({ code: 404, message: "auth account not found" }, { status: 404 })
      }
      accountId = account.id
      employeeId = account.employee_id
      email = account.email
      accountUsername = account.username
    }

    const updated = await query<SiteUserMappingRow>(
      `UPDATE auth_site_user_mappings SET
         employee_id = $2,
         email = $3,
         auth_account_id = $4::uuid,
         site_code = $5,
         site_local_username = $6,
         note = COALESCE($7, note),
         updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id::text, employee_id, email, auth_account_id::text, site_code,
                 site_local_username, note, created_at::text, updated_at::text`,
      [
        id,
        employeeId,
        email,
        accountId,
        siteCode,
        siteLocalUsername,
        note === undefined ? before.note : note,
      ],
    )
    const row = { ...updated.rows[0], account_username: accountUsername }
    await writeAudit({
      action: "update_account_mapping",
      targetTable: "auth_site_user_mappings",
      targetId: id,
      before,
      after: row,
      actor: session.username,
      result: "success",
    })
    return NextResponse.json({ code: 0, data: row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ code: 409, message: "mapping already exists" }, { status: 409 })
    }
    return NextResponse.json({ code: 500, message: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "users:write")
  } catch (e) {
    if (e instanceof NextResponse) return e
    throw e
  }

  const { id } = await params
  await ensureAuthSchema()
  const existing = await query<SiteUserMappingRow>(
    `SELECT id::text, employee_id, email, auth_account_id::text, site_code,
            site_local_username, note, created_at::text, updated_at::text
     FROM auth_site_user_mappings WHERE id = $1::uuid LIMIT 1`,
    [id],
  )
  const before = existing.rows[0]
  if (!before) {
    return NextResponse.json({ code: 404, message: "mapping not found" }, { status: 404 })
  }

  await query(`DELETE FROM auth_site_user_mappings WHERE id = $1::uuid`, [id])
  await writeAudit({
    action: "delete_account_mapping",
    targetTable: "auth_site_user_mappings",
    targetId: id,
    before,
    after: null,
    actor: session.username,
    result: "success",
  })
  return NextResponse.json({ code: 0, message: "deleted" })
}
