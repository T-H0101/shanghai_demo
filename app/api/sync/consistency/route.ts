/**
 * GET /api/sync/consistency?siteCode=SH01
 * Sprint R.7 - 数据一致性校验结果查询
 *
 * 返回最近一次 check-sync-consistency 写入 sync_consistency_log 的结果
 * 不每次跑全量校验 (慢查询), 仅读 log 表
 *
 * 如果没有结果:
 *   status: "not_run"
 *
 * R.1 §7 强约束: 禁止 mock, 真实 SQL
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const siteCode = request.nextUrl.searchParams.get("siteCode") ?? ""

    // 查最近一次 (按 siteCode 过滤或 ALL)
    const whereConditions: string[] = []
    const queryParams: unknown[] = []
    if (siteCode) {
      whereConditions.push(`site_code = $${queryParams.length + 1}`)
      queryParams.push(siteCode)
    }
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""

    const result = await query<{
      id: string
      site_code: string
      checked_at: string
      status: string
      table_count: number
      matched_table_count: number
      mismatched_table_count: number
      result_json: unknown
    }>(
      `SELECT id, site_code, checked_at, status, table_count,
              matched_table_count, mismatched_table_count, result_json
       FROM sync_consistency_log
       ${whereClause}
       ORDER BY checked_at DESC
       LIMIT 1`,
      queryParams
    )

    if (result.rows.length === 0) {
      return NextResponse.json({
        code: 0,
        message: "ok (no check has been run yet)",
        status: "not_run",
        siteCode: siteCode || "(all)",
        dataSource: "sync_consistency_log (empty)",
        recommendation:
          "Run `pnpm check:sync-consistency -- --siteCode=SH01` to populate.",
        traceId: `api-${Date.now()}`,
      })
    }

    const row = result.rows[0]
    return NextResponse.json({
      code: 0,
      message: "ok",
      status: row.status,
      siteCode: row.site_code,
      checkedAt: row.checked_at,
      tableCount: row.table_count,
      matchedTableCount: row.matched_table_count,
      mismatchedTableCount: row.mismatched_table_count,
      result: row.result_json,
      dataSource: "sync_consistency_log (database)",
      traceId: `api-${Date.now()}`,
    })
  } catch (error) {
    console.error("[API Error] /api/sync/consistency:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        dataSource: "error",
        error: error instanceof Error ? error.message : String(error),
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
