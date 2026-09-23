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
import { requirePermission, requireSession } from "@/lib/auth/middleware"
import { createHash } from "crypto"
import { buildExport } from "@/lib/export"
import { buildManifest } from "@/lib/export/manifest"
import { buildXlsxExport } from "@/lib/export/xlsx"
import { toNextResponse } from "@/lib/export/next-response"
import { recordExport, resolveExportActor } from "@/lib/export/audit"
import { formatBeijingTime } from "@/lib/time/beijing"
import { logStatusLabel } from "@/lib/types/logs"

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
  [key: string]: unknown
}

const COLUMNS = [
  "username",
  "operation",
  "site_code",
  "ip_address",
  "result",
  "failure_reason",
  "created_at",
] as const

const COLUMN_LABELS = ["用户名", "操作", "站点", "IP", "状态", "失败原因", "时间"] as const

type DisplayRow = {
  username: string
  operation: string
  site_code: string
  ip_address: string
  result: string
  failure_reason: string
  created_at: string
  [key: string]: unknown
}

function toDisplayRows(rows: AuditRow[]): DisplayRow[] {
  return rows.map((r) => {
    const status = r.result
    let operation = "登录认证"
    if (status === "success") operation = "登录成功"
    else if (status === "failed") operation = "登录失败"
    else if (status === "locked") operation = "账号锁定"
    else if (status === "logout") operation = "退出登录"
    return {
      username: r.username,
      operation,
      site_code: r.site_code ?? "",
      ip_address: r.ip_address ?? "",
      result: logStatusLabel(status),
      failure_reason: r.failure_reason ?? "",
      created_at: formatBeijingTime(r.created_at) || r.created_at,
    }
  })
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "audit:read")
  } catch (e) {
    if (e instanceof NextResponse) return e
    throw e
  }

  await ensureAuthSchema()
  const actor = await resolveExportActor(req)

  const url = new URL(req.url)
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase()
  if (format !== "csv" && format !== "json" && format !== "xlsx") {
    return NextResponse.json(
      { code: 400, message: "format must be csv, json, or xlsx" },
      { status: 400 },
    )
  }
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
  if (siteCode) { conditions.push(`site_code ILIKE $${idx}`); params.push(`%${siteCode}%`); idx++ }
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
    const columns = COLUMNS as unknown as Array<keyof DisplayRow & string>
    const labels = [...COLUMN_LABELS]
    const displayRows = toDisplayRows(rows)

    if (format === "json") {
      const filename = `login-audit-${new Date().toISOString().slice(0, 10)}.json`
      const body = JSON.stringify({ data: rows, total: rows.length, sha256 }, null, 2)
      await recordExport(
        buildManifest({
          exportType: "login_audit",
          format: "json",
          dataSource: "auth_login_audit",
          rowCount: rows.length,
          sha256,
          filename,
          siteCode: siteCode ?? null,
          filters: { username, result, from, to },
        }),
        { actor },
      )
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "x-sha256": sha256,
          "x-record-count": String(rows.length),
        },
      })
    }

    if (format === "xlsx") {
      const exportResult = await buildXlsxExport<DisplayRow>({
        exportType: "login_audit",
        dataSource: "auth_login_audit",
        format: "xlsx",
        columns,
        columnLabels: labels,
        rows: displayRows,
        siteCode: siteCode ?? null,
        filters: { username, result, from, to },
        filenamePrefix: "login-audit",
      })
      await recordExport(exportResult.manifest, { actor })
      return toNextResponse(exportResult)
    }

    const exportResult = buildExport<DisplayRow>({
      exportType: "login_audit",
      dataSource: "auth_login_audit",
      format: "csv",
      columns,
      columnLabels: labels,
      rows: displayRows,
      siteCode: siteCode ?? null,
      filters: { username, result, from, to },
      filenamePrefix: "login-audit",
    })
    await recordExport(exportResult.manifest, { actor })
    return toNextResponse(exportResult)
  } catch (e) {
    return NextResponse.json(
      { message: "未知异常", error: "UNKNOWN_EXCEPTION" },
      { status: 500 },
    )
  }
}
