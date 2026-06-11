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

  // ===== Sprint R.7: 一致性校验 5 项验证 =====
  // 8. 调一致性 API: 用不存在的 siteCode 测 not_run
  const notRunRes = await fetch(`${BASE}/api/sync/consistency?siteCode=DOES_NOT_EXIST_R7`)
  const notRun = await notRunRes.json()
  check(
    "R.7 /api/sync/consistency 返回 not_run 路径",
    notRunRes.status === 200 && notRun.status === "not_run",
    `HTTP ${notRunRes.status} status=${notRun.status}`
  )
  check(
    "R.7 not_run 含 recommendation 字段 (R.1 §1 强约束)",
    typeof notRun.recommendation === "string" && notRun.recommendation.includes("check:sync-consistency"),
    `recommendation=${notRun.recommendation?.slice(0, 50)}...`
  )

  // 9. /sync 页面 200 + 前端代码含一致性卡逻辑 (R.7 用 grep 验证 client component 代码)
  const syncPageRes = await fetch(`${BASE}/sync`)
  check(
    "R.7 /sync 页面 200 (HTTP 验证, client render 需浏览器)",
    syncPageRes.status === 200,
    `HTTP ${syncPageRes.status}`
  )
  // 读源文件验证前端代码含一致性卡 (client component, curl HTML 不含)
  const { readFile } = await import("node:fs/promises")
  const syncPageSrc = await readFile("app/sync/page.tsx", "utf8")
  check(
    "R.7 前端 /sync 代码含 consistency-card 元素",
    syncPageSrc.includes("consistency-card") && syncPageSrc.includes("数据一致性校验"),
    "前端代码含 consistency-card + 标题"
  )
  check(
    "R.7 前端 /sync 代码 fetch /api/sync/consistency",
    syncPageSrc.includes("/api/sync/consistency"),
    "前端代码含 API 调用"
  )

  // 10. 一致性 API 用真实 SH01 查 (之前 check-sync-consistency 跑过, 应有 log)
  const consistencySh01Res = await fetch(`${BASE}/api/sync/consistency?siteCode=SH01`)
  const consistencySh01 = await consistencySh01Res.json()
  check(
    "R.7 /api/sync/consistency SH01 返回真实数据 (非 not_run)",
    consistencySh01Res.status === 200 && consistencySh01.status !== "not_run" && typeof consistencySh01.tableCount === "number",
    `status=${consistencySh01.status} tableCount=${consistencySh01.tableCount}`
  )
  check(
    "R.7 SH01 结果含 matched/mismatched 计数",
    typeof consistencySh01.matchedTableCount === "number" && typeof consistencySh01.mismatchedTableCount === "number",
    `matched=${consistencySh01.matchedTableCount} mismatched=${consistencySh01.mismatchedTableCount}`
  )
  check(
    "R.7 dataSource 显式 (database/empty, 不允许 mock)",
    consistencySh01.dataSource?.includes("sync_consistency_log") || consistencySh01.dataSource?.includes("empty"),
    `dataSource=${consistencySh01.dataSource}`
  )

  // ===== Sprint R.10A: 多站点安全配置 =====
  const configRes = await fetch(`${BASE}/api/sync/config`)
  const config = await configRes.json()
  const configText = JSON.stringify(config)
  check(
    "R.10A /api/sync/config 返回中心库配置",
    configRes.status === 200 && config.code === 0 && config.source === "sync_sites",
    `HTTP=${configRes.status} source=${config.source}`
  )
  check(
    "R.10A 多站点配置包含安全字段",
    Array.isArray(config.data?.sites) &&
      config.data.sites.length > 0 &&
      config.data.sites.every((site: { siteCode?: string; intervalSeconds?: number }) =>
        typeof site.siteCode === "string" && typeof site.intervalSeconds === "number"
      ),
    `sites=${config.data?.sites?.length ?? 0}`
  )
  check(
    "R.10A 配置 API 不泄露连接值或 secret",
    !configText.includes("dbHost") &&
      !configText.includes("dbUser") &&
      !configText.includes("databaseUrl") &&
      !configText.includes("password") &&
      !configText.includes("secretValue"),
    "仅允许 credentialKeyRef / env key ref"
  )
  check(
    "R.10A /sync 页面展示多站点同步配置",
    syncPageSrc.includes("/api/sync/config") &&
      syncPageSrc.includes("多站点同步配置") &&
      syncPageSrc.includes("credentialKeyRef"),
    "前端需展示安全配置来源"
  )

  console.log(`\n=== Sync: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("❌ sync test crashed:", err)
  process.exit(1)
})

export {}
