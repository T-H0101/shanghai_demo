/**
 * GET /api/auth/sso/start
 * Sprint R.65 — start an OIDC SSO flow.
 *
 * Returns implemented_candidate if OIDC is not configured. Real
 * activation requires the four OIDC env keys + a test AD user.
 */

import { NextRequest, NextResponse } from "next/server"
import { buildOidcStartUrl } from "@/lib/auth/oidc-provider"
import { randomBytes } from "node:crypto"

export async function GET(req: NextRequest) {
  const state = randomBytes(16).toString("hex")
  const redirectUri = `${req.nextUrl.origin}/api/auth/sso/callback`
  const result = buildOidcStartUrl(state, redirectUri)
  if (result.status === "redirect" && result.redirectUrl) {
    return NextResponse.redirect(result.redirectUrl, 302)
  }
  return NextResponse.json(
    {
      code: 0,
      status: "implemented_candidate",
      blocker: result.blocker ?? "unknown",
      missing: result.missing ?? [],
      message:
        "OIDC provider not configured. Set OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_JWKS_URL.",
    },
    { status: 200 }
  )
}
