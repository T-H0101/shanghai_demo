/**
 * Sprint R.29: 防越权 E2E 测试
 *
 * REQ-6.2.4: session + permission + site access 中间件
 *
 * 运行: npx tsx scripts/e2e/test-rbac.ts
 */

import { Client } from "pg"

export {} // Make this a module to avoid variable conflicts

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000"
let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  ✅ ${label}`) }
  else { failed++; console.error(`  ❌ ${label}${detail ? `: ${detail}` : ""}`) }
}

async function resetAdminAuthState() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    await client.query(
      `UPDATE auth_accounts
       SET failed_attempts = 0, locked_until = NULL, status = 'active', updated_at = NOW()
       WHERE username = 'admin'`,
    )
    await client.query(
      `DELETE FROM auth_login_audit
       WHERE username = 'admin'
         AND result IN ('failed', 'locked')
         AND created_at > NOW() - INTERVAL '30 minutes'`,
    )
  } finally {
    await client.end()
  }
}

async function main() {
  console.log("\n📋 Sprint R.29: 防越权 (REQ-6.2.4)\n")
  await resetAdminAuthState()

  // ── 1. 未登录请求应返回 401 ──
  console.log("─── 1. 未登录请求 ───")

  const protectedRoutes = [
    { path: "/api/tasks", method: "GET", name: "tasks" },
    { path: "/api/racks", method: "GET", name: "racks" },
    { path: "/api/volumes", method: "GET", name: "volumes" },
    { path: "/api/logs", method: "GET", name: "logs" },
    { path: "/api/users", method: "GET", name: "users" },
    { path: "/api/control/commands", method: "GET", name: "control-commands" },
  ]

  for (const route of protectedRoutes) {
    const res = await fetch(`${BASE}${route.path}`, {
      method: route.method,
      headers: { "Content-Type": "application/json" },
    })
    check(
      `未登录 ${route.name} 返回 401`,
      res.status === 401,
      `status=${res.status}`,
    )
  }

  // ── 2. 登录后请求应返回 200 ──
  console.log("\n─── 2. 登录后请求 ───")

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin", siteCode: "SH01" }),
  })
  check("登录成功", loginRes.ok)
  const cookie = loginRes.headers.get("set-cookie")?.match(/odp_session=([^;]+)/)?.[1]
  check("获取 cookie", Boolean(cookie))

  if (cookie) {
    for (const route of protectedRoutes) {
      const res = await fetch(`${BASE}${route.path}`, {
        method: route.method,
        headers: { Cookie: `odp_session=${cookie}` },
      })
      check(
        `登录后 ${route.name} 返回 200`,
        res.status === 200,
        `status=${res.status}`,
      )
    }
  }

  // ── 3. POST 控制命令需 control:submit 权限 ──
  console.log("\n─── 3. POST 权限检查 ───")

  if (cookie) {
    const postRes = await fetch(`${BASE}/api/control/commands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `odp_session=${cookie}`,
      },
      body: JSON.stringify({
        sourceSiteId: "SH01",
        commandType: "task_pause",
        targetType: "task",
        targetId: "test-001",
      }),
    })
    // admin has control:submit, so should get 201 (or 400 if validation fails, but not 403)
    check(
      "admin POST 控制命令不返回 403",
      postRes.status !== 403,
      `status=${postRes.status}`,
    )
  }

  // ── 4. 中间件文件存在性检查 ──
  console.log("\n─── 4. 中间件文件检查 ───")

  const middlewareRes = await fetch(`${BASE}/api/system/health`)
  check("系统健康检查可访问 (不受 auth 影响)", middlewareRes.ok)

  // ── Summary ──
  console.log(`\n${"═".repeat(60)}`)
  console.log(`📊 R.29 测试结果: ${passed} passed, ${failed} failed, ${passed + failed} total`)
  if (failed > 0) {
    console.log("❌ 有测试失败")
    process.exitCode = 1
  } else {
    console.log("✅ 全部通过")
  }
}

main().catch((e) => {
  console.error("测试运行失败:", e)
  process.exitCode = 1
})
