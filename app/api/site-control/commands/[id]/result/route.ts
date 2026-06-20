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
import { updateSyncRequestStatusByCommandId } from "@/lib/sync/sync-request"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const rawBody = await req.text()
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const siteCode =
    typeof body.siteCode === "string" ? body.siteCode : null
  const auth = await verifySiteControlRequest(req, {
    rawBody,
    payloadSiteCode: siteCode,
  })
  if (!auth.ok) return auth.response

  const { status, result, errorMessage } = body
  if (
    !["success", "failed", "cancelled", "unsupported"].includes(
      String(status)
    )
  ) {
    return NextResponse.json(
      { error: "status must be success / failed / cancelled / unsupported" },
      { status: 400 }
    )
  }

  try {
    const outcome = await markCommandResult(
      id,
      auth.siteCode,
      status as "success" | "failed" | "cancelled" | "unsupported",
      {
        result:
          typeof result === "object" && result
            ? (result as Record<string, unknown>)
            : undefined,
        errorMessage:
          typeof errorMessage === "string" ? errorMessage : undefined,
      }
    )
    if (outcome.kind === "not_found") {
      return NextResponse.json(
        { error: "command not found" },
        { status: 404 }
      )
    }
    if (outcome.kind === "invalid_state") {
      return NextResponse.json(
        { error: "command is not running" },
        { status: 409 }
      )
    }
    if (outcome.kind === "conflict") {
      return NextResponse.json(
        { error: "conflicting final result" },
        { status: 409 }
      )
    }
    if (
      outcome.row.commandType === "sync_full" ||
      outcome.row.commandType === "sync_incremental"
    ) {
      const syncPayload =
        typeof result === "object" && result
          ? (result as Record<string, unknown>)
          : {}
      const syncResult =
        typeof syncPayload.sync === "object" && syncPayload.sync
          ? (syncPayload.sync as Record<string, unknown>)
          : {}
      await updateSyncRequestStatusByCommandId(
        id,
        status === "success" ? "completed" : "failed",
        {
          errorMessage:
            status === "success"
              ? undefined
              : typeof errorMessage === "string"
                ? errorMessage
                : String(status),
          timing: {
            commandStatus: status,
            sync: syncResult,
            completedAt: new Date().toISOString(),
          },
        }
      )
    }
    return NextResponse.json({
      ok: true,
      idempotent: outcome.kind === "idempotent",
      command: outcome.row,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
