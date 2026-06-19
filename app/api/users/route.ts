/**
 * GET /api/users
 * 用户中心表只读列表。
 * 中心库失败或为空时 fail-closed，不允许 mock fallback。
 */

import { NextRequest, NextResponse } from "next/server"
import { listFromTable } from "@/lib/api/list-helper"
import { requireSession, requirePermission } from "@/lib/auth/middleware"

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
  try {
    // Sprint R.29: 防越权
    const session = await requireSession(request)
    requirePermission(session, "users:read")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  return listFromTable<UserItem>(
    {
      sourceTable: "unified_users",
      sourceSiteIdColumn: "source_site_id",
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
      keywordColumn: "username",
      statusColumn: "status",
    },
    request
  )
}
