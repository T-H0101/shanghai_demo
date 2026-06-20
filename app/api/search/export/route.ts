/**
 * GET /api/search/export - 检索结果导出
 *
 * Sprint R.42 - REQ-4.1.3: 有界检索导出
 *
 * 对当前可用的有界检索结果提供 CSV/JSON 导出
 * 字段: 文件路径、大小、创建时间、存储位置、所属部门
 *
 * 注意: 当前基于 unified_* 表的有界数据, 非 ES 千万级索引
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { createHash } from "crypto"

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "platform:read")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  const url = new URL(req.url)
  const format = url.searchParams.get("format") ?? "csv"
  const keyword = url.searchParams.get("keyword") ?? undefined
  const siteCode = url.searchParams.get("siteCode") ?? undefined
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 10000), 50000)

  try {
    // Search across unified tables for file-like records
    const conditions: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (keyword) {
      conditions.push(`(disc_no ILIKE $${idx} OR volume_id ILIKE $${idx})`)
      params.push(`%${keyword}%`)
      idx++
    }
    if (siteCode) {
      conditions.push(`source_site_id = $${idx}`)
      params.push(siteCode)
      idx++
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const result = await query(
      `SELECT id::text, source_site_id, disc_no, media_type, capacity,
              volume_id, slot_index, status, created_at::text
       FROM unified_disc_media ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      [...params, limit],
    )

    const rows = result.rows.map((r: any) => ({
      filePath: r.disc_no ?? "—",
      size: r.capacity ?? "—",
      createdAt: r.created_at ?? "—",
      storageLocation: `${r.source_site_id}/${r.volume_id ?? "—"}/${r.slot_index ?? "—"}`,
      department: "—", // Not available in current schema
      siteCode: r.source_site_id,
      mediaType: r.media_type ?? "—",
      status: r.status ?? "—",
    }))

    const sha256 = createHash("sha256").update(JSON.stringify(rows)).digest("hex")

    if (format === "json") {
      return new NextResponse(
        JSON.stringify({
          data: rows,
          total: rows.length,
          sha256,
          limitations: ["department 字段当前不可用 (源端 schema 缺失)", "仅包含已同步的光盘介质数据"],
        }, null, 2),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="search-export-${new Date().toISOString().slice(0, 10)}.json"`,
            "x-sha256": sha256,
            "x-record-count": String(rows.length),
          },
        },
      )
    }

    // CSV
    const header = "file_path,size,created_at,storage_location,department,site_code,media_type,status"
    const csvRows = rows.map((r: any) =>
      [r.filePath, r.size, r.createdAt, r.storageLocation, r.department, r.siteCode, r.mediaType, r.status].join(",")
    )
    const csv = [header, ...csvRows].join("\n")
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="search-export-${new Date().toISOString().slice(0, 10)}.csv"`,
        "x-sha256": sha256,
        "x-record-count": String(rows.length),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
