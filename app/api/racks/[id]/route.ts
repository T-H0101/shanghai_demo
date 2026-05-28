/**
 * GET /api/racks/[id]
 * 盘架详情 API
 */

import { NextRequest, NextResponse } from "next/server"
import { racks } from "@/lib/mock/racks"
import { adaptRack } from "@/lib/api/adapters"
import type { ApiResponse, RackDTO } from "@/lib/api/dto"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rack = racks.find(r => r.id === id || r.rackId === id)

    if (!rack) {
      return NextResponse.json(
        {
          code: 404,
          message: "Rack not found",
          data: null,
          traceId: `api-${Date.now()}`,
        },
        { status: 404 }
      )
    }

    const adaptedRack = adaptRack(rack)

    const response: ApiResponse<RackDTO> = {
      code: 0,
      message: "ok",
      data: adaptedRack,
      traceId: `api-${Date.now()}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API Error] /api/racks/[id]:", error)
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
