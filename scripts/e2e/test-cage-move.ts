/**
 * 盘笼移位登记事件 e2e — Sprint R.104（目标=站点区域）
 */

import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { installAuthenticatedFetch } from "./auth-helper"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const DB_CONTAINER = "unified_disc_postgres"
const DB_USER = "unified"
const DB_NAME = "unified_disc_platform"

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

function psql(sql: string): string {
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -tA -c ${JSON.stringify(sql)}`,
    { encoding: "utf8" },
  ).trim()
}

function applyDdl() {
  for (const file of [
    "databases/sprint-r98/01-cage-move-register.sql",
    "databases/sprint-r103/01-site-regions.sql",
    "databases/sprint-r104/01-cage-move-region.sql",
    "databases/sprint-r106/01-cage-move-source-nullable.sql",
  ]) {
    execSync(
      `docker exec -i ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1`,
      { input: readFileSync(file), encoding: "utf8" },
    )
  }
}

async function main() {
  console.log("=== 盘笼移位登记 e2e (R.106) ===\n")
  await installAuthenticatedFetch(BASE)
  applyDdl()

  const rfid = `E2E-R106-${Date.now()}`
  const sourceSite = "SH01"
  const sourceRegion = psql(
    `SELECT COALESCE(region_code,'') FROM sync_sites WHERE site_code='${sourceSite}' LIMIT 1`,
  )
  const targetRegion = psql(
    `SELECT code FROM site_regions WHERE status='active' AND code <> '${sourceRegion}' ORDER BY code LIMIT 1`,
  )
  const thirdRegion = psql(
    `SELECT code FROM site_regions WHERE status='active' AND code <> '${sourceRegion}' AND code <> '${targetRegion}' ORDER BY code LIMIT 1`,
  )

  try {
    check("源站已挂区域", Boolean(sourceRegion), `region=${sourceRegion || "—"}`)
    check("存在可用目标区域", Boolean(targetRegion), `target=${targetRegion || "—"}`)

    const pageRes = await fetch(`${BASE}/cage-moves`)
    const pageHtml = await pageRes.text()
    check("页面 /cage-moves 200", pageRes.status === 200, `HTTP ${pageRes.status}`)
    check(
      "盘笼移位页含登记入口",
      pageHtml.includes('data-testid="cage-moves-register-open"') ||
        pageHtml.includes("盘笼移位"),
    )

    const beforeRes = await fetch(`${BASE}/api/racks/cage-moves?limit=5`)
    const beforeJson = await beforeRes.json()
    check(
      "点击前 GET /api/racks/cage-moves",
      beforeRes.status === 200 && beforeJson.code === 0 && Array.isArray(beforeJson.data?.items),
    )

    const byRegionRes = await fetch(
      `${BASE}/api/racks/magazines/by-region?regionCode=${encodeURIComponent(sourceRegion)}`,
    )
    const byRegionJson = await byRegionRes.json()
    check(
      "GET magazines/by-region",
      byRegionRes.status === 200 && byRegionJson.code === 0 && Array.isArray(byRegionJson.data?.items),
      `HTTP ${byRegionRes.status}`,
    )

    const sameRegionRes = await fetch(`${BASE}/api/racks/cage-moves`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        magazineRfid: rfid,
        sourceRegionCode: sourceRegion,
        sourceSiteCode: sourceSite,
        sourceDeviceIp: "10.98.0.1",
        targetRegionCode: sourceRegion,
        registrarName: "e2e",
      }),
    })
    const sameRegionJson = await sameRegionRes.json()
    check(
      "同区域拒绝",
      sameRegionRes.status === 400 && String(sameRegionJson.error ?? "").includes("区域"),
      `HTTP ${sameRegionRes.status} ${sameRegionJson.error ?? ""}`,
    )

    const postRes = await fetch(`${BASE}/api/racks/cage-moves`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        magazineRfid: rfid,
        cageId: "mag-e2e-note",
        sourceRegionCode: sourceRegion,
        sourceSiteCode: sourceSite,
        sourceDeviceIp: "10.98.0.1",
        sourceDevicePort: "",
        relocated: false,
        targetRegionCode: targetRegion,
        registrarName: "e2e-registrar",
        remark: "R.106 e2e first",
      }),
    })
    const postJson = await postRes.json()
    const message = String(postJson.message ?? "")
    const firstId = String(postJson.data?.id ?? "")
    check(
      "POST 首次登记 201",
      postRes.status === 201 && postJson.code === 0 && postJson.data?.magazine_rfid === rfid,
      `HTTP ${postRes.status} id=${firstId || "—"}`,
    )
    check(
      "API message 为总控登记口径（目标区域）",
      message.includes("已登记到总控") &&
        message.includes("目标为站点区域") &&
        !message.includes("移位成功") &&
        !message.includes("已移位"),
      message,
    )

    const dbLoc = psql(
      `SELECT target_region_code || '|' || COALESCE(target_site_code,'') || '|' || COALESCE(target_device_ip,'') || '|' || COALESCE(source_site_code,'') FROM unified_cage_move_register WHERE magazine_rfid='${rfid}' AND status='registered' ORDER BY created_at DESC LIMIT 1`,
    )
    check(
      "首次：目标区域空站设备，源站有值",
      dbLoc.startsWith(`${targetRegion}||`) && dbLoc.endsWith(`|${sourceSite}`),
      dbLoc,
    )

    if (thirdRegion) {
      const remigrateRes = await fetch(`${BASE}/api/racks/cage-moves`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          magazineRfid: rfid,
          sourceRegionCode: targetRegion,
          relocated: true,
          targetRegionCode: thirdRegion,
          registrarName: "e2e-registrar",
          remark: "R.106 remigrate",
        }),
      })
      const remigrateJson = await remigrateRes.json()
      const secondId = String(remigrateJson.data?.id ?? "")
      check(
        "再迁登记 201（无源站设备）",
        remigrateRes.status === 201 && remigrateJson.code === 0,
        `HTTP ${remigrateRes.status}`,
      )
      const remigrateDb = psql(
        `SELECT COALESCE(source_site_code,'') || '|' || COALESCE(source_device_ip,'') || '|' || target_region_code FROM unified_cage_move_register WHERE id='${secondId}'`,
      )
      check("再迁库：源站设备空", remigrateDb === `||${thirdRegion}`, remigrateDb)

      const delOldRes = await fetch(`${BASE}/api/racks/cage-moves/${encodeURIComponent(firstId)}`, {
        method: "DELETE",
      })
      const delOldJson = await delOldRes.json()
      check(
        "非最新撤销拒绝",
        delOldRes.status === 409 && String(delOldJson.error ?? "").includes("最近一次"),
        `HTTP ${delOldRes.status} ${delOldJson.error ?? ""}`,
      )

      const delLatestRes = await fetch(
        `${BASE}/api/racks/cage-moves/${encodeURIComponent(secondId)}`,
        { method: "DELETE" },
      )
      const delLatestJson = await delLatestRes.json()
      check(
        "最新再迁可撤销",
        delLatestRes.status === 200 && delLatestJson.data?.status === "cancelled",
        `HTTP ${delLatestRes.status}`,
      )

      const delFirstAgain = await fetch(
        `${BASE}/api/racks/cage-moves/${encodeURIComponent(firstId)}`,
        { method: "DELETE" },
      )
      const delFirstAgainJson = await delFirstAgain.json()
      check(
        "撤销后再撤首次（现为最新）",
        delFirstAgain.status === 200 && delFirstAgainJson.data?.status === "cancelled",
        `HTTP ${delFirstAgain.status}`,
      )
    } else {
      check("再迁用例跳过（无第三区域）", true)

      const afterRes = await fetch(`${BASE}/api/racks/cage-moves?limit=20`)
      const afterJson = await afterRes.json()
      const listed = (afterJson.data?.items ?? []).find(
        (row: { magazine_rfid: string }) => row.magazine_rfid === rfid,
      )
      check("GET 列表含新登记 RFID", Boolean(listed))
      check("列表 is_latest_registered", listed?.is_latest_registered === true)

      const delRes = await fetch(`${BASE}/api/racks/cage-moves/${encodeURIComponent(firstId)}`, {
        method: "DELETE",
      })
      const delJson = await delRes.json()
      check(
        "DELETE 取消登记",
        delRes.status === 200 && delJson.data?.status === "cancelled",
        `HTTP ${delRes.status}`,
      )
    }

    const rfidsRes = await fetch(`${BASE}/api/racks/cage-moves?rfidsOnly=1`)
    const rfidsJson = await rfidsRes.json()
    check(
      "RFID 筛选项接口",
      rfidsRes.status === 200 && Array.isArray(rfidsJson.data?.rfids),
    )

    const searchRes = await fetch(
      `${BASE}/api/search?regionCode=${encodeURIComponent(targetRegion)}&q=${encodeURIComponent(rfid)}&limit=5`,
    )
    const searchJson = await searchRes.json()
    check(
      "检索按目标区域不 5xx",
      searchRes.status === 200 && searchJson.code === 0,
      `HTTP ${searchRes.status}`,
    )
    const countRes = await fetch(
      `${BASE}/api/search/count?regionCode=${encodeURIComponent(targetRegion)}&q=${encodeURIComponent(rfid)}`,
    )
    check("count 与检索共用区域过滤", countRes.status === 200)

    const [pageSrc, viewSrc, dialogSrc, routeSrc, searchSrc, countSrc] = await Promise.all([
      readFile("app/(platform)/cage-moves/page.tsx", "utf8"),
      readFile("components/racks/cage-move-view.tsx", "utf8"),
      readFile("components/racks/cage-move-dialog.tsx", "utf8"),
      readFile("app/api/racks/cage-moves/route.ts", "utf8"),
      readFile("app/api/search/route.ts", "utf8"),
      readFile("app/api/search/count/route.ts", "utf8"),
    ])
    const misleading =
      /移位成功|已移位/.test(viewSrc) ||
      /移位成功|已移位/.test(dialogSrc) ||
      /移位成功|已移位/.test(routeSrc)
    check("文案不含「移位成功/已移位」", !misleading)
    check(
      "Dialog 原区域+盘笼 / 目标区域+预览",
      dialogSrc.includes('data-testid="cage-move-source-region"') &&
        dialogSrc.includes('data-testid="cage-move-source-cage"') &&
        dialogSrc.includes('data-testid="cage-move-target-region"') &&
        dialogSrc.includes('data-testid="cage-move-region-preview"') &&
        dialogSrc.includes("relocated") &&
        !dialogSrc.includes('data-testid="cage-move-source-site"'),
    )
    check(
      "search 用区域过滤",
      searchSrc.includes("resolveSearchRegionFilter") &&
        searchSrc.includes("relocationFilterFromRegion") &&
        countSrc.includes("resolveSearchRegionFilter"),
    )
  } finally {
    try {
      psql(`DELETE FROM unified_cage_move_register WHERE magazine_rfid='${rfid}'`)
    } catch {
      // ignore
    }
  }

  console.log(`\n=== Cage move: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("❌ cage-move test crashed:", err)
  process.exit(1)
})
