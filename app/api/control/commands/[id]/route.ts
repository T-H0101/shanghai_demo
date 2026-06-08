/**
 * GET /api/control/commands/[id] - 单条详情
 *
 * 用途: 详情页/控制台查询单条状态
 */

import { NextRequest, NextResponse } from "next/server"
import { getControlCommand } from "@/lib/control/control-command"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const row = await getControlCommand(id)
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, command: row })
}
