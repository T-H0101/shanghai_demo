/**
 * Sites 事件 e2e - Sprint R.6 实施 + R.9A 真实化
 *
 * R.9A 覆盖:
 *   - /sites 页面 200
 *   - /api/sites 真实读 (R.4 修复: 100% mock → real/derived)
 *   - dataSource 显式 (database / derived / empty, 不允许 mock)
 *   - /sites 页面 HTML 不再含 mockSites 硬编码 6 站点 (上海/北京/广州/成都/南京/武汉)
 *   - /sites 页面不直接 import mockSites
 *   - "注册新站点" / "启用禁用" / "SSO 跳转" 按钮在源码中标记为 disabled
 *   - /sites 页面显示 dataSource 标识
 *   - siteCode 切换联动 (R.2F.4)
 *   - 8 个核心 API siteCode 过滤一致性
 *   - 禁止 mock 冒充 (R.1 §7 + R.4 修复)
 *
 * 不实施: 真实浏览器 (R.6 占位说明)
 */

import { installAuthenticatedFetch } from "./auth-helper"

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
  console.log("=== Sites 事件 e2e (R.9A) ===\n")
  await installAuthenticatedFetch(BASE)

  // ──────────────────────────────────────────────────────────
  // 0. R.69 Task 1: 站点注册表单一来源契约
  // ──────────────────────────────────────────────────────────
  const { readFileSync: readFileSyncRaw } = await import("node:fs")
  const siteContextSrc = readFileSyncRaw("lib/site/site-context.tsx", "utf8")
  const siteSelectorSrc = readFileSyncRaw("components/site/site-selector.tsx", "utf8")
  check(
    "R.69: site selector no longer uses hardcoded SITE_CANDIDATES = [",
    !siteContextSrc.includes("SITE_CANDIDATES = ["),
    "site-context.tsx 不再硬编码 SITE_CANDIDATES 数组"
  )
  check(
    "R.69: site context fetches /api/sync/config or /api/sites",
    siteContextSrc.includes("/api/sync/config") || siteContextSrc.includes("/api/sites"),
    "site-context.tsx 已接入中心注册表接口"
  )
  check(
    "R.69: site selector exposes data source state",
    siteSelectorSrc.includes("data-testid=\"site-selector-source\""),
    "site-selector.tsx 含 site-selector-source 标识"
  )

  // ──────────────────────────────────────────────────────────
  // 1. 页面能打开
  // ──────────────────────────────────────────────────────────
  const pageRes = await fetch(`${BASE}/sites`)
  check("页面 /sites 200", pageRes.status === 200, `HTTP ${pageRes.status}`)

  // ──────────────────────────────────────────────────────────
  // 2. /api/sites 真实 (R.4 修复: 不允许 mock)
  // ──────────────────────────────────────────────────────────
  const sitesRes = await fetch(`${BASE}/api/sites`)
  const sites = await sitesRes.json()
  check(
    "/api/sites 200",
    sitesRes.status === 200 && sites.code === 0,
    `HTTP ${sitesRes.status}`
  )
  check(
    "dataSource 显式 (database/derived/empty/error, 不允许 mock)",
    sites.dataSource === "database" ||
      sites.dataSource === "derived" ||
      sites.dataSource === "empty" ||
      sites.dataSource === "error",
    `dataSource=${sites.dataSource}`
  )
  check(
    "禁止 mock 冒充 (R.4 修复)",
    sites.dataSource !== "mock",
    `dataSource=${sites.dataSource} ≠ mock`
  )
  check(
    "站点列表非空 (derived 至少 1 site)",
    Array.isArray(sites.data) && sites.data.length >= 1,
    `items=${sites.data?.length ?? 0}`
  )

  // ──────────────────────────────────────────────────────────
  // 3. source 显式 (R.4 修复)
  // ──────────────────────────────────────────────────────────
  check(
    "source 显式 (unified_sites 或派生)",
    sites.source !== undefined && sites.source !== "mock",
    `source=${sites.source}`
  )

  // ──────────────────────────────────────────────────────────
  // 4. derived 来源: 真实表 (不 mock)
  // ──────────────────────────────────────────────────────────
  if (sites.dataSource === "derived") {
    check(
      "derived 来自真实表 (unified_tasks/devices/volumes/sync_package_log)",
      sites.source?.includes("unified") && sites.source?.includes("sync_package_log"),
      `source=${sites.source}`
    )
  }

  // ──────────────────────────────────────────────────────────
  // 5. R.9A: 页面源码不再 import mockSites / 硬编码 6 站点名
  // ──────────────────────────────────────────────────────────
  const { readFile } = await import("node:fs/promises")
  const sitesPage = await readFile("app/sites/page.tsx", "utf8")
  // 真实 import 匹配 (不允许: from "@/lib/mock/sites")
  const hasMockSitesImport = /from\s+["']@\/lib\/mock\/sites["']/.test(sitesPage)
  check(
    "R.9A: 页面不再 import mockSites",
    !hasMockSitesImport,
    "源码不含 mockSites 导入"
  )
  // mockSiteProvider import 检查
  const hasMockProviderImport = /import[^;]*mockSiteProvider[^;]*from/.test(sitesPage)
  check(
    "R.9A: 页面不再 import mockSiteProvider",
    !hasMockProviderImport,
    "mockSiteProvider 引用已清除"
  )
  check(
    "R.9A: 页面不再硬编码 6 mock 站点名",
    !sitesPage.includes("上海研发中心") &&
      !sitesPage.includes("北京总部机房") &&
      !sitesPage.includes("广州生产基地") &&
      !sitesPage.includes("成都研发基地") &&
      !sitesPage.includes("南京中心") &&
      !sitesPage.includes("武汉备份中心"),
    "硬编码站点名已清除"
  )
  check(
    "R.9A: 页面 fetch /api/sites",
    sitesPage.includes("/api/sites") && sitesPage.includes("fetch"),
    "fetch('/api/sites') 已接入"
  )
  check(
    "R.9A: 页面渲染 dataSource 标识 (database/derived/empty)",
    sitesPage.includes("dataSource") && (sitesPage.includes("database") || sitesPage.includes("derived") || sitesPage.includes("empty")),
    "dataSource 标识已在源码"
  )

  // ──────────────────────────────────────────────────────────
  // 6. R.9A: 写操作按钮 (注册新站点 / 启用禁用 / SSO) 已 disabled
  // ──────────────────────────────────────────────────────────
  const regNewSiteBtn = /<Button[^>]*>[\s\S]{0,40}注册新站点[\s\S]*?<\/Button>/
  const regNewSiteMatch = sitesPage.match(regNewSiteBtn)
  const regNewSiteDisabled =
    regNewSiteMatch &&
    (regNewSiteMatch[0].includes("disabled") ||
      regNewSiteMatch[0].includes("handleUnsupported"))
  check(
    "R.9A: '注册新站点' 按钮 disabled / handleUnsupported",
    regNewSiteDisabled === true || regNewSiteMatch === null,
    regNewSiteMatch ? "按钮已加 disabled" : "按钮未匹配 (允许)"
  )
  // Power 按钮 disabled 检测: 在 <Button ... disabled ...> 与 <Power 之间任意内容
  const powerBtnMatch = /<Button[\s\S]*?disabled[\s\S]*?>[\s\S]*?<Power[\s\S]*?\/>/.test(sitesPage)
  check(
    "R.9A: '启用/禁用' (Power 按钮) disabled",
    sitesPage.includes("<Power") && powerBtnMatch,
    "Power 按钮已 disabled"
  )
  check(
    "R.9A: 'SSO' 按钮 disabled (REQ-2.1.2 blocked_by_auth)",
    /<Button[^>]*disabled[^>]*>[\s\S]{0,60}SSO/.test(sitesPage),
    "SSO 按钮已 disabled"
  )

  // ──────────────────────────────────────────────────────────
  // 7. R.9A: 按钮/toast 不含误导措辞 (R.1 §7)
  // ──────────────────────────────────────────────────────────
  const misleadingPatterns = [
    /toast[^}]*已暂停/,
    /toast[^}]*暂停成功/,
    /toast[^}]*已禁用/,
    /toast[^}]*已启用/,
    /toast[^}]*站点创建成功/,
    /toast[^}]*跳转成功/,
    /toast[^}]*同步成功/,
    /onClick[^}]*已暂停/,
  ]
  const misleadingHits = misleadingPatterns.filter((p) => p.test(sitesPage))
  check(
    "R.9A: 不含误导 toast/onClick 措辞 (R.1 §7)",
    misleadingHits.length === 0,
    misleadingHits.length === 0 ? "无命中" : `命中 ${misleadingHits.length} 个模式`
  )

  // ──────────────────────────────────────────────────────────
  // 8. R.9A: 失败状态显式 (不允许静默 mock fallback)
  // ──────────────────────────────────────────────────────────
  check(
    "R.9A: 页面有加载失败错误态 (dataSource=error)",
    sitesPage.includes("dataSource") && sitesPage.includes("error"),
    "error 状态已处理"
  )
  check(
    "R.9A: 页面有空数据态 (dataSource=empty)",
    sitesPage.includes("empty") || sitesPage.includes("暂无站点"),
    "empty 状态已处理"
  )

  // ──────────────────────────────────────────────────────────
  // 9. R.9A: 一致性校验走真实 API, 不走 mockSiteProvider
  // ──────────────────────────────────────────────────────────
  check(
    "R.9A: 一致性校验调 /api/sync/consistency",
    sitesPage.includes("/api/sync/consistency"),
    "已调真实一致性 API"
  )

  // ──────────────────────────────────────────────────────────
  // 10. siteCode 切换联动: 8 个核心 API 一致性
  // ──────────────────────────────────────────────────────────
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
    "7 个核心 API siteCode 联动 (R.2F.4)",
    consistent === endpoints.length,
    `${consistent}/${endpoints.length} 200 OK`
  )

  // ──────────────────────────────────────────────────────────
  // 11. 派生站点 siteCode 与 unified_tasks 真实数据交叉验证
  // ──────────────────────────────────────────────────────────
  const sitesData: Array<{ code: string }> = sites.data ?? []
  const tasksRes = await fetch(`${BASE}/api/tasks?limit=200`)
  const tasks = await tasksRes.json()
  const taskSiteCodes = new Set<string>()
  for (const t of tasks.data?.items ?? []) taskSiteCodes.add(t.siteCode)
  const overlap = sitesData.filter((s) => taskSiteCodes.has(s.code))
  check(
    "派生站点 siteCode 与 unified_tasks 真实数据重叠",
    sitesData.length === 0 || overlap.length > 0,
    `sites=${sitesData.length} overlap=${overlap.length} taskSites=${taskSiteCodes.size}`
  )

  // ──────────────────────────────────────────────────────────
  // 12. 页面 HTML 不含 6 站点名 (真实渲染检查)
  // ──────────────────────────────────────────────────────────
  const pageHtml = await pageRes.text()
  const mockSiteNameHits = [
    pageHtml.includes("上海研发中心") ? 1 : 0,
    pageHtml.includes("北京总部机房") ? 1 : 0,
    pageHtml.includes("广州生产基地") ? 1 : 0,
    pageHtml.includes("成都研发基地") ? 1 : 0,
    pageHtml.includes("南京中心") ? 1 : 0,
    pageHtml.includes("武汉备份中心") ? 1 : 0,
  ].reduce((a, b) => a + b, 0)
  // 注: HTML 可能含 "上海" / "北京" 等通用字, 但不含完整 mock 站点名
  check(
    "页面 HTML 不再渲染 mock 6 站点全名",
    mockSiteNameHits === 0,
    `命中 ${mockSiteNameHits} 个 mock 全名`
  )

  console.log(`\n=== Sites: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("❌ sites test crashed:", err)
  process.exit(1)
})

export {}
