/**
 * GET /api/racks/magazines
 * 按站点 + 设备列出盘笼（unified_magazines），供盘笼移位 Dialog 级联选择。
 * 仅返回 rfid 非空的行（跨站身份靠 RFID）。
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { requireSession, requirePermission, getVisibleSites } from "@/lib/auth/middleware"

type MagRow = {
  magazine_id: string | null
  rfid: string
  barcode: string | null
  position: string | null
  status: string | null
  device_id: string | null
  source_site_id: string
}

function formatCageLabel(rfid: string, position: string | null): string {
  const n = position != null && position !== "" ? Number(position) : NaN
  if (Number.isFinite(n)) return `${rfid}·盘笼${n + 1}`
  return rfid
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request)
    requirePermission(session, "racks:read")
    const visibleSites = getVisibleSites(session)

    const sp = request.nextUrl.searchParams
    const siteCode = (sp.get("siteCode") ?? "").trim()
    const deviceId = (sp.get("deviceId") ?? "").trim()

    if (!siteCode || !deviceId) {
      return NextResponse.json(
        { code: 400, error: "siteCode 与 deviceId 必填" },
        { status: 400 }
      )
    }
    if (visibleSites && !visibleSites.includes(siteCode)) {
      return NextResponse.json({ code: 403, error: "无权访问该站点" }, { status: 403 })
    }

    const { rows } = await query<MagRow>(
      `SELECT magazine_id::text AS magazine_id,
              TRIM(rfid) AS rfid,
              barcode,
              position::text AS position,
              status,
              device_id::text AS device_id,
              source_site_id
       FROM unified_magazines
       WHERE source_site_id = $1
         AND device_id::text = $2
         AND rfid IS NOT NULL
         AND TRIM(rfid) <> ''
       ORDER BY
         CASE WHEN position ~ '^[0-9]+$' THEN position::int ELSE NULL END NULLS LAST,
         magazine_id NULLS LAST,
         rfid`,
      [siteCode, deviceId]
    )

    return NextResponse.json({
      code: 0,
      data: {
        items: rows.map((r) => ({
          magazineId: r.magazine_id,
          rfid: r.rfid,
          barcode: r.barcode,
          position: r.position,
          status: r.status,
          deviceId: r.device_id,
          siteCode: r.source_site_id,
          label: formatCageLabel(r.rfid, r.position),
        })),
        total: rows.length,
      },
      message: "仅含 RFID 的盘笼；跨站登记以 RFID 为键",
    })
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json(
      { code: 500, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
