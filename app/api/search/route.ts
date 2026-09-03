/**
 * GET /api/search
 * Cross-dimension file search — OpenSearch disc_file_index (业务 syncDB 推送契约)
 */

import { NextRequest, NextResponse } from "next/server"
import { createOpenSearchFileSearchAdapter } from "@/lib/adapters/opensearch/file-search-adapter"
import { query } from "@/lib/db"
import {
  buildSearchEnrichmentContext,
  enrichSearchHits,
  loadDeviceNameByIp,
  relocationFilterFromRegion,
} from "@/lib/search/hit-enrichment"
import {
  loadAccessibleRegionFacets,
  resolveSearchRegionFilter,
} from "@/lib/search/search-region-scope"
import {
  filterSearchHitsByScope,
  requireSearchSession,
  resolveSearchSiteScope,
  searchScopeIsEmpty,
} from "@/lib/search/search-site-scope"

const DEFAULT_LIMIT = 50
const SEARCH_REQUIREMENTS = ["REQ-4.1.1", "REQ-4.1.2", "REQ-5.2.1"]
const SEARCH_MISSING_DIMENSIONS = ["dept_permission_filter", "production_es_runbook"]

type VolumeRow = {
  source_site_id: string
  volume_id: string | null
  source_id: string
  volume_name: string | null
}

type SiteRow = {
  site_code: string
  site_name: string | null
}

function volumeKey(siteId: string, volumeId: string | number) {
  return `${siteId}::${String(volumeId)}`
}

async function loadVolumeNameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const { rows } = await query<VolumeRow>(
      `SELECT source_site_id,
              volume_id::text AS volume_id,
              source_id::text AS source_id,
              volume_name
       FROM unified_volumes`,
    )
    for (const row of rows) {
      const name = row.volume_name?.trim()
      const label = name || null
      if (!label) continue
      const site = row.source_site_id
      if (row.volume_id) map.set(volumeKey(site, row.volume_id), label)
      if (row.source_id) map.set(volumeKey(site, row.source_id), label)
    }
  } catch {
    // 中心库不可用时仍返回 ES 原始结果
  }
  return map
}

async function loadSiteNameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const { rows } = await query<SiteRow>(
      `SELECT site_code, site_name FROM sync_sites WHERE enabled IS DISTINCT FROM FALSE`,
    )
    for (const row of rows) {
      map.set(row.site_code, row.site_name?.trim() || row.site_code)
    }
  } catch {
    // ignore
  }
  return map
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSearchSession(request)
    const keyword =
      request.nextUrl.searchParams.get("q") ??
      request.nextUrl.searchParams.get("keyword") ??
      ""
    const scope = resolveSearchSiteScope(session, null)
    if (searchScopeIsEmpty(scope)) {
      const regions = await loadAccessibleRegionFacets()
      return NextResponse.json({
        code: 0,
        data: {
          items: [],
          total: 0,
          nextSearchAfter: null,
          hasMore: false,
          source: "opensearch",
          pageSize: DEFAULT_LIMIT,
          searchAfter: null,
          facets: { regions },
          requirements: SEARCH_REQUIREMENTS,
          missingDimensions: SEARCH_MISSING_DIMENSIONS,
        },
        message: "当前账号无可访问站点",
      })
    }

    const regionCodeParam =
      request.nextUrl.searchParams.get("regionCode") ??
      request.nextUrl.searchParams.get("region") ??
      undefined
    const regionFilter = await resolveSearchRegionFilter(session, regionCodeParam, scope)
    const esSiteCodes = regionFilter.siteCodes
    const docType = "file" as const

    const pageSize = Math.min(
      Number(
        request.nextUrl.searchParams.get("pageSize") ??
          request.nextUrl.searchParams.get("limit") ??
          DEFAULT_LIMIT,
      ),
      500,
    )
    const searchAfterRaw = request.nextUrl.searchParams.get("searchAfter")
    const searchAfter =
      searchAfterRaw != null && searchAfterRaw.trim() !== "" ? searchAfterRaw.trim() : null

    const enrichment = await buildSearchEnrichmentContext()
    const rfidFilter =
      regionFilter.kind === "region"
        ? relocationFilterFromRegion(
            enrichment.relocations,
            regionFilter.regionCode,
            regionFilter.siteCodes,
          )
        : { inboundRfids: [], outboundRfids: [] }

    const adapter = createOpenSearchFileSearchAdapter()
    const result = await adapter.searchFiles({
      keyword,
      siteCodes: esSiteCodes,
      docType,
      limit: pageSize,
      searchAfter,
      inboundRfids: rfidFilter.inboundRfids,
      outboundRfids: rfidFilter.outboundRfids,
    })

    if (result.source === "blocked_by_external_system") {
      return NextResponse.json(
        {
          code: 0,
          data: {
            items: [],
            total: 0,
            nextSearchAfter: null,
            hasMore: false,
            source: "blocked_by_external_system",
            blocker: result.blocker ?? "es_unavailable",
            requirements: SEARCH_REQUIREMENTS,
            missingDimensions: SEARCH_MISSING_DIMENSIONS,
          },
          message:
            "OpenSearch/ES file index is not configured or unreachable; set SEARCH_ES_URL / SEARCH_ES_INDEX",
        },
        { status: 200 },
      )
    }

    const previewIps = result.hits
      .map((h) => {
        const rfid = h.magazineRfid?.trim()
        const relocated = rfid ? enrichment.relocationMap.has(rfid) : false
        if (relocated) return ""
        return (h.deviceIp || "").trim()
      })
      .filter(Boolean)

    const [volumeNames, siteNames, deviceNames] = await Promise.all([
      loadVolumeNameMap(),
      loadSiteNameMap(),
      loadDeviceNameByIp(previewIps),
    ])
    const items = filterSearchHitsByScope(
      enrichSearchHits(result.hits, {
        volumeNames,
        siteNames,
        relocationMap: enrichment.relocationMap,
        siteToRegion: enrichment.siteToRegion,
        regionNames: enrichment.regionNames,
        deviceNames,
      }),
      scope,
    )

    let facets: { regions: Array<{ code: string; name: string }> } = { regions: [] }
    try {
      facets = { regions: await loadAccessibleRegionFacets() }
    } catch {
      // facets optional
    }

    return NextResponse.json({
      code: 0,
      data: {
        items,
        total: 0,
        nextSearchAfter: result.nextSearchAfter,
        hasMore: result.hasMore,
        source: "opensearch",
        pageSize,
        searchAfter,
        facets,
        requirements: SEARCH_REQUIREMENTS,
        missingDimensions: SEARCH_MISSING_DIMENSIONS,
      },
      message: "数据源: OpenSearch/ES disc_file_index（_id search_after 分页）",
    })
  } catch (error) {
    if (error instanceof NextResponse) return error
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
      { status: 500 },
    )
  }
}
