/**
 * POST /api/site-control/commands/[id]/ack - 站点收到命令后立即 ack
 *
 * 用途: 站点拉走后, 改 status 'pulled' → 'running' (表明正在执行)
 *       不代表成功, 仅代表 "我收到了, 在做"
 *
 * 当前限制: ack 主要是状态记录, 真实执行不在站点侧
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { verifySiteControlRequest } from "@/lib/auth/site-control-auth"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifySiteControlRequest(req)
  if (!auth.ok) return auth.response
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
