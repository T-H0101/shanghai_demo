/**
 * POST /api/auth/change-password — 登录用户修改自己的密码
 *
 * 需校验当前密码；任意已登录用户可用，无需 user:manage。
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { ensureAuthSchema } from "@/lib/auth/server"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { writeAudit } from "@/lib/control/audit"
import { requireSession } from "@/lib/auth/middleware"

const MIN_LEN = 8

export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireSession(req)
  } catch (e) {
    if (e instanceof NextResponse) return e
    throw e
  }

  let body: { currentPassword?: unknown; newPassword?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const currentPassword = body.currentPassword
  const newPassword = body.newPassword

  if (typeof currentPassword !== "string" || !currentPassword) {
    return NextResponse.json({ error: "请填写当前密码" }, { status: 400 })
  }
  if (typeof newPassword !== "string" || newPassword.length < MIN_LEN) {
    return NextResponse.json({ error: `新密码至少 ${MIN_LEN} 位` }, { status: 400 })
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "新密码不能与当前密码相同" }, { status: 400 })
  }

  await ensureAuthSchema()

  try {
    const account = await query<{ id: string; username: string; password_hash: string; status: string }>(
      `SELECT id::text, username, password_hash, status
       FROM auth_accounts
       WHERE id = $1::uuid
       LIMIT 1`,
      [session.id],
    )

    const row = account.rows[0]
    if (!row) {
      return NextResponse.json({ error: "账号不存在" }, { status: 404 })
    }
    if (row.status !== "active") {
      return NextResponse.json({ error: "账号状态异常，无法修改密码" }, { status: 403 })
    }

    const ok = await verifyPassword(currentPassword, row.password_hash)
    if (!ok) {
      return NextResponse.json({ error: "当前密码不正确" }, { status: 401 })
    }

    const passwordHash = await hashPassword(newPassword)
    await query(
      `UPDATE auth_accounts
       SET password_hash = $1, failed_attempts = 0, locked_until = NULL, updated_at = NOW()
       WHERE id = $2::uuid`,
      [passwordHash, row.id],
    )

    await writeAudit({
      action: "change_password",
      targetTable: "auth_accounts",
      targetId: row.id,
      before: { username: row.username },
      after: { password_changed: true },
      actor: session.username,
      result: "success",
    })

    return NextResponse.json({
      ok: true,
      message: "密码已修改，请牢记新密码",
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
