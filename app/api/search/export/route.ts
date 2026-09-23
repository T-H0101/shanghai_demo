/**
 * GET /api/search/export — 检索结果导出（OpenSearch disc_file_index）
 */

import { NextRequest, NextResponse } from "next/server"
import type { AuthUser } from "@/lib/auth/server"
import { createOpenSearchFileSearchAdapter } from "@/lib/adapters/opensearch/file-search-adapter"
import { query } from "@/lib/db"
import { buildExport } from "@/lib/export"
import { toNextResponse } from "@/lib/export/next-response"
import {
  SEARCH_EXPORT_COLUMNS,
  SEARCH_EXPORT_LABELS,
  toSearchExportRowFromHit,
  type SearchExportRow,
} from "@/lib/search/export-format"
import {
  buildSearchEnrichmentContext,
  enrichSearchHits,
  loadDeviceNameByIp,
  relocationFilterFromRegion,
} from "@/lib/search/hit-enrichment"
import { resolveSearchRegionFilter } from "@/lib/search/search-region-scope"
import {
  filterSearchHitsByScope,
  requireSearchSession,
  resolveSearchSiteScope,
  searchScopeIsEmpty,
} from "@/lib/search/search-site-scope"

type VolumeRow = {
  source_site_id: string
  volume_id: string | null
  source_id: string
  volume_name: string | null
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
      if (!name) continue
      const site = row.source_site_id
      if (row.volume_id) map.set(volumeKey(site, row.volume_id), name)
      if (row.source_id) map.set(volumeKey(site, row.source_id), name)
    }
  } catch {
    // ignore
  }
  return map
}

async function loadSiteNameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const { rows } = await query<{ site_code: string; site_name: string | null }>(
      `SELECT site_code, site_name FROM sync_sites WHERE enabled IS DISTINCT FROM FALSE`,
    )
    for (const row of rows) {
      if (row.site_code) map.set(row.site_code, row.site_name?.trim() || row.site_code)
    }
  } catch {
    // ignore
  }
  return map
}

export async function GET(req: NextRequest) {
  let session: AuthUser
  try {
    session = await requireSearchSession(req)
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: "AUTH_ERROR" }, { status: 500 })
  }

  const url = new URL(req.url)
  const formatRaw = (url.searchParams.get("format") ?? "csv").toLowerCase()
  const format = formatRaw === "json" ? "json" : "csv"
  const keyword = url.searchParams.get("q") ?? url.searchParams.get("keyword") ?? ""
  const regionCodeParam =
    url.searchParams.get("regionCode") ?? url.searchParams.get("region") ?? undefined
  const docType = "file" as const
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 10000), 50000)

  try {
    const scope = resolveSearchSiteScope(session, null)
    if (searchScopeIsEmpty(scope)) {
      const exportResult = buildExport({
        exportType: "search",
        dataSource: "opensearch:disc_file_index",
        format,
        columns: [...SEARCH_EXPORT_COLUMNS],
        columnLabels: SEARCH_EXPORT_LABELS,
        rows: [],
        siteCode: null,
        filters: {
          keyword: keyword || null,
          regionCode: regionCodeParam ?? null,
          docType: docType ?? null,
        },
        filenamePrefix: "search-export",
      })
      return toNextResponse(exportResult)
    }

    const regionFilter = await resolveSearchRegionFilter(session, regionCodeParam, scope)
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
      siteCodes: regionFilter.siteCodes,
      docType,
      limit,
      searchAfter: null,
      inboundRfids: rfidFilter.inboundRfids,
      outboundRfids: rfidFilter.outboundRfids,
    })

    if (result.source === "blocked_by_external_system") {
      return NextResponse.json(
        {
          error: "search_export_unavailable",
          blocker: result.blocker ?? "blocked_by_external_system",
          message: "全文检索服务暂未接入，无法导出。",
        },
        { status: 501 },
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

    const [volumeMap, siteMap, deviceNames] = await Promise.all([
      loadVolumeNameMap(),
      loadSiteNameMap(),
      loadDeviceNameByIp(previewIps),
    ])
    const enriched = filterSearchHitsByScope(
      enrichSearchHits(result.hits, {
        volumeNames: volumeMap,
        siteNames: siteMap,
        relocationMap: enrichment.relocationMap,
        siteToRegion: enrichment.siteToRegion,
        regionNames: enrichment.regionNames,
        deviceNames,
      }),
      scope,
    )
    const rows: SearchExportRow[] = enriched.map((hit) => toSearchExportRowFromHit(hit))

    const exportResult = buildExport({
      exportType: "search",
      dataSource: "opensearch:disc_file_index",
      format,
      columns: [...SEARCH_EXPORT_COLUMNS],
      columnLabels: SEARCH_EXPORT_LABELS,
      rows,
      siteCode: null,
      filters: {
        keyword: keyword || null,
        regionCode: regionCodeParam ?? null,
        docType: docType ?? null,
      },
      filenamePrefix: "search-export",
    })

    return toNextResponse(exportResult)
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json(
      { message: "未知异常", error: "UNKNOWN_EXCEPTION" },
      { status: 500 },
    )
  }
}
