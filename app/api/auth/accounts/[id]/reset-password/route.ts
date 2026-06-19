/**
 * POST /api/auth/accounts/[id]/reset-password - 重置密码
 *
 * REQ-3.1.3: 支持管理员重置密码
 *
 * Sprint R.28
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { ensureAuthSchema } from "@/lib/auth/server"
import { hashPassword } from "@/lib/auth/password"
import { writeAudit } from "@/lib/control/audit"
import { randomBytes } from "crypto"

function generatePassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*"
  const bytes = randomBytes(length)
  return Array.from(bytes, (b) => chars[b % chars.length]).join("")
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureAuthSchema()
  const { id } = await params

  try {
    const account = await query(
      `SELECT id::text, username FROM auth_accounts WHERE id = $1::uuid LIMIT 1`,
      [id],
    )

    if (account.rows.length === 0) {
      return NextResponse.json({ error: "account not found" }, { status: 404 })
    }

    const newPassword = generatePassword()
    const passwordHash = await hashPassword(newPassword)

    await query(
      `UPDATE auth_accounts SET password_hash = $1, failed_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $2::uuid`,
      [passwordHash, id],
    )

    await writeAudit({
      action: "reset_password",
      targetTable: "auth_accounts",
      targetId: id,
      before: { username: account.rows[0].username },
      after: { password_reset: true },
      actor: "admin",
      result: "success",
    })

    return NextResponse.json({
      ok: true,
      message: `密码已重置，请妥善保管`,
      newPassword,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
