/**
 * PUT    /api/sites/regions/[code] — 更新名称/说明/状态，或替换挂靠站点
 * DELETE /api/sites/regions/[code] — 删除区域（先清空站点挂靠）
 */

import { NextRequest, NextResponse } from "next/server"
import { query, transaction } from "@/lib/db/postgres"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { writeAudit } from "@/lib/control/audit"

type Ctx = { params: Promise<{ code: string }> }

function normalizeCode(raw: string | undefined): string {
  return (raw ?? "").trim().toUpperCase()
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "platform:operate")
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ code: 500, error: "AUTH_ERROR" }, { status: 500 })
  }

  const regionCode = normalizeCode((await ctx.params).code)
  if (!regionCode) {
    return NextResponse.json({ code: 400, error: "REGION_REQUIRED" }, { status: 400 })
  }

  let body: {
    name?: unknown
    description?: unknown
    status?: unknown
    siteCodes?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 400, error: "INVALID_JSON" }, { status: 400 })
  }

  try {
    const before = await query<{
      code: string
      name: string
      description: string | null
      status: string
    }>(`SELECT code, name, description, status FROM site_regions WHERE code = $1 LIMIT 1`, [
      regionCode,
    ])
    if (!before.rows[0]) {
      return NextResponse.json(
        { code: 404, error: "NOT_FOUND", message: `区域不存在: ${regionCode}` },
        { status: 404 },
      )
    }

    const nextName =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : before.rows[0].name
    const nextDesc =
      typeof body.description === "string"
        ? body.description.trim()
        : (before.rows[0].description ?? "")
    const nextStatus =
      body.status === "inactive" || body.status === "active"
        ? body.status
        : before.rows[0].status

    if (nextName.length > 100) {
      return NextResponse.json(
        { code: 400, error: "INVALID_NAME", message: "区域名称≤100 字" },
        { status: 400 },
      )
    }

    const assignSites = Array.isArray(body.siteCodes)
    const siteCodes = assignSites
      ? Array.from(
          new Set(
            (body.siteCodes as unknown[])
              .filter((c): c is string => typeof c === "string")
              .map((c) => c.trim())
              .filter(Boolean),
          ),
        )
      : null

    if (siteCodes) {
      if (siteCodes.length > 0) {
        const found = await query<{ site_code: string }>(
          `SELECT site_code FROM sync_sites WHERE site_code = ANY($1::text[])`,
          [siteCodes],
        )
        const foundSet = new Set(found.rows.map((r) => r.site_code))
        const missing = siteCodes.filter((c) => !foundSet.has(c))
        if (missing.length > 0) {
          return NextResponse.json(
            {
              code: 400,
              error: "UNKNOWN_SITES",
              message: `以下站点未注册: ${missing.join(", ")}`,
            },
            { status: 400 },
          )
        }
      }
    }

    const beforeSites = await query<{ site_code: string }>(
      `SELECT site_code FROM sync_sites WHERE region_code = $1 ORDER BY site_code`,
      [regionCode],
    )

    await transaction(async (client) => {
      await client.query(
        `UPDATE site_regions
         SET name = $2, description = $3, status = $4, updated_at = NOW()
         WHERE code = $1`,
        [regionCode, nextName, nextDesc || null, nextStatus],
      )

      if (siteCodes) {
        await client.query(
          `UPDATE sync_sites SET region_code = NULL, updated_at = NOW()
           WHERE region_code = $1`,
          [regionCode],
        )
        if (siteCodes.length > 0) {
          await client.query(
            `UPDATE sync_sites SET region_code = $1, updated_at = NOW()
             WHERE site_code = ANY($2::text[])`,
            [regionCode, siteCodes],
          )
        }
      }
    })

    await writeAudit({
      action: "site_region_update",
      targetTable: "site_regions",
      targetId: regionCode,
      before: {
        ...before.rows[0],
        siteCodes: beforeSites.rows.map((r) => r.site_code),
      },
      after: {
        code: regionCode,
        name: nextName,
        description: nextDesc,
        status: nextStatus,
        siteCodes: siteCodes ?? beforeSites.rows.map((r) => r.site_code),
      },
      actor: session.username,
      siteCode: session.siteCode,
      result: "success",
    })

    return NextResponse.json({
      code: 0,
      message: "站点区域已更新",
      data: {
        code: regionCode,
        name: nextName,
        description: nextDesc,
        status: nextStatus,
        siteCodes: siteCodes ?? beforeSites.rows.map((r) => r.site_code),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { code: 500, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "platform:operate")
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ code: 500, error: "AUTH_ERROR" }, { status: 500 })
  }

  const regionCode = normalizeCode((await ctx.params).code)
  if (!regionCode) {
    return NextResponse.json({ code: 400, error: "REGION_REQUIRED" }, { status: 400 })
  }

  try {
    const before = await query<{ code: string; name: string }>(
      `SELECT code, name FROM site_regions WHERE code = $1 LIMIT 1`,
      [regionCode],
    )
    if (!before.rows[0]) {
      return NextResponse.json(
        { code: 404, error: "NOT_FOUND", message: `区域不存在: ${regionCode}` },
        { status: 404 },
      )
    }

    const linked = await query<{ site_code: string }>(
      `SELECT site_code FROM sync_sites WHERE region_code = $1 ORDER BY site_code`,
      [regionCode],
    )

    await transaction(async (client) => {
      await client.query(
        `UPDATE sync_sites SET region_code = NULL, updated_at = NOW() WHERE region_code = $1`,
        [regionCode],
      )
      await client.query(`DELETE FROM site_regions WHERE code = $1`, [regionCode])
    })

    await writeAudit({
      action: "site_region_delete",
      targetTable: "site_regions",
      targetId: regionCode,
      before: {
        ...before.rows[0],
        siteCodes: linked.rows.map((r) => r.site_code),
      },
      after: null,
      actor: session.username,
      siteCode: session.siteCode,
      result: "success",
    })

    return NextResponse.json({
      code: 0,
      message: "站点区域已删除",
      data: { code: regionCode },
    })
  } catch (e) {
    return NextResponse.json(
      { code: 500, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
