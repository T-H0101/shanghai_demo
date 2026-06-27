/**
 * Sprint R.26 auth foundation e2e.
 *
 * Verifies the platform no longer relies on browser-only mock authentication:
 * - login issues an HttpOnly session cookie
 * - /api/auth/me reads server session
 * - logout clears session
 * - repeated failures lock the account
 * - auth source no longer advertises mock localStorage login
 *
 * Sprint R.80 — adds contract checks: ADFS/OIDC/LDAP remain
 * `blocked_by_auth` until real issuer + test AD user + claim
 * mapping exist. local JWT is the only path that may be complete.
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { closePool, query } from "../../lib/db/postgres"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

function check(label: string, ok: boolean, detail?: string) {
  if (!ok) {
    console.error(`FAIL ${label}${detail ? ` - ${detail}` : ""}`)
    process.exitCode = 1
    return
  }
  console.log(`PASS ${label}${detail ? ` - ${detail}` : ""}`)
}

function cookieFrom(response: Response): string {
  const raw = response.headers.get("set-cookie") ?? ""
  return raw
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.startsWith("odp_session="))
    ?.split(";")[0] ?? ""
}

async function drain(response: Response) {
  await response.arrayBuffer().catch(() => undefined)
}

async function post(path: string, body: Record<string, unknown>, cookie?: string) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

async function seedRecentFailures(username: string, siteCode: string) {
  await query(
    `INSERT INTO auth_login_audit (
       username, site_code, ip_address, user_agent, result, failure_reason, provider, created_at
     )
     SELECT $1, $2, 'e2e', 'e2e-auth-lockout', 'failed', 'seeded lockout threshold', 'local',
            NOW() - (gs || ' seconds')::interval
     FROM generate_series(1, 5) AS gs`,
    [username, siteCode],
  )
}

async function main() {
  console.log("=== Auth foundation e2e ===")

  const loginSource = readFileSync("app/login/page.tsx", "utf8")
  const sessionSource = readFileSync("lib/auth/session.ts", "utf8")

  check(
    "login page no longer imports mock auth provider",
    !loginSource.includes("@/lib/mock/auth") && !loginSource.includes("validateMockCredentials"),
  )
  check(
    "session helper no longer stores mock token in localStorage",
    !sessionSource.includes("mock_token") && !sessionSource.includes("saveMockSession"),
  )

  const login = await post("/api/auth/login", {
    username: "admin",
    password: "admin",
    siteCode: "SH01",
  })
  const loginJson = await login.json().catch(() => ({}))
  check("POST /api/auth/login returns 200", login.status === 200, `status=${login.status}`)
  check("login response marks provider local", loginJson?.data?.provider === "local", JSON.stringify(loginJson))

  const cookie = cookieFrom(login)
  check("login sets odp_session cookie", cookie.startsWith("odp_session="), cookie)
  check("session cookie is HttpOnly", (login.headers.get("set-cookie") ?? "").includes("HttpOnly"))

  const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie } })
  const meJson = await me.json().catch(() => ({}))
  check("GET /api/auth/me returns 200 with cookie", me.status === 200, `status=${me.status}`)
  check("me includes username admin", meJson?.data?.user?.username === "admin", JSON.stringify(meJson))
  check("me includes RBAC permissions", Array.isArray(meJson?.data?.permissions) && meJson.data.permissions.length > 0)

  const logout = await post("/api/auth/logout", {}, cookie)
  check("POST /api/auth/logout returns 200", logout.status === 200, `status=${logout.status}`)
  check("logout expires odp_session cookie", (logout.headers.get("set-cookie") ?? "").includes("Max-Age=0"))
  await drain(logout)

  const lockedUser = `lock-${Date.now()}`
  await seedRecentFailures(lockedUser, "SH01")
  const locked = await post("/api/auth/login", {
    username: lockedUser,
    password: "wrong",
    siteCode: "SH01",
  })
  const lockedJson = await locked.json().catch(() => ({}))
  check("sixth failed login returns 423 lockout", locked.status === 423, `status=${locked.status}`)
  check("lockout response exposes locked code", lockedJson?.code === "AUTH_LOCKED", JSON.stringify(lockedJson))

  // ── R.80 contract: ADFS/OIDC/LDAP must remain blocked_by_auth ──
  console.log("\n─── R.80 auth boundary contract ───")

  const oidcProviderSource = readFileSync("lib/auth/oidc-provider.ts", "utf8")
  const ldapProviderSource = readFileSync("lib/auth/ldap-provider.ts", "utf8")
  const accountMappingSource = readFileSync("lib/auth/account-mapping.ts", "utf8")
  const traceabilitySource = readFileSync("docs/database-analysis/requirements-traceability.md", "utf8")
  const settingsSource = readFileSync("app/settings/page.tsx", "utf8")

  check(
    "OIDC provider exposes readiness contract",
    oidcProviderSource.includes("getOidcReadiness") &&
      oidcProviderSource.includes("missingEnvKeys") &&
      oidcProviderSource.includes("blocked_by_auth"),
    "getOidcReadiness() must return {ready, missingEnvKeys, status}"
  )
  check(
    "OIDC adapter remains blocked without issuer",
    oidcProviderSource.includes("OIDC_ISSUER_URL") &&
      oidcProviderSource.includes("enterprise_provider_not_configured"),
    "OIDC env key ref + blocker"
  )
  check(
    "LDAP adapter remains blocked without URL",
    ldapProviderSource.includes("LDAP_URL") &&
      ldapProviderSource.includes("enterprise_provider_not_configured"),
    "LDAP env key ref + blocker"
  )
  check(
    "Account mapping returns implemented_candidate when IdP is not configured",
    accountMappingSource.includes("implemented_candidate") &&
      accountMappingSource.includes("oidc_not_configured") &&
      accountMappingSource.includes("ldap_not_configured"),
    "mapOidcClaimsToAccount / mapLdapEntryToAccount"
  )
  check(
    "ADFS not claimed complete in requirements traceability",
    traceabilitySource.includes("blocked_by_auth"),
    "traceability must surface blocked_by_auth"
  )
  check(
    "settings page exposes settings-auth-boundary card",
    settingsSource.includes("settings-auth-boundary") &&
      settingsSource.includes("blocked_by_auth") &&
      settingsSource.includes("本地登录已启用"),
    "settings-auth-boundary card present"
  )
  check(
    "auth code does not fake OIDC login",
    !oidcProviderSource.includes("fakeOIDCLogin") &&
      !oidcProviderSource.includes("stub-oidc-login") &&
      !ldapProviderSource.includes("fakeLdapBind"),
    "no fake ADFS/OIDC/LDAP login helpers"
  )

  assert.equal(process.exitCode ?? 0, 0)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await closePool().catch(() => undefined)
  })
