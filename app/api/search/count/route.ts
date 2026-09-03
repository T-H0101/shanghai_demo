/**
 * GET /api/search/count
 * 与统一检索同条件的 OpenSearch /_count（精确命中总数）
 */

import { NextRequest, NextResponse } from "next/server"
import {
  buildSearchEnrichmentContext,
  relocationFilterFromRegion,
} from "@/lib/search/hit-enrichment"
import { countFilesInEs, isEsConfigured } from "@/lib/search/es-client"
import { resolveSearchRegionFilter } from "@/lib/search/search-region-scope"
import {
  requireSearchSession,
  resolveSearchSiteScope,
  searchScopeIsEmpty,
} from "@/lib/search/search-site-scope"

export async function GET(request: NextRequest) {
  try {
    const session = await requireSearchSession(request)
    if (!isEsConfigured()) {
      return NextResponse.json(
        {
          code: 0,
          data: {
            total: 0,
            source: "blocked_by_external_system",
            blocker: "es_not_configured",
          },
          message: "OpenSearch 未配置",
        },
        { status: 200 },
      )
    }

    const keyword =
      request.nextUrl.searchParams.get("q") ??
      request.nextUrl.searchParams.get("keyword") ??
      ""
    const scope = resolveSearchSiteScope(session, null)
    if (searchScopeIsEmpty(scope)) {
      return NextResponse.json({
        code: 0,
        data: { total: 0, source: "opensearch" },
        message: "当前账号无可访问站点",
      })
    }

    const regionCodeParam =
      request.nextUrl.searchParams.get("regionCode") ??
      request.nextUrl.searchParams.get("region") ??
      undefined
    const regionFilter = await resolveSearchRegionFilter(session, regionCodeParam, scope)
    const docType = "file" as const

    const enrichment = await buildSearchEnrichmentContext()
    const rfidFilter =
      regionFilter.kind === "region"
        ? relocationFilterFromRegion(
            enrichment.relocations,
            regionFilter.regionCode,
            regionFilter.siteCodes,
          )
        : { inboundRfids: [], outboundRfids: [] }

    const total = await countFilesInEs({
      q: keyword,
      siteCodes: regionFilter.siteCodes,
      docType,
      inboundRfids: rfidFilter.inboundRfids,
      outboundRfids: rfidFilter.outboundRfids,
    })

    return NextResponse.json({
      code: 0,
      data: {
        total,
        source: "opensearch",
      },
      message: "OpenSearch /_count",
    })
  } catch (error) {
    if (error instanceof NextResponse) return error
    return NextResponse.json(
      {
        code: 1,
        data: {
          total: 0,
          source: "blocked_by_external_system",
          blocker: "es_count_failure",
        },
        error: error instanceof Error ? error.message : "count_failed",
      },
      { status: 500 },
    )
  }
}
