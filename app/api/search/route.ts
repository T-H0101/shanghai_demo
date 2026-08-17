/**
 * GET /api/search
 * Cross-dimension file search — OpenSearch disc_file_index (业务 syncDB 推送契约)
 */

import { NextRequest, NextResponse } from "next/server"
import { createOpenSearchFileSearchAdapter } from "@/lib/adapters/opensearch/file-search-adapter"
import { query } from "@/lib/db"
import type { FileSearchHit } from "@/lib/ports/search-port"

const DEFAULT_LIMIT = 50
const SEARCH_REQUIREMENTS = ["REQ-4.1.1", "REQ-4.1.2", "REQ-5.2.1"]
const SEARCH_MISSING_DIMENSIONS = ["permission_filter_hardening", "production_es_runbook"]

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
       FROM unified_volumes`
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
      `SELECT site_code, site_name FROM sync_sites WHERE enabled IS DISTINCT FROM FALSE`
    )
    for (const row of rows) {
      map.set(row.site_code, row.site_name?.trim() || row.site_code)
    }
  } catch {
    // ignore
  }
  return map
}

function enrichHits(
  hits: FileSearchHit[],
  volumeNames: Map<string, string>,
  siteNames: Map<string, string>
): Array<FileSearchHit & { siteName: string | null }> {
  return hits.map((hit) => {
    let volumeName = hit.volumeName
    if (!volumeName && hit.volumeId != null) {
      volumeName =
        volumeNames.get(volumeKey(hit.sourceSiteId, hit.volumeId)) ??
        `卷-${hit.volumeId}`
    } else if (!volumeName && hit.volumeId != null) {
      volumeName = `卷-${hit.volumeId}`
    }
    return {
      ...hit,
      volumeName: volumeName ?? (hit.volumeId != null ? `卷-${hit.volumeId}` : null),
      volumeCode: hit.volumeCode ?? (hit.volumeId != null ? String(hit.volumeId) : null),
      siteName: siteNames.get(hit.sourceSiteId) ?? hit.sourceSiteId,
    }
  })
}

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
    const volumeRaw = request.nextUrl.searchParams.get("volumeId")
    const volumeId =
      volumeRaw != null && volumeRaw !== "" && Number.isFinite(Number(volumeRaw))
        ? Number(volumeRaw)
        : undefined
    const docTypeRaw = request.nextUrl.searchParams.get("docType")
    const docType =
      docTypeRaw === "file" || docTypeRaw === "folder" ? docTypeRaw : undefined

    const pageSize = Math.min(
      Number(request.nextUrl.searchParams.get("pageSize") ?? request.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT),
      500
    )
    const searchAfterRaw = request.nextUrl.searchParams.get("searchAfter")
    const searchAfter =
      searchAfterRaw != null && searchAfterRaw.trim() !== "" ? searchAfterRaw.trim() : null

    const adapter = createOpenSearchFileSearchAdapter()
    const result = await adapter.searchFiles({
      keyword,
      siteCode,
      volumeId,
      docType,
      limit: pageSize,
      searchAfter,
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
        { status: 200 }
      )
    }

    const [volumeNames, siteNames] = await Promise.all([
      loadVolumeNameMap(),
      loadSiteNameMap(),
    ])
    const items = enrichHits(result.hits, volumeNames, siteNames)

    let facets: {
      sites: Array<{ code: string; name: string }>
      volumes: Array<{ siteCode: string; volumeId: string; name: string }>
    } = { sites: [], volumes: [] }
    try {
      const siteRows = await query<SiteRow>(
        `SELECT site_code, site_name FROM sync_sites WHERE enabled IS DISTINCT FROM FALSE ORDER BY site_code`
      )
      facets.sites = siteRows.rows.map((r) => ({
        code: r.site_code,
        name: r.site_name?.trim() || r.site_code,
      }))
      const volParams: unknown[] = []
      let volSql = `SELECT source_site_id, volume_id::text AS volume_id, source_id::text AS source_id, volume_name
                    FROM unified_volumes`
      if (siteCode) {
        volSql += ` WHERE source_site_id = $1`
        volParams.push(siteCode)
      }
      volSql += ` ORDER BY source_site_id, volume_id NULLS LAST`
      const volRows = await query<VolumeRow>(volSql, volParams)
      const seen = new Set<string>()
      for (const row of volRows.rows) {
        const vid = row.volume_id || row.source_id
        if (!vid) continue
        const key = `${row.source_site_id}::${vid}`
        if (seen.has(key)) continue
        seen.add(key)
        facets.volumes.push({
          siteCode: row.source_site_id,
          volumeId: String(vid),
          name: row.volume_name?.trim() || `卷-${vid}`,
        })
      }
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
