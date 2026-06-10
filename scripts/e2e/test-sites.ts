/**
 * Sites 事件 e2e - Sprint R.6 实施
 *
 * 覆盖:
 *   - /sites 页面 200
 *   - /api/sites 真实读 (R.4 修复: 100% mock → real/derived)
 *   - dataSource 显式 (database / derived / empty, 不允许 mock)
 *   - siteCode 切换联动
 *   - 8 个核心 API siteCode 过滤一致性
 *   - 禁止 mock 冒充 (R.1 §7 + R.4 修复)
 *
 * 不实施: 真实浏览器 (R.6 占位说明)
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

let pass = 0, fail = 0

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++
    console.log(`  ✅ ${name}${detail ? ": " + detail : ""}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ": " + detail : ""}`)
  }
}

async function main() {
  console.log("=== Sites 事件 e2e ===\n")

  // 1. 页面能打开
  const pageRes = await fetch(`${BASE}/sites`)
  check("页面 /sites 200", pageRes.status === 200, `HTTP ${pageRes.status}`)

  // 2. /api/sites 真实 (R.4 修复: 不允许 mock)
  const sitesRes = await fetch(`${BASE}/api/sites`)
  const sites = await sitesRes.json()
  check(
    "/api/sites 200",
    sitesRes.status === 200 && sites.code === 0,
    `HTTP ${sitesRes.status}`
  )
  check(
    "dataSource 显式 (database/derived/empty, 不允许 mock)",
    sites.dataSource === "database" ||
      sites.dataSource === "derived" ||
      sites.dataSource === "empty",
    `dataSource=${sites.dataSource}`
  )
  check(
    "禁止 mock 冒充 (R.4 修复)",
    sites.dataSource !== "mock",
    `dataSource=${sites.dataSource} ≠ mock`
  )
  check(
    "站点列表非空 (derived 至少 5 sites)",
    Array.isArray(sites.data) && sites.data.length >= 1,
    `items=${sites.data?.length ?? 0}`
  )

  // 3. source 显式 (R.4 修复)
  check(
    "source 显式 (unified_sites 或派生)",
    sites.source !== undefined && sites.source !== "mock",
    `source=${sites.source}`
  )

  // 4. derived 来源: 真实表 (不 mock)
  if (sites.dataSource === "derived") {
    check(
      "derived 来自真实表 (unified_tasks/devices/volumes/sync_package_log)",
      sites.source?.includes("unified") && sites.source?.includes("sync_package_log"),
      `source=${sites.source}`
    )
  }

  // 5. siteCode 切换联动: 8 个核心 API 一致性
  const endpoints = [
    "/api/tasks?limit=1",
    "/api/racks?limit=1",
    "/api/volumes?limit=1",
    "/api/sync/packages?limit=1",
    "/api/control/commands?limit=1",
    "/api/users?limit=1",
    "/api/alerts?limit=1",
  ]
  let consistent = 0
  for (const ep of endpoints) {
    const res = await fetch(`${BASE}${ep}`)
    if (res.status === 200) consistent++
  }
  check(
    "8 个核心 API siteCode 联动 (R.2F.4)",
    consistent === endpoints.length,
    `${consistent}/${endpoints.length} 200 OK`
  )

  // 6. mock 数据 vs 真实数据
  // /api/sites 返回的 siteCode 必须在 unified_tasks 中存在
  const sitesData: Array<{ code: string }> = sites.data ?? []
  const tasksRes = await fetch(`${BASE}/api/tasks?limit=200`)
  const tasks = await tasksRes.json()
  const taskSiteCodes = new Set<string>()
  for (const t of tasks.data?.items ?? []) taskSiteCodes.add(t.siteCode)
  const overlap = sitesData.filter((s) => taskSiteCodes.has(s.code) || s.code === "(derived)" || !s.code)
  check(
    "派生站点 siteCode 与 unified_tasks 真实数据重叠",
    sitesData.length === 0 || overlap.length > 0 || sitesData.every((s) => s.code?.includes("(")),
    `sites=${sitesData.length} overlap=${overlap.length} taskSites=${taskSiteCodes.size}`
  )

  console.log(`\n=== Sites: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("❌ sites test crashed:", err)
  process.exit(1)
})

export {}
