/**
 * PUT /api/sites/regions/reorder — 保存站点区域展示顺序
 *
 * body: { codes: string[] } 必须覆盖全部区域，且无重复。
 */

import { NextRequest, NextResponse } from "next/server"
import { query, transaction } from "@/lib/db/postgres"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { writeAudit } from "@/lib/control/audit"

function normalizeCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : ""
}

export async function PUT(req: NextRequest) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "platform:operate")
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ code: 500, error: "AUTH_ERROR" }, { status: 500 })
  }

  let body: { codes?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 400, error: "INVALID_JSON" }, { status: 400 })
  }

  if (!Array.isArray(body.codes) || body.codes.length === 0) {
    return NextResponse.json(
      { code: 400, error: "INVALID_ORDER", message: "请提供完整的区域编码列表" },
      { status: 400 },
    )
  }

  const codes = body.codes.map(normalizeCode)
  if (codes.some((c) => !c)) {
    return NextResponse.json(
      { code: 400, error: "INVALID_ORDER", message: "区域编码不能为空" },
      { status: 400 },
    )
  }
  if (new Set(codes).size !== codes.length) {
    return NextResponse.json(
      { code: 400, error: "INVALID_ORDER", message: "区域编码列表含重复项" },
      { status: 400 },
    )
  }

  try {
    const existing = await query<{ code: string }>(`SELECT code FROM site_regions`)
    const existingSet = new Set(existing.rows.map((r) => r.code))
    if (existingSet.size !== codes.length) {
      return NextResponse.json(
        {
          code: 400,
          error: "INVALID_ORDER",
          message: `须包含全部 ${existingSet.size} 个区域，当前 ${codes.length} 个`,
        },
        { status: 400 },
      )
    }
    const unknown = codes.filter((c) => !existingSet.has(c))
    if (unknown.length > 0) {
      return NextResponse.json(
        {
          code: 400,
          error: "UNKNOWN_REGIONS",
          message: `未知区域: ${unknown.join(", ")}`,
        },
        { status: 400 },
      )
    }

    const before = await query<{ code: string; sort_order: number }>(
      `SELECT code, sort_order FROM site_regions ORDER BY sort_order ASC, code ASC`,
    )
    const orders = codes.map((_, i) => i + 1)

    await transaction(async (client) => {
      await client.query(
        `UPDATE site_regions AS sr
         SET sort_order = v.ord, updated_at = NOW()
         FROM unnest($1::text[], $2::int[]) AS v(code, ord)
         WHERE sr.code = v.code`,
        [codes, orders],
      )
    })

    await writeAudit({
      action: "site_region_reorder",
      targetTable: "site_regions",
      targetId: "all",
      before: { codes: before.rows.map((r) => r.code) },
      after: { codes },
      actor: session.username,
      siteCode: session.siteCode,
      result: "success",
    })

    return NextResponse.json({
      code: 0,
      message: "区域顺序已保存",
      data: { codes },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/sort_order|site_regions|does not exist/i.test(msg)) {
      return NextResponse.json(
        {
          code: 503,
          error: "SCHEMA_MISSING",
          message: "未找到 site_regions.sort_order，请执行 databases/sprint-r105/01-site-region-sort.sql 或 pnpm db:init",
        },
        { status: 503 },
      )
    }
    return NextResponse.json({ code: 500, error: msg }, { status: 500 })
  }
}
