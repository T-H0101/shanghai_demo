/**
 * Login page redesign e2e — Sprint UI/UX beautification.
 *
 * Verifies (against a running dev server at BASE_URL):
 *  1. /login returns 200
 *  2. Background Canvas is rendered (data-testid="login-background")
 *  3. SSO disabled button is REMOVED
 *  4. federation status has only 2 items (JWT 会话 / 登录审计)
 *  5. Top-right has help mailto + theme toggle (no Globe)
 *  6. Login card has data-testid="login-card"
 *  7. Submit button has data-testid="login-submit"
 *  8. Bottom copy lines preserved (本地 JWT / ADFS 待接入 / 站点 SSO 待接入)
 *  9. Form has account + password inputs in correct autoComplete order
 * 10. Source file integrity (3 components imported, GlassPanel removed)
 */

import { readFileSync } from "node:fs"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

async function main() {
  console.log("=== Login page e2e (UI/UX redesign) ===\n")

  // ── 1. Page reachable ──────────────────────────────────────
  const res = await fetch(`${BASE}/login`)
  check("/login 200", res.status === 200, `HTTP ${res.status}`)

  const html = await res.text()

  // ── 2. Background canvas present ───────────────────────────
  check(
    "Background canvas mounted",
    html.includes('data-testid="login-background"'),
    'data-testid="login-background" found',
  )

  // ── 2b. r3 background polish — radial gradient overlay ─
  check(
    "r3: login page background has radial-gradient overlay",
    html.includes("radial-gradient"),
    "CSS radial-gradient present in SSR HTML",
  )

  // ── 3. SSO dead button removed ─────────────────────────────
  check(
    "SSO disabled button REMOVED",
    !html.includes('data-testid="login-sso-blocked"'),
    "login-sso-blocked no longer present",
  )

  // ── 4. Federation status trimmed ───────────────────────────
  const fedMatch = html.match(/data-testid="login-federation-status"[\s\S]{0,2000}?<\/div>\s*<\/div>/)
  if (fedMatch) {
    const inner = fedMatch[0]
    const dotCount = (inner.match(/h-2 w-2 rounded-full/g) ?? []).length
    check("Federation status has exactly 2 items", dotCount === 2, `dots=${dotCount}`)
  } else {
    check("Federation status container found", false, "container missing")
  }

  // ── 5. Header (r2: simplified to logo only) ──────────────
  check(
    "Login header has no help mailto",
    !html.includes('data-testid="login-help"'),
    "Help button removed in r2",
  )
  check(
    "Login header has no theme toggle",
    !html.includes('data-testid="login-theme-toggle"'),
    "Moon button removed in r2",
  )
  check(
    "Login header mounted (logo + product name only)",
    html.includes('data-testid="login-header"') &&
      (html.match(/data-testid="login-header"/g) ?? []).length === 1,
    "header element present exactly once",
  )

  // ── 6 & 7. Login card + submit ─────────────────────────────
  check("Login card mounted", html.includes('data-testid="login-card"'))
  check(
    "Submit button has testid",
    html.includes('data-testid="login-submit"'),
  )

  // ── 8. Bottom copy preserved ───────────────────────────────
  check(
    "Bottom copy line 1 preserved",
    html.includes("当前认证：本地 JWT"),
  )
  check(
    "Bottom copy line 2 preserved",
    html.includes("企业 ADFS/LDAP：待接入"),
  )
  check(
    "Bottom copy line 3 preserved",
    html.includes("站点 SSO：待 ADFS/LDAP 与站点 token 接收端点确认"),
  )

  // ── 9. Form input order & autocomplete ────────────────────
  // Search for the raw DOM positions; React injects many props between
  // field tags so allow a generous gap.
  const accountIdx = html.indexOf('id="account"')
  const passwordIdx = html.indexOf('id="password"')
  check(
    "Account field precedes password",
    accountIdx > 0 && passwordIdx > accountIdx,
    `account@${accountIdx} password@${passwordIdx}`,
  )
  check(
    "Account autoComplete=username",
    /id="account"[\s\S]{0,200}?autoComplete="username"/.test(html),
  )
  check(
    "Password autoComplete=current-password",
    /id="password"[\s\S]{0,200}?autoComplete="current-password"/.test(html),
  )

  // ── 10. Source file integrity ─────────────────────────────
  const pageSrc = readFileSync("app/login/page.tsx", "utf8")
  check(
    "app/login/page.tsx imports the 3 new components",
    pageSrc.includes("LoginBackground") &&
      pageSrc.includes("LoginHeader") &&
      pageSrc.includes("LoginCard"),
    "all three imports present",
  )
  check(
    "app/login/page.tsx removed GlassPanel (capability cards gone)",
    !pageSrc.includes("GlassPanel"),
    "GlassPanel import removed",
  )

  // ── Summary ───────────────────────────────────────────────
  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})