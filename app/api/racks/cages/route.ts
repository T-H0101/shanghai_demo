/**
 * GET /api/racks/cages - 盘笼查询
 *
 * Sprint R.32 - REQ-4.3.2: 盘笼统一查询
 *
 * 从 unified_devices 派生盘笼数据, 支持状态/站点过滤
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { requireSession, requirePermission, getVisibleSites } from "@/lib/auth/middleware"

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request)
    requirePermission(session, "platform:read")
    const visibleSites = getVisibleSites(session)

    const sp = request.nextUrl.searchParams
    const siteCode = sp.get("siteCode") ?? undefined
    const status = sp.get("status") ?? undefined // online/offline
    const limit = Math.min(Number(sp.get("limit") ?? 100), 500)
    const offset = Number(sp.get("offset") ?? 0)

    const conditions: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (siteCode) {
      conditions.push(`source_site_id = $${idx}`); params.push(siteCode); idx++
    } else if (visibleSites) {
      conditions.push(`source_site_id = ANY($${idx})`); params.push(visibleSites); idx++
    }

    if (status === "online") {
      conditions.push(`device_status = 'online'`)
    } else if (status === "offline") {
      conditions.push(`device_status = 'offline'`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const [countRes, dataRes] = await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM unified_devices ${where}`, params),
      query(
        `SELECT id::text, source_site_id, device_name, device_type, device_status,
                ip_address, total_capacity, remaining_capacity, used_slots, total_slots,
                last_synced_at::text, cage_count
         FROM unified_devices ${where}
         ORDER BY device_status DESC, device_name
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
    ])

    return NextResponse.json({
      ok: true,
      data: {
        items: dataRes.rows,
        total: Number.parseInt(countRes.rows[0]?.count ?? "0", 10),
        limit,
        offset,
      },
      dataSource: "database",
    })
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
