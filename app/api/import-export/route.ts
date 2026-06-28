/**
 * GET/POST/PUT/DELETE /api/import-export
 *
 * Sprint R.83.7 Task 3 — 导入导出 family CRUD over center DB
 * unified_csv_details (primary table; lists 8 unified_* tables in sourceTables).
 *
 * Tables:
 *   - unified_csv_details         (tbl_csv_details)
 *   - unified_import_folder_datas (tbl_import_folder_data)
 *   - unified_import_folder_logs  (tbl_import_folder_log)
 *   - unified_import_folder_titles (tbl_import_folder_title)
 *   - unified_upload_details      (tbl_upload_details)
 *   - unified_download_details    (tbl_download_details)
 *   - unified_export_infos        (tbl_export_info)
 *
 * Auth: requires platform session; writes require platform:operate.
 * Source: center DB only (lib/db → DATABASE_URL). NO restore DB.
 *
 * Envelope:
 *   { code: 0, data: { items, total, sourceTables }, traceId }
 */

import { NextRequest, NextResponse } from "next/server"
import { query, transaction } from "@/lib/db"
import { guardR83Api } from "@/lib/auth/r83-api-guard"

const TARGET_TABLE = "unified_csv_details"
const SOURCE_TABLES = [
  "unified_csv_details",
  "unified_import_folder_datas",
  "unified_import_folder_logs",
  "unified_import_folder_titles",
  "unified_upload_details",
  "unified_download_details",
  "unified_export_infos",
]

async function list(siteCode: string | null, limit: number, offset: number) {
  const params: unknown[] = []
  let where = ""
  if (siteCode) {
    params.push(siteCode)
    where = `WHERE source_site_id = $${params.length}`
  }
  params.push(limit, offset)
  const itemsRes = await query<Record<string, unknown>>(
    `SELECT source_site_id, source_record_id, source_table, synced_at, raw_data
     FROM ${TARGET_TABLE} ${where}
     ORDER BY synced_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )
  const totalRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${TARGET_TABLE} ${where}`,
    siteCode ? [siteCode] : [],
  )
  return {
    items: itemsRes.rows,
    total: Number(totalRes.rows[0]?.count ?? 0),
  }
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
  const traceId = `r83-7-import-export-${Date.now()}`
  try {
    const url = new URL(req.url)
    const siteCode = url.searchParams.get("siteCode")
    const auth = await guardR83Api(req, "read", siteCode)
    if (auth) return auth
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? 100), 1),
      500,
    )
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0)
    const data = await list(siteCode, limit, offset)
    return NextResponse.json({
      code: 0,
      data: { ...data, sourceTables: SOURCE_TABLES },
      traceId,
    })
  } catch (err) {
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
  const traceId = `r83-7-import-export-${Date.now()}`
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
  const traceId = `r83-7-import-export-${Date.now()}`
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
  const traceId = `r83-7-import-export-${Date.now()}`
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