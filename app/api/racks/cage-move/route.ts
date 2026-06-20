/**
 * POST /api/racks/cage-move
 * Sprint R.64 — center command for cage move registration.
 *
 * Returns 202 if the station move table exists, or 202 with
 * `status: blocked_by_source_schema` and a clear blocker message if
 * not. The center `unified_cage_move_log` (or a candidate marker)
 * is always written first.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { registerCageMove } from "@/lib/control/cage-move"

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "racks:operate")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  let body: {
    sourceSiteCode?: string
    targetSiteCode?: string
    cageId?: string
    operator?: string
    approvalStatus?: "pending" | "approved" | "rejected"
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json(
      { code: 400, error: "invalid_json" },
      { status: 400 }
    )
  }

  if (!body.cageId || !body.sourceSiteCode || !body.targetSiteCode) {
    return NextResponse.json(
      {
        code: 400,
        error: "sourceSiteCode, targetSiteCode, cageId are required",
      },
      { status: 400 }
    )
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

  try {
    const result = await registerCageMove({
      sourceSiteCode: body.sourceSiteCode,
      targetSiteCode: body.targetSiteCode,
      cageId: body.cageId,
      operator: body.operator ?? "admin",
      approvalStatus: body.approvalStatus ?? "pending",
      ip,
    })

    return NextResponse.json(
      {
        code: 0,
        commandId: result.commandId,
        commandNo: result.commandNo,
        status: result.status,
        centerLogId: result.centerLogId,
        blocker: result.blocker ?? null,
        message: result.message,
      },
      { status: 202 }
    )
  } catch (err) {
    return NextResponse.json(
      { code: 500, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
