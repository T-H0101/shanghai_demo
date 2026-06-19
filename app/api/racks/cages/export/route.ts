/**
 * GET /api/racks/cages/export - 盘笼导出
 *
 * Sprint R.32 - REQ-4.3.2
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { requireSession, requirePermission, getVisibleSites } from "@/lib/auth/middleware"
import { createHash } from "crypto"

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request)
    requirePermission(session, "platform:read")
    const visibleSites = getVisibleSites(session)

    const sp = request.nextUrl.searchParams
    const format = sp.get("format") ?? "csv"
    const siteCode = sp.get("siteCode") ?? undefined

    const conditions: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (siteCode) {
      conditions.push(`source_site_id = $${idx}`); params.push(siteCode); idx++
    } else if (visibleSites) {
      conditions.push(`source_site_id = ANY($${idx})`); params.push(visibleSites); idx++
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const dataRes = await query(
      `SELECT id::text, source_site_id, device_name, device_type, device_status,
              ip_address, total_capacity, remaining_capacity, used_slots, total_slots
       FROM unified_devices ${where} ORDER BY device_name LIMIT 10000`,
      params,
    )

    const rows = dataRes.rows
    const sha256 = createHash("sha256").update(JSON.stringify(rows)).digest("hex")

    if (format === "json") {
      return new NextResponse(JSON.stringify({ data: rows, total: rows.length, sha256 }, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="cages-${new Date().toISOString().slice(0, 10)}.json"`,
          "x-sha256": sha256,
          "x-record-count": String(rows.length),
        },
      })
    }

    const header = "id,site_code,device_name,device_type,status,ip_address,total_capacity,remaining_capacity,used_slots,total_slots"
    const csvRows = rows.map((r: any) =>
      [r.id, r.source_site_id, r.device_name, r.device_type, r.device_status, r.ip_address ?? "", r.total_capacity ?? "", r.remaining_capacity ?? "", r.used_slots ?? "", r.total_slots ?? ""].join(",")
    )
    const csv = [header, ...csvRows].join("\n")
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cages-${new Date().toISOString().slice(0, 10)}.csv"`,
        "x-sha256": sha256,
        "x-record-count": String(rows.length),
      },
    })
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
