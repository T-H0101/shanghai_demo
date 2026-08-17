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
    // 默认返回全部设备；仅当显式传 limit 时分页（上限 10000）
    const limitRaw = sp.get("limit")
    const limit = limitRaw != null && limitRaw !== ""
      ? Math.min(Math.max(1, Number(limitRaw) || 1), 10000)
      : null
    const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0)

    const conditions: string[] = [`(status IS NULL OR status <> 'deleted')`]
    const params: unknown[] = []
    let idx = 1

    if (siteCode) {
      conditions.push(`source_site_id = $${idx}`); params.push(siteCode); idx++
    } else if (visibleSites) {
      conditions.push(`source_site_id = ANY($${idx})`); params.push(visibleSites); idx++
    }

    if (status === "online") {
      conditions.push(`status = 'online'`)
    } else if (status === "offline") {
      conditions.push(`status = 'offline'`)
    } else if (status === "warning") {
      conditions.push(`status = 'warning'`)
    } else if (status === "error") {
      conditions.push(`status = 'error'`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const dataSql = limit == null
      ? `SELECT device_id::text AS id, source_site_id, device_name, device_type, status AS device_status,
                ip_address, total_capacity, used_capacity, used_slots, slot_count AS total_slots,
                synced_at::text AS last_synced_at, cage_count
         FROM unified_devices ${where}
         ORDER BY status DESC, device_name`
      : `SELECT device_id::text AS id, source_site_id, device_name, device_type, status AS device_status,
                ip_address, total_capacity, used_capacity, used_slots, slot_count AS total_slots,
                synced_at::text AS last_synced_at, cage_count
         FROM unified_devices ${where}
         ORDER BY status DESC, device_name
         LIMIT $${idx} OFFSET $${idx + 1}`
    const dataParams = limit == null ? params : [...params, limit, offset]

    const [countRes, dataRes] = await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM unified_devices ${where}`, params),
      query(dataSql, dataParams),
    ])

    return NextResponse.json({
      ok: true,
      data: {
        items: dataRes.rows,
        total: Number.parseInt(countRes.rows[0]?.count ?? "0", 10),
        limit: limit ?? dataRes.rows.length,
        offset,
      },
      dataSource: "database",
    })
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
