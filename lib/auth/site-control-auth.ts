import { NextRequest, NextResponse } from "next/server"
import { getSyncPackageAuthConfig } from "@/lib/sync/package-auth"
import { verifySiteAgentRequest } from "@/lib/site-agent/hmac"
import { consumeSiteAgentNonce } from "@/lib/site-agent/nonce-store"

export interface SiteAuthOk {
  ok: true
  mode: "dev" | "strict"
  siteCode: string
}

export interface SiteAuthFail {
  ok: false
  response: NextResponse
}

export type SiteAuthResult = SiteAuthOk | SiteAuthFail

export async function verifySiteControlRequest(
  request: NextRequest,
  input: {
    rawBody: string
    payloadSiteCode: string | null
  }
): Promise<SiteAuthResult> {
  const config = getSyncPackageAuthConfig()
  const headerSiteCode = request.headers.get("x-site-code")

  if (config.mode === "dev") {
    const siteCode = input.payloadSiteCode ?? headerSiteCode
    if (!siteCode) {
      return {
        ok: false,
        response: NextResponse.json(
          { code: "MISSING_SITE_CODE", message: "siteCode is required" },
          { status: 400 }
        ),
      }
    }
    return { ok: true, mode: "dev", siteCode }
  }

  const auth = verifySiteAgentRequest({
    siteCode: headerSiteCode,
    timestamp: request.headers.get("x-agent-timestamp"),
    nonce: request.headers.get("x-agent-nonce"),
    signature: request.headers.get("x-agent-signature"),
    method: request.method,
    path: `${request.nextUrl.pathname}${request.nextUrl.search}`,
    rawBody: input.rawBody,
    payloadSiteCode: input.payloadSiteCode,
  })
  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { code: auth.code, message: auth.message },
        { status: auth.code === "AUTH_NOT_CONFIGURED" ? 503 : 401 }
      ),
    }
  }

  const nonce = request.headers.get("x-agent-nonce")!
  const nonceResult = await consumeSiteAgentNonce(headerSiteCode!, nonce)
  if (!nonceResult.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: nonceResult.code,
          message:
            nonceResult.code === "UNKNOWN_SITE"
              ? "siteCode is not registered in sync_sites"
              : "nonce has already been used",
        },
        { status: nonceResult.code === "UNKNOWN_SITE" ? 404 : 409 }
      ),
    }
  }

  return { ok: true, mode: "strict", siteCode: headerSiteCode! }
}
