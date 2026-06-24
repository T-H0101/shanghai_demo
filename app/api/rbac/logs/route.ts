/**
 * GET /api/rbac/logs
 *
 * Sprint R.83.2 Task 5 — Read-only log browser over center DB unified_sys_logs.
 *
 * Logs are read-only: POST/PUT/DELETE are NOT exported. Next.js will return 405
 * for unhandled methods on a route handler that only exports GET.
 *
 * Auth: blocked_by_auth per CLAUDE.md (no auth check here).
 * Source: center DB only (lib/db → DATABASE_URL). NO restore DB.
 *
 * Envelope:
 *   { code: 0, data: { ...payload, sourceTables: [...] }, traceId }
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

const TARGET_TABLE = "unified_sys_logs"
const SOURCE_TABLES = [
  "unified_sys_logs",
  "unified_api_logs",
  "unified_api_interfaces",
]

async function list(siteCode: string | null, limit: number, offset: number) {
  const params: unknown[] = []
  let where = ""
  if (siteCode) {
    params.push(siteCode)
    where = `WHERE source_site_id = $${params.length}`
  }
  params.push(limit, offset)
  const itemsRes = await query<Record<string, unknown>>(
    `SELECT source_site_id, source_record_id, source_table, synced_at, raw_data
     FROM ${TARGET_TABLE} ${where}
     ORDER BY synced_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  const totalRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${TARGET_TABLE} ${where}`,
    siteCode ? [siteCode] : []
  )
  return {
    items: itemsRes.rows,
    total: Number(totalRes.rows[0]?.count ?? 0),
  }
}

export async function GET(req: NextRequest) {
  const traceId = `rbac-logs-${Date.now()}`
  try {
    const url = new URL(req.url)
    const siteCode = url.searchParams.get("siteCode")
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 500)
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0)
    const data = await list(siteCode, limit, offset)
    return NextResponse.json({
      code: 0,
      data: { ...data, sourceTables: SOURCE_TABLES },
      traceId,
    })
  } catch (err) {
    return NextResponse.json(
      {
        code: 500,
        message: err instanceof Error ? err.message : "unknown",
        traceId,
      },
      { status: 500 }
    )
  }
}