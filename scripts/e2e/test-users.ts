/**
 * Users 事件 e2e - R.10C 真实只读化
 */

import { readFile } from "node:fs/promises"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++
    console.log(`  ✅ ${name}${detail ? ": " + detail : ""}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ": " + detail : ""}`)
  }
}

async function drain(res: Response) {
  await res.arrayBuffer().catch(() => undefined)
}

async function main() {
  console.log("=== Users 事件 e2e (R.10C) ===\n")

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin", siteCode: "SH01" }),
  })
  const cookie = loginRes.headers.get("set-cookie")?.match(/odp_session=([^;]+)/)?.[1] ?? ""
  const authHeaders: HeadersInit = cookie ? { Cookie: `odp_session=${cookie}` } : {}
  check("测试账号登录成功", loginRes.ok && Boolean(cookie), `HTTP ${loginRes.status}`)
  await drain(loginRes)

  const pageRes = await fetch(`${BASE}/users`)
  check("页面 /users 200", pageRes.status === 200, `HTTP ${pageRes.status}`)
  await drain(pageRes)

  const usersRes = await fetch(`${BASE}/api/users?pageSize=100`, { headers: authHeaders })
  const users = await usersRes.json()
  check(
    "用户 API 只返回中心库来源",
    usersRes.status === 200 && users.source === "database",
    `source=${users.source}`
  )
  check(
    "unified_users 真实记录可读",
    Array.isArray(users.data?.items) && users.data.items.length > 0,
    `items=${users.data?.items?.length ?? 0}`
  )
  check(
    "用户 API 不含 mock 标识",
    !JSON.stringify(users).toLowerCase().includes('"source":"mock"')
  )

  const siteRes = await fetch(`${BASE}/api/users?pageSize=100&siteCode=SH01`, { headers: authHeaders })
  const siteUsers = await siteRes.json()
  check(
    "siteCode=SH01 过滤生效",
    siteRes.status === 200 &&
      siteUsers.data?.items?.every((item: { sourceSiteId: string }) => item.sourceSiteId === "SH01"),
    `items=${siteUsers.data?.items?.length ?? 0}`
  )

  const apiSource = await readFile("app/api/users/route.ts", "utf8")
  check(
    "用户 API 无 mock fallback",
    !apiSource.includes("@/lib/mock/users") &&
      !apiSource.includes("fallback to mock") &&
      !apiSource.includes("adaptUserList")
  )

  const pageSource = await readFile("app/users/page.tsx", "utf8")
  check(
    "用户页面无 mock 数据导入",
    !pageSource.includes("@/lib/mock/users") &&
      !pageSource.includes("@/lib/mock/sites") &&
      !pageSource.includes("@/lib/mock/tasks")
  )
  check(
    "用户页面读取真实 API",
    pageSource.includes("/api/users") && pageSource.includes("fetch")
  )
  check(
    "账号生命周期与 Auth 管理入口已接入",
    pageSource.includes("Auth 账号管理") &&
      pageSource.includes("handleUnlock") &&
      pageSource.includes("/api/auth/accounts")
  )
  check(
    "页面无假创建/同步/封禁/删除成功",
    !pageSource.includes("账号创建成功") &&
      !pageSource.includes("同步完成") &&
      !pageSource.includes("账号已封禁") &&
      !pageSource.includes("账号已删除")
  )
  check(
    "页面处理 database/empty/error",
    pageSource.includes("database") &&
      pageSource.includes("empty") &&
      pageSource.includes("error")
  )
  check(
    "R.80: 站点→AD 映射展示受限时不宣称完成",
    pageSource.includes("未映射") ||
      pageSource.includes("blocked") ||
      pageSource.includes("candidate") ||
      !pageSource.includes("AD")
  )
  check(
    "R.80: 跨站点权限同步未宣称完成",
    !pageSource.includes("跨站点权限同步完成") &&
      !pageSource.includes("已传播至所有站点") &&
      !pageSource.includes("站点同步完成")
  )

  console.log(`\n=== Users: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
