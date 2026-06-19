/**
 * GET /api/system/config - 系统配置读取
 * PATCH /api/system/config - 系统配置写入
 *
 * Sprint R.33 - REQ-6.4.3: 配置管理
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { writeAudit } from "@/lib/control/audit"

const CONFIG_TABLE = "auth_system_config"

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "platform:read")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  try {
    const result = await query(
      `SELECT key, value, description, updated_by, updated_at::text FROM ${CONFIG_TABLE} ORDER BY key`,
    )
    return NextResponse.json({
      ok: true,
      data: result.rows,
      dataSource: "database",
    })
  } catch (e) {
    return NextResponse.json({
      ok: true,
      data: [],
      dataSource: "empty",
      message: "config table may not exist yet",
    })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "platform:operate")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }) }

  const { key, value, description } = body ?? {}
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "missing key" }, { status: 400 })
  }
  if (value === undefined) {
    return NextResponse.json({ error: "missing value" }, { status: 400 })
  }

  try {
    // Get before state
    const before = await query(`SELECT * FROM ${CONFIG_TABLE} WHERE key = $1`, [key])

    await query(
      `INSERT INTO ${CONFIG_TABLE} (key, value, description, updated_by, updated_at)
       VALUES ($1, $2, $3, 'admin', NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, description = COALESCE($3, ${CONFIG_TABLE}.description), updated_by = 'admin', updated_at = NOW()`,
      [key, String(value), description ?? null],
    )

    await writeAudit({
      action: "update_config",
      targetTable: CONFIG_TABLE,
      targetId: key,
      before: before.rows[0] ?? null,
      after: { key, value, description },
      actor: "admin",
      result: "success",
    })

    return NextResponse.json({ ok: true, message: `config ${key} updated` })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
