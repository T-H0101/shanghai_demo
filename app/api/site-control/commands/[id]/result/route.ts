/**
 * POST /api/site-control/commands/[id]/result - 站点回写执行结果
 *
 * 用途: 站点执行完控制命令后, 回写 success / failed / cancelled + result / errorMessage
 *
 * 严格边界:
 *  - 这是状态机更新, 不是真实执行入口
 *  - 真实执行在站点侧, 站点侧跑完调此 API 回写
 *  - 站点不实际存在时, 可用 curl 模拟 (Sprint 4.5 测试用)
 */

import { NextRequest, NextResponse } from "next/server"
import { markCommandResult } from "@/lib/control/control-command"
import { verifySiteControlRequest } from "@/lib/auth/site-control-auth"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifySiteControlRequest(req)
  if (!auth.ok) return auth.response
  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const { status, result, errorMessage } = body ?? {}
  if (!["success", "failed", "cancelled"].includes(status)) {
    return NextResponse.json(
      { error: "status must be success / failed / cancelled" },
      { status: 400 }
    )
  }

  try {
    const row = await markCommandResult(id, status, {
      result: typeof result === "object" && result ? result : undefined,
      errorMessage: typeof errorMessage === "string" ? errorMessage : undefined,
    })
    if (!row) {
      return NextResponse.json(
        { error: "command not found or already finalized" },
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
