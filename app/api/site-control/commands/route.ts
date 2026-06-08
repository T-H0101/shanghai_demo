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
import { getSyncPackageAuthConfig } from "@/lib/sync/package-auth"

function checkAuth(req: NextRequest): { ok: boolean; message: string } {
  const config = getSyncPackageAuthConfig()
  if (config.mode === "dev") {
    return { ok: true, message: "dev mode" }
  }
  // strict 模式: 校验 x-site-code 与 secret 头 (简化版, 不走完整 HMAC)
  const sig = req.headers.get("x-site-control-signature")
  if (!sig || sig !== config.secret) {
    return { ok: false, message: "missing or invalid x-site-control-signature" }
  }
  return { ok: true, message: "ok" }
}

export async function GET(req: NextRequest) {
  const auth = checkAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

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
