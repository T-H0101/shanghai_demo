/**
 * POST /api/auth/accounts/[id]/unlock - 管理员解锁账号
 *
 * REQ-2.2.3: 管理员解锁被锁定的账号
 *
 * Sprint R.27
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { ensureAuthSchema } from "@/lib/auth/server"
import { writeAudit } from "@/lib/control/audit"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureAuthSchema()
  const { id } = await params

  try {
    // Find the account
    const account = await query(
      `SELECT id::text, username, status, failed_attempts, locked_until::text
       FROM auth_accounts WHERE id = $1::uuid LIMIT 1`,
      [id],
    )

    if (account.rows.length === 0) {
      return NextResponse.json({ error: "account not found" }, { status: 404 })
    }

    const before = account.rows[0]

    // Unlock: reset failed_attempts, clear locked_until, set status to active
    await query(
      `UPDATE auth_accounts
       SET failed_attempts = 0, locked_until = NULL, status = 'active', updated_at = NOW()
       WHERE id = $1::uuid`,
      [id],
    )

    // Write audit
    await writeAudit({
      action: "unlock_account",
      targetTable: "auth_accounts",
      targetId: id,
      before,
      after: { ...before, failed_attempts: 0, locked_until: null, status: "active" },
      actor: "admin",
      result: "success",
    })

    return NextResponse.json({
      ok: true,
      message: `账号 ${before.username} 已解锁`,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
