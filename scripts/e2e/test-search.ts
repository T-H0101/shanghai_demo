/**
 * Search 事件 e2e - Sprint R.6 实施
 *
 * 覆盖:
 *   - /search 页面 200 (不 404)
 *   - /api/search 显式 501 not_implemented (R.4 修复: 禁止 404)
 *   - 响应 source=not_implemented + blocker=blocked_by_external_system
 *   - UI 显示 blocker banner (R.4 amber banner 验证)
 *   - 不允许假搜索结果 (R.1 §7)
 *   - 不允许 mock 冒充
 *
 * 不实施: 真实浏览器 (R.6 占位说明, UI banner 验证靠 grep)
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

  // 2. /api/search 显式 501 not_implemented (R.4 修复)
  const searchRes = await fetch(`${BASE}/api/search?q=test`)
  const search = await searchRes.json()
  check(
    "/api/search 显式 501 not_implemented (R.4 修复)",
    searchRes.status === 501,
    `HTTP ${searchRes.status}`
  )
  check(
    "source=not_implemented 显式 (R.4)",
    search.source === "not_implemented",
    `source=${search.source}`
  )
  check(
    "blocker=blocked_by_external_system 显式",
    search.blocker === "blocked_by_external_system",
    `blocker=${search.blocker}`
  )

  // 3. 响应含 REQ 关联
  check(
    "响应含 REQ 关联 (R.1 §1 强约束)",
    search.meta?.requirement?.id === "REQ-4.1.1",
    `reqId=${search.meta?.requirement?.id}`
  )
  check(
    "响应含当前数据 (4 行任务级, 真实)",
    typeof search.meta?.currentReality?.taskLevelFileIndex === "number",
    `rows=${search.meta?.currentReality?.taskLevelFileIndex}`
  )

  // 4. 不允许 items 假数据
  check(
    "items=[] 不允许假结果 (R.4 fail-closed)",
    Array.isArray(search.data?.items) && search.data?.items?.length === 0,
    `items=${search.data?.items?.length ?? 0}`
  )

  // 5. 不允许 mock 冒充
  const noMock = JSON.stringify(search)
  check(
    "禁止 mock 冒充 (R.1 §7)",
    !noMock.includes('"source":"mock"'),
    "未发现 mock"
  )

  // 6. UI blocker banner 验证 (前端代码层 grep)
  const { readFile } = await import("node:fs/promises")
  const searchPage = await readFile("app/search/page.tsx", "utf8")
  check(
    "前端含 blocker banner (R.4 amber banner)",
    searchPage.includes("search-blocker-banner") && searchPage.includes("AlertTriangle"),
    "已发现 amber banner 元素"
  )
  check(
    "前端含 useEffect 调 /api/search (R.4)",
    searchPage.includes("/api/search") && searchPage.includes("useEffect"),
    "已发现自动检测"
  )

  // 7. 多种 siteCode 验证
  for (const sc of ["SH01", "BJ02", ""]) {
    const url = `${BASE}/api/search?q=x${sc ? `&siteCode=${sc}` : ""}`
    const r = await fetch(url)
    const j = await r.json()
    check(
      `siteCode=${sc || "(empty)"} 显式 501`,
      r.status === 501 && j.source === "not_implemented",
      `HTTP ${r.status}`
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
