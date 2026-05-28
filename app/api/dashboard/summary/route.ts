/**
 * GET /api/dashboard/summary
 * 首页统计数据 API
 */

import { NextResponse } from "next/server"
import { tasks, taskStats, taskAlerts } from "@/lib/mock/tasks"
import { racks, rackStats } from "@/lib/mock/racks"
import { sites, siteStats } from "@/lib/mock/sites"
import { adaptDashboardSummary } from "@/lib/api/adapters"
import type { ApiResponse, DashboardSummaryDTO } from "@/lib/api/dto"

export async function GET() {
  try {
    const summary = adaptDashboardSummary({
      taskStats,
      rackStats,
      siteStats,
      alertCount: {
        critical: taskAlerts.filter(a => a.level === "critical").length,
        warning: taskAlerts.filter(a => a.level === "warning").length,
      },
    })

    const response: ApiResponse<DashboardSummaryDTO> = {
      code: 0,
      message: "ok",
      data: summary,
      traceId: `api-${Date.now()}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API Error] /api/dashboard/summary:", error)
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
