/**
 * GET /api/racks
 * 盘架列表 API
 */

import { NextRequest, NextResponse } from "next/server"
import { racks } from "@/lib/mock/racks"
import { adaptRackList } from "@/lib/api/adapters"
import type { ApiResponse, RackDTO } from "@/lib/api/dto"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const siteCode = searchParams.get("siteCode")
    const status = searchParams.get("status")

    // 过滤
    let filteredRacks = [...racks]
    if (siteCode) {
      filteredRacks = filteredRacks.filter(r => r.siteCode === siteCode)
    }
    if (status) {
      filteredRacks = filteredRacks.filter(r => r.status === status)
    }

    // 转换
    const adaptedRacks = adaptRackList(filteredRacks)

    const response: ApiResponse<RackDTO[]> = {
      code: 0,
      message: "ok",
      data: adaptedRacks,
      traceId: `api-${Date.now()}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API Error] /api/racks:", error)
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
