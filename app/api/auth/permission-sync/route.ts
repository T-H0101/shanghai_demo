/**
 * POST /api/auth/permission-sync
 * Sprint R.66 — write a permission change to the center and enqueue
 * a station sync command. Returns `implemented_candidate` with
 * station_auth_schema_not_verified when no station auth tables are
 * available.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { createControlCommand } from "@/lib/control/control-command"
import { writeAudit } from "@/lib/control/audit"

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "user:manage")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  let body: { userId?: string; role?: string; siteCode?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json(
      { code: 400, error: "invalid_json" },
      { status: 400 }
    )
  }
  if (!body.userId || !body.role) {
    return NextResponse.json(
      { code: 400, error: "userId and role are required" },
      { status: 400 }
    )
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

  // 1. Center side: write audit
  await writeAudit({
    action: "permission_sync_queued",
    targetTable: "auth_accounts",
    targetId: body.userId,
    after: { role: body.role, siteCode: body.siteCode ?? null },
    actor: "admin",
    siteCode: body.siteCode ?? null,
    result: "success",
  })

  // 2. Enqueue station sync command
  const command = await createControlCommand({
    sourceSiteId: body.siteCode ?? "SH01",
    commandType: "permission_sync",
    targetType: "user",
    targetId: body.userId,
    payload: { userId: body.userId, role: body.role },
    requestedBy: "admin",
    requestedIp: ip,
  })

  return NextResponse.json(
    {
      code: 0,
      status: "implemented_candidate",
      blocker: "station_auth_schema_not_verified",
      commandId: command.id,
      commandNo: command.commandNo,
      message:
        "Permission change written to center. Station enforcement is candidate until station auth tables are present.",
    },
    { status: 202 }
  )
}
