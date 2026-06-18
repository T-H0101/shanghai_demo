/**
 * POST /api/sync/trigger
 * Sprint R.22: 手动同步触发 fail-closed 边界。
 *
 * 当前总控尚未具备向 Site Agent 下发“立即全量/增量同步”的真实通道，
 * 因此本端点只返回 501 blocked_by_site_change，不写 sync_package_log，
 * 不伪造完成态。
 */

import { NextRequest, NextResponse } from "next/server"

const payload = {
  code: 501,
  message: "Manual sync trigger is not implemented. Site Agent command channel for full/incremental sync is required.",
  source: "not_implemented",
  blocker: "blocked_by_site_change",
  reqId: "REQ-2.3.2",
  allowedAlternative: "Run `pnpm scheduler:sync:once -- --siteCode=<SITE>` from an operator shell.",
}

export async function GET() {
  return NextResponse.json(payload, { status: 501 })
}

export async function POST(request: NextRequest) {
  await request.json().catch(() => null)
  return NextResponse.json(payload, { status: 501 })
}
