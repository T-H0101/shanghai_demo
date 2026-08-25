/**
 * OIDC authorize state/nonce — HMAC 绑定到 HttpOnly cookie，防 CSRF。
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { getAuthSecret } from "@/lib/auth/jwt"

export const OIDC_STATE_COOKIE = "odp_oidc_state"
const TTL_SECONDS = 600

export interface OidcStateBundle {
  state: string
  nonce: string
  redirectUri: string
  exp: number
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getAuthSecret()).update(payloadB64).digest("base64url")
}

export function createOidcStateBundle(redirectUri: string): { cookieValue: string; bundle: OidcStateBundle } {
  const bundle: OidcStateBundle = {
    state: randomBytes(16).toString("hex"),
    nonce: randomBytes(16).toString("hex"),
    redirectUri,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  }
  const payloadB64 = Buffer.from(JSON.stringify(bundle), "utf8").toString("base64url")
  return { cookieValue: `${payloadB64}.${sign(payloadB64)}`, bundle }
}

export function parseOidcStateCookie(cookieValue: string | undefined): OidcStateBundle | null {
  if (!cookieValue) return null
  const dot = cookieValue.lastIndexOf(".")
  if (dot < 1) return null
  const payloadB64 = cookieValue.slice(0, dot)
  const mac = cookieValue.slice(dot + 1)
  const expected = sign(payloadB64)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const bundle = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as OidcStateBundle
    if (!bundle.state || !bundle.nonce || !bundle.redirectUri) return null
    if (bundle.exp <= Math.floor(Date.now() / 1000)) return null
    return bundle
  } catch {
    return null
  }
}

export const OIDC_STATE_COOKIE_MAX_AGE = TTL_SECONDS
