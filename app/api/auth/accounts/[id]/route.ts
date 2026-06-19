/**
 * GET /api/auth/accounts/[id] - 账号详情
 * PATCH /api/auth/accounts/[id] - 更新账号 (启用/禁用)
 * DELETE /api/auth/accounts/[id] - 删除账号 (需校验未完成任务)
 *
 * Sprint R.28
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { ensureAuthSchema } from "@/lib/auth/server"
import { writeAudit } from "@/lib/control/audit"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureAuthSchema()
  const { id } = await params

  try {
    const result = await query(
      `SELECT id::text, username, display_name, role, department, accessible_sites,
              status, failed_attempts, locked_until::text, last_login_at::text, created_at::text
       FROM auth_accounts WHERE id = $1::uuid LIMIT 1`,
      [id],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "account not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, account: result.rows[0] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureAuthSchema()
  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const { status, displayName, role, department, accessibleSites } = body ?? {}

  try {
    // Get current state
    const before = await query(
      `SELECT id::text, username, display_name, role, department, accessible_sites, status
       FROM auth_accounts WHERE id = $1::uuid LIMIT 1`,
      [id],
    )

    if (before.rows.length === 0) {
      return NextResponse.json({ error: "account not found" }, { status: 404 })
    }

    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (status) {
      const validStatuses = ["active", "disabled", "pending_activation"]
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `invalid status: ${validStatuses.join(", ")}` }, { status: 400 })
      }
      updates.push(`status = $${idx}`)
      values.push(status)
      idx++
    }
    if (displayName !== undefined) {
      updates.push(`display_name = $${idx}`)
      values.push(displayName)
      idx++
    }
    if (role) {
      updates.push(`role = $${idx}`)
      values.push(role)
      idx++
    }
    if (department !== undefined) {
      updates.push(`department = $${idx}`)
      values.push(department)
      idx++
    }
    if (accessibleSites !== undefined) {
      updates.push(`accessible_sites = $${idx}`)
      values.push(accessibleSites)
      idx++
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "no fields to update" }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)

    await query(
      `UPDATE auth_accounts SET ${updates.join(", ")} WHERE id = $${idx}::uuid`,
      values,
    )

    const action = status === "active" ? "enable_account"
      : status === "disabled" ? "disable_account"
      : "update_account"

    await writeAudit({
      action,
      targetTable: "auth_accounts",
      targetId: id,
      before: before.rows[0],
      after: { ...before.rows[0], ...body },
      actor: "admin",
      result: "success",
    })

    return NextResponse.json({ ok: true, message: "account updated" })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureAuthSchema()
  const { id } = await params

  try {
    // Check account exists
    const account = await query(
      `SELECT id::text, username, status FROM auth_accounts WHERE id = $1::uuid LIMIT 1`,
      [id],
    )

    if (account.rows.length === 0) {
      return NextResponse.json({ error: "account not found" }, { status: 404 })
    }

    // Check for unfinished tasks (REQ-3.1.3: 删除前需校验是否有未完成任务)
    const unfinishedTasks = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM unified_tasks
       WHERE status NOT IN ('completed', 'failed', 'cancelled')`,
    )
    const taskCount = Number.parseInt(unfinishedTasks.rows[0]?.count ?? "0", 10)

    if (taskCount > 0) {
      return NextResponse.json({
        error: "cannot_delete_with_pending_tasks",
        message: `当前有 ${taskCount} 个未完成任务，删除账号可能导致业务中断`,
        pendingTasks: taskCount,
      }, { status: 409 })
    }

    await query(`DELETE FROM auth_accounts WHERE id = $1::uuid`, [id])

    await writeAudit({
      action: "delete_account",
      targetTable: "auth_accounts",
      targetId: id,
      before: account.rows[0],
      actor: "admin",
      result: "success",
    })

    return NextResponse.json({ ok: true, message: `account ${account.rows[0].username} deleted` })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
