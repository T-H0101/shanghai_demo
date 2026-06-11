/**
 * GET /api/users/export
 * Sprint R.13 — unified_users 真实只读导出
 *
 * 严格白名单字段, 不导出 raw_data (jsonb, 可能含源端额外字段).
 * 框架内 sanitize 兜底, 即使白名单不慎含 password 也会被剔除.
 *
 * Query:
 *   - siteCode: source_site_id 过滤
 *   - role:     role 过滤
 *   - status:   status 过滤
 *   - keyword:  username/display_name/email ILIKE 模糊
 *   - format:   csv | json | xlsx (xlsx 显式 not_implemented)
 *
 * R.1 §硬约束:
 *   - 不写入 (REQ-3.1.1/3.1.2 写仍 blocked_by_auth, 本端点纯只读)
 *   - dataSource = database | empty | error, 禁止 mock
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { buildExport } from "@/lib/export"
import { toNextResponse } from "@/lib/export/next-response"
import { recordExport } from "@/lib/export/audit"

export const dynamic = "force-dynamic"

interface UserExportRow extends Record<string, unknown> {
  user_id: string | null
  username: string
  display_name: string | null
  email: string | null
  phone: string | null
  role: string | null
  department: string | null
  status: string | null
  source_site_id: string
  source_table: string
  source_id: string
  synced_at: string
  created_at: string
}

// 白名单列 (不含 raw_data, 不含 password 类字段)
const COLUMNS: Array<keyof UserExportRow & string> = [
  "user_id",
  "username",
  "display_name",
  "email",
  "phone",
  "role",
  "department",
  "status",
  "source_site_id",
  "source_table",
  "source_id",
  "synced_at",
  "created_at",
]

const ALLOWED_FORMATS = ["csv", "json", "xlsx"] as const
type ExportFormat = (typeof ALLOWED_FORMATS)[number]

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const siteCode = sp.get("siteCode")?.trim() ?? ""
    const role = sp.get("role")?.trim() ?? ""
    const status = sp.get("status")?.trim() ?? ""
    const keyword = sp.get("keyword")?.trim() ?? ""
    const formatParam = (sp.get("format") ?? "csv").toLowerCase()

    if (!ALLOWED_FORMATS.includes(formatParam as ExportFormat)) {
      return NextResponse.json(
        { code: 400, message: `format must be one of ${ALLOWED_FORMATS.join("/")}`, dataSource: "error" },
        { status: 400 }
      )
    }
    const format = formatParam as ExportFormat

    const conditions: string[] = []
    const params: unknown[] = []
    if (siteCode) {
      params.push(siteCode)
      conditions.push(`source_site_id = $${params.length}`)
    }
    if (role) {
      params.push(role)
      conditions.push(`role = $${params.length}`)
    }
    if (status) {
      params.push(status)
      conditions.push(`status = $${params.length}`)
    }
    if (keyword) {
      params.push(`%${keyword}%`)
      const idx = params.length
      conditions.push(`(COALESCE(username,'') ILIKE $${idx} OR COALESCE(display_name,'') ILIKE $${idx} OR COALESCE(email,'') ILIKE $${idx})`)
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const result = await query<UserExportRow>(
      `SELECT
        user_id, username, display_name, email, phone, role, department, status,
        source_site_id, source_table, source_id,
        synced_at::text AS synced_at, created_at::text AS created_at
       FROM unified_users
       ${whereClause}
       ORDER BY source_site_id, username
       LIMIT 5000`,
      params
    )

    const exportResult = buildExport<UserExportRow>({
      exportType: "users",
      dataSource: "unified_users",
      format,
      columns: COLUMNS,
      rows: result.rows,
      siteCode: siteCode || null,
      filters: {
        role: role || null,
        status: status || null,
        keyword: keyword || null,
      },
      filenamePrefix: "users",
    })

    if (exportResult.code === "ok") {
      await recordExport(exportResult.manifest)
    }

    return toNextResponse(exportResult)
  } catch (error) {
    console.error("[API Error] /api/users/export:", error)
    return NextResponse.json(
      { code: 500, message: "Internal server error", dataSource: "error", traceId: `api-${Date.now()}` },
      { status: 500 }
    )
  }
}
