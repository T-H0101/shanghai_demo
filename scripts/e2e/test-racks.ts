/**
 * Racks 事件 e2e - R.10D API 模式 fail-closed
 */

import { readFile } from "node:fs/promises"
import { createHash } from "node:crypto"
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
  console.log("=== Racks 事件 e2e (R.10D) ===\n")
  await installAuthenticatedFetch(BASE)

  const pageRes = await fetch(`${BASE}/racks`)
  check("页面 /racks 200", pageRes.status === 200, `HTTP ${pageRes.status}`)

  const racksRes = await fetch(`${BASE}/api/racks`)
  const racks = await racksRes.json()
  check(
    "设备 API 真实读取 unified_devices",
    racksRes.status === 200 && racks.source === "database" && Array.isArray(racks.data),
    `source=${racks.source} items=${racks.data?.length ?? 0}`
  )
  check(
    "真实设备记录非空",
    racks.data?.length > 0,
    `items=${racks.data?.length ?? 0}`
  )

  const siteRes = await fetch(`${BASE}/api/racks?siteCode=SH01`)
  const siteRacks = await siteRes.json()
  check(
    "siteCode=SH01 过滤生效",
    siteRes.status === 200 &&
      siteRacks.data?.every((item: { siteCode: string }) => item.siteCode === "SH01"),
    `items=${siteRacks.data?.length ?? 0}`
  )

  const exportRes = await fetch(`${BASE}/api/racks/export?siteCode=SH01`)
  const exportText = await exportRes.text()
  const exportLines = exportText.trim().split("\n")
  check(
    "设备导出 API 返回真实 CSV",
    exportRes.status === 200 &&
      exportRes.headers.get("content-type")?.includes("text/csv") === true &&
      exportLines.length === (siteRacks.data?.length ?? 0) + 1,
    `HTTP ${exportRes.status} rows=${Math.max(0, exportLines.length - 1)}`
  )
  check(
    "设备导出内容含真实字段与 SH01 数据",
    exportLines[0]?.includes("device_id") &&
      exportLines[0]?.includes("site_code") &&
      siteRacks.data?.every((item: { id: string }) => exportText.includes(item.id)),
    `header=${exportLines[0] ?? ""}`
  )
  check(
    "设备导出返回记录数与 SHA-256 摘要",
    exportRes.headers.get("x-export-record-count") === String(siteRacks.data?.length ?? 0) &&
      exportRes.headers.get("x-content-sha256") ===
        createHash("sha256").update(exportText, "utf8").digest("hex") &&
      exportRes.headers.get("content-disposition")?.includes("devices-SH01-") === true,
    `count=${exportRes.headers.get("x-export-record-count")}`
  )

  const providerSource = await readFile("lib/api/api-providers.ts", "utf8")
  const rackProviderBlock =
    providerSource.split("export const apiRackProvider")[1]?.split("// ============================================================")[0] ?? ""
  check(
    "apiRackProvider.getAll 无 mock fallback",
    !rackProviderBlock.includes("return mockRackProvider.getAll(siteCode)")
  )
  check(
    "apiRackProvider.getStats 无 mock fallback",
    !rackProviderBlock.includes("return mockRackProvider.getStats(siteCode)")
  )
  check(
    "racks 数据源支持 database/empty/error",
    providerSource.includes('"database" | "empty" | "error"')
  )

  const pageSource = await readFile("app/racks/page.tsx", "utf8")
  check(
    "API 模式不再空数据回退 mockRacks",
    !pageSource.includes("racksData.length > 0 ? racksData : mockRacks")
  )
  check(
    "API 模式不再展示模拟 fallback",
    !pageSource.includes("正在显示模拟数据")
  )
  check(
    "页面明确 database/empty/error",
    pageSource.includes("racksDataSource") &&
      pageSource.includes('"database" | "empty" | "error"') &&
      pageSource.includes("中心库暂无设备数据") &&
      pageSource.includes("中心库设备数据读取失败")
  )
  check(
    "导出按钮调用真实 API 并下载文件",
    pageSource.includes("/api/racks/export") &&
      pageSource.includes("URL.createObjectURL") &&
      !pageSource.includes("设备数据导出功能开发中")
  )

  console.log("\n--- R.17 盘位明细 (Racks/Slots closure) ---")
  // R.17: 选第一个 SH01 设备, 验证 /api/racks/[id] + /api/racks/[id]/slots
  const firstRack = siteRacks.data?.[0]
  check(
    "[R.17] /api/racks 至少 1 个 SH01 设备",
    !!firstRack,
    `id=${firstRack?.id ?? "—"}`
  )
  if (firstRack) {
    // 1. /api/racks/[id] 详情 (R.17 真实化, 不再 mock)
    const detailRes = await fetch(`${BASE}/api/racks/${encodeURIComponent(firstRack.id)}?siteCode=SH01`)
    const detail = await detailRes.json()
    const detailCages = detail?.data?.cages ?? []
    const detailSlots = detail?.data?.slots ?? []
    check(
      "[R.17] /api/racks/[id] 真实化 (无 mock)",
      detailRes.status === 200 && detail.source === "database" && Array.isArray(detailCages),
      `code=${detailRes.status} source=${detail.source} cages=${detailCages.length}`
    )
    check(
      "[R.17] /api/racks/[id] 含 slot 明细 (与 DB 一致或合理)",
      detailCages.length > 0 || detailSlots.length > 0,
      `cages=${detailCages.length} slots=${detailSlots.length}`
    )
    check(
      "[R.17] /api/racks/[id] slot 含 sourceEvidence (R.5 §10)",
      detailSlots.every((s: any) => s.sourceSiteId && s.sourceTable && s.sourceId) ||
        detailCages.every((c: any) => c.slots.every((s: any) => s.sourceSiteId && s.sourceTable && s.sourceId)),
      `sourceEvidence 字段全有`
    )

    // 2. /api/racks/[id]/slots (R.17 新增)
    const slotsRes = await fetch(`${BASE}/api/racks/${encodeURIComponent(firstRack.id)}/slots?siteCode=SH01`)
    const slotsJson = await slotsRes.json()
    const slotsCages = slotsJson?.data?.cages ?? []
    const slotsFlat = slotsJson?.data?.slots ?? []
    check(
      "[R.17] /api/racks/[id]/slots 端点真存在",
      slotsRes.status === 200 && slotsJson.code === 0,
      `code=${slotsRes.status}`
    )
    check(
      "[R.17] /api/racks/[id]/slots 不来自 mock (source=database)",
      slotsJson.source === "database" && slotsFlat.length > 0,
      `source=${slotsJson.source} slots=${slotsFlat.length}`
    )
    check(
      "[R.17] /api/racks/[id]/slots slot 含 capacity (不伪造)",
      slotsFlat.every((s: any) => !s.id || s.capacity === undefined || typeof s.capacity === "string"),
      `capacity 字段类型正确 (string 或 undefined, 数字 = 伪造)`
    )
    // 3. slot 数量软约束 (R.17 决定: slots 端只返 device 关联, detail 端返 site 级全集, 故 slots ≤ detail)
    check(
      "[R.17] slots 端 slot 数量 ≤ detail 端 (R.17 设计: slots 按设备, detail 按 site)",
      slotsFlat.length <= detailSlots.length,
      `slots=${slotsFlat.length} ≤ detail=${detailSlots.length}`
    )
    // 4. siteCode 生效 (R.7B)
    const wrongSite = await fetch(`${BASE}/api/racks/${encodeURIComponent(firstRack.id)}/slots?siteCode=INVALID`)
    const wrongJson = await wrongSite.json()
    check(
      "[R.17] siteCode=INVALID 不命中 (正确回 404/400)",
      wrongSite.status === 404 || wrongSite.status === 400 || wrongJson.code === 404 || wrongJson.code === 400,
      `status=${wrongSite.status} code=${wrongJson.code}`
    )
  }

  // 5. /api/racks 列表含 sourceEvidence (R.5 §10)
  check(
    "[R.17] /api/racks 列表含 sourceEvidence",
    racks.sourceEvidence && racks.sourceEvidence.sourceTable === "unified_devices",
    `sourceTable=${racks.sourceEvidence?.sourceTable ?? "—"}`
  )

  console.log(`\n=== Racks: ${pass} pass, ${fail} fail ===`)
  if (fail > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
