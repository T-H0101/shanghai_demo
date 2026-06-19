/**
 * Sprint R.36: 并发测试 (>=20 用户)
 *
 * REQ-6.1.2: 支持>=20个并发用户，无卡顿、无超时
 *
 * 运行: npx tsx scripts/e2e/test-concurrency.ts
 */

export {}

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const CONCURRENCY = 20
let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  ✅ ${label}`) }
  else { failed++; console.error(`  ❌ ${label}${detail ? `: ${detail}` : ""}`) }
}

async function concurrentFetch(path: string, count: number): Promise<{ successes: number; failures: number; avgMs: number; maxMs: number }> {
  const results: { ok: boolean; ms: number }[] = []

  // Login first to get cookie
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123", siteCode: "SH01" }),
  })
  const cookie = loginRes.headers.get("set-cookie")?.match(/odp_session=([^;]+)/)?.[1] ?? ""

  const promises = Array.from({ length: count }, async () => {
    const start = Date.now()
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: cookie ? { Cookie: `odp_session=${cookie}` } : {},
      })
      return { ok: res.ok, ms: Date.now() - start }
    } catch {
      return { ok: false, ms: Date.now() - start }
    }
  })

  const batch = await Promise.all(promises)
  results.push(...batch)

  const successes = results.filter(r => r.ok).length
  const failures = results.filter(r => !r.ok).length
  const avgMs = Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length)
  const maxMs = Math.max(...results.map(r => r.ms))

  return { successes, failures, avgMs, maxMs }
}

async function main() {
  console.log(`\n📋 Sprint R.36: 并发测试 (REQ-6.1.2, ${CONCURRENCY} 并发)\n`)

  const endpoints = [
    { path: "/api/tasks?pageSize=10", name: "Tasks API" },
    { path: "/api/racks", name: "Racks API" },
    { path: "/api/volumes", name: "Volumes API" },
    { path: "/api/logs?limit=20", name: "Logs API" },
    { path: "/api/users?pageSize=10", name: "Users API" },
    { path: "/api/system/health", name: "Health API" },
  ]

  for (const ep of endpoints) {
    console.log(`─── ${ep.name} (${CONCURRENCY} 并发) ───`)
    const result = await concurrentFetch(ep.path, CONCURRENCY)

    check(
      `${ep.name}: ${result.successes}/${CONCURRENCY} 成功`,
      result.failures === 0,
      result.failures > 0 ? `${result.failures} failures` : undefined,
    )
    check(
      `${ep.name}: 平均响应 ${result.avgMs}ms < 1000ms`,
      result.avgMs < 1000,
      `avg=${result.avgMs}ms`,
    )
    check(
      `${ep.name}: 最大响应 ${result.maxMs}ms < 3000ms`,
      result.maxMs < 3000,
      `max=${result.maxMs}ms`,
    )
    console.log()
  }

  // ── Summary ──
  console.log(`${"═".repeat(60)}`)
  console.log(`📊 R.36 测试结果: ${passed} passed, ${failed} failed, ${passed + failed} total`)
  if (failed > 0) { console.log("❌ 有测试失败"); process.exitCode = 1 }
  else { console.log("✅ 全部通过") }
}

main().catch((e) => { console.error("测试运行失败:", e); process.exitCode = 1 })
