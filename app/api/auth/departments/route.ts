/**
 * GET /api/auth/departments
 * Sprint R.66 — return departments the current user can see.
 *
 * Returns `implemented_candidate` with the missing source schema
 * blocker (tbl_depa is empty) when no rows are present.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/middleware"
import { query } from "@/lib/db/postgres"

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    if (!session.role) {
      return NextResponse.json(
        { code: 401, error: "no_role_assigned" },
        { status: 401 }
      )
    }
  } catch (e) {
    if (e instanceof NextResponse) return e
    throw e
  }

  const r = await query<{ id: string; name: string }>(
    `SELECT id::text, name FROM tbl_depa`
  )

  if (r.rowCount === 0) {
    return NextResponse.json({
      code: 0,
      status: "implemented_candidate",
      blocker: "tbl_depa_empty",
      departments: [],
      message: "tbl_depa has no rows; department dimension is a candidate",
    })
  }

  return NextResponse.json({
    code: 0,
    status: "active",
    departments: r.rows,
  })
}
