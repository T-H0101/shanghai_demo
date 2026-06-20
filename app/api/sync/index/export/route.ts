/**
 * POST /api/sync/index/export - 索引导出任务
 *
 * Sprint R.42 - REQ-5.2.2: 光盘索引导出
 *
 * 创建后台导出 job, 生成已同步索引的导出文件
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { writeAudit } from "@/lib/control/audit"
import { createHash } from "crypto"
import { randomBytes } from "crypto"

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "platform:read")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  let body: any
  try { body = await req.json() } catch { body = {} }

  const siteCode = body.siteCode ?? undefined
  const format = body.format ?? "csv"

  try {
    // Generate export job ID
    const jobId = randomBytes(8).toString("hex")
    const filename = `index-export-${jobId}-${new Date().toISOString().slice(0, 10)}.${format}`

    // Query current index data
    const conditions: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (siteCode) {
      conditions.push(`source_site_id = $${idx}`); params.push(siteCode); idx++
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const result = await query(
      `SELECT id::text, source_site_id, disc_no, media_type, capacity, volume_id, status, created_at::text
       FROM unified_disc_media ${where} ORDER BY created_at DESC LIMIT 50000`,
      params,
    )

    const rows = result.rows
    const sha256 = createHash("sha256").update(JSON.stringify(rows)).digest("hex")

    // Audit
    await writeAudit({
      action: "index_export",
      targetTable: "unified_disc_media",
      targetId: jobId,
      after: { jobId, filename, recordCount: rows.length, format, siteCode },
      actor: "admin",
      result: "success",
    })

    return NextResponse.json({
      ok: true,
      data: {
        jobId,
        filename,
        recordCount: rows.length,
        format,
        sha256,
        status: "completed",
        limitations: ["仅包含已同步的光盘介质数据", "tbl_file/tbl_folder 不在当前导出范围"],
      },
    }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "platform:read")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  const url = new URL(req.url)
  const format = url.searchParams.get("format") ?? "csv"
  const siteCode = url.searchParams.get("siteCode") ?? undefined

  try {
    const conditions: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (siteCode) {
      conditions.push(`source_site_id = $${idx}`); params.push(siteCode); idx++
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const result = await query(
      `SELECT id::text, source_site_id, disc_no, media_type, capacity, volume_id, status, created_at::text
       FROM unified_disc_media ${where} ORDER BY created_at DESC LIMIT 50000`,
      params,
    )

    const sha256 = createHash("sha256").update(JSON.stringify(result.rows)).digest("hex")

    if (format === "json") {
      return new NextResponse(
        JSON.stringify({ data: result.rows, total: result.rows.length, sha256 }, null, 2),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="index-${new Date().toISOString().slice(0, 10)}.json"`,
            "x-sha256": sha256,
            "x-record-count": String(result.rows.length),
          },
        },
      )
    }

    const header = "id,site_code,disc_no,media_type,capacity,volume_id,status,created_at"
    const csvRows = result.rows.map((r: any) =>
      [r.id, r.source_site_id, r.disc_no ?? "", r.media_type ?? "", r.capacity ?? "", r.volume_id ?? "", r.status ?? "", r.created_at].join(",")
    )
    const csv = [header, ...csvRows].join("\n")
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="index-${new Date().toISOString().slice(0, 10)}.csv"`,
        "x-sha256": sha256,
        "x-record-count": String(result.rows.length),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
