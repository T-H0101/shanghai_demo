/**
 * GET/POST/PUT/DELETE /api/system-aux
 *
 * Sprint R.83.7 Task 3 — 系统辅助族 family CRUD over center DB
 * unified_error_rates (primary table; lists 3 unified_* tables in sourceTables).
 *
 * Tables:
 *   - unified_error_rates    (tbl_error_rate)
 *   - unified_escapes        (tbl_escape)
 *   - unified_remote_backups (tbl_remote_backup)
 *
 * Auth: blocked_by_auth per CLAUDE.md (no auth check here).
 * Source: center DB only (lib/db → DATABASE_URL). NO restore DB.
 *
 * Envelope:
 *   { code: 0, data: { items, total, sourceTables }, traceId }
 */

import { NextRequest, NextResponse } from "next/server"
import { query, transaction } from "@/lib/db"

const TARGET_TABLE = "unified_error_rates"
const SOURCE_TABLES = [
  "unified_error_rates",
  "unified_escapes",
  "unified_remote_backups",
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
  const traceId = `r83-7-system-aux-${Date.now()}`
  try {
    const url = new URL(req.url)
    const siteCode = url.searchParams.get("siteCode")
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
  const traceId = `r83-7-system-aux-${Date.now()}`
  try {
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
  const traceId = `r83-7-system-aux-${Date.now()}`
  try {
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
  const traceId = `r83-7-system-aux-${Date.now()}`
  try {
    const url = new URL(req.url)
    const siteCode = url.searchParams.get("siteCode")
    const recordId = url.searchParams.get("sourceRecordId")
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