/**
 * GET /api/auth/sso/start
 * Sprint R.99 — 跳转药明 ADFS authorize。未配置时回到 /login?sso=not_configured，不假装成功。
 */

import { NextRequest, NextResponse } from "next/server"
import { buildOidcStartUrl, resolveOidcRedirectUri } from "@/lib/auth/oidc-provider"
import {
  OIDC_STATE_COOKIE,
  OIDC_STATE_COOKIE_MAX_AGE,
  createOidcStateBundle,
} from "@/lib/auth/oidc-state"
import { resolveAuthCookieSecure } from "@/lib/auth/server"
import { publicAbsoluteUrl } from "@/lib/http/public-origin"

function loginRedirect(req: NextRequest, query: string) {
  return NextResponse.redirect(publicAbsoluteUrl(`/login?${query}`, req), 302)
}

export async function GET(req: NextRequest) {
  const redirectUri = resolveOidcRedirectUri(req)
  const { cookieValue, bundle } = createOidcStateBundle(redirectUri)
  const result = buildOidcStartUrl({
    state: bundle.state,
    nonce: bundle.nonce,
    redirectUri,
  })

  if (result.status !== "redirect" || !result.redirectUrl) {
    return loginRedirect(req, "sso=not_configured")
  }

  const response = NextResponse.redirect(result.redirectUrl, 302)
  response.cookies.set(OIDC_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: resolveAuthCookieSecure(req),
    path: "/",
    maxAge: OIDC_STATE_COOKIE_MAX_AGE,
  })
  return response
}
