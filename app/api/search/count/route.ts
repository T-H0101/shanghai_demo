/**
 * GET /api/search/count
 * 与统一检索同条件的 OpenSearch /_count（精确命中总数）
 * 由前端在「检索条件变化」时调用一次；翻页不应重复请求。
 */

import { NextRequest, NextResponse } from "next/server"
import { listCurrentMagazineLocations } from "@/lib/control/cage-move-register"
import {
  relocationFilterFromDevice,
  relocationFilterFromLocations,
} from "@/lib/search/hit-enrichment"
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
    const deviceIpRaw =
      request.nextUrl.searchParams.get("deviceIp") ??
      request.nextUrl.searchParams.get("device_ip") ??
      undefined
    const deviceIp = deviceIpRaw?.trim() || undefined
    const docType = "file" as const

    const locations = await listCurrentMagazineLocations()
    const rfidFilter = siteCode
      ? relocationFilterFromLocations(locations, [siteCode])
      : { inboundRfids: [], outboundRfids: [] }
    const deviceRfidFilter = deviceIp
      ? relocationFilterFromDevice(locations, deviceIp)
      : { inboundRfids: [], outboundRfids: [] }

    const total = await countFilesInEs({
      q: keyword,
      siteCodes: siteCode ? [siteCode] : [],
      deviceIp,
      docType,
      inboundRfids: rfidFilter.inboundRfids,
      outboundRfids: rfidFilter.outboundRfids,
      deviceInboundRfids: deviceRfidFilter.inboundRfids,
      deviceOutboundRfids: deviceRfidFilter.outboundRfids,
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
