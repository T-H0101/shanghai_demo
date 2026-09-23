/**
 * GET /api/auth/accounts/[id] - 账号详情
 * PATCH /api/auth/accounts/[id] - 更新账号
 * DELETE /api/auth/accounts/[id] - 删除账号
 *
 * REQ-3.1.3 账号生命周期管理
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { ensureAuthSchema, roleExists } from "@/lib/auth/server"
import { writeAudit } from "@/lib/control/audit"
import { requireSession, requirePermission } from "@/lib/auth/middleware"

const VALID_STATUSES = ["active", "disabled", "pending_activation"] as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "users:read")
  } catch (e) {
    if (e instanceof NextResponse) return e
    throw e
  }

  await ensureAuthSchema()
  const { id } = await params

  try {
    const result = await query(
      `SELECT id::text, username, display_name, role, department, employee_id, email, accessible_sites,
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
      { message: "未知异常", error: "UNKNOWN_EXCEPTION" },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "user:manage")
  } catch (e) {
    if (e instanceof NextResponse) return e
    throw e
  }

  await ensureAuthSchema()
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const { status, displayName, role, department, accessibleSites, employeeId, email } = body

  try {
    const before = await query(
      `SELECT id::text, username, display_name, role, department, employee_id, email, accessible_sites, status
       FROM auth_accounts WHERE id = $1::uuid LIMIT 1`,
      [id],
    )

    if (before.rows.length === 0) {
      return NextResponse.json({ error: "account not found" }, { status: 404 })
    }

    const row = before.rows[0] as {
      id: string
      username: string
      display_name: string | null
      role: string
      department: string | null
      employee_id: string | null
      email: string | null
      accessible_sites: string[] | null
      status: string
    }

    if (
      status === "disabled" &&
      row.role === "group_admin" &&
      row.status === "active"
    ) {
      const admins = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM auth_accounts
         WHERE role = 'group_admin' AND status = 'active' AND id <> $1::uuid`,
        [id],
      )
      if (Number.parseInt(admins.rows[0]?.count ?? "0", 10) === 0) {
        return NextResponse.json(
          { error: "cannot_disable_last_group_admin", message: "不能禁用最后一个可用的集团管理员" },
          { status: 409 },
        )
      }
    }

    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (status !== undefined) {
      if (typeof status !== "string" || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        return NextResponse.json({ error: `invalid status: ${VALID_STATUSES.join(", ")}` }, { status: 400 })
      }
      updates.push(`status = $${idx}`)
      values.push(status)
      idx++
    }
    if (displayName !== undefined) {
      updates.push(`display_name = $${idx}`)
      values.push(typeof displayName === "string" ? displayName : null)
      idx++
    }
    if (role !== undefined) {
      if (typeof role !== "string") {
        return NextResponse.json({ error: "invalid role" }, { status: 400 })
      }
      const ok =
        ["group_admin", "site_admin", "auditor", "operator", "viewer"].includes(role) ||
        (await roleExists(role))
      if (!ok) {
        return NextResponse.json({ error: `invalid role: ${role}` }, { status: 400 })
      }
      updates.push(`role = $${idx}`)
      values.push(role)
      idx++
    }
    if (department !== undefined) {
      updates.push(`department = $${idx}`)
      values.push(typeof department === "string" ? department : null)
      idx++
    }
    if (accessibleSites !== undefined) {
      if (!Array.isArray(accessibleSites)) {
        return NextResponse.json({ error: "accessibleSites must be an array" }, { status: 400 })
      }
      updates.push(`accessible_sites = $${idx}`)
      values.push(accessibleSites.map(String))
      idx++
    }
    if (employeeId !== undefined) {
      updates.push(`employee_id = $${idx}`)
      values.push(typeof employeeId === "string" && employeeId.trim() ? employeeId.trim() : null)
      idx++
    }
    if (email !== undefined) {
      updates.push(`email = $${idx}`)
      values.push(typeof email === "string" && email.trim() ? email.trim() : null)
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

    const action =
      status === "active"
        ? "enable_account"
        : status === "disabled"
          ? "disable_account"
          : "update_account"

    await writeAudit({
      action,
      targetTable: "auth_accounts",
      targetId: id,
      before: row,
      after: { ...row, ...body },
      actor: session.username,
      result: "success",
    })

    return NextResponse.json({ ok: true, message: "account updated" })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "employee_id or email already exists", message: "工号或邮箱已存在" }, { status: 409 })
    }
    return NextResponse.json({ message: "未知异常", error: "UNKNOWN_EXCEPTION" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "user:manage")
  } catch (e) {
    if (e instanceof NextResponse) return e
    throw e
  }

  await ensureAuthSchema()
  const { id } = await params

  try {
    const account = await query<{ id: string; username: string; status: string; role: string }>(
      `SELECT id::text, username, status, role FROM auth_accounts WHERE id = $1::uuid LIMIT 1`,
      [id],
    )

    if (account.rows.length === 0) {
      return NextResponse.json({ error: "account not found" }, { status: 404 })
    }

    const row = account.rows[0]

    if (row.username === session.username) {
      return NextResponse.json(
        { error: "cannot_delete_self", message: "不能删除当前登录账号" },
        { status: 409 },
      )
    }

    if (row.role === "group_admin") {
      const admins = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM auth_accounts
         WHERE role = 'group_admin' AND status = 'active' AND id <> $1::uuid`,
        [id],
      )
      if (Number.parseInt(admins.rows[0]?.count ?? "0", 10) === 0) {
        return NextResponse.json(
          { error: "cannot_delete_last_group_admin", message: "不能删除最后一个可用的集团管理员" },
          { status: 409 },
        )
      }
    }

    // REQ-3.1.3: 删除前校验该操作员名下未完成任务（按 operator 关联，非全库任务）
    try {
      const unfinishedTasks = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM unified_tasks
         WHERE operator = $1
           AND COALESCE(status, '') NOT IN ('completed', 'failed', 'cancelled', 'success', 'done')`,
        [row.username],
      )
      const taskCount = Number.parseInt(unfinishedTasks.rows[0]?.count ?? "0", 10)
      if (taskCount > 0) {
        return NextResponse.json(
          {
            error: "cannot_delete_with_pending_tasks",
            message: `账号 ${row.username} 名下有 ${taskCount} 个未完成任务，删除可能导致业务中断`,
            pendingTasks: taskCount,
          },
          { status: 409 },
        )
      }
    } catch {
      // unified_tasks 不存在时不阻断删除
    }

    await query(`DELETE FROM auth_accounts WHERE id = $1::uuid`, [id])

    await writeAudit({
      action: "delete_account",
      targetTable: "auth_accounts",
      targetId: id,
      before: row,
      actor: session.username,
      result: "success",
    })

    return NextResponse.json({ ok: true, message: `account ${row.username} deleted` })
  } catch (e) {
    return NextResponse.json(
      { message: "未知异常", error: "UNKNOWN_EXCEPTION" },
      { status: 500 },
    )
  }
}
