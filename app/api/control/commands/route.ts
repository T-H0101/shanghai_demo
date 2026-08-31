/**
 * POST /api/control/commands - 创建控制命令
 * GET  /api/control/commands - 列表查询
 *
 * 任务暂停 / 重置：总控同步直调站点 MultimediumNw `/unified-task-control`
 *（实时 status 预检 + 原业务 pause/reset），不依赖 Site Agent 拉队列。
 * control_command 仍写入作审计。
 */

import { NextRequest, NextResponse } from "next/server"
import {
  createControlCommand,
  listControlCommands,
  COMMAND_TYPES,
  TARGET_TYPES,
  type CommandType,
  type TargetType,
} from "@/lib/control/control-command"
import {
  dispatchSiteTaskControl,
  isDirectSiteTaskControlType,
} from "@/lib/control/dispatch-site-task-control"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { resolveSiteScope } from "@/lib/auth/site-scope"

export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "control:submit")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const { sourceSiteId, commandType, targetType, targetId, payload } = body ?? {}
  if (!sourceSiteId || typeof sourceSiteId !== "string") {
    return NextResponse.json({ error: "missing sourceSiteId" }, { status: 400 })
  }
  if (!COMMAND_TYPES.includes(commandType)) {
    return NextResponse.json(
      { error: `invalid commandType, must be one of ${COMMAND_TYPES.join(",")}` },
      { status: 400 },
    )
  }
  if (!TARGET_TYPES.includes(targetType)) {
    return NextResponse.json(
      { error: `invalid targetType, must be one of ${TARGET_TYPES.join(",")}` },
      { status: 400 },
    )
  }
  if (!targetId || typeof targetId !== "string") {
    return NextResponse.json({ error: "missing targetId" }, { status: 400 })
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"

  const siteId = sourceSiteId.slice(0, 32)
  const tid = targetId.slice(0, 64)
  const pl = typeof payload === "object" && payload ? payload : {}
  const requestedBy =
    session && typeof session.username === "string" ? session.username : null

  // 暂停 / 重置：直调站点业务 HTTP（预检 + 原业务逻辑）
  if (isDirectSiteTaskControlType(commandType)) {
    try {
      const result = await dispatchSiteTaskControl({
        sourceSiteId: siteId,
        commandType,
        targetId: tid,
        payload: pl,
        requestedBy,
        requestedIp: ip.slice(0, 64),
      })
      if (!result.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: result.message,
            reasonCode: result.site?.reasonCode ?? null,
            currentStatus: result.site?.currentStatus ?? null,
            command: result.command,
            commandNo: result.command.commandNo,
          },
          { status: result.httpStatus >= 400 && result.httpStatus < 600 ? result.httpStatus : 502 },
        )
      }
      return NextResponse.json(
        {
          ok: true,
          command: result.command,
          commandNo: result.command.commandNo,
          message: result.message,
          currentStatus: result.site?.currentStatus ?? null,
        },
        { status: 200 },
      )
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      )
    }
  }

  try {
    const row = await createControlCommand({
      sourceSiteId: siteId,
      commandType: commandType as CommandType,
      targetType: targetType as TargetType,
      targetId: tid,
      payload: pl,
      requestedBy,
      requestedIp: ip.slice(0, 64),
    })
    return NextResponse.json(
      {
        ok: true,
        command: row,
        message: "控制命令已提交",
      },
      { status: 201 },
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "control:submit")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  const url = new URL(req.url)
  const siteCodeParam = url.searchParams.get("siteCode") ?? undefined
  const scope = resolveSiteScope(session!, siteCodeParam ?? null)
  const commandType = (url.searchParams.get("commandType") as CommandType | null) ?? undefined
  const status = (url.searchParams.get("status") as any) ?? undefined
  const limit = Number(url.searchParams.get("limit") ?? 100)
  const offset = Number(url.searchParams.get("offset") ?? 0)

  try {
    const result = await listControlCommands({
      sourceSiteId: scope.kind === "single" ? scope.siteCode : undefined,
      sourceSiteIds: scope.kind === "listed" ? scope.siteCodes : undefined,
      commandType,
      status,
      limit,
      offset,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
