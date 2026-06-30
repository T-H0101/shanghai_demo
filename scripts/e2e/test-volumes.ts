/**
 * R.92 — Volumes view e2e (refactored from R.17)
 *
 * R.91.1 merged /volumes standalone page into /racks?view=volumes.
 * R.92 rewrites this test to validate the merged view:
 *   - /racks?view=volumes page 200
 *   - /volumes redirect → /racks?view=volumes
 *   - /api/volumes + /api/volumes/[id] real backend (unchanged)
 *   - sourceEvidence field (R.5 §10)
 *   - siteCode filter
 *   - volumes-view component source: no fake success toast
 */

import { readFile } from "node:fs/promises"
import { installAuthenticatedFetch } from "./auth-helper"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; console.log(`  ✅ ${name}${detail ? ": " + detail : ""}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ": " + detail : ""}`) }
}

async function main() {
  console.log("=== Volumes view e2e (R.92) ===\n")
  await installAuthenticatedFetch(BASE)

  // 1. /racks?view=volumes 200 (merged page)
  const pageRes = await fetch(`${BASE}/racks?view=volumes`)
  check(
    "[1] 页面 /racks?view=volumes 200",
    pageRes.status === 200,
    `HTTP ${pageRes.status}`
  )

  // 2. /volumes 旧路由 redirect → /racks?view=volumes
  // R.92.1: Next.js dev mode 下 redirect() 用 streaming + meta refresh 而非 3xx
  // 接受任一: 3xx location 头, 或 200 + meta refresh 指向目标
  const redirectRes = await fetch(`${BASE}/volumes`, { redirect: "manual" })
  const redirectText = redirectRes.status === 200 ? await redirectRes.text() : ""
  const has3xx = redirectRes.status >= 300 && redirectRes.status < 400 &&
    (redirectRes.headers.get("location") ?? "").includes("/racks?view=volumes")
  const hasMetaRefresh = redirectText.includes('http-equiv="refresh"') && redirectText.includes("/racks?view=volumes")
  const hasNextRedirect = redirectText.includes("NEXT_REDIRECT") && redirectText.includes("/racks?view=volumes")
  check(
    "[2] /volumes 重定向到 /racks?view=volumes",
    has3xx || hasMetaRefresh || hasNextRedirect,
    `HTTP ${redirectRes.status} 3xx=${has3xx} metaRefresh=${hasMetaRefresh} nextRedirect=${hasNextRedirect}`
  )

  // 3. /api/volumes 真实读取
  const volRes = await fetch(`${BASE}/api/volumes`)
  const volJson = await volRes.json()
  check(
    "[3] /api/volumes 真实读取 (source=database)",
    volRes.status === 200 && volJson.source === "database" && Array.isArray(volJson.data),
    `source=${volJson.source} items=${volJson.data?.length ?? 0}`
  )
  check(
    "[4] 卷记录非空 (unified_volumes 真有数据)",
    volJson.data?.length > 0,
    `items=${volJson.data?.length ?? 0}`
  )

  // 4. 容量字段非空 (不伪造)
  const volumesWithCapacity = volJson.data?.filter((v: any) => v.totalCapacity && v.totalCapacity !== "0 B") ?? []
  check(
    "[5] 至少 1 个卷有真实 totalCapacity (不伪造)",
    volumesWithCapacity.length > 0,
    `有容量的卷数=${volumesWithCapacity.length}/${volJson.data?.length ?? 0}`
  )

  // 5. sourceEvidence 字段
  check(
    "[6] /api/volumes 列表含 sourceEvidence (R.5 §10)",
    volJson.sourceEvidence && volJson.sourceEvidence.sourceTable === "unified_volumes",
    `sourceTable=${volJson.sourceEvidence?.sourceTable ?? "—"}`
  )

  // 6. siteCode 过滤
  const siteRes = await fetch(`${BASE}/api/volumes?siteCode=SH01`)
  const siteJson = await siteRes.json()
  const allSH01 = siteJson.data?.every((v: any) =>
    !v.info || v.info.includes("SH01") || v.aggregate?.site_code === "SH01"
  ) ?? false
  check(
    "[7] siteCode=SH01 过滤生效 (info 含 SH01 或 aggregate.site_code=SH01)",
    allSH01,
    `items=${siteJson.data?.length ?? 0}`
  )

  // 7. /api/volumes/[id] 详情 (R.92.1: DTO 用 volume_id, 不是 id)
  const firstVol = volJson.data?.[0]
  const firstVolId = firstVol?.volume_id ?? firstVol?.id
  if (firstVolId) {
    const detailRes = await fetch(`${BASE}/api/volumes/${encodeURIComponent(firstVolId)}`)
    const detail = await detailRes.json()
    check(
      "[8] /api/volumes/[id] 真实化 (code=0)",
      detailRes.status === 200 && detail.code === 0 && detail.data,
      `code=${detailRes.status} data.id=${detail.data?.id ?? "—"}`
    )
    check(
      "[9] /api/volumes/[id] sourceEvidence 字段 (R.5 §10)",
      detail.data?.sourceEvidence && detail.data.sourceEvidence.sourceTable,
      `sourceTable=${detail.data?.sourceEvidence?.sourceTable ?? "—"}`
    )
    check(
      "[10] /api/volumes/[id] capacity 真实 (不伪造)",
      detail.data?.totalCapacity !== undefined,
      `totalCapacity=${detail.data?.totalCapacity ?? "—"}`
    )
    check(
      "[11] /api/volumes/[id] 含 siteInfo 或 deviceInfo (关联真实)",
      detail.data?.siteInfo || detail.data?.deviceInfo || detail.data?.aggregate,
      `关联字段有`
    )
    // 不存在的 id
    const badRes = await fetch(`${BASE}/api/volumes/INVALID_ID_NOT_EXIST`)
    const badJson = await badRes.json()
    check(
      "[12] /api/volumes/[id] bogus id 返 404 (无伪造空数据)",
      badRes.status === 404 || badJson.code === 404,
      `status=${badRes.status} code=${badJson.code}`
    )
  } else {
    check("[8-12] /api/volumes/[id] 跳过 (无 firstVolId)", false, "无卷可测")
  }

  // 8. volumes-view 组件静态扫描 (无假成功 toast)
  const viewSource = await readFile("components/racks/volumes-view.tsx", "utf8")
  const FORBIDDEN = ["卷创建成功", "卷删除成功", "已扩容", "已挂载成功"]
  let badToast = 0
  for (const phrase of FORBIDDEN) {
    if (viewSource.includes(phrase)) { check(`[13] toast 不含 "${phrase}"`, false, "误宣"); badToast++ }
  }
  if (badToast === 0) check("[13] volumes-view toast 全部合规 (R.1 §7)", true, "0 误宣")

  // 9. api-volume provider 不 mock fallback
  const providerSource = await readFile("lib/api/api-providers.ts", "utf8")
  check(
    "[14] apiVolumeProvider 无 mock fallback",
    !providerSource.includes("return mockVolumeProvider.getAll(siteCode)") &&
      !providerSource.includes("mockVolumeProvider"),
    "无 mock 调用"
  )

  // 10. volumes-view 在 /racks 页面正确渲染
  const racksPageSource = await readFile("app/racks/page.tsx", "utf8")
  check(
    "[15] /racks 页面含 volumes-view 渲染分支",
    racksPageSource.includes("VolumesView") && racksPageSource.includes('view === "volumes"'),
    "merged view 入口存在"
  )

  // 11. /volumes 旧入口仍是 thin redirect (不是 standalone page)
  const oldVolSource = await readFile("app/volumes/page.tsx", "utf8").catch(() => "")
  const lineCount = oldVolSource.split("\n").filter(l => l.trim() !== "").length
  check(
    "[16] /volumes 仅保留 thin redirect (非 standalone page)",
    lineCount <= 10,
    `app/volumes/page.tsx ${lineCount} 非空行 (期望 ≤10)`
  )

  console.log(`\n=== Volumes: ${pass} pass, ${fail} fail ===`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error("❌ Volumes e2e crashed:", e)
  process.exit(1)
})
