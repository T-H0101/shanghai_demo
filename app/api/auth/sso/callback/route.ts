/**
 * GET /api/auth/sso/callback
 * Sprint R.99 — 用 code 换 token、验 id_token、签发总控 JWT。
 * 未配置或校验失败回到 /login?sso=error，不静默发会话。
 */

import { NextRequest, NextResponse } from "next/server"
import {
  exchangeAuthorizationCode,
  oidcStatus,
  verifyIdToken,
} from "@/lib/auth/oidc-provider"
import { OIDC_STATE_COOKIE, parseOidcStateCookie } from "@/lib/auth/oidc-state"
import { mapOidcClaimsToAccount } from "@/lib/auth/account-mapping"
import {
  completeAdfsLogin,
  recordAdfsLoginFailure,
  resolveAuthCookieSecure,
  setSessionCookie,
} from "@/lib/auth/server"
import { publicAbsoluteUrl } from "@/lib/http/public-origin"

function clearState(response: NextResponse, req: NextRequest) {
  response.cookies.set(OIDC_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: resolveAuthCookieSecure(req),
    path: "/",
    maxAge: 0,
  })
}

function failRedirect(req: NextRequest, reason: string) {
  const response = NextResponse.redirect(
    publicAbsoluteUrl(`/login?sso=error&reason=${encodeURIComponent(reason)}`, req),
    302,
  )
  clearState(response, req)
  return response
}

export async function GET(req: NextRequest) {
  const s = oidcStatus()
  if (s.status !== "active") {
    await recordAdfsLoginFailure({ request: req, reason: "oidc_not_configured" })
    return failRedirect(req, "not_configured")
  }

  const adfsError = req.nextUrl.searchParams.get("error")
  if (adfsError) {
    await recordAdfsLoginFailure({ request: req, reason: `adfs_${adfsError}` })
    return failRedirect(req, adfsError)
  }

  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  const bundle = parseOidcStateCookie(req.cookies.get(OIDC_STATE_COOKIE)?.value)
  if (!code) {
    await recordAdfsLoginFailure({ request: req, reason: "missing_code" })
    return failRedirect(req, "missing_code")
  }
  if (!bundle || !state || bundle.state !== state) {
    await recordAdfsLoginFailure({ request: req, reason: "state_mismatch" })
    return failRedirect(req, "state_mismatch")
  }

  const exchanged = await exchangeAuthorizationCode({
    code,
    redirectUri: bundle.redirectUri,
  })
  if (exchanged.status !== "ok" || !exchanged.idToken) {
    await recordAdfsLoginFailure({ request: req, reason: exchanged.error ?? "token_exchange" })
    return failRedirect(req, "token_exchange")
  }

  const verified = await verifyIdToken({ idToken: exchanged.idToken, nonce: bundle.nonce })
  if (verified.status !== "ok") {
    await recordAdfsLoginFailure({ request: req, reason: verified.error })
    return failRedirect(req, "id_token")
  }

  const mapped = mapOidcClaimsToAccount(verified.claims)
  if (mapped.status !== "mapped" || !mapped.account) {
    await recordAdfsLoginFailure({
      request: req,
      reason: mapped.blocker ?? mapped.status,
    })
    return failRedirect(req, "claim_mapping")
  }

  const result = await completeAdfsLogin({
    mapped: mapped.account,
    request: req,
    idToken: exchanged.idToken,
  })
  if (!result.ok) {
    return failRedirect(req, result.code.toLowerCase())
  }

  const dest = result.user.siteCode
    ? `/?siteCode=${encodeURIComponent(result.user.siteCode)}`
    : "/"
  const response = NextResponse.redirect(publicAbsoluteUrl(dest, req), 302)
  setSessionCookie(response, result.token, req)
  clearState(response, req)
  return response
}
