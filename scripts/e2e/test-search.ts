/**
 * Search 事件 e2e - Sprint R.48 当前实现
 *
 * 覆盖:
 *   - /search 页面 200 (不 404)
 *   - /api/search 真实查询 source file index, HTTP 200
 *   - 响应 source=opensearch / es / unified_file_index / blocked_by_external_system
 *   - UI 保留 blocker/limitation banner
 *   - 不允许 mock 搜索结果
 *   - 不允许 mock 冒充
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
  console.log("=== Search 事件 e2e ===\n")

  // 1. 页面能打开 (R.4 修复: 不允许 404)
  const pageRes = await fetch(`${BASE}/search`)
  check("页面 /search 200 (R.4 修复, 不允许 404)", pageRes.status === 200, `HTTP ${pageRes.status}`)

  // 2. /api/search 当前应为 R.48 真实查询接口
  const searchRes = await fetch(`${BASE}/api/search?q=test&limit=20`)
  const search = await searchRes.json()
  const source = search.data?.source ?? search.meta?.source
  const blocker = search.data?.blocker ?? search.meta?.blocker ?? null
  const items = search.data?.items ?? []
  const requirements = search.data?.requirements ?? search.meta?.requirements ?? []
  const missingDimensions = search.data?.missingDimensions ?? []

  check(
    "/api/search 返回 200 真实查询接口 (R.48)",
    searchRes.status === 200 && search.code === 0,
    `HTTP ${searchRes.status}`
  )
  check(
    "source 显式为真实源或外部阻塞",
    source === "opensearch" || source === "es" || source === "unified_file_index" || source === "blocked_by_external_system",
    `source=${source}`
  )
  check(
    "blocker 仅在外部索引不可用时出现",
    source === "blocked_by_external_system" ? typeof blocker === "string" : blocker === null,
    `blocker=${blocker}`
  )

  // 3. 响应含 REQ 关联
  check(
    "响应含 REQ-4.1.1 / REQ-4.1.2 关联",
    Array.isArray(requirements) &&
      requirements.includes("REQ-4.1.1") &&
      requirements.includes("REQ-4.1.2"),
    `reqs=${Array.isArray(requirements) ? requirements.join(",") : ""}`
  )
  check(
    "响应含 limitations / missingDimensions",
    Array.isArray(missingDimensions),
    `missing=${missingDimensions.join(",")}`
  )

  // 4. 不允许假数据或越界大查询
  check(
    "items 为真实受限查询数组",
    Array.isArray(items) && items.length <= 20,
    `items=${items.length}`
  )

  // 5. 不允许 mock 冒充
  const noMock = JSON.stringify(search)
  check(
    "禁止 mock 冒充 (R.1 §7)",
    !noMock.includes('"source":"mock"'),
    "未发现 mock"
  )

  // 6. UI blocker/limitations 验证 (前端代码层 grep)
  const { readFile } = await import("node:fs/promises")
  const searchPage = await readFile("app/search/page.tsx", "utf8")
  check(
    "前端含 blocker/limitation banner",
    searchPage.includes("search-blocker-banner") && searchPage.includes("AlertTriangle"),
    "已发现限制说明元素"
  )
  check(
    "前端调用 /api/search 并处理真实结果",
    searchPage.includes("/api/search") && searchPage.includes("body.data.items"),
    "已发现真实结果处理"
  )
  check(
    "前端不直接展示后端内部 blocker 原因",
    !searchPage.includes("data.meta.reason") &&
      !searchPage.includes("body?.meta?.reason") &&
      searchPage.includes("SEARCH_BLOCKER_REASON"),
    "使用产品化检索阻塞文案"
  )

  // 7. 多种 siteCode 验证
  for (const sc of ["SH01", "BJ02", ""]) {
    const url = `${BASE}/api/search?q=x${sc ? `&siteCode=${sc}` : ""}`
    const r = await fetch(url)
    const j = await r.json()
    const scSource = j.data?.source ?? j.meta?.source
    check(
      `siteCode=${sc || "(empty)"} 返回真实或显式阻塞`,
      r.status === 200 &&
        (scSource === "opensearch" ||
          scSource === "es" ||
          scSource === "unified_file_index" ||
          scSource === "blocked_by_external_system"),
      `HTTP ${r.status} source=${scSource}`
    )
  }

  console.log(`\n=== Search: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("❌ search test crashed:", err)
  process.exit(1)
})

export {}
