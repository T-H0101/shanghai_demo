/**
 * POST /api/sync/consistency/[id]/resolve - 解决一致性差异
 *
 * Sprint R.31 - REQ-2.3.3: 人工修复或接受差异
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { writeAudit } from "@/lib/control/audit"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "sync:operate")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  const { id } = await params
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }) }

  const { action, note } = body ?? {} // action: "accept" | "fix"
  if (!action || !["accept", "fix"].includes(action)) {
    return NextResponse.json({ error: "action must be 'accept' or 'fix'" }, { status: 400 })
  }

  try {
    const before = await query(`SELECT * FROM sync_consistency_log WHERE id = $1::uuid LIMIT 1`, [id])
    if (before.rows.length === 0) {
      return NextResponse.json({ error: "consistency record not found" }, { status: 404 })
    }

    // Mark as resolved
    await query(
      `UPDATE sync_consistency_log SET status = 'resolved', updated_at = NOW() WHERE id = $1::uuid`,
      [id],
    )

    await writeAudit({
      action: action === "accept" ? "accept_difference" : "manual_fix",
      targetTable: "sync_consistency_log",
      targetId: id,
      before: before.rows[0],
      after: { action, note, resolved: true },
      actor: "admin",
      result: "success",
    })

    return NextResponse.json({ ok: true, message: `差异已${action === "accept" ? "接受" : "修复"}` })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
