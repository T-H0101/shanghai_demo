/**
 * GET /api/search
 * Cross-dimension file search — R.55 center-owned read path
 *
 * Selection:
 *   1. ES/OpenSearch configured -> query ES
 *   2. otherwise                -> unified_file_index
 *   3. otherwise                -> blocked_by_external_system
 *
 * NEVER reads site_restore_db directly. The bounded restore reader is
 * retained only for audit tooling.
 *
 * REQ-4.1.1: cross-dimension search — partial (ES preferred for full perf)
 * REQ-4.1.2: search performance <=3s for 千万级 — blocked_by_external_system
 * REQ-5.2.1: index export — partial
 */

import { NextRequest, NextResponse } from "next/server"
import { searchFileIndex } from "@/lib/search/file-index-repository"

export async function GET(request: NextRequest) {
  try {
    const keyword =
      request.nextUrl.searchParams.get("q") ??
      request.nextUrl.searchParams.get("keyword") ??
      undefined
    const suffix = request.nextUrl.searchParams.get("suffix") ?? undefined
    const limit = Math.min(
      Number(request.nextUrl.searchParams.get("limit") ?? "50"),
      200
    )

    const result = await searchFileIndex({ q: keyword, suffix, limit })

    return NextResponse.json({
      code: 0,
      data: {
        items: result.items,
        total: result.total,
        source: result.source,
        missingDimensions: result.missingDimensions,
        requirements: result.requirements,
        blocker: result.blocker,
      },
      message:
        result.source === "blocked_by_external_system"
          ? "中心 unified_file_index 为空且未配置 ES, 检索被阻塞"
          : `数据源：总控库 ${result.source}`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        code: 1,
        data: { items: [], total: 0, source: "blocked_by_external_system" },
        error: error instanceof Error ? error.message : "search_failed",
      },
      { status: 500 }
    )
  }
}
