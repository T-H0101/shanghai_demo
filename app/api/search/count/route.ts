/**
 * GET /api/search/count
 * 与统一检索同条件的 OpenSearch /_count（精确命中总数）
 * 由前端在「检索条件变化」时调用一次；翻页不应重复请求。
 */

import { NextRequest, NextResponse } from "next/server"
import { loadSiteRfidRelocationFilter } from "@/lib/control/cage-move-register"
import { countFilesInEs, isEsConfigured } from "@/lib/search/es-client"

export async function GET(request: NextRequest) {
  try {
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

    const rfidFilter = siteCode
      ? await loadSiteRfidRelocationFilter([siteCode])
      : { inboundRfids: [], outboundRfids: [] }

    const total = await countFilesInEs({
      q: keyword,
      siteCodes: siteCode ? [siteCode] : [],
      volumeId,
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
