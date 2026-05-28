/**
 * GET /api/volumes
 * 存储卷列表 API
 */

import { NextRequest, NextResponse } from "next/server"
import { racks } from "@/lib/mock/racks"
import { adaptVolumeList } from "@/lib/api/adapters"
import type { ApiResponse, VolumeDTO } from "@/lib/api/dto"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const siteCode = searchParams.get("siteCode")
    const type = searchParams.get("type")

    // 从 rack.volumes 收集所有卷
    let allVolumes = racks.flatMap(r => r.volumes ?? [])

    // 过滤
    if (siteCode) {
      const siteRacks = racks.filter(r => r.siteCode === siteCode)
      allVolumes = siteRacks.flatMap(r => r.volumes ?? [])
    }
    if (type && type !== "all") {
      allVolumes = allVolumes.filter(v => v.type === type)
    }

    // 去重
    const uniqueVolumes = allVolumes.filter(
      (v, index, self) => self.findIndex(x => x.id === v.id) === index
    )

    // 转换
    const adaptedVolumes = adaptVolumeList(uniqueVolumes)

    const response: ApiResponse<VolumeDTO[]> = {
      code: 0,
      message: "ok",
      data: adaptedVolumes,
      traceId: `api-${Date.now()}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API Error] /api/volumes:", error)
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
