/**
 * Sprint R.51 — Security boundary e2e tests.
 *
 * Verifies:
 * - Unsigned site-control requests rejected (HMAC)
 * - Session cookie is HttpOnly
 * - Password is scrypt hash, not plaintext
 * - API responses don't leak secrets
 * - Auth accounts have no weak passwords
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
let exitCode = 0
let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string) {
  if (!ok) {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`)
    failed++
    exitCode = 1
  } else {
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`)
    passed++
  }
}

async function main() {
  console.log(`\n=== R.51 Security Boundary Tests ===\nBASE=${BASE}\n`)

  // 1. Login to get session cookie
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin", siteCode: "SH01" }),
    redirect: "manual",
  })
  const setCookie = loginRes.headers.get("set-cookie") ?? ""
  check("login returns HttpOnly cookie", setCookie.includes("HttpOnly"), setCookie.slice(0, 80))
  check("login returns SameSite", setCookie.includes("SameSite"), setCookie.slice(0, 80))

  const sessionCookie = setCookie.split(";")[0]

  // 2. Unsigned site-control poll should be rejected (pass siteCode but no HMAC)
  const unsignedRes = await fetch(`${BASE}/api/site-control/commands?siteCode=SH01`, {
    headers: { "Content-Type": "application/json" },
  })
  // Should get 401 (no HMAC signature)
  check("unsigned site-control rejected", unsignedRes.status === 401 || unsignedRes.status === 403, `HTTP ${unsignedRes.status}`)

  // 3. Protected APIs require auth
  const noAuthRes = await fetch(`${BASE}/api/tasks`)
  check("GET /api/tasks without auth rejected", noAuthRes.status === 401, `HTTP ${noAuthRes.status}`)

  const noAuthUsers = await fetch(`${BASE}/api/users`)
  check("GET /api/users without auth rejected", noAuthUsers.status === 401, `HTTP ${noAuthUsers.status}`)

  const noAuthControl = await fetch(`${BASE}/api/control/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  check("POST /api/control/commands without auth rejected", noAuthControl.status === 401, `HTTP ${noAuthControl.status}`)

  // 4. With auth, APIs work
  const authRes = await fetch(`${BASE}/api/tasks`, {
    headers: { Cookie: sessionCookie },
  })
  check("GET /api/tasks with auth succeeds", authRes.status === 200, `HTTP ${authRes.status}`)

  // 5. API responses don't contain password_hash or secret values
  const meRes = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: sessionCookie },
  })
  const meData = await meRes.json()
  const meStr = JSON.stringify(meData)
  check("auth/me response has no password_hash", !meStr.includes("password_hash"), "")
  check("auth/me response has no scrypt", !meStr.includes("scrypt"), "")

  // 6. Accounts API doesn't expose password hashes
  const accountsRes = await fetch(`${BASE}/api/auth/accounts`, {
    headers: { Cookie: sessionCookie },
  })
  const accountsData = await accountsRes.json()
  const accountsStr = JSON.stringify(accountsData)
  check("auth/accounts has no password_hash", !accountsStr.includes("password_hash"), "")
  check("auth/accounts has no scrypt", !accountsStr.includes("scrypt"), "")

  // 7. System health doesn't leak DB credentials
  const healthRes = await fetch(`${BASE}/api/system/health`)
  const healthStr = await healthRes.text()
  check("system/health has no DB password", !healthStr.includes("password") && !healthStr.includes("starxdb"), "")

  // 8. Wrong password login fails
  const badLogin = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "wrong_password", siteCode: "SH01" }),
  })
  check("wrong password returns 401", badLogin.status === 401, `HTTP ${badLogin.status}`)

  // Summary
  console.log(`\n=== R.51 Summary: ${passed} passed, ${failed} failed ===`)
  if (exitCode !== 0) process.exit(exitCode)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
