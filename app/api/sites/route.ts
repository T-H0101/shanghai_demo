/**
 * GET /api/sites
 * 站点列表 API
 */

import { NextRequest, NextResponse } from "next/server"
import { sites } from "@/lib/mock/sites"
import { adaptSiteList } from "@/lib/api/adapters"
import type { ApiResponse, SiteDTO } from "@/lib/api/dto"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")

    // 过滤
    let filteredSites = [...sites]
    if (status) {
      filteredSites = filteredSites.filter(s => s.status === status)
    }

    // 转换
    const adaptedSites = adaptSiteList(filteredSites)

    const response: ApiResponse<SiteDTO[]> = {
      code: 0,
      message: "ok",
      data: adaptedSites,
      traceId: `api-${Date.now()}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API Error] /api/sites:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        data: null,
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
