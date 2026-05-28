/**
 * GET /api/users
 * 用户列表 API
 */

import { NextRequest, NextResponse } from "next/server"
import { users } from "@/lib/mock/users"
import { adaptUserList } from "@/lib/api/adapters"
import type { ApiResponse, PaginatedResponse, UserDTO } from "@/lib/api/dto"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") ?? "1")
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20")
    const keyword = searchParams.get("keyword")
    const siteCode = searchParams.get("siteCode")
    const role = searchParams.get("role")

    // 过滤
    let filteredUsers = [...users]
    if (keyword) {
      const kw = keyword.toLowerCase()
      filteredUsers = filteredUsers.filter(
        u =>
          u.username.toLowerCase().includes(kw) ||
          u.displayName?.toLowerCase().includes(kw) ||
          u.department?.toLowerCase().includes(kw)
      )
    }
    if (siteCode) {
      filteredUsers = filteredUsers.filter(u =>
        u.accessibleSites?.includes(siteCode)
      )
    }
    if (role && role !== "all") {
      filteredUsers = filteredUsers.filter(u => u.role === role)
    }

    // 分页
    const total = filteredUsers.length
    const start = (page - 1) * pageSize
    const paginatedUsers = filteredUsers.slice(start, start + pageSize)

    // 转换
    const adaptedUsers = adaptUserList(paginatedUsers)

    const response: ApiResponse<PaginatedResponse<UserDTO>> = {
      code: 0,
      message: "ok",
      data: {
        items: adaptedUsers,
        page,
        pageSize,
        total,
      },
      traceId: `api-${Date.now()}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API Error] /api/users:", error)
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
