/**
 * 全局区域筛选 e2e — Sprint R.107
 *
 * 协议: ?regionCode= 独立参数；siteCode 仍为单值
 * 空区域 → listed:[] → 列表空数据
 * 检索/日志页 UI 本轮不合并顶部区域（API 已支持 regionCode）
 */

import { readFile } from "node:fs/promises"
import { installAuthenticatedFetch } from "./auth-helper"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

let pass = 0
let fail = 0

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
  console.log("=== 全局区域筛选 e2e (R.107) ===\n")
  await installAuthenticatedFetch(BASE)

  const [
    ctxSrc,
    selectorSrc,
    scopeSrc,
    tasksApiSrc,
    searchPageSrc,
    logsPageSrc,
  ] = await Promise.all([
    readFile("lib/site/site-context.tsx", "utf8"),
    readFile("components/site/site-selector.tsx", "utf8"),
    readFile("lib/auth/site-scope.ts", "utf8"),
    readFile("app/api/tasks/route.ts", "utf8"),
    readFile("app/(platform)/search/page.tsx", "utf8"),
    readFile("app/(platform)/logs/page.tsx", "utf8"),
  ])

  check(
    "SiteContext 暴露 regionCode / setRegionCode / isRegionScope",
    ctxSrc.includes("regionCode") &&
      ctxSrc.includes("setRegionCode") &&
      ctxSrc.includes("isRegionScope") &&
      ctxSrc.includes("unified.selectedRegionCode"),
  )
  check(
    "SiteSelector 树形标记 + 隐藏权限内无站区域",
    selectorSrc.includes("·区域") &&
      selectorSrc.includes("·站点") &&
      selectorSrc.includes("setRegionCode") &&
      selectorSrc.includes("site-selector-panel") &&
      selectorSrc.includes("r.sites.length > 0"),
  )
  check(
    "resolveRequestScope 存在且空区域 listed:[]",
    scopeSrc.includes("resolveRequestScope") &&
      scopeSrc.includes("listed") &&
      scopeSrc.includes("region_code"),
  )
  check(
    "tasks API 接入 resolveRequestScope",
    tasksApiSrc.includes("resolveRequestScope") && tasksApiSrc.includes("regionCode"),
  )
  check(
    "检索页保持页内 regionFilter（本轮不合并顶部）",
    searchPageSrc.includes("regionFilter") && searchPageSrc.includes("search-region-filter"),
  )
  check(
    "日志页不使用 useSite（本轮不合并顶部）",
    !logsPageSrc.includes("useSite("),
  )

  const regionsRes = await fetch(`${BASE}/api/sites/regions`)
  const regionsJson = await regionsRes.json().catch(() => ({}))
  check("GET /api/sites/regions 可用", regionsRes.ok && regionsJson.code === 0, `HTTP ${regionsRes.status}`)

  const regions = (regionsJson?.data?.regions ?? []) as Array<{
    code: string
    status?: string
    sites?: unknown[]
  }>
  const active = regions.find((r) => r.status !== "inactive")
  if (active?.code) {
    const tasksRes = await fetch(
      `${BASE}/api/tasks?regionCode=${encodeURIComponent(active.code)}&pageSize=5`,
    )
    const tasksJson = await tasksRes.json().catch(() => ({}))
    check(
      "GET /api/tasks?regionCode= 返回成功",
      tasksRes.ok && tasksJson.code === 0,
      `HTTP ${tasksRes.status} code=${tasksJson.code}`,
    )

    const summaryRes = await fetch(
      `${BASE}/api/dashboard/summary?regionCode=${encodeURIComponent(active.code)}`,
    )
    const summaryJson = await summaryRes.json().catch(() => ({}))
    check(
      "GET /api/dashboard/summary?regionCode= 返回成功",
      summaryRes.ok && summaryJson.code === 0,
      `HTTP ${summaryRes.status}`,
    )
  } else {
    check("存在可测 active 区域（跳过 API 实调）", false, "无 active 区域，请先维护 site_regions")
  }

  // 空区域：用不存在的编码 → listed 空 → tasks total 0
  const emptyRes = await fetch(`${BASE}/api/tasks?regionCode=__NO_SUCH_REGION__&pageSize=5`)
  const emptyJson = await emptyRes.json().catch(() => ({}))
  const emptyTotal = Number(emptyJson?.data?.total ?? -1)
  check(
    "空区域 tasks 返回空列表",
    emptyRes.ok && emptyJson.code === 0 && emptyTotal === 0,
    `total=${emptyTotal}`,
  )

  const homeRes = await fetch(`${BASE}/`)
  check("控制台页 200", homeRes.status === 200, `HTTP ${homeRes.status}`)

  console.log(`\n=== 结果: ${pass} pass / ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
