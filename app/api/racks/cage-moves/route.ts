/**
 * GET/POST /api/racks/cage-moves
 * Sprint R.104/R.106 — 总控盘笼移位登记（目标=站点区域；支持再迁）
 * 有页权限即可全站查询，不做站级裁剪。
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { query } from "@/lib/db"
import {
  CageMoveRegisterError,
  createCageMoveRegister,
  listCageMoveRegisters,
  listRegisteredMagazineRfids,
} from "@/lib/control/cage-move-register"

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "cage_moves:read")
    const sp = req.nextUrl.searchParams
    if (sp.get("rfidsOnly") === "1" || sp.get("rfidsOnly") === "true") {
      const rfids = await listRegisteredMagazineRfids()
      return NextResponse.json({
        code: 0,
        data: { rfids },
        message: "已登记过的盘笼 RFID（筛选用）",
      })
    }
    const limit = Number(sp.get("limit") ?? 50)
    const offset = Number(sp.get("offset") ?? 0)
    const magazineRfid = sp.get("magazineRfid") ?? sp.get("rfid") ?? null
    const result = await listCageMoveRegisters({ limit, offset, magazineRfid })
    return NextResponse.json({
      code: 0,
      data: result,
      message: "盘笼移位登记（总控），不代表站点已执行移位",
    })
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json(
      { code: 500, message: "未知异常", error: "UNKNOWN_EXCEPTION" },
      { status: 500 },
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
    sourceRegionCode?: string
    sourceSiteCode?: string | null
    sourceDeviceIp?: string | null
    sourceDevicePort?: string | null
    relocated?: boolean
    targetRegionCode?: string
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
      sourceRegionCode: body.sourceRegionCode ?? "",
      sourceSiteCode: body.sourceSiteCode,
      sourceDeviceIp: body.sourceDeviceIp,
      sourceDevicePort: body.sourceDevicePort,
      relocated: Boolean(body.relocated),
      targetRegionCode: body.targetRegionCode ?? "",
      registrarName: body.registrarName ?? "",
      remark: body.remark,
      operatorAccountId: session.id,
      actor: session.username,
      actorIp: clientIp(req),
    })
    const regionName =
      (
        await query<{ name: string | null }>(
          `SELECT name FROM site_regions WHERE code = $1 LIMIT 1`,
          [row.target_region_code],
        )
      ).rows[0]?.name?.trim() || row.target_region_code
    return NextResponse.json(
      {
        code: 0,
        data: row,
        message: `盘笼移位已登记到总控，目标为站点区域 ${regionName}，等待线下移笼`,
      },
      { status: 201 },
    )
  } catch (e) {
    if (e instanceof CageMoveRegisterError) {
      return NextResponse.json({ code: e.status, error: e.message }, { status: e.status })
    }
    return NextResponse.json(
      { code: 500, message: "未知异常", error: "UNKNOWN_EXCEPTION" },
      { status: 500 },
    )
  }
}
