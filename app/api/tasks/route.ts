/**
 * GET /api/tasks
 * 任务列表 API
 */

import { NextRequest, NextResponse } from "next/server"
import { tasks } from "@/lib/mock/tasks"
import { adaptTaskList } from "@/lib/api/adapters"
import type { ApiResponse, PaginatedResponse, TaskDTO } from "@/lib/api/dto"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") ?? "1")
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20")
    const status = searchParams.get("status")
    const type = searchParams.get("type")
    const siteCode = searchParams.get("siteCode")

    // 过滤
    let filteredTasks = [...tasks]
    if (status && status !== "all") {
      filteredTasks = filteredTasks.filter(t => t.status === status || t.phase === status)
    }
    if (type && type !== "all") {
      filteredTasks = filteredTasks.filter(t => t.type === type)
    }
    if (siteCode) {
      filteredTasks = filteredTasks.filter(t => t.siteCode === siteCode)
    }

    // 分页
    const total = filteredTasks.length
    const start = (page - 1) * pageSize
    const paginatedTasks = filteredTasks.slice(start, start + pageSize)

    // 转换
    const adaptedTasks = adaptTaskList(paginatedTasks)

    const response: ApiResponse<PaginatedResponse<TaskDTO>> = {
      code: 0,
      message: "ok",
      data: {
        items: adaptedTasks,
        page,
        pageSize,
        total,
      },
      traceId: `api-${Date.now()}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API Error] /api/tasks:", error)
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
