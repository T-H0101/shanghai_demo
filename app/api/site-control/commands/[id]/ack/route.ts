/**
 * POST /api/site-control/commands/[id]/ack - 站点收到命令后立即 ack
 *
 * 用途: 站点拉走后, 改 status 'pulled' → 'running' (表明正在执行)
 *       不代表成功, 仅代表 "我收到了, 在做"
 *
 * 当前限制: ack 主要是状态记录, 真实执行不在站点侧
 */

import { NextRequest, NextResponse } from "next/server"
import { markCommandRunning } from "@/lib/control/control-command"
import { verifySiteControlRequest } from "@/lib/auth/site-control-auth"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rawBody = await req.text()
  let body: { siteCode?: unknown }
  try {
    body = JSON.parse(rawBody) as { siteCode?: unknown }
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const siteCode = typeof body.siteCode === "string" ? body.siteCode : null
  const auth = await verifySiteControlRequest(req, {
    rawBody,
    payloadSiteCode: siteCode,
  })
  if (!auth.ok) return auth.response

  try {
    const row = await markCommandRunning(id, auth.siteCode)
    if (!row) {
      return NextResponse.json(
        { error: "command not found or not in pulled state" },
        { status: 404 }
      )
    }
    return NextResponse.json({ ok: true, command: row })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
