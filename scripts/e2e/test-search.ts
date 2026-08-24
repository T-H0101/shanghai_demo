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
  check(
    "结果表含盘笼列与详情按钮；存储卷不在列表展示",
    searchPage.includes(">盘笼<") &&
      searchPage.includes("search-row-detail") &&
      searchPage.includes("search-detail-dialog") &&
      !searchPage.includes(">存储卷</TableHead>") &&
      !searchPage.includes(">设备</TableHead>"),
    "列表精简列 + 详情弹窗"
  )
  check(
    "仅文件检索：类型列与类型筛选已注释",
    searchPage.includes("类型列暂隐藏") &&
      searchPage.includes("类型筛选暂隐藏"),
    "UI 不再筛目录"
  )

  const esClient = await readFile("lib/search/es-client.ts", "utf8")
  check(
    "OpenSearch 仅排除目录文档，路径关键字仍可命中文件",
    esClient.includes('{ term: { doc_type: "file" } }') &&
      esClient.includes('wildcardContains("folder_path.keyword", keyword)'),
    "doc_type=file + folder_path 关键字"
  )
  check(
    "发起回迁调用 /api/search/restore 且文案为记录已提交",
    searchPage.includes("/api/search/restore") &&
      searchPage.includes("回迁记录已提交") &&
      searchPage.includes("fileSize") &&
      !searchPage.includes("回迁成功") &&
      !searchPage.includes("已回迁"),
    "物理位置登记口径（含可选 size）"
  )

  const restorePhysical = await readFile("lib/search/restore-physical.ts", "utf8")
  check(
    "根目录 / 组路径时不被剥成空串",
    restorePhysical.includes("stripTrailingSlashesPreserveRoot") &&
      restorePhysical.includes('if (raw === "/") return "/"'),
    "OS 真有 / 时拼成 /文件名；空路径不臆造"
  )

  // 8. 回迁 API：缺字段应 400（需登录时可能 401，均不可伪装成功）
  const restoreRes = await fetch(`${BASE}/api/search/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetSiteCode: "SH01" }),
  })
  const restoreBody = await restoreRes.json().catch(() => ({}))
  check(
    "POST /api/search/restore 缺物理位置时不返回成功",
    restoreRes.status !== 200 || restoreBody?.code !== 0,
    `HTTP ${restoreRes.status} code=${restoreBody?.code}`
  )
  check(
    "回迁响应不宣称执行完成",
    !JSON.stringify(restoreBody).includes("回迁成功") &&
      !JSON.stringify(restoreBody).includes("已回迁"),
    "文案合规"
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
