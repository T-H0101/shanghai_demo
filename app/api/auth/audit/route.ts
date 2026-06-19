/**
 * GET /api/auth/audit - 登录审计检索
 *
 * REQ-2.2.3: 支持按账号、时间、状态、IP、站点过滤
 *
 * Sprint R.27
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { ensureAuthSchema } from "@/lib/auth/server"

interface AuditRow {
  id: string
  username: string
  account_id: string | null
  site_code: string | null
  ip_address: string | null
  user_agent: string | null
  result: string
  failure_reason: string | null
  provider: string
  created_at: string
}

export async function GET(req: NextRequest) {
  await ensureAuthSchema()

  const url = new URL(req.url)
  const username = url.searchParams.get("username") ?? undefined
  const result = url.searchParams.get("result") ?? undefined
  const siteCode = url.searchParams.get("siteCode") ?? undefined
  const ip = url.searchParams.get("ip") ?? undefined
  const from = url.searchParams.get("from") ?? undefined
  const to = url.searchParams.get("to") ?? undefined
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500)
  const offset = Number(url.searchParams.get("offset") ?? 0)

  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (username) {
    conditions.push(`username ILIKE $${idx}`)
    params.push(`%${username}%`)
    idx++
  }
  if (result) {
    conditions.push(`result = $${idx}`)
    params.push(result)
    idx++
  }
  if (siteCode) {
    conditions.push(`site_code = $${idx}`)
    params.push(siteCode)
    idx++
  }
  if (ip) {
    conditions.push(`ip_address ILIKE $${idx}`)
    params.push(`%${ip}%`)
    idx++
  }
  if (from) {
    conditions.push(`created_at >= $${idx}`)
    params.push(from)
    idx++
  }
  if (to) {
    conditions.push(`created_at <= $${idx}`)
    params.push(to)
    idx++
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  try {
    const [countResult, dataResult] = await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM auth_login_audit ${where}`, params),
      query<AuditRow>(
        `SELECT id::text, username, account_id::text, site_code, ip_address, user_agent,
                result, failure_reason, provider, created_at::text
         FROM auth_login_audit
         ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
    ])

    return NextResponse.json({
      ok: true,
      data: {
        items: dataResult.rows,
        total: Number.parseInt(countResult.rows[0]?.count ?? "0", 10),
        limit,
        offset,
      },
      dataSource: "database",
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), dataSource: "error" },
      { status: 500 },
    )
  }
}
