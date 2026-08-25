/**
 * Sprint R.99 — ADFS/OIDC 单边能力 e2e（不依赖药明 Client ID/Secret）
 *
 * 验证：未配置时不假装登录；authorize 路径为 ADFS /oauth2/；
 * 映射 API 真实写库；claim 抽取；站点 SSO 使用映射用户名。
 */

import { readFileSync } from "node:fs"
import { closePool, query } from "../../lib/db/postgres"
import { extractAdIdentityFromClaims, resolveSiteLocalUsername, centralUsernameFromAdClaims } from "../../lib/auth/account-mapping"
import {
  buildOidcStartUrl,
  resolveOidcEndpoints,
  resolveOidcRedirectUri,
  resolvePostLogoutRedirectUri,
} from "../../lib/auth/oidc-provider"
import { resolvePublicOrigin } from "../../lib/http/public-origin"
import { resolveCentralPortalSitesUrl } from "../../lib/site/sso-ticket"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++
    console.log(`  PASS ${name}${detail ? ` — ${detail}` : ""}`)
  } else {
    fail++
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

async function drain(res: Response) {
  await res.arrayBuffer().catch(() => undefined)
}

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {}
  for (const key of Object.keys(overrides)) {
    prev[key] = process.env[key]
    const next = overrides[key]
    if (next === undefined) delete process.env[key]
    else process.env[key] = next
  }
  try {
    fn()
  } finally {
    for (const key of Object.keys(prev)) {
      const value = prev[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

async function loginAdmin() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin", siteCode: "SH01" }),
  })
  const cookie = loginRes.headers.get("set-cookie")?.match(/odp_session=([^;]+)/)?.[1] ?? ""
  await drain(loginRes)
  return cookie
}

async function main() {
  console.log("=== R.99 ADFS/OIDC unilateral e2e ===\n")

  const oidcSrc = readFileSync("lib/auth/oidc-provider.ts", "utf8")
  const startSrc = readFileSync("app/api/auth/sso/start/route.ts", "utf8")
  const callbackSrc = readFileSync("app/api/auth/sso/callback/route.ts", "utf8")
  const loginCardSrc = readFileSync("components/auth/login-card.tsx", "utf8")

  check(
    "ADFS 端点使用 /oauth2/authorize 而非 {issuer}/authorize",
    oidcSrc.includes("/oauth2/authorize") && !oidcSrc.includes("${process.env.OIDC_ISSUER_URL}/authorize"),
  )
  check("callback 调用 exchangeAuthorizationCode", callbackSrc.includes("exchangeAuthorizationCode"))
  check("callback 调用 verifyIdToken", callbackSrc.includes("verifyIdToken"))
  check("未配置时 start 回 login?sso=not_configured", startSrc.includes("sso=not_configured"))
  check(
    "start/callback 不使用 nextUrl.origin",
    !startSrc.includes("nextUrl.origin") && !callbackSrc.includes("nextUrl.origin"),
  )
  check("无 fake OIDC login helper", !oidcSrc.includes("fakeOIDCLogin") && !callbackSrc.includes("stub"))
  check(
    "登录页企业 AD 按钮指向 start",
    loginCardSrc.includes("login-adfs-start") && loginCardSrc.includes("/api/auth/sso/start"),
  )

  const identity = extractAdIdentityFromClaims({
    employeeid: "E1001",
    email: "e1001@wuxiapptec.com",
    name: "测试用户",
  })
  check("claim 抽取员工号", identity.employeeId === "E1001")
  check("claim 抽取邮箱", identity.email === "e1001@wuxiapptec.com")
  check(
    "总控用户名优先 AD 登录名",
    centralUsernameFromAdClaims({
      employeeid: "E1001",
      preferred_username: "ZhangSan",
      email: "e1001@wuxiapptec.com",
    }) === "zhangsan",
  )

  const prevIssuer = process.env.OIDC_ISSUER_URL
  process.env.OIDC_ISSUER_URL = "https://stsdev.wuxiapptec.com/adfs"
  const endpoints = resolveOidcEndpoints()
  check(
    "stsdev issuer 解析为 ADFS oauth2 authorize",
    endpoints?.authorization === "https://stsdev.wuxiapptec.com/adfs/oauth2/authorize",
    endpoints?.authorization,
  )
  check(
    "stsdev issuer 解析为 ADFS oauth2 token",
    endpoints?.token === "https://stsdev.wuxiapptec.com/adfs/oauth2/token",
  )
  if (prevIssuer === undefined) delete process.env.OIDC_ISSUER_URL
  else process.env.OIDC_ISSUER_URL = prevIssuer

  const listenReq = {
    url: "https://0.0.0.0:3000/api/auth/sso/start",
    headers: new Headers({
      host: "0.0.0.0:3000",
      "x-forwarded-proto": "https",
    }),
  }
  withEnv(
    {
      PUBLIC_APP_URL: "https://10.186.1.229:30000",
      NEXT_PUBLIC_APP_URL: undefined,
      OIDC_REDIRECT_URI: undefined,
    },
    () => {
      check(
        "PUBLIC_APP_URL 覆盖监听地址 0.0.0.0",
        resolvePublicOrigin(listenReq) === "https://10.186.1.229:30000",
        resolvePublicOrigin(listenReq),
      )
      check(
        "OIDC redirect_uri 来自对外 Origin",
        resolveOidcRedirectUri(listenReq) === "https://10.186.1.229:30000/api/auth/sso/callback",
      )
      check(
        "OIDC post-logout 来自对外 Origin",
        resolvePostLogoutRedirectUri(listenReq) === "https://10.186.1.229:30000/login",
      )
      check(
        "站点 SSO 回跳与登录共用 Origin",
        resolveCentralPortalSitesUrl(listenReq) === "https://10.186.1.229:30000/sites",
      )
    },
  )
  withEnv({ PUBLIC_APP_URL: undefined, NEXT_PUBLIC_APP_URL: undefined, OIDC_REDIRECT_URI: undefined }, () => {
    const forwarded = {
      url: "http://0.0.0.0:3000/api/auth/sso/start",
      headers: new Headers({
        host: "0.0.0.0:3000",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "10.186.1.229:30000",
      }),
    }
    check(
      "无 PUBLIC_APP_URL 时用 X-Forwarded-Host",
      resolvePublicOrigin(forwarded) === "https://10.186.1.229:30000",
      resolvePublicOrigin(forwarded),
    )
    check(
      "仅监听地址时不输出 0.0.0.0",
      resolvePublicOrigin(listenReq) === "http://127.0.0.1:3000",
      resolvePublicOrigin(listenReq),
    )
  })

  const startRes = await fetch(`${BASE}/api/auth/sso/start`, { redirect: "manual" })
  const location = startRes.headers.get("location") ?? ""
  check(
    "GET /api/auth/sso/start 未配置时 302 回登录页",
    startRes.status === 302 && location.includes("sso=not_configured") && !location.includes("0.0.0.0"),
    `status=${startRes.status} location=${location}`,
  )
  await drain(startRes)

  const startJson = await fetch(`${BASE}/api/auth/sso/start`, { redirect: "follow" })
  check("follow 后落到 /login", startJson.url.includes("/login"), startJson.url)
  await drain(startJson)

  const callbackRes = await fetch(`${BASE}/api/auth/sso/callback`, { redirect: "manual" })
  const cbLoc = callbackRes.headers.get("location") ?? ""
  check(
    "GET /api/auth/sso/callback 未配置不发会话",
    callbackRes.status === 302 && cbLoc.includes("sso=error") && !cbLoc.includes("0.0.0.0"),
    `status=${callbackRes.status} location=${cbLoc}`,
  )
  await drain(callbackRes)

  const cookie = await loginAdmin()
  check("admin 登录拿到 cookie", Boolean(cookie))
  const authHeaders: HeadersInit = {
    cookie: `odp_session=${cookie}`,
    "content-type": "application/json",
  }

  await query(
    `DELETE FROM auth_site_user_mappings m
     USING auth_accounts a
     WHERE m.auth_account_id = a.id AND a.username = 'admin' AND m.site_code = 'SH01'`,
  ).catch(() => undefined)
  await query(
    `DELETE FROM auth_site_user_mappings
     WHERE site_code = 'SH01' AND lower(site_local_username) = 'site_user_e2e'`,
  ).catch(() => undefined)

  const createRes = await fetch(`${BASE}/api/auth/account-mappings`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      username: "admin",
      siteCode: "SH01",
      siteLocalUsername: "site_user_e2e",
      note: "r99 e2e",
    }),
  })
  const created = await createRes.json().catch(() => null)
  check(
    "POST mapping 按用户名写入中心库",
    createRes.ok && Boolean(created?.data?.id) && created?.data?.account_username === "admin",
    `status=${createRes.status}`,
  )
  const mappingId = created?.data?.id as string | undefined

  const adminRow = await query<{ id: string }>(
    `SELECT id::text AS id FROM auth_accounts WHERE username = 'admin' LIMIT 1`,
  )
  const mappedName = adminRow.rows[0]?.id
    ? await resolveSiteLocalUsername({
        accountId: adminRow.rows[0].id,
        fallbackUsername: "admin",
        siteCode: "SH01",
      })
    : ""
  check("SSO 解析映射为站点用户名", mappedName === "site_user_e2e", mappedName)

  const listRes = await fetch(`${BASE}/api/auth/account-mappings?siteCode=SH01`, {
    headers: { cookie: `odp_session=${cookie}` },
  })
  const listJson = await listRes.json().catch(() => null)
  check(
    "GET mapping dataSource=database",
    listRes.ok && listJson?.dataSource === "database",
    `source=${listJson?.dataSource}`,
  )

  if (mappingId) {
    const db = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM auth_site_user_mappings WHERE id = $1::uuid`,
      [mappingId],
    )
    check("psql 能查到映射行", Number.parseInt(db.rows[0]?.n ?? "0", 10) === 1)

    const delRes = await fetch(`${BASE}/api/auth/account-mappings/${mappingId}`, {
      method: "DELETE",
      headers: { cookie: `odp_session=${cookie}` },
    })
    check("DELETE mapping 200", delRes.ok, `status=${delRes.status}`)
    await drain(delRes)
    const afterDelete = adminRow.rows[0]?.id
      ? await resolveSiteLocalUsername({
          accountId: adminRow.rows[0].id,
          fallbackUsername: "admin",
          siteCode: "SH01",
        })
      : ""
    check("删除映射后回退用户名", afterDelete === "admin", afterDelete)
  }

  const startWithClient = buildOidcStartUrl({
    state: "s",
    nonce: "n",
    redirectUri: "https://example.invalid/api/auth/sso/callback",
  })
  check(
    "无 Client 时 buildOidcStartUrl 为 implemented_candidate",
    startWithClient.status === "implemented_candidate",
    startWithClient.status,
  )

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await closePool().catch(() => undefined)
  })
