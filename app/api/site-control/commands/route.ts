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
import { listControlCommands, markCommandPulled } from "@/lib/control/control-command"
import { verifySiteControlRequest } from "@/lib/auth/site-control-auth"

export async function GET(req: NextRequest) {
  const auth = verifySiteControlRequest(req)
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const siteCode = url.searchParams.get("siteCode")
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100)

  if (!siteCode) {
    return NextResponse.json({ error: "missing siteCode" }, { status: 400 })
  }

  try {
    // 1. 列出 pending (可同时拉多条让站点挑)
    const { rows } = await listControlCommands({
      sourceSiteId: siteCode,
      status: "pending",
      limit,
    })

    // 2. 自动 mark pulled (FOR UPDATE 语义: 一次只允许一个站点拉)
    // 注: 当前未做分布式锁, 单进程足够
    const pulled: typeof rows = []
    for (const r of rows) {
      const updated = await markCommandPulled(r.id)
      if (updated) pulled.push(updated)
    }

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
