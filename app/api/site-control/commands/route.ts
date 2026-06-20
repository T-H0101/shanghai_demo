/**
 * GET /api/site-control/commands - 站点轮询命令
 *
 * 用途: 站点侧每小时/更短周期拉取, 走 HMAC 鉴权
 *
 * 当前实现:
 *  - dev 模式无 HMAC 也允许 (SYNC_PACKAGE_AUTH_MODE=dev)
 *  - strict 模式需走 HMAC (复用 package-auth 但目前先用 secret 比较)
 *  - 不要求真实站点已存在 (仅为接口契约)
 */

import { NextRequest, NextResponse } from "next/server"
import { claimControlCommands } from "@/lib/control/control-command"
import { verifySiteControlRequest } from "@/lib/auth/site-control-auth"
import { updateSyncRequestStatusByCommandId } from "@/lib/sync/sync-request"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const siteCode = url.searchParams.get("siteCode")
  const requestedLimit = Number(url.searchParams.get("limit") ?? 20)
  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 20

  if (!siteCode) {
    return NextResponse.json({ error: "missing siteCode" }, { status: 400 })
  }
  const auth = await verifySiteControlRequest(req, {
    rawBody: "",
    payloadSiteCode: siteCode,
  })
  if (!auth.ok) return auth.response

  try {
    const configuredLeaseMs = Number(
      process.env.SITE_AGENT_CONTROL_LEASE_MS ?? 30_000
    )
    const pulled = await claimControlCommands({
      sourceSiteId: siteCode,
      limit,
      leaseMs:
        Number.isInteger(configuredLeaseMs) && configuredLeaseMs >= 5_000
          ? configuredLeaseMs
          : 30_000,
    })
    await Promise.all(
      pulled
        .filter((command) => command.commandType === "sync_full" || command.commandType === "sync_incremental")
        .map((command) => updateSyncRequestStatusByCommandId(command.id, "agent_polled"))
    )

    return NextResponse.json({
      ok: true,
      siteCode,
      pulledCount: pulled.length,
      commands: pulled,
      note: "执行完成后 POST /api/site-control/commands/[id]/result 回写",
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
