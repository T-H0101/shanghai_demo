/**
 * DELETE /api/racks/cage-moves/[id]
 * 取消错误登记：仅同一 RFID 最新一条 registered 可撤。
 * 不向站点下发撤销，不代表现场搬迁已撤回。
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import {
  CageMoveRegisterError,
  cancelCageMoveRegister,
} from "@/lib/control/cage-move-register"

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "racks:operate")
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ code: 500, error: "AUTH_ERROR" }, { status: 500 })
  }
  if (!session) {
    return NextResponse.json({ code: 401, error: "AUTH_UNAUTHENTICATED" }, { status: 401 })
  }

  const { id } = await params

  try {
    const row = await cancelCageMoveRegister({
      id,
      operatorAccountId: session.id,
      actor: session.username,
      actorIp: clientIp(req),
    })
    return NextResponse.json({
      code: 0,
      data: row,
      message: "已撤销这次移位登记。在目标区域检索将不再包含该盘笼",
    })
  } catch (e) {
    if (e instanceof CageMoveRegisterError) {
      return NextResponse.json({ code: e.status, error: e.message }, { status: e.status })
    }
    return NextResponse.json(
      { code: 500, message: "未知异常", error: "UNKNOWN_EXCEPTION" },
      { status: 500 }
    )
  }
}
