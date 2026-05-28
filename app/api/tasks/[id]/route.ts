/**
 * GET /api/tasks/[id]
 * 任务详情 API
 */

import { NextRequest, NextResponse } from "next/server"
import { tasks } from "@/lib/mock/tasks"
import { adaptTask } from "@/lib/api/adapters"
import type { ApiResponse, TaskDTO } from "@/lib/api/dto"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const task = tasks.find(t => t.id === id)

    if (!task) {
      return NextResponse.json(
        {
          code: 404,
          message: "Task not found",
          data: null,
          traceId: `api-${Date.now()}`,
        },
        { status: 404 }
      )
    }

    const adaptedTask = adaptTask(task)

    const response: ApiResponse<TaskDTO> = {
      code: 0,
      message: "ok",
      data: adaptedTask,
      traceId: `api-${Date.now()}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API Error] /api/tasks/[id]:", error)
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
