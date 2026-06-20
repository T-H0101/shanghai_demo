/**
 * R.47/R.55 — GET /api/logs/source
 *
 * AUDIT-ONLY endpoint. Per R.55 architecture freeze, product pages must
 * read from center-owned stores (PG17 unified_*, ClickHouse when
 * configured) and NOT from site_restore_db directly. This endpoint is
 * retained for audit tooling and consistency verification only, and
 * returns an explicit `audit_only: true` flag plus
 * `blocker: direct_source_read` so that any consumer UI can show
 * "audit-only" wording.
 *
 * Product log reads must use /api/logs which delegates to
 * lib/logs/log-repository (R.57).
 */

import { NextResponse } from "next/server"
import { fetchSourceLogs } from "@/lib/source/log-source"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500)
    const keyword = url.searchParams.get("keyword") ?? undefined

    const result = await fetchSourceLogs({ limit, keyword })

    return NextResponse.json({
      code: 0,
      data: {
        ...result,
        audit_only: true,
        blocker: "direct_source_read",
        message:
          "R.55: 此端点仅供审计/对账使用, 产品页面请使用 /api/logs (经 log-repository 走 ClickHouse 或中心 PG)",
      },
    })
  } catch (err) {
    return NextResponse.json(
      { code: -1, message: (err as Error).message },
      { status: 500 }
    )
  }
}
