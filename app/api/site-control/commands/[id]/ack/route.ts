/**
 * POST /api/site-control/commands/[id]/ack - 站点收到命令后立即 ack
 *
 * 用途: 站点拉走后, 改 status 'pulled' → 'running' (表明正在执行)
 *       不代表成功, 仅代表 "我收到了, 在做"
 *
 * 当前限制: ack 主要是状态记录, 真实执行不在站点侧
 */

import { NextRequest, NextResponse } from "next/server"
import { getSyncPackageAuthConfig } from "@/lib/sync/package-auth"
import { query } from "@/lib/db/postgres"

function checkAuth(req: NextRequest): { ok: boolean; message: string } {
  const config = getSyncPackageAuthConfig()
  if (config.mode === "dev") return { ok: true, message: "dev mode" }
  const sig = req.headers.get("x-site-control-signature")
  if (!sig || sig !== config.secret) {
    return { ok: false, message: "missing or invalid x-site-control-signature" }
  }
  return { ok: true, message: "ok" }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = checkAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }
  const { id } = await params

  try {
    const res = await query(
      `UPDATE control_command
       SET status = 'running'
       WHERE id = $1 AND status IN ('pulled', 'pending')
       RETURNING id, command_no, status`,
      [id]
    )
    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: "command not found or not in pullable state" },
        { status: 404 }
      )
    }
    return NextResponse.json({ ok: true, command: res.rows[0] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
