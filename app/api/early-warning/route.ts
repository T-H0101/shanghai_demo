/**
 * GET/POST/PUT/DELETE /api/early-warning
 *
 * Sprint R.83.5 CRUD over unified_early_warnings
 * Sprint R.101: 跨站只读列表 — 对齐站点 tbl_early_warning 字段投影 + 筛选 + 反馈只读
 *
 * Auth: requires platform session; writes require platform:operate.
 * Source: center DB only. NO restore DB.
 */

import { NextRequest, NextResponse } from "next/server"
import { query, transaction } from "@/lib/db"
import { requirePermission, requireSession } from "@/lib/auth/middleware"
import { resolveSiteScope, sqlColumnInSiteScope, type SiteScope } from "@/lib/auth/site-scope"
import { guardR83Api } from "@/lib/auth/r83-api-guard"
import {
  mapEarlyWarningFeedbackRow,
  mapEarlyWarningRow,
} from "@/lib/early-warning/display"
const TARGET_TABLE = "unified_early_warnings"
const FEEDBACK_TABLE = "unified_early_warning_feedbacks"
const SOURCE_TABLES = [
  "unified_early_warnings",
  "unified_early_warning_feedbacks",
]

interface ListFilters {
  scope: SiteScope
  type: string | null
  status: string | null
  /** open = 未处理(0) + 处理中(1)，排除已完成(2) */
  statusGroup: string | null
  level: string | null
  keyword: string | null
  limit: number
  offset: number
}

async function list(filters: ListFilters) {
  const params: unknown[] = []
  const where: string[] = []

  const scopeFilter = sqlColumnInSiteScope("source_site_id", filters.scope, 1)
  where.push(scopeFilter.sql)
  params.push(...scopeFilter.params)
  let paramIndex = scopeFilter.nextParam

  if (filters.type != null && filters.type !== "") {
    params.push(String(filters.type))
    where.push(`COALESCE(warning_type, raw_data->>'type') = $${paramIndex++}`)
  }
  if (filters.statusGroup === "open") {
    where.push(
      `COALESCE(status, NULLIF(raw_data->>'status', '')::smallint) IN (0, 1)`,
    )
  } else if (filters.status != null && filters.status !== "") {
    params.push(Number(filters.status))
    where.push(
      `COALESCE(status, NULLIF(raw_data->>'status', '')::smallint) = $${paramIndex++}`,
    )
  }
  if (filters.level != null && filters.level !== "") {
    params.push(String(filters.level))
    where.push(`COALESCE(warning_level, raw_data->>'s_level') = $${paramIndex++}`)
  }
  if (filters.keyword) {
    params.push(`%${filters.keyword}%`)
    where.push(
      `(COALESCE(message, raw_data->>'title', '') ILIKE $${paramIndex++})`,
    )
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""
  params.push(filters.limit, filters.offset)

  const itemsRes = await query<Record<string, unknown>>(
    `SELECT source_site_id, source_record_id, source_table, synced_at,
            src_warning_id, warning_type, warning_level, message,
            triggered_at, resolved_at, status, lib_id, raw_data
     FROM ${TARGET_TABLE}
     ${whereSql}
     ORDER BY COALESCE(triggered_at, synced_at) DESC NULLS LAST
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    params,
  )

  const countParams = params.slice(0, -2)
  const totalRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${TARGET_TABLE} ${whereSql}`,
    countParams,
  )

  return {
    items: itemsRes.rows.map(mapEarlyWarningRow),
    total: Number(totalRes.rows[0]?.count ?? 0),
  }
}
async function listFeedbacks(siteCode: string, warningId: number) {
  const res = await query<Record<string, unknown>>(
    `SELECT source_site_id, source_record_id, synced_at,
            src_feedback_id, warning_id, feedback_type, feedback_text,
            feedback_at, user_name, raw_data
     FROM ${FEEDBACK_TABLE}
     WHERE source_site_id = $1
       AND COALESCE(warning_id, NULLIF(raw_data->>'early_warning_id', '')::bigint) = $2
     ORDER BY COALESCE(feedback_at, synced_at) ASC NULLS LAST`,
    [siteCode, warningId],
  )
  return res.rows.map(mapEarlyWarningFeedbackRow)
}

async function upsert(body: Record<string, unknown>) {
  const source_site_id = String(body.source_site_id ?? "")
  const source_record_id = String(body.source_record_id ?? "")
  if (!source_site_id || !source_record_id) {
    throw new Error("source_site_id and source_record_id required")
  }
  return transaction(async (client) => {
    const r = await client.query<{ id: string }>(
      `INSERT INTO ${TARGET_TABLE} (source_site_id, source_table, source_record_id, raw_data)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (source_site_id, source_record_id) DO UPDATE
         SET raw_data = EXCLUDED.raw_data, synced_at = NOW()
       RETURNING id`,
      [
        source_site_id,
        TARGET_TABLE,
        source_record_id,
        JSON.stringify(body.raw_data ?? {}),
      ],
    )
    return { id: r.rows[0]?.id }
  })
}

async function update(body: Record<string, unknown>) {
  const source_site_id = String(body.source_site_id ?? "")
  const source_record_id = String(body.source_record_id ?? "")
  if (!source_site_id || !source_record_id) {
    throw new Error("source_site_id and source_record_id required")
  }
  return transaction(async (client) => {
    const r = await client.query(
      `UPDATE ${TARGET_TABLE}
       SET raw_data = $3::jsonb, synced_at = NOW()
       WHERE source_site_id = $1 AND source_record_id = $2`,
      [source_site_id, source_record_id, JSON.stringify(body.raw_data ?? {})],
    )
    return { updated: r.rowCount ?? 0 }
  })
}

async function remove(siteCode: string, recordId: string) {
  return transaction(async (client) => {
    const r = await client.query(
      `DELETE FROM ${TARGET_TABLE} WHERE source_site_id = $1 AND source_record_id = $2`,
      [siteCode, recordId],
    )
    return { deleted: r.rowCount ?? 0 }
  })
}

export async function GET(req: NextRequest) {
  const traceId = `rbac-early-warning-${Date.now()}`
  try {
    const session = await requireSession(req)
    requirePermission(session, "platform:read")

    const url = new URL(req.url)
    const siteCodeParam = url.searchParams.get("siteCode")
    const scope = resolveSiteScope(session, siteCodeParam)

    if (scope.kind === "listed" && scope.siteCodes.length === 0) {
      return NextResponse.json({
        code: 0,
        data: {
          items: [],
          total: 0,
          sourceTables: SOURCE_TABLES,
          readOnly: true,
        },
        dataSource: "empty",
        meta: {
          note: "站点预警列表为只读汇总；处理在站点侧完成。",
        },
        traceId,
      })
    }

    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? 100), 1),
      500,
    )
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0)
    const statusGroupParam = url.searchParams.get("statusGroup")
    const data = await list({
      scope,
      type: url.searchParams.get("type"),
      status: statusGroupParam === "open" ? null : url.searchParams.get("status"),
      statusGroup: statusGroupParam === "open" ? "open" : null,
      level: url.searchParams.get("level"),
      keyword: url.searchParams.get("keyword")?.trim() || null,
      limit,
      offset,
    })

    const siteCode = siteCodeParam?.trim() || null
    const warningIdRaw = url.searchParams.get("warningId")
    let feedbacks: ReturnType<typeof mapEarlyWarningFeedbackRow>[] | undefined
    if (warningIdRaw != null && warningIdRaw !== "" && siteCode) {
      const warningId = Number(warningIdRaw)
      if (Number.isFinite(warningId)) {
        feedbacks = await listFeedbacks(siteCode, warningId)
      }
    }

    return NextResponse.json({
      code: 0,
      data: {
        ...data,
        feedbacks,
        sourceTables: SOURCE_TABLES,
        readOnly: true,
      },
      dataSource: data.total > 0 ? "database" : "empty",
      meta: {
        note: "站点预警列表为只读汇总；处理在站点侧完成。",
      },
      traceId,
    })
  } catch (err) {
    if (err instanceof NextResponse) return err
    return NextResponse.json(
      {
        code: 500,
        message: err instanceof Error ? err.message : "unknown",
        traceId,
      },
      { status: 500 },
    )
  }
}
export async function POST(req: NextRequest) {
  const traceId = `rbac-early-warning-${Date.now()}`
  try {
    const auth = await guardR83Api(req, "write")
    if (auth) return auth
    const body = await req.json()
    const data = await upsert(body)
    return NextResponse.json({ code: 0, data, traceId })
  } catch (err) {
    return NextResponse.json(
      {
        code: 400,
        message: err instanceof Error ? err.message : "invalid request",
        traceId,
      },
      { status: 400 },
    )
  }
}

export async function PUT(req: NextRequest) {
  const traceId = `rbac-early-warning-${Date.now()}`
  try {
    const auth = await guardR83Api(req, "write")
    if (auth) return auth
    const body = await req.json()
    const data = await update(body)
    return NextResponse.json({ code: 0, data, traceId })
  } catch (err) {
    return NextResponse.json(
      {
        code: 400,
        message: err instanceof Error ? err.message : "invalid request",
        traceId,
      },
      { status: 400 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  const traceId = `rbac-early-warning-${Date.now()}`
  try {
    const url = new URL(req.url)
    const siteCode = url.searchParams.get("siteCode")
    const recordId = url.searchParams.get("sourceRecordId")
    const auth = await guardR83Api(req, "write", siteCode)
    if (auth) return auth
    if (!siteCode || !recordId) {
      throw new Error("siteCode and sourceRecordId are required")
    }
    const data = await remove(siteCode, recordId)
    return NextResponse.json({ code: 0, data, traceId })
  } catch (err) {
    return NextResponse.json(
      {
        code: 400,
        message: err instanceof Error ? err.message : "invalid request",
        traceId,
      },
      { status: 400 },
    )
  }
}
