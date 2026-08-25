/**
 * lib/auth/oidc-provider.ts
 * Sprint R.99 — ADFS 4 / OIDC Authorization Code 适配。
 *
 * 未配置 Client ID/Secret 时返回 implemented_candidate / blocked_by_auth，
 * 不假装登录成功。端点按 ADFS 惯例：{issuer}/oauth2/authorize|token，
 * 而不是通用 OIDC 的 {issuer}/authorize。
 *
 * 药明测试环境文档地址（仅作对照，运行时读 env）：
 *   issuer:  https://stsdev.wuxiapptec.com/adfs
 *   authorize: .../adfs/oauth2/authorize
 *   token:     .../adfs/oauth2/token
 */

import { createPublicKey, createVerify } from "node:crypto"
import { resolvePublicOrigin, type OriginRequest } from "@/lib/http/public-origin"

type JwkLike = {
  kid?: string
  kty?: string
  n?: string
  e?: string
  x5c?: string[]
  [key: string]: unknown
}

export interface OidcStatus {
  status: "implemented_candidate" | "active"
  blocker: string | null
  missing: string[]
  endpoints?: OidcEndpoints
}

export interface OidcEndpoints {
  issuer: string
  authorization: string
  token: string
  jwks: string
  logout: string
}

const REQUIRED_FOR_LOGIN = [
  "OIDC_ISSUER_URL",
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
] as const

export function envTrim(name: string): string {
  return process.env[name]?.trim() ?? ""
}

function issuerBase(): string {
  return envTrim("OIDC_ISSUER_URL").replace(/\/+$/, "")
}

/** ADFS 4：issuer 形如 https://host/adfs 时走 /oauth2/*，可用 env 覆盖。 */
export function resolveOidcEndpoints(): OidcEndpoints | null {
  const issuer = issuerBase()
  if (!issuer) return null
  return {
    issuer,
    authorization: envTrim("OIDC_AUTHORIZATION_URL") || `${issuer}/oauth2/authorize`,
    token: envTrim("OIDC_TOKEN_URL") || `${issuer}/oauth2/token`,
    jwks: envTrim("OIDC_JWKS_URL") || `${issuer}/discovery/keys`,
    logout: envTrim("OIDC_LOGOUT_URL") || `${issuer}/oauth2/logout`,
  }
}

export function oidcStatus(): OidcStatus {
  const missing = REQUIRED_FOR_LOGIN.filter((k) => !envTrim(k))
  if (missing.length > 0) {
    return {
      status: "implemented_candidate",
      blocker: "enterprise_provider_not_configured",
      missing: [...missing],
    }
  }
  const endpoints = resolveOidcEndpoints()
  if (!endpoints) {
    return {
      status: "implemented_candidate",
      blocker: "enterprise_provider_not_configured",
      missing: ["OIDC_ISSUER_URL"],
    }
  }
  return {
    status: "active",
    blocker: null,
    missing: [],
    endpoints,
  }
}

export interface OidcStartResult {
  status: "implemented_candidate" | "redirect"
  redirectUrl?: string
  blocker?: string
  missing?: string[]
}

export function buildOidcStartUrl(input: {
  state: string
  nonce: string
  redirectUri: string
}): OidcStartResult {
  const s = oidcStatus()
  if (s.status !== "active" || !s.endpoints) {
    return { status: "implemented_candidate", blocker: s.blocker ?? "unknown", missing: s.missing }
  }
  const url = new URL(s.endpoints.authorization)
  url.searchParams.set("client_id", envTrim("OIDC_CLIENT_ID"))
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", input.redirectUri)
  url.searchParams.set("response_mode", "query")
  url.searchParams.set("scope", envTrim("OIDC_SCOPE") || "openid")
  url.searchParams.set("state", input.state)
  url.searchParams.set("nonce", input.nonce)
  const resource = envTrim("OIDC_RESOURCE")
  if (resource) url.searchParams.set("resource", resource)
  return { status: "redirect", redirectUrl: url.toString() }
}

export function buildOidcLogoutUrl(input: {
  postLogoutRedirectUri: string
  idTokenHint?: string | null
}): string | null {
  const endpoints = resolveOidcEndpoints()
  if (!endpoints) return null
  const url = new URL(endpoints.logout)
  url.searchParams.set("post_logout_redirect_uri", input.postLogoutRedirectUri)
  if (input.idTokenHint) url.searchParams.set("id_token_hint", input.idTokenHint)
  return url.toString()
}

export function resolveOidcRedirectUri(req?: OriginRequest): string {
  const explicit = envTrim("OIDC_REDIRECT_URI")
  if (explicit) return explicit
  return `${resolvePublicOrigin(req)}/api/auth/sso/callback`
}

export function resolvePostLogoutRedirectUri(req?: OriginRequest): string {
  return `${resolvePublicOrigin(req)}/login`
}

export interface OidcReadiness {
  ready: boolean
  missingEnvKeys: string[]
  status: "configured_candidate" | "blocked_by_auth"
}

export function getOidcReadiness(): OidcReadiness {
  const required = ["OIDC_ISSUER_URL", "OIDC_CLIENT_ID", "OIDC_JWKS_URL"] as const
  const missing = required.filter((k) => !envTrim(k))
  return {
    ready: missing.length === 0,
    missingEnvKeys: [...missing],
    status: missing.length === 0 ? "configured_candidate" : "blocked_by_auth",
  }
}

export interface TokenExchangeResult {
  status: "ok" | "failed"
  idToken?: string
  accessToken?: string
  error?: string
}

export async function exchangeAuthorizationCode(input: {
  code: string
  redirectUri: string
}): Promise<TokenExchangeResult> {
  const s = oidcStatus()
  if (s.status !== "active" || !s.endpoints) {
    return { status: "failed", error: "oidc_not_configured" }
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: envTrim("OIDC_CLIENT_ID"),
    client_secret: envTrim("OIDC_CLIENT_SECRET"),
  })
  let res: Response
  try {
    res = await fetch(s.endpoints.token, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    })
  } catch (e) {
    return { status: "failed", error: `token_network:${e instanceof Error ? e.message : String(e)}` }
  }
  const json = (await res.json().catch(() => null)) as {
    id_token?: string
    access_token?: string
    error?: string
    error_description?: string
  } | null
  if (!res.ok || !json?.id_token) {
    const detail = json?.error_description || json?.error || `http_${res.status}`
    return { status: "failed", error: `token_exchange:${detail}` }
  }
  return { status: "ok", idToken: json.id_token, accessToken: json.access_token }
}

interface JwtHeader {
  alg?: string
  kid?: string
  typ?: string
}

export function decodeJwtParts(token: string): { header: JwtHeader; payload: Record<string, unknown>; signature: Buffer } | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as JwtHeader
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>
    const signature = Buffer.from(parts[2], "base64url")
    return { header, payload, signature }
  } catch {
    return null
  }
}

async function loadJwksKey(jwksUrl: string, kid?: string): Promise<JwkLike | string | null> {
  const res = await fetch(jwksUrl)
  if (!res.ok) return null
  const body = (await res.json().catch(() => null)) as { keys?: JwkLike[] } | null
  const keys = body?.keys ?? []
  const jwk = (kid ? keys.find((k) => k.kid === kid) : keys[0]) ?? keys[0]
  if (!jwk) return null
  if (Array.isArray(jwk.x5c) && jwk.x5c[0]) {
    const b64 = String(jwk.x5c[0]).replace(/\s+/g, "")
    return `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----`
  }
  return jwk
}

export async function verifyIdToken(input: {
  idToken: string
  nonce: string
}): Promise<{ status: "ok"; claims: Record<string, unknown> } | { status: "failed"; error: string }> {
  const s = oidcStatus()
  if (s.status !== "active" || !s.endpoints) {
    return { status: "failed", error: "oidc_not_configured" }
  }
  const decoded = decodeJwtParts(input.idToken)
  if (!decoded) return { status: "failed", error: "malformed_id_token" }
  if (decoded.header.alg && decoded.header.alg !== "RS256") {
    return { status: "failed", error: `unsupported_alg:${decoded.header.alg}` }
  }

  let keyMaterial: JwkLike | string | null
  try {
    keyMaterial = await loadJwksKey(s.endpoints.jwks, decoded.header.kid)
  } catch (e) {
    return { status: "failed", error: `jwks_network:${e instanceof Error ? e.message : String(e)}` }
  }
  if (!keyMaterial) return { status: "failed", error: "jwks_key_not_found" }

  const unsigned = input.idToken.split(".").slice(0, 2).join(".")
  const verifier = createVerify("RSA-SHA256")
  verifier.update(unsigned)
  verifier.end()
  let publicKey
  try {
    publicKey =
      typeof keyMaterial === "string"
        ? createPublicKey(keyMaterial)
        : createPublicKey({ key: keyMaterial, format: "jwk" })
  } catch {
    return { status: "failed", error: "jwks_key_invalid" }
  }
  if (!verifier.verify(publicKey, decoded.signature)) {
    return { status: "failed", error: "id_token_bad_signature" }
  }

  const claims = decoded.payload
  const now = Math.floor(Date.now() / 1000)
  const exp = typeof claims.exp === "number" ? claims.exp : 0
  if (exp && exp <= now) return { status: "failed", error: "id_token_expired" }

  const iss = String(claims.iss ?? "").replace(/\/+$/, "")
  if (iss && iss !== s.endpoints.issuer) return { status: "failed", error: "id_token_iss_mismatch" }

  const aud = claims.aud
  const clientId = envTrim("OIDC_CLIENT_ID")
  const audOk = aud === clientId || (Array.isArray(aud) && aud.includes(clientId))
  if (!audOk) return { status: "failed", error: "id_token_aud_mismatch" }

  const nonce = typeof claims.nonce === "string" ? claims.nonce : ""
  if (nonce && nonce !== input.nonce) return { status: "failed", error: "id_token_nonce_mismatch" }

  return { status: "ok", claims }
}
