/**
 * GET /api/users
 * Sprint 2E.2 - 用户中心表列表 (优先真实, fallback mock)
 */

import { NextRequest, NextResponse } from "next/server"
import { users as mockUsers } from "@/lib/mock/users"
import { adaptUserList } from "@/lib/api/adapters"
import { listFromTable } from "@/lib/api/list-helper"
import type { ApiResponse, PaginatedResponse, UserDTO } from "@/lib/api/dto"

interface UserItem {
  id: string
  sourceSiteId: string
  sourceTable: string
  sourceId: string
  userId: string | null
  username: string | null
  displayName: string | null
  status: string | null
  role: string | null
  department: string | null
  phone: string | null
  email: string | null
  createdAt: string
}

export async function GET(request: NextRequest) {
  let dbResponse: Response | null = null
  try {
    dbResponse = await listFromTable<UserItem>(
      {
        sourceTable: 'unified_users',
        sourceSiteIdColumn: 'source_site_id',
        selectColumns: `
          id::text,
          source_site_id AS "sourceSiteId",
          source_table AS "sourceTable",
          source_id AS "sourceId",
          user_id AS "userId",
          username,
          display_name AS "displayName",
          status,
          role,
          department,
          phone,
          email,
          created_at::text AS "createdAt"
        `,
        keywordColumn: 'username',
        statusColumn: 'status',
      },
      request
    )
  } catch (err) {
    console.warn('[API/users] center DB query failed, fallback to mock:', err)
  }

  if (dbResponse && dbResponse.ok) {
    const body = await dbResponse.clone().json()
    if (body?.data?.items?.length > 0) {
      return dbResponse
    }
  }

  // Fallback: mock
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") ?? "1")
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20")
  const keyword = searchParams.get("keyword")
  const siteCode = searchParams.get("siteCode")
  const role = searchParams.get("role")

  let filteredUsers = [...mockUsers]
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
    filteredUsers = filteredUsers.filter(u => u.accessibleSites?.includes(siteCode))
  }
  if (role && role !== "all") {
    filteredUsers = filteredUsers.filter(u => u.role === role)
  }

  const total = filteredUsers.length
  const start = (page - 1) * pageSize
  const paginatedUsers = filteredUsers.slice(start, start + pageSize)
  const adaptedUsers = adaptUserList(paginatedUsers)

  const response: ApiResponse<PaginatedResponse<UserDTO>> = {
    code: 0,
    message: "ok",
    data: { items: adaptedUsers, page, pageSize, total },
    traceId: `api-${Date.now()}`,
  }
  return NextResponse.json(response)
}