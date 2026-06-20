/**
 * R.17 — Volumes 事件 e2e (新增)
 *
 * 验证 /api/volumes + /api/volumes/[id] 真接入, 含:
 *  - 真实 unified_volumes 读取
 *  - 容量 / 已用 / 关联 site/device 真实
 *  - sourceEvidence 字段 (R.5 §10)
 *  - siteCode 过滤生效
 *  - 不来自 mock
 *  - 无假空卷 / 假成功 toast
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
  console.log("=== Volumes 事件 e2e (R.17) ===\n")
  await installAuthenticatedFetch(BASE)

  // 1. 页面 200
  const pageRes = await fetch(`${BASE}/volumes`)
  check("[0] 页面 /volumes 200", pageRes.status === 200, `HTTP ${pageRes.status}`)

  // 2. /api/volumes 真实读取
  const volRes = await fetch(`${BASE}/api/volumes`)
  const volJson = await volRes.json()
  check(
    "[1] /api/volumes 真实读取 (source=database)",
    volRes.status === 200 && volJson.source === "database" && Array.isArray(volJson.data),
    `source=${volJson.source} items=${volJson.data?.length ?? 0}`
  )
  check(
    "[2] 卷记录非空 (unified_volumes 真有数据)",
    volJson.data?.length > 0,
    `items=${volJson.data?.length ?? 0}`
  )

  // 3. 容量字段非空 (不伪造)
  const volumesWithCapacity = volJson.data?.filter((v: any) => v.totalCapacity && v.totalCapacity !== "0 B") ?? []
  check(
    "[3] 至少 1 个卷有真实 totalCapacity (不伪造)",
    volumesWithCapacity.length > 0,
    `有容量的卷数=${volumesWithCapacity.length}/${volJson.data?.length ?? 0}`
  )

  // 4. sourceEvidence 字段
  check(
    "[4] /api/volumes 列表含 sourceEvidence (R.5 §10)",
    volJson.sourceEvidence && volJson.sourceEvidence.sourceTable === "unified_volumes",
    `sourceTable=${volJson.sourceEvidence?.sourceTable ?? "—"}`
  )

  // 5. siteCode 过滤
  const siteRes = await fetch(`${BASE}/api/volumes?siteCode=SH01`)
  const siteJson = await siteRes.json()
  const allSH01 = siteJson.data?.every((v: any) =>
    !v.info || v.info.includes("SH01") || v.aggregate?.site_code === "SH01"
  ) ?? false
  check(
    "[5] siteCode=SH01 过滤生效 (info 含 SH01 或 aggregate.site_code=SH01)",
    allSH01,
    `items=${siteJson.data?.length ?? 0}`
  )

  // 6. /api/volumes/[id] 详情 (R.17 新增)
  const firstVol = volJson.data?.[0]
  if (firstVol?.id) {
    const detailRes = await fetch(`${BASE}/api/volumes/${encodeURIComponent(firstVol.id)}`)
    const detail = await detailRes.json()
    check(
      "[6] /api/volumes/[id] 真实化 (R.17 新增, code=0)",
      detailRes.status === 200 && detail.code === 0 && detail.data,
      `code=${detailRes.status} data.id=${detail.data?.id ?? "—"}`
    )
    check(
      "[7] /api/volumes/[id] sourceEvidence 字段 (R.5 §10)",
      detail.data?.sourceEvidence && detail.data.sourceEvidence.sourceTable,
      `sourceTable=${detail.data?.sourceEvidence?.sourceTable ?? "—"}`
    )
    check(
      "[8] /api/volumes/[id] capacity 真实 (不伪造)",
      detail.data?.totalCapacity !== undefined,
      `totalCapacity=${detail.data?.totalCapacity ?? "—"}`
    )
    check(
      "[9] /api/volumes/[id] 含 siteInfo 或 deviceInfo (关联真实)",
      detail.data?.siteInfo || detail.data?.deviceInfo || detail.data?.aggregate,
      `关联字段有`
    )
    // 不存在的 id
    const badRes = await fetch(`${BASE}/api/volumes/INVALID_ID_NOT_EXIST`)
    const badJson = await badRes.json()
    check(
      "[10] /api/volumes/[id] bogus id 返 404 (无伪造空数据)",
      badRes.status === 404 || badJson.code === 404,
      `status=${badRes.status} code=${badJson.code}`
    )
  } else {
    check("[6-10] /api/volumes/[id] 跳过 (无 firstVol.id)", false, "无卷可测")
  }

  // 7. volumes 页面静态扫描 (无假成功 toast)
  const pageSource = await readFile("app/volumes/page.tsx", "utf8")
  const FORBIDDEN = ["卷创建成功", "卷删除成功", "已扩容", "已挂载成功"]
  let badToast = 0
  for (const phrase of FORBIDDEN) {
    if (pageSource.includes(phrase)) { check(`[11] toast 不含 "${phrase}"`, false, "误宣"); badToast++ }
  }
  if (badToast === 0) check("[11] 页面 toast 全部合规 (R.1 §7)", true, "0 误宣")

  // 8. api-volume provider 不 mock fallback
  const providerSource = await readFile("lib/api/api-providers.ts", "utf8")
  check(
    "[12] apiVolumeProvider 无 mock fallback",
    !providerSource.includes("return mockVolumeProvider.getAll(siteCode)") &&
      !providerSource.includes("mockVolumeProvider"),
    "无 mock 调用"
  )

  console.log(`\n=== Volumes: ${pass} pass, ${fail} fail ===`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error("❌ Volumes e2e crashed:", e)
  process.exit(1)
})
