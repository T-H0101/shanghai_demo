/**
 * GET /api/search
 * Cross-dimension file search — R.85 port-based read path (ADR 0002)
 *
 * Selection:
 *   1. ES/OpenSearch configured + reachable -> query ES via SearchPort
 *   2. ES not configured / unreachable      -> blocked_by_external_system
 *
 * The route MUST NOT import `lib/search/es-client` directly. It calls the
 * `SearchPort` factory and translates `FileSearchResult.source` into the
 * HTTP envelope. Domain rules live in `lib/domain/search/*`; the OpenSearch
 * adapter lives in `lib/adapters/opensearch/file-search-adapter.ts`.
 *
 * Requirements:
 *   REQ-4.1.1: cross-dimension search (partial until ES wired)
 *   REQ-4.1.2: search performance <=3s for 千万级 (blocked_by_external_system until R.86+)
 *   REQ-5.2.1: index export (partial until R.86+ watermarks)
 */

import { NextRequest, NextResponse } from "next/server"
import { createOpenSearchFileSearchAdapter } from "@/lib/adapters/opensearch/file-search-adapter"

const DEFAULT_LIMIT = 50
const SEARCH_REQUIREMENTS = ["REQ-4.1.1", "REQ-4.1.2", "REQ-5.2.1"]
const SEARCH_MISSING_DIMENSIONS = ["permission_filter_hardening", "incremental_watermark", "production_es_runbook"]

export async function GET(request: NextRequest) {
  try {
    const keyword =
      request.nextUrl.searchParams.get("q") ??
      request.nextUrl.searchParams.get("keyword") ??
      ""
    const siteCode =
      request.nextUrl.searchParams.get("siteCode") ??
      request.nextUrl.searchParams.get("site") ??
      undefined
    const limit = Math.min(
      Number(request.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT),
      200
    )
    const offset = Math.max(
      Number(request.nextUrl.searchParams.get("offset") ?? "0"),
      0
    )

    const adapter = createOpenSearchFileSearchAdapter()
    const result = await adapter.searchFiles({
      keyword,
      siteCode,
      limit,
      offset,
    })

    if (result.source === "blocked_by_external_system") {
      return NextResponse.json(
        {
          code: 0,
          data: {
            items: [],
            total: 0,
            source: "blocked_by_external_system",
            blocker: result.blocker ?? "es_unavailable",
            requirements: SEARCH_REQUIREMENTS,
            missingDimensions: SEARCH_MISSING_DIMENSIONS,
          },
          message:
            "OpenSearch/ES file index is not configured or unreachable; see es-large-table-roadmap.md",
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      code: 0,
      data: {
        items: result.hits,
        total: result.total,
        source: "opensearch",
        requirements: SEARCH_REQUIREMENTS,
        missingDimensions: SEARCH_MISSING_DIMENSIONS,
      },
      message: "数据源: OpenSearch/ES (SearchPort)",
    })
  } catch (error) {
    return NextResponse.json(
      {
        code: 1,
        data: {
          items: [],
          total: 0,
          source: "blocked_by_external_system",
          blocker: "search_route_failure",
        },
        error: error instanceof Error ? error.message : "search_failed",
      },
      { status: 500 }
    )
  }
}
