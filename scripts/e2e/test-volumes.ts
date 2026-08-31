/**
 * Volumes page e2e
 *
 *   - /volumes standalone page 200
 *   - /api/volumes + /api/volumes/[id] real backend
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

  // 1. /volumes 独立页面 200
  const pageRes = await fetch(`${BASE}/volumes`)
  const pageText = pageRes.status === 200 ? await pageRes.text() : ""
  check(
    "[1] 页面 /volumes 200",
    pageRes.status === 200,
    `HTTP ${pageRes.status}`
  )
  check(
    "[2] /volumes 页面含 volumes-view",
    pageText.includes("volumes-view") || pageText.includes("存储卷"),
    "页面渲染存储卷内容"
  )

  // 2. /api/volumes 真实读取
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

  // 7. /api/volumes/[id] 详情（跨站 volume_id 必须带 siteCode）
  const firstVol = volJson.data?.[0]
  const firstVolId = firstVol?.id
  const firstSite = firstVol?.siteCode
  if (firstVolId) {
    const detailUrl = firstSite
      ? `${BASE}/api/volumes/${encodeURIComponent(firstVolId)}?siteCode=${encodeURIComponent(firstSite)}`
      : `${BASE}/api/volumes/${encodeURIComponent(firstVolId)}`
    const detailRes = await fetch(detailUrl)
    const detail = await detailRes.json()
    check(
      "[8] /api/volumes/[id] 真实化 (code=0)",
      detailRes.status === 200 && detail.code === 0 && detail.data,
      `code=${detailRes.status} data.id=${detail.data?.id ?? "—"}`
    )
    check(
      "[8b] 详情站点与列表一致（防跨站串行）",
      !firstSite || detail.data?.siteCode === firstSite,
      `list=${firstSite ?? "—"} detail=${detail.data?.siteCode ?? "—"}`
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
    // 无 siteCode 的业务号 → 400；带假站点的业务号 → 404
    const noSiteRes = await fetch(`${BASE}/api/volumes/INVALID_ID_NOT_EXIST`)
    const noSiteJson = await noSiteRes.json()
    check(
      "[12] /api/volumes/[id] 无 siteCode 的非 UUID → 400",
      noSiteRes.status === 400 || noSiteJson.code === 400,
      `status=${noSiteRes.status} code=${noSiteJson.code}`
    )
    const badRes = await fetch(`${BASE}/api/volumes/INVALID_ID_NOT_EXIST?siteCode=NO_SUCH_SITE`)
    const badJson = await badRes.json()
    check(
      "[12b] /api/volumes/[id] 假 id+site → 404",
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

  // 10. volumes-view 在 /volumes 页面渲染 + 布局约定
  const volumesPageSource = await readFile("app/volumes/page.tsx", "utf8")
  check(
    "[15] /volumes 页面含 VolumesView",
    volumesPageSource.includes("VolumesView"),
    "standalone 入口存在"
  )
  check(
    "[15b] 标题行刷新 (站点管理同款)",
    volumesPageSource.includes('data-testid="volumes-refresh"') ||
      volumesPageSource.includes("volumes-refresh"),
    "PageHeader actions 含刷新"
  )
  check(
    "[15c] 右侧固定详情 (非 Drawer)",
    viewSource.includes("DetailPanel") && !viewSource.includes("Drawer"),
    "master-detail DetailPanel"
  )
  check(
    "[15d] 列表不含盘位分配列",
    !/<TableHead[^>]*>盘位分配<\/TableHead>/.test(viewSource),
    "盘位分配仅在详情"
  )

  // 11. 侧边栏含存储卷管理菜单
  const sidebarSource = await readFile("components/dashboard/sidebar.tsx", "utf8")
  check(
    "[16] 侧边栏含存储卷管理",
    sidebarSource.includes('label: "存储卷管理"') && sidebarSource.includes('href: "/volumes"'),
    "菜单项存在"
  )

  console.log(`\n=== Volumes: ${pass} pass, ${fail} fail ===`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error("❌ Volumes e2e crashed:", e)
  process.exit(1)
})
