/**
 * GET /api/auth/permissions
 * Sprint R.66 — return effective permissions for the current user.
 *
 * Returns `implemented_candidate` with the station auth schema
 * blocker when no station auth tables are present in the source DB.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/middleware"
import { resolveRoles, type ResourceType } from "@/lib/auth/rbac-policy"

export async function GET(req: NextRequest) {
  let session: Awaited<ReturnType<typeof requireSession>>
  try {
    session = await requireSession(req)
  } catch (e) {
    if (e instanceof NextResponse) return e
    throw e
  }

  const roleNames = session.role ? [session.role] : []
  const roles = resolveRoles(roleNames)

  const permissions: Array<{ resource: ResourceType; action: string }> = []
  for (const role of roles) {
    for (const allow of role.allow) permissions.push(allow)
  }

  return NextResponse.json({
    code: 0,
    status: "implemented_candidate",
    blocker: "station_auth_schema_not_verified",
    userId: session.id,
    roles: roleNames,
    permissions,
    message: "RBAC UI/API is in place; enterprise/station enforcement pending real station auth schema",
  })
}
