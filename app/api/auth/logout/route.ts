/**
 * POST /api/auth/logout
 * 清总控会话；若有 ADFS id_token 则返回 logoutUrl（前端再跳药明 logout）。
 */

import { NextRequest, NextResponse } from "next/server"
import { buildOidcLogoutUrl, resolvePostLogoutRedirectUri } from "@/lib/auth/oidc-provider"
import {
  clearSessionCookie,
  recordLogout,
  sessionFromRequest,
  takeOidcIdToken,
} from "@/lib/auth/server"

export async function POST(request: NextRequest) {
  const user = await sessionFromRequest(request)
  await recordLogout(request, user?.username ?? "unknown", user?.provider ?? "local")

  let adfsLogoutUrl: string | null = null
  if (user && (user.provider === "adfs" || user.provider === "oidc")) {
    const idToken = await takeOidcIdToken(user.id)
    adfsLogoutUrl = buildOidcLogoutUrl({
      postLogoutRedirectUri: resolvePostLogoutRedirectUri(request),
      idTokenHint: idToken,
    })
  }

  const response = NextResponse.json({
    code: 200,
    message: "logged out",
    data: { adfsLogoutUrl },
  })
  clearSessionCookie(response, request)
  return response
}
