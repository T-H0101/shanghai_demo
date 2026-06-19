/**
 * POST /api/control/commands - 创建控制命令
 * GET  /api/control/commands - 列表查询
 *
 * 写入入口 (用户/系统)
 *
 * ⚠️ Sprint 4.5 MVP 范围: 不要求 Auth, requestedBy 固定为 null
 *   解锁后 (Sprint 5.1 ADFS 接入):
 *     - const session = await getSession()
 *     - if (!session) return 401
 *     - requestedBy = session.user
 *   详见 docs/summary/CODEBASE_QUALITY_AUDIT.md §3.2
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
import { requireSession, requirePermission } from "@/lib/auth/middleware"

export async function POST(req: NextRequest) {
  // Sprint R.29: 防越权
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

  // 严格校验 (不信任前端)
  const { sourceSiteId, commandType, targetType, targetId, payload } = body ?? {}
  if (!sourceSiteId || typeof sourceSiteId !== "string") {
    return NextResponse.json({ error: "missing sourceSiteId" }, { status: 400 })
  }
  if (!COMMAND_TYPES.includes(commandType)) {
    return NextResponse.json(
      { error: `invalid commandType, must be one of ${COMMAND_TYPES.join(",")}` },
      { status: 400 }
    )
  }
  if (!TARGET_TYPES.includes(targetType)) {
    return NextResponse.json(
      { error: `invalid targetType, must be one of ${TARGET_TYPES.join(",")}` },
      { status: 400 }
    )
  }
  if (!targetId || typeof targetId !== "string") {
    return NextResponse.json({ error: "missing targetId" }, { status: 400 })
  }

  // 请求 IP (走 X-Forwarded-For 或 remoteAddr)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"

  try {
    const row = await createControlCommand({
      sourceSiteId: sourceSiteId.slice(0, 32),
      commandType: commandType as CommandType,
      targetType: targetType as TargetType,
      targetId: targetId.slice(0, 64),
      payload: typeof payload === "object" && payload ? payload : {},
      requestedBy: null, // Auth 解锁后从 session 读
      requestedIp: ip.slice(0, 64),
    })
    return NextResponse.json(
      {
        ok: true,
        command: row,
        message: "控制命令已提交, 等待站点同步执行",
      },
      { status: 201 }
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  // Sprint R.29: 防越权
  try {
    const session = await requireSession(req)
    requirePermission(session, "control:submit")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  const url = new URL(req.url)
  const sourceSiteId = url.searchParams.get("siteCode") ?? undefined
  const commandType = (url.searchParams.get("commandType") as CommandType | null) ?? undefined
  const status = (url.searchParams.get("status") as any) ?? undefined
  const limit = Number(url.searchParams.get("limit") ?? 100)
  const offset = Number(url.searchParams.get("offset") ?? 0)

  try {
    const result = await listControlCommands({
      sourceSiteId,
      commandType,
      status,
      limit,
      offset,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
