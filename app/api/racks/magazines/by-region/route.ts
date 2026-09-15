/**
 * GET /api/racks/magazines/by-region
 * 按原区域列出可登记盘笼（未迁 + 迁入本区域标记「迁移」）
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession, requireAnyPermission } from "@/lib/auth/middleware"
import {
  CageMoveRegisterError,
  listRegionCageCandidates,
} from "@/lib/control/cage-move-register"

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request)
    requireAnyPermission(session, ["racks:operate", "cage_moves:read"])

    const regionCode = (request.nextUrl.searchParams.get("regionCode") ?? "").trim()
    if (!regionCode) {
      return NextResponse.json({ code: 400, error: "regionCode 必填" }, { status: 400 })
    }

    const items = await listRegionCageCandidates(regionCode)
    return NextResponse.json({
      code: 0,
      data: { items, total: items.length },
      message: "未迁=区域内设备盘笼；迁移=已登记迁入本区域",
    })
  } catch (e) {
    if (e instanceof NextResponse) return e
    if (e instanceof CageMoveRegisterError) {
      return NextResponse.json({ code: e.status, error: e.message }, { status: e.status })
    }
    return NextResponse.json(
      { code: 500, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
