/**
 * GET /api/auth/sso/callback
 * Sprint R.65 — OIDC callback. Returns implemented_candidate when
 * OIDC is not configured. Real activation requires the OIDC env
 * keys, the JWKS verifier, and a real AD test user.
 */

import { NextRequest, NextResponse } from "next/server"
import { oidcStatus } from "@/lib/auth/oidc-provider"
import { mapOidcClaimsToAccount } from "@/lib/auth/account-mapping"

export async function GET(req: NextRequest) {
  const s = oidcStatus()
  if (s.status !== "active") {
    return NextResponse.json(
      {
        code: 0,
        status: "implemented_candidate",
        blocker: s.blocker,
        missing: s.missing,
        message: "OIDC callback not active; provider not configured",
      },
      { status: 200 }
    )
  }
  // Real callback would exchange the code, verify the id_token, map
  // claims, and create a session. We never silently grant auth.
  const code = req.nextUrl.searchParams.get("code")
  if (!code) {
    return NextResponse.json(
      { code: 400, error: "missing_code" },
      { status: 400 }
    )
  }
  const mapped = mapOidcClaimsToAccount({ preferred_username: "stub", sub: "stub" })
  return NextResponse.json({
    code: 0,
    status: mapped.status,
    message: "OIDC real token exchange not yet implemented",
  })
}
