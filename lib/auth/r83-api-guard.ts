import { NextRequest, NextResponse } from "next/server"
import {
  requirePermission,
  requireSession,
  requireSiteAccess,
} from "@/lib/auth/middleware"

type R83Action = "read" | "write" | "sync"

const PERMISSION_BY_ACTION: Record<R83Action, string> = {
  read: "platform:read",
  write: "platform:operate",
  sync: "sync:operate",
}

export async function guardR83Api(
  req: NextRequest,
  action: R83Action,
  siteCode?: string | null,
): Promise<NextResponse | null> {
  try {
    const session = await requireSession(req)
    requirePermission(session, PERMISSION_BY_ACTION[action])
    requireSiteAccess(session, siteCode)
    return null
  } catch (err) {
    if (err instanceof NextResponse) return err
    return NextResponse.json(
      { code: 500, message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
