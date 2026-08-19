/**
 * GET/POST /api/racks/cage-moves
 * Sprint R.98 — 总控盘笼移位登记（REQ-4.3.1）
 *
 * POST 只写入中心库 unified_cage_move_register，不向站点下发移位执行。
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import {
  CageMoveRegisterError,
  createCageMoveRegister,
  listCageMoveRegisters,
} from "@/lib/control/cage-move-register"

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "platform:read")
    const sp = req.nextUrl.searchParams
    const limit = Number(sp.get("limit") ?? 50)
    const offset = Number(sp.get("offset") ?? 0)
    const result = await listCageMoveRegisters({ limit, offset })
    return NextResponse.json({
      code: 0,
      data: result,
      message: "盘笼移位登记（总控），不代表站点已执行移位",
    })
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json(
      { code: 500, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
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

  let body: {
    cageId?: string
    magazineRfid?: string
    sourceSiteCode?: string
    sourceDeviceIp?: string
    sourceDevicePort?: string | null
    targetSiteCode?: string
    targetDeviceIp?: string
    targetDevicePort?: string | null
    registrarName?: string
    remark?: string | null
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ code: 400, error: "invalid_json" }, { status: 400 })
  }

  try {
    const row = await createCageMoveRegister({
      cageId: body.cageId,
      magazineRfid: body.magazineRfid ?? "",
      sourceSiteCode: body.sourceSiteCode ?? "",
      sourceDeviceIp: body.sourceDeviceIp ?? "",
      sourceDevicePort: body.sourceDevicePort,
      targetSiteCode: body.targetSiteCode ?? "",
      targetDeviceIp: body.targetDeviceIp ?? "",
      targetDevicePort: body.targetDevicePort,
      registrarName: body.registrarName ?? "",
      remark: body.remark,
      operatorAccountId: session.id,
      actor: session.username,
      actorIp: clientIp(req),
    })
    return NextResponse.json(
      {
        code: 0,
        data: row,
        message: "盘笼移位已登记到总控，检索将按目标站点归属，等待站点库同步盘笼位置",
      },
      { status: 201 }
    )
  } catch (e) {
    if (e instanceof CageMoveRegisterError) {
      return NextResponse.json({ code: e.status, error: e.message }, { status: e.status })
    }
    return NextResponse.json(
      { code: 500, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
