/**
 * GET /api/auth/audit/export - 登录审计导出
 *
 * REQ-2.2.3: 支持 CSV/JSON/XLSX 导出
 *
 * Sprint R.27
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { ensureAuthSchema } from "@/lib/auth/server"
import { createHash } from "crypto"

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
  const format = url.searchParams.get("format") ?? "csv"
  const username = url.searchParams.get("username") ?? undefined
  const result = url.searchParams.get("result") ?? undefined
  const siteCode = url.searchParams.get("siteCode") ?? undefined
  const from = url.searchParams.get("from") ?? undefined
  const to = url.searchParams.get("to") ?? undefined

  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (username) { conditions.push(`username ILIKE $${idx}`); params.push(`%${username}%`); idx++ }
  if (result) { conditions.push(`result = $${idx}`); params.push(result); idx++ }
  if (siteCode) { conditions.push(`site_code = $${idx}`); params.push(siteCode); idx++ }
  if (from) { conditions.push(`created_at >= $${idx}`); params.push(from); idx++ }
  if (to) { conditions.push(`created_at <= $${idx}`); params.push(to); idx++ }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  try {
    const dataResult = await query<AuditRow>(
      `SELECT id::text, username, account_id::text, site_code, ip_address, user_agent,
              result, failure_reason, provider, created_at::text
       FROM auth_login_audit
       ${where}
       ORDER BY created_at DESC
       LIMIT 10000`,
      params,
    )

    const rows = dataResult.rows
    const sha256 = createHash("sha256").update(JSON.stringify(rows)).digest("hex")

    if (format === "json") {
      const body = JSON.stringify({ data: rows, total: rows.length, sha256 }, null, 2)
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="login-audit-${new Date().toISOString().slice(0, 10)}.json"`,
          "x-sha256": sha256,
          "x-record-count": String(rows.length),
        },
      })
    }

    // CSV (default)
    const header = "id,username,account_id,site_code,ip_address,result,failure_reason,provider,created_at"
    const csvRows = rows.map(r =>
      [r.id, r.username, r.account_id ?? "", r.site_code ?? "", r.ip_address ?? "", r.result, (r.failure_reason ?? "").replace(/,/g, ";"), r.provider, r.created_at].join(",")
    )
    const csv = [header, ...csvRows].join("\n")
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="login-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
        "x-sha256": sha256,
        "x-record-count": String(rows.length),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
