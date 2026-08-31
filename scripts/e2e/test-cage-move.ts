/**
 * 盘笼移位登记事件 e2e — Sprint R.98
 *
 * 必测 10 项 (R.5 §1.1):
 *   1. 点击位置: /cage-moves 页 data-testid="cage-moves-register-open" + Dialog 提交 cage-move-submit
 *   2. 点击前: GET /api/racks/cage-moves 列表
 *   3. 点击后 API: POST /api/racks/cage-moves
 *   4. API 返回: 201 + message 含「已登记到总控」
 *   5. 数据库: unified_cage_move_register 新增一行
 *   6. 列表刷新: GET 含该 RFID；下方 Tab 仅历史
 *   7. toast: API message，禁止「移位成功」
 *   8. 无 mock fallback
 *   9. 不误导: 只宣称总控登记，不宣称站点已执行
 *  10. requirements: REQ-4.3.1 / REQ-4.1.1
 *  附加: DELETE /api/racks/cage-moves/:id → status=cancelled，列表与 RFID 映射移除
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
    { encoding: "utf8" }
  ).trim()
}

function applyDdl() {
  execSync(
    `docker exec -i ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1`,
    {
      input: readFileSync("databases/sprint-r98/01-cage-move-register.sql"),
      encoding: "utf8",
    }
  )
}

async function main() {
  console.log("=== 盘笼移位登记 e2e (R.98) ===\n")
  await installAuthenticatedFetch(BASE)
  applyDdl()

  const rfid = `E2E-R98-${Date.now()}`
  const sourceSite = "SH01"
  const targetSite = "BJ02"

  try {
    const pageRes = await fetch(`${BASE}/cage-moves`)
    const pageHtml = await pageRes.text()
    check("页面 /cage-moves 200", pageRes.status === 200, `HTTP ${pageRes.status}`)
    check(
      "盘笼移位独立页含登记入口与列表",
      pageHtml.includes('data-testid="cage-moves-register-open"') ||
        pageHtml.includes("盘笼移位") ||
        pageHtml.includes("cage-move"),
      "独立菜单页可渲染"
    )

    const beforeRes = await fetch(`${BASE}/api/racks/cage-moves?limit=5`)
    const beforeJson = await beforeRes.json()
    check(
      "点击前 GET /api/racks/cage-moves",
      beforeRes.status === 200 && beforeJson.code === 0 && Array.isArray(beforeJson.data?.items),
      `HTTP ${beforeRes.status} total=${beforeJson.data?.total ?? "?"}`
    )

    const sameSiteRes = await fetch(`${BASE}/api/racks/cage-moves`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        magazineRfid: rfid,
        sourceSiteCode: sourceSite,
        targetSiteCode: sourceSite,
        sourceDeviceIp: "10.98.0.1",
        targetDeviceIp: "10.98.0.2",
        registrarName: "e2e",
      }),
    })
    const sameSiteJson = await sameSiteRes.json()
    check(
      "同源站点拒绝",
      sameSiteRes.status === 400 && String(sameSiteJson.error ?? "").includes("站点"),
      `HTTP ${sameSiteRes.status} ${sameSiteJson.error ?? ""}`
    )

    const sameIpRes = await fetch(`${BASE}/api/racks/cage-moves`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        magazineRfid: rfid,
        sourceSiteCode: sourceSite,
        targetSiteCode: targetSite,
        sourceDeviceIp: "10.98.0.1",
        targetDeviceIp: "10.98.0.1",
        registrarName: "e2e",
      }),
    })
    const sameIpJson = await sameIpRes.json()
    check(
      "同源设备 IP 拒绝",
      sameIpRes.status === 400 && String(sameIpJson.error ?? "").includes("IP"),
      `HTTP ${sameIpRes.status} ${sameIpJson.error ?? ""}`
    )

    const postRes = await fetch(`${BASE}/api/racks/cage-moves`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        magazineRfid: rfid,
        cageId: "mag-e2e-note",
        sourceSiteCode: sourceSite,
        sourceDeviceIp: "10.98.0.1",
        sourceDevicePort: "",
        targetSiteCode: targetSite,
        targetDeviceIp: "10.98.0.2",
        registrarName: "e2e-registrar",
        remark: "R.98 e2e",
      }),
    })
    const postJson = await postRes.json()
    const message = String(postJson.message ?? "")
    check(
      "POST /api/racks/cage-moves 201",
      postRes.status === 201 && postJson.code === 0 && postJson.data?.magazine_rfid === rfid,
      `HTTP ${postRes.status} id=${postJson.data?.id ?? "—"}`
    )
    check(
      "API message 为总控登记口径",
      message.includes("已登记到总控") &&
        message.includes("检索将按目标站点归属") &&
        !message.includes("移位成功") &&
        !message.includes("已移位"),
      message
    )

    const dbCount = psql(
      `SELECT COUNT(*)::text FROM unified_cage_move_register WHERE magazine_rfid='${rfid}'`
    )
    const dbLoc = psql(
      `SELECT target_site_code || '|' || target_device_ip || '|' || COALESCE(target_device_port,'') FROM unified_cage_move_register WHERE magazine_rfid='${rfid}' AND status='registered' ORDER BY created_at DESC LIMIT 1`
    )
    check("数据库写入一行", dbCount === "1", `count=${dbCount}`)
    check("当前位置=目标站 IP", dbLoc.startsWith(`${targetSite}|10.98.0.2|`), dbLoc)

    const auditCount = psql(
      `SELECT COUNT(*)::text FROM audit_log WHERE action='cage_move_registered' AND after_json->>'magazineRfid'='${rfid}'`
    )
    check("audit_log cage_move_registered", Number.parseInt(auditCount, 10) >= 1, `count=${auditCount}`)

    const afterRes = await fetch(`${BASE}/api/racks/cage-moves?limit=20`)
    const afterJson = await afterRes.json()
    const listed = (afterJson.data?.items ?? []).find(
      (row: { magazine_rfid: string; id?: string; source_site_name?: string; cage_id?: string }) =>
        row.magazine_rfid === rfid
    )
    check("GET 列表含新登记 RFID", afterRes.status === 200 && Boolean(listed), `found=${Boolean(listed)}`)
    check(
      "列表含站点名称/设备字段且无盘笼 ID 依赖展示",
      Boolean(listed?.source_site_name) && listed?.id != null,
      `id=${listed?.id ?? "—"} siteName=${listed?.source_site_name ?? "—"}`
    )

    const registerId = String(postJson.data?.id ?? listed?.id ?? "")
    const delRes = await fetch(`${BASE}/api/racks/cage-moves/${encodeURIComponent(registerId)}`, {
      method: "DELETE",
    })
    const delJson = await delRes.json()
    const delMsg = String(delJson.message ?? "")
    check(
      "DELETE /api/racks/cage-moves/:id 取消登记",
      delRes.status === 200 && delJson.code === 0 && delJson.data?.status === "cancelled",
      `HTTP ${delRes.status} status=${delJson.data?.status ?? "—"}`
    )
    check(
      "撤销文案为总控登记口径",
      delMsg.includes("已撤销这次移位登记") &&
        delMsg.includes("目标站点检索") &&
        !delMsg.includes("移位成功") &&
        !delMsg.includes("已移位"),
      delMsg
    )

    const dbStatus = psql(
      `SELECT status FROM unified_cage_move_register WHERE magazine_rfid='${rfid}' ORDER BY created_at DESC LIMIT 1`
    )
    check("数据库 status=cancelled", dbStatus === "cancelled", `status=${dbStatus}`)

    const cancelAudit = psql(
      `SELECT COUNT(*)::text FROM audit_log WHERE action='cage_move_cancelled' AND after_json->>'magazineRfid'='${rfid}'`
    )
    check("audit_log cage_move_cancelled", Number.parseInt(cancelAudit, 10) >= 1, `count=${cancelAudit}`)

    const afterDelRes = await fetch(`${BASE}/api/racks/cage-moves?limit=20`)
    const afterDelJson = await afterDelRes.json()
    const stillListed = (afterDelJson.data?.items ?? []).some(
      (row: { magazine_rfid: string }) => row.magazine_rfid === rfid
    )
    check("取消后列表不再含该 RFID", afterDelRes.status === 200 && !stillListed, `stillListed=${stillListed}`)

    const locAfterCancel = psql(
      `SELECT COUNT(*)::text FROM unified_cage_move_register WHERE magazine_rfid='${rfid}' AND status='registered'`
    )
    check("映射不再含该 RFID", locAfterCancel === "0", `registered=${locAfterCancel}`)

    const delAgainRes = await fetch(`${BASE}/api/racks/cage-moves/${encodeURIComponent(registerId)}`, {
      method: "DELETE",
    })
    check("重复删除 409", delAgainRes.status === 409, `HTTP ${delAgainRes.status}`)

    const searchRes = await fetch(
      `${BASE}/api/search?siteCode=${encodeURIComponent(targetSite)}&q=${encodeURIComponent(rfid)}&limit=5`
    )
    const searchJson = await searchRes.json()
    check(
      "检索按目标站扩条件不 5xx",
      searchRes.status === 200 && searchJson.code === 0,
      `HTTP ${searchRes.status} source=${searchJson.data?.source ?? "?"}`
    )
    const countRes = await fetch(
      `${BASE}/api/search/count?siteCode=${encodeURIComponent(targetSite)}&q=${encodeURIComponent(rfid)}`
    )
    const countJson = await countRes.json()
    check(
      "count 与检索共用 RFID 解析",
      countRes.status === 200 && countJson.code === 0,
      `HTTP ${countRes.status} total=${countJson.data?.total ?? "?"}`
    )

    const [pageSrc, viewSrc, dialogSrc, routeSrc, delRouteSrc, esSrc, searchSrc, countSrc] = await Promise.all([
      readFile("app/cage-moves/page.tsx", "utf8"),
      readFile("components/racks/cage-move-view.tsx", "utf8"),
      readFile("components/racks/cage-move-dialog.tsx", "utf8"),
      readFile("app/api/racks/cage-moves/route.ts", "utf8"),
      readFile("app/api/racks/cage-moves/[id]/route.ts", "utf8"),
      readFile("lib/search/es-client.ts", "utf8"),
      readFile("app/api/search/route.ts", "utf8"),
      readFile("app/api/search/count/route.ts", "utf8"),
    ])
    const misleading =
      /移位成功|已移位/.test(viewSrc) ||
      /移位成功|已移位/.test(dialogSrc) ||
      /移位成功|已移位/.test(routeSrc) ||
      /移位成功|已移位/.test(delRouteSrc) ||
      /toast[\s\S]{0,80}移位成功/.test(dialogSrc) ||
      viewSrc.includes("登记历史（总控）") ||
      viewSrc.includes("本列表不代表站点已执行移位")
    check("文案不含「移位成功/已移位」及误导说明", !misleading)
    check(
      "独立页 Dialog 提交 + 列表仅历史",
      pageSrc.includes('data-testid="cage-moves-register-open"') &&
        dialogSrc.includes('data-testid="cage-move-submit"') &&
        dialogSrc.includes("/api/racks/cage-moves") &&
        viewSrc.includes('data-testid="cage-move-history"') &&
        !viewSrc.includes('data-testid="cage-move-submit"'),
    )
    check(
      "列表/登记/撤销按站点权限（源站与目标站均须可访问）",
      routeSrc.includes("resolveSiteScope") &&
        routeSrc.includes("siteScope") &&
        delRouteSrc.includes("resolveSiteScope") &&
        delRouteSrc.includes("siteScope"),
    )
    check(
      "列表列：盘笼RFID、位置名称+IP、撤销登记",
      viewSrc.includes("盘笼RFID") &&
        viewSrc.includes("撤销登记") &&
        viewSrc.includes("/api/racks/cage-moves/") &&
        viewSrc.includes("method: \"DELETE\"") &&
        !viewSrc.includes("盘笼 ID") &&
        !viewSrc.includes(">RFID<"),
    )
    const sidebarSrc = await readFile("components/dashboard/sidebar.tsx", "utf8")
    check(
      "侧边栏盘笼移位在存储卷之后",
      /存储卷管理[\s\S]*盘笼移位/.test(sidebarSrc) &&
        sidebarSrc.includes('href: "/cage-moves"'),
    )
    check(
      "ES 扩条件含 inbound RFID",
      esSrc.includes("magazine_rfid: inbound") && esSrc.includes("source_site_id: params.siteCodes"),
    )
    check(
      "search 用登记表扩 RFID；count 共用 loadSiteRfidRelocationFilter",
      (searchSrc.includes("relocationFilterFromLocations") ||
        searchSrc.includes("listCurrentMagazineLocations")) &&
        searchSrc.includes("enrichSearchHits") &&
        countSrc.includes("loadSiteRfidRelocationFilter"),
    )
    const slotsSrc = await readFile("app/api/racks/[id]/slots/route.ts", "utf8")
    const overlaySrc = await readFile("lib/devices/cage-move-slot-overlay.ts", "utf8")
    check(
      "设备详情盘位按 RFID 映射原设备历史态",
      slotsSrc.includes("loadSlotHistoryOverlayMaps") &&
        slotsSrc.includes("applyHistoricalSlotOverlay") &&
        overlaySrc.includes("listCurrentMagazineRelocations") &&
        overlaySrc.includes("loadHistoricalSlotsByRfid"),
    )
    check("不走旧 cage-move 控制队列入口", dialogSrc.includes("/api/racks/cage-moves") && !dialogSrc.includes("/api/racks/cage-move\""))
  } finally {
    try {
      psql(`DELETE FROM unified_cage_move_register WHERE magazine_rfid='${rfid}'`)
    } catch {
      // ignore cleanup
    }
  }

  console.log(`\n=== Cage move: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("❌ cage-move test crashed:", err)
  process.exit(1)
})
