/**
 * R.47 — GET /api/logs/source
 *
 * Returns real site-native logs from star_restore_db.
 * If source tables are empty or missing, returns explicit blocked_by_source_schema.
 */

import { NextResponse } from "next/server"
import { fetchSourceLogs } from "@/lib/source/log-source"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500)
    const keyword = url.searchParams.get("keyword") ?? undefined

    const result = await fetchSourceLogs({ limit, keyword })

    return NextResponse.json({ code: 0, data: result })
  } catch (err) {
    return NextResponse.json(
      { code: -1, message: (err as Error).message },
      { status: 500 },
    )
  }
}
