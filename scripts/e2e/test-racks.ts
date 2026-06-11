/**
 * Racks 事件 e2e - R.10D API 模式 fail-closed
 */

import { readFile } from "node:fs/promises"
import { createHash } from "node:crypto"

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

  console.log(`\n=== Racks: ${pass} pass, ${fail} fail ===`)
  if (fail > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
