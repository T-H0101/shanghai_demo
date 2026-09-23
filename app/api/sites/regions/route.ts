/**
 * GET  /api/sites/regions — 站点区域列表
 * POST /api/sites/regions — 新建站点区域
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { requireSession, requirePermission, requireAnyPermission } from "@/lib/auth/middleware"
import { writeAudit } from "@/lib/control/audit"

const REGION_CODE_RE = /^[A-Z][A-Z0-9_]{0,47}$/

export type SiteRegionDto = {
  code: string
  name: string
  description: string
  status: "active" | "inactive"
  sortOrder: number
  siteCount: number
  sites: Array<{ code: string; name: string }>
  createdAt: string | null
  updatedAt: string | null
}

function normalizeCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : ""
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requireAnyPermission(session, ["sites:list", "dashboard:read"])
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ code: 500, error: "AUTH_ERROR" }, { status: 500 })
  }

  try {
    const regions = await query<{
      code: string
      name: string
      description: string | null
      status: string
      sort_order: number
      created_at: string | null
      updated_at: string | null
    }>(
      `SELECT code, name, description, status, sort_order,
              created_at::text, updated_at::text
       FROM site_regions
       ORDER BY sort_order ASC, code ASC`,
    )

    const siteRows = await query<{
      site_code: string
      site_name: string
      region_code: string | null
    }>(
      `SELECT site_code, site_name, region_code
       FROM sync_sites
       WHERE region_code IS NOT NULL
       ORDER BY site_name ASC, site_code ASC`,
    )

    const byRegion = new Map<string, Array<{ code: string; name: string }>>()
    for (const row of siteRows.rows) {
      if (!row.region_code) continue
      const list = byRegion.get(row.region_code) ?? []
      list.push({ code: row.site_code, name: row.site_name })
      byRegion.set(row.region_code, list)
    }

    const data: SiteRegionDto[] = regions.rows.map((r) => {
      const sites = byRegion.get(r.code) ?? []
      return {
        code: r.code,
        name: r.name,
        description: r.description ?? "",
        status: r.status === "inactive" ? "inactive" : "active",
        sortOrder: Number(r.sort_order) || 0,
        siteCount: sites.length,
        sites,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }
    })

    return NextResponse.json({ code: 0, data: { regions: data, total: data.length } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // 表未迁移时给出明确提示
    if (/site_regions|relation .* does not exist/i.test(msg)) {
      return NextResponse.json(
        {
          code: 503,
          error: "SCHEMA_MISSING",
          message: "未找到 site_regions 表，请执行 databases/sprint-r103/01-site-regions.sql、databases/sprint-r105/01-site-region-sort.sql 或 pnpm db:init",
        },
        { status: 503 },
      )
    }
    return NextResponse.json({ code: 500, message: "未知异常", error: "UNKNOWN_EXCEPTION" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "platform:operate")
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ code: 500, error: "AUTH_ERROR" }, { status: 500 })
  }

  let body: { code?: unknown; name?: unknown; description?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 400, error: "INVALID_JSON" }, { status: 400 })
  }

  const code = normalizeCode(body.code)
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const description = typeof body.description === "string" ? body.description.trim() : ""

  if (!REGION_CODE_RE.test(code)) {
    return NextResponse.json(
      {
        code: 400,
        error: "INVALID_REGION_CODE",
        message: "区域编码须为大写字母开头，仅含大写字母、数字、下划线，长度 1–48",
      },
      { status: 400 },
    )
  }
  if (!name || name.length > 100) {
    return NextResponse.json(
      { code: 400, error: "INVALID_NAME", message: "请填写区域名称（≤100 字）" },
      { status: 400 },
    )
  }

  try {
    const exists = await query<{ code: string }>(
      `SELECT code FROM site_regions WHERE code = $1 LIMIT 1`,
      [code],
    )
    if (exists.rows[0]) {
      return NextResponse.json(
        { code: 409, error: "REGION_EXISTS", message: `区域编码已存在: ${code}` },
        { status: 409 },
      )
    }

    const inserted = await query<{ sort_order: number }>(
      `INSERT INTO site_regions(code, name, description, status, sort_order)
       VALUES (
         $1, $2, $3, 'active',
         (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM site_regions)
       )
       RETURNING sort_order`,
      [code, name, description || null],
    )

    await writeAudit({
      action: "site_region_create",
      targetTable: "site_regions",
      targetId: code,
      after: { code, name, description },
      actor: session.username,
      siteCode: session.siteCode,
      result: "success",
    })

    return NextResponse.json(
      {
        code: 0,
        data: {
          code,
          name,
          description,
          status: "active",
          sortOrder: Number(inserted.rows[0]?.sort_order) || 0,
          siteCount: 0,
          sites: [],
          createdAt: null,
          updatedAt: null,
        } satisfies SiteRegionDto,
        message: "站点区域已创建",
      },
      { status: 201 },
    )
  } catch (e) {
    return NextResponse.json(
      { code: 500, message: "未知异常", error: "UNKNOWN_EXCEPTION" },
      { status: 500 },
    )
  }
}
