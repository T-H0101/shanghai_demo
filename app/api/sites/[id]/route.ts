/**
 * PATCH /api/sites/[id] - 编辑站点
 * DELETE /api/sites/[id] - 禁用/删除站点
 *
 * Sprint R.30 - REQ-2.1.1: 站点配置
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { writeAudit } from "@/lib/control/audit"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "platform:operate")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  const { id } = await params
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }) }

  const { name, ip, port, contact, enabled } = body ?? {}

  try {
    const before = await query(`SELECT * FROM sync_sites WHERE id = $1::uuid OR site_code = $1 LIMIT 1`, [id])
    if (before.rows.length === 0) {
      return NextResponse.json({ error: "site not found" }, { status: 404 })
    }

    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (name !== undefined) { updates.push(`site_name = $${idx}`); values.push(name); idx++ }
    if (ip !== undefined) { updates.push(`ip_address = $${idx}`); values.push(ip); idx++ }
    if (port !== undefined) { updates.push(`port = $${idx}`); values.push(port); idx++ }
    if (contact !== undefined) { updates.push(`contact = $${idx}`); values.push(contact); idx++ }
    if (enabled !== undefined) { updates.push(`enabled = $${idx}`); values.push(enabled); idx++ }

    if (updates.length === 0) return NextResponse.json({ error: "no fields to update" }, { status: 400 })

    updates.push(`updated_at = NOW()`)
    values.push(id)

    await query(
      `UPDATE sync_sites SET ${updates.join(", ")} WHERE id = $${idx}::uuid OR site_code = $${idx}`,
      values,
    )

    await writeAudit({
      action: enabled === false ? "disable_site" : "update_site",
      targetTable: "sync_sites",
      targetId: id,
      before: before.rows[0],
      after: body,
      actor: "admin",
      result: "success",
    })

    return NextResponse.json({ ok: true, message: "site updated" })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(_req)
    requirePermission(session, "platform:operate")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  const { id } = await params

  try {
    const before = await query(`SELECT * FROM sync_sites WHERE id = $1::uuid OR site_code = $1 LIMIT 1`, [id])
    if (before.rows.length === 0) {
      return NextResponse.json({ error: "site not found" }, { status: 404 })
    }

    // Soft delete: disable instead of hard delete
    await query(
      `UPDATE sync_sites SET enabled = false, updated_at = NOW() WHERE id = $1::uuid OR site_code = $1`,
      [id],
    )

    await writeAudit({
      action: "disable_site",
      targetTable: "sync_sites",
      targetId: id,
      before: before.rows[0],
      after: { enabled: false },
      actor: "admin",
      result: "success",
    })

    return NextResponse.json({ ok: true, message: "site disabled" })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
