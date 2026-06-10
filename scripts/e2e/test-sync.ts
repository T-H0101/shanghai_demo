/**
 * Sync 事件 e2e - Sprint R.6 实施
 *
 * 覆盖:
 *   - /sync 页面 200
 *   - /api/sync/packages 列表真实
 *   - /api/sync/logs 表日志真实
 *   - HMAC 鉴权 (无签名 401, R.2G.1)
 *   - siteCode 过滤
 *   - 失败包 (status=failed) 真实存在
 *   - DRY_RUN status=skipped 真实 (不真同步)
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
  console.log("=== Sync 事件 e2e ===\n")

  // 1. 页面能打开
  const pageRes = await fetch(`${BASE}/sync`)
  check("页面 /sync 200", pageRes.status === 200, `HTTP ${pageRes.status}`)

  // 2. packages 列表真实
  const pkgRes = await fetch(`${BASE}/api/sync/packages?limit=10`)
  const pkg = await pkgRes.json()
  const pkgItems = pkg.data?.items ?? []
  check(
    "packages 真实加载 (sync_package_log)",
    pkg.code === 0 && Array.isArray(pkgItems) && pkgItems.length > 0,
    `items=${pkgItems.length} total=${pkg.data?.total}`
  )
  check(
    "packages 状态分布 (success/failed)",
    pkgItems.some((p: { status: string }) => p.status === "success") ||
      pkgItems.some((p: { status: string }) => p.status === "failed"),
    `statuses=${[...new Set(pkgItems.map((p: { status: string }) => p.status))].join(",")}`
  )

  // 3. table log 真实
  const logRes = await fetch(`${BASE}/api/sync/logs?limit=10`)
  const log = await logRes.json()
  const logItems = log.data ?? []
  check(
    "table log 真实 (sync_table_log)",
    Array.isArray(logItems) && logItems.length > 0,
    `items=${logItems.length}`
  )
  check(
    "table log 含 skipped (DRY_RUN 标记)",
    logItems.some((l: { status: string }) => l.status === "skipped"),
    `skipped=${logItems.filter((l: { status: string }) => l.status === "skipped").length}`
  )

  // 4. HMAC 鉴权 (R.2G.1)
  const noAuthRes = await fetch(`${BASE}/api/sync/package`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  })
  check(
    "HMAC 鉴权 (无签名 401)",
    noAuthRes.status === 401,
    `HTTP ${noAuthRes.status}`
  )

  // 5. siteCode 过滤
  const allRes = await fetch(`${BASE}/api/sync/packages?limit=20`)
  const all = await allRes.json()
  const sh01Res = await fetch(`${BASE}/api/sync/packages?siteCode=SH01&limit=20`)
  const sh01 = await sh01Res.json()
  check(
    "siteCode=SH01 过滤生效",
    sh01.data?.items?.length !== all.data?.items?.length,
    `sh01=${sh01.data?.items?.length} all=${all.data?.items?.length}`
  )

  // 6. 失败包真实存在 (R.3 验证 11 failed in DB, API limit=20 hardcoded 锁住)
  // 通过 docker exec psql 直接查 (不绕 API)
  const { exec } = await import("node:child_process")
  const { promisify } = await import("node:util")
  const execAsync = promisify(exec)
  let failedCount = 0
  try {
    const { stdout } = await execAsync(
      `docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -t -c "SELECT count(*) FROM sync_package_log WHERE status='failed';" 2>&1`
    )
    failedCount = parseInt(stdout.trim().split("\n").pop() ?? "0", 10) || 0
  } catch {
    failedCount = 0
  }
  check(
    "失败包真实存在 (R.3 验证 11 failed in DB)",
    failedCount > 0,
    `failed=${failedCount} (DB 直查)`
  )

  // 7. 不允许 mock 冒充
  const noMock = JSON.stringify(pkg)
  check(
    "禁止 mock 冒充 (R.1 §7)",
    !noMock.includes('"source":"mock"') && !noMock.includes("mockData"),
    "未发现 mock"
  )

  console.log(`\n=== Sync: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("❌ sync test crashed:", err)
  process.exit(1)
})

export {}
