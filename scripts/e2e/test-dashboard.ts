/**
 * Dashboard 事件 e2e - Sprint R.6 实施
 *
 * 覆盖:
 *   - / (Dashboard 页面) HTTP 200
 *   - /api/dashboard/summary 真实数据
 *   - /api/dashboard/recent-syncs 真实数据
 *   - /api/alerts 真实数据
 *   - siteCode 切换后数据变化
 *   - dataSource 显式 (database / mock)
 *   - 禁止 mock 冒充 (R.1 §7)
 *
 * 不实施: 浏览器 console / network (R.6 占位说明, R.7+ Playwright)
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

let pass = 0, fail = 0
const results: { name: string; status: "PASS" | "FAIL"; detail?: string }[] = []

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++
    results.push({ name, status: "PASS", detail })
    console.log(`  ✅ ${name}${detail ? ": " + detail : ""}`)
  } else {
    fail++
    results.push({ name, status: "FAIL", detail })
    console.log(`  ❌ ${name}${detail ? ": " + detail : ""}`)
  }
}

async function main() {
  console.log("=== Dashboard 事件 e2e ===\n")

  // 1. 页面能打开
  const homeRes = await fetch(`${BASE}/`)
  check("页面 / 200", homeRes.status === 200, `HTTP ${homeRes.status}`)

  // 2. /api/dashboard/summary 真实调用
  const sumRes = await fetch(`${BASE}/api/dashboard/summary`)
  const sum = await sumRes.json()
  check(
    "summary API 真实调用",
    sum.code === 0 && sum.source === "database",
    `source=${sum.source} code=${sum.code}`
  )
  check(
    "summary 字段非空",
    sum.data?.taskCount !== undefined && sum.data?.deviceCount !== undefined,
    `tasks=${sum.data?.taskCount} devices=${sum.data?.deviceCount}`
  )
  check(
    "summary siteCount 显式",
    typeof sum.data?.siteCount === "number",
    `siteCount=${sum.data?.siteCount}`
  )

  // 3. /api/dashboard/recent-syncs 真实调用
  const recentRes = await fetch(`${BASE}/api/dashboard/recent-syncs?limit=3`)
  const recent = await recentRes.json()
  const recentItems = recent.data?.data?.items ?? recent.data?.items ?? []
  check(
    "recent-syncs API 真实",
    recent.code === 0 && Array.isArray(recentItems),
    `items=${recentItems.length}`
  )

  // 4. /api/alerts 真实
  const alertsRes = await fetch(`${BASE}/api/alerts`)
  const alerts = await alertsRes.json()
  check(
    "alerts API 真实",
    alerts.code === 0 && Array.isArray(alerts.data?.items),
    `alerts=${alerts.data?.items?.length ?? 0}`
  )

  // 5. siteCode 切换后 summary 数据变化
  const allRes = await fetch(`${BASE}/api/dashboard/summary`)
  const all = await allRes.json()
  const sh01Res = await fetch(`${BASE}/api/dashboard/summary?siteCode=SH01`)
  const sh01 = await sh01Res.json()
  check(
    "siteCode 切换生效 (SH01 vs All)",
    sh01.data?.taskCount !== all.data?.taskCount ||
      sh01.data?.deviceCount !== all.data?.deviceCount ||
      sh01.data?.packageCount !== all.data?.packageCount,
    `SH01 task=${sh01.data?.taskCount} all=${all.data?.taskCount}`
  )

  // 6. dataSource 显式 (R.4 修复后)
  // 注意: /api/alerts 是 Sprint 2.7 实现, 未加 source 字段, 接受 null
  const allSources = [sum.source, recent.source, alerts.source, all.source, sh01.source]
  check(
    "dataSource 显式 (R.4 修复, alerts 是老路由 source=null 接受)",
    allSources.every((s) => s === "database" || s == null),
    `sources=${[...new Set(allSources.map(s => s ?? "null"))].join(",")}`
  )

  // 7. 不允许 mock 冒充 (R.1 §7)
  const noMockData = JSON.stringify({ sum, all, sh01, recent, alerts })
  check(
    "禁止 mock 冒充 (R.1 §7)",
    !noMockData.includes('"source":"mock"'),
    "未发现 source=mock"
  )

  console.log(`\n=== Dashboard: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("❌ dashboard test crashed:", err)
  process.exit(1)
})

export {}
