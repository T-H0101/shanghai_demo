/**
 * GET /api/sites/[id]/sso
 * Sprint R.65 — generate a station jump token. The token is a
 * candidate only until a real station accepts it; we never claim
 * station SSO is wired until then.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { randomBytes, createHmac } from "node:crypto"
import { oidcStatus } from "@/lib/auth/oidc-provider"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "sites:read")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  const { id } = await params
  const o = oidcStatus()

  if (o.status !== "active") {
    return NextResponse.json(
      {
        code: 0,
        status: "implemented_candidate",
        blocker: o.blocker,
        missing: o.missing,
        message: "Station SSO token issuance is a candidate; ADFS/LDAP not configured",
      },
      { status: 200 }
    )
  }

  const secret = process.env.SITE_AGENT_SECRET ?? process.env.SYNC_PACKAGE_SECRET ?? ""
  if (!secret) {
    return NextResponse.json(
      {
        code: 0,
        status: "implemented_candidate",
        blocker: "site_agent_secret_not_configured",
        message: "Cannot sign station jump token without SITE_AGENT_SECRET",
      },
      { status: 200 }
    )
  }

  const nonce = randomBytes(8).toString("hex")
  const ts = String(Date.now())
  const payload = `${id}|admin|${ts}|${nonce}`
  const sig = createHmac("sha256", secret).update(payload).digest("hex")

  return NextResponse.json({
    code: 0,
    status: "implemented_candidate",
    siteCode: id,
    token: `${payload}|${sig}`,
    blocker: "station_token_acceptance_unverified",
    message: "Token generated. A real station must accept it before REQ-2.1.2 can be strict complete.",
  })
}
