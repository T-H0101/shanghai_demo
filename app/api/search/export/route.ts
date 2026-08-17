/**
 * GET /api/search/export — 检索结果导出（OpenSearch disc_file_index）
 * 列与统一检索页面对齐：中文表头 + 格式化内容
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
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
  try {
    const session = await requireSession(req)
    requirePermission(session, "platform:read")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  const url = new URL(req.url)
  const formatRaw = (url.searchParams.get("format") ?? "csv").toLowerCase()
  const format = formatRaw === "json" ? "json" : "csv"
  const keyword =
    url.searchParams.get("q") ?? url.searchParams.get("keyword") ?? ""
  const siteCode =
    url.searchParams.get("siteCode") ?? url.searchParams.get("site") ?? undefined
  const volumeRaw = url.searchParams.get("volumeId")
  const volumeId =
    volumeRaw != null && volumeRaw !== "" && Number.isFinite(Number(volumeRaw))
      ? Number(volumeRaw)
      : undefined
  const docTypeRaw = url.searchParams.get("docType")
  const docType =
    docTypeRaw === "file" || docTypeRaw === "folder" ? docTypeRaw : undefined
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 10000), 50000)

  try {
    const adapter = createOpenSearchFileSearchAdapter()
    const result = await adapter.searchFiles({
      keyword,
      siteCode: siteCode || undefined,
      volumeId,
      docType,
      limit,
      searchAfter: null,
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

    const [volumeMap, siteMap] = await Promise.all([loadVolumeNameMap(), loadSiteNameMap()])
    const rows: SearchExportRow[] = result.hits.map((hit) => {
      const enriched = {
        ...hit,
        siteName: hit.sourceSiteId ? siteMap.get(hit.sourceSiteId) ?? hit.sourceSiteId : null,
        volumeName:
          hit.volumeId != null && hit.sourceSiteId
            ? volumeMap.get(volumeKey(hit.sourceSiteId, hit.volumeId)) ??
              (hit.volumeName || null)
            : hit.volumeName,
      }
      return toSearchExportRowFromHit(enriched)
    })

    const exportResult = buildExport({
      exportType: "search",
      dataSource: "opensearch:disc_file_index",
      format,
      columns: [...SEARCH_EXPORT_COLUMNS],
      columnLabels: SEARCH_EXPORT_LABELS,
      rows,
      siteCode: siteCode ?? null,
      filters: {
        keyword: keyword || null,
        volumeId: volumeId != null ? String(volumeId) : null,
        docType: docType ?? null,
      },
      filenamePrefix: "search-export",
    })

    return toNextResponse(exportResult)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
