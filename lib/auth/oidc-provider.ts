/**
 * lib/auth/oidc-provider.ts
 * Sprint R.65 — OIDC/ADFS provider boundary.
 *
 * Disabled by default. Returns `implemented_candidate` with the
 * missing config keys when not configured. Real activation requires
 * OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET and
 * OIDC_JWKS_URL plus a test AD user / group.
 */

export interface OidcStatus {
  status: "implemented_candidate" | "active"
  blocker: string | null
  missing: string[]
  endpoints?: {
    authorization: string
    token: string
    jwks: string
  }
}

const REQUIRED = ["OIDC_ISSUER_URL", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_JWKS_URL"] as const

export function oidcStatus(): OidcStatus {
  const missing = REQUIRED.filter((k) => !process.env[k])
  if (missing.length > 0) {
    return {
      status: "implemented_candidate",
      blocker: "enterprise_provider_not_configured",
      missing: [...missing],
    }
  }
  return {
    status: "active",
    blocker: null,
    missing: [],
    endpoints: {
      authorization: `${process.env.OIDC_ISSUER_URL}/authorize`,
      token: `${process.env.OIDC_ISSUER_URL}/token`,
      jwks: process.env.OIDC_JWKS_URL ?? "",
    },
  }
}

export interface OidcStartResult {
  status: "implemented_candidate" | "redirect"
  redirectUrl?: string
  blocker?: string
  missing?: string[]
}

export function buildOidcStartUrl(state: string, redirectUri: string): OidcStartResult {
  const s = oidcStatus()
  if (s.status !== "active" || !s.endpoints) {
    return { status: "implemented_candidate", blocker: s.blocker ?? "unknown", missing: s.missing }
  }
  const url = new URL(s.endpoints.authorization)
  url.searchParams.set("client_id", process.env.OIDC_CLIENT_ID ?? "")
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("scope", "openid profile email groups")
  url.searchParams.set("state", state)
  return { status: "redirect", redirectUrl: url.toString() }
}
