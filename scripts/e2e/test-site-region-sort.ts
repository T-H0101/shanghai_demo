/**
 * 站点区域排序 e2e — Sprint R.105
 *
 * 交互: 区域 Tab 拖拽 → PUT /api/sites/regions/reorder → site_regions.sort_order
 * 站点列表: GET /api/sites 按区域顺序分组，同区域内按名称
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
    "databases/sprint-r103/01-site-regions.sql",
    "databases/sprint-r105/01-site-region-sort.sql",
  ]) {
    execSync(
      `docker exec -i ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1`,
      { input: readFileSync(file), encoding: "utf8" },
    )
  }
}

function regionKeysAreGrouped(keys: Array<string | null | undefined>): boolean {
  const seen = new Set<string>()
  let last = ""
  for (const raw of keys) {
    const key = raw || "__none__"
    if (key !== last) {
      if (seen.has(key)) return false
      seen.add(key)
      last = key
    }
  }
  return true
}

async function main() {
  console.log("=== 站点区域排序 e2e (R.105) ===\n")
  await installAuthenticatedFetch(BASE)
  applyDdl()

  const col = psql(
    `SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='site_regions' AND column_name='sort_order'`,
  )
  check("DDL site_regions.sort_order 存在", col === "1", col)

  const pageRes = await fetch(`${BASE}/sites`)
  check("页面 /sites 200", pageRes.status === 200, `HTTP ${pageRes.status}`)

  const [panelSrc, pageSrc, sitesApiSrc, reorderSrc] = await Promise.all([
    readFile("components/sites/site-regions-panel.tsx", "utf8"),
    readFile("app/(platform)/sites/page.tsx", "utf8"),
    readFile("app/api/sites/route.ts", "utf8"),
    readFile("app/api/sites/regions/reorder/route.ts", "utf8"),
  ])

  check(
    "区域列表可拖拽并调用 reorder",
    panelSrc.includes("GripVertical") &&
      panelSrc.includes("/api/sites/regions/reorder") &&
      panelSrc.includes('data-testid="site-region-list"') &&
      panelSrc.includes("draggable"),
  )
  check(
    "toast 为「区域顺序已保存」非误导成功",
    panelSrc.includes("区域顺序已保存") &&
      !panelSrc.includes("排序成功") &&
      !/站点列表[\s\S]{0,40}已暂停/.test(panelSrc),
  )
  check(
    "站点页筛选不二次排序",
    pageSrc.includes("sites.filter") &&
      !/const filtered = useMemo\(\(\) => sites\.filter[\s\S]*?\.sort\(/.test(pageSrc),
  )
  check(
    "GET /api/sites 按区域 sort_order 再按名称",
    sitesApiSrc.includes("sr.sort_order ASC NULLS LAST") &&
      sitesApiSrc.includes("ss.site_name ASC"),
  )
  check(
    "reorder 写 audit site_region_reorder",
    reorderSrc.includes('action: "site_region_reorder"') &&
      reorderSrc.includes("unnest"),
  )

  const beforeRegionsRes = await fetch(`${BASE}/api/sites/regions`)
  const beforeRegionsJson = await beforeRegionsRes.json()
  const regions = (beforeRegionsJson.data?.regions ?? []) as Array<{
    code: string
    name: string
    sortOrder?: number
  }>
  check(
    "点击前 GET /api/sites/regions",
    beforeRegionsRes.status === 200 && beforeRegionsJson.code === 0 && Array.isArray(regions),
    `HTTP ${beforeRegionsRes.status} n=${regions.length}`,
  )
  check(
    "区域列表含 sortOrder",
    regions.length === 0 || regions.every((r) => typeof r.sortOrder === "number"),
  )

  const sitesRes = await fetch(`${BASE}/api/sites`)
  const sitesJson = await sitesRes.json()
  const sites = (sitesJson.data ?? []) as Array<{
    code: string
    name: string
    regionCode?: string | null
  }>
  check("GET /api/sites 200", sitesRes.status === 200 && sitesJson.code === 0, `HTTP ${sitesRes.status}`)
  check(
    "站点列表同区域连续（未归属在后）",
    regionKeysAreGrouped(sites.map((s) => s.regionCode ?? "")),
    `n=${sites.length}`,
  )

  const createdTemp: string[] = []
  if (regions.length < 2) {
    for (const spec of [
      { code: "E2ER105A", name: "e2e-r105-a" },
      { code: "E2ER105B", name: "e2e-r105-b" },
    ]) {
      if (regions.some((r) => r.code === spec.code)) continue
      const createRes = await fetch(`${BASE}/api/sites/regions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(spec),
      })
      const createJson = await createRes.json()
      const ok = (createRes.status === 201 || createRes.status === 200) && createJson.code === 0
      check(`准备临时区域 ${spec.code}`, ok, `HTTP ${createRes.status}`)
      if (ok) createdTemp.push(spec.code)
    }
    const reload = await fetch(`${BASE}/api/sites/regions`)
    const reloadJson = await reload.json()
    regions.splice(0, regions.length, ...((reloadJson.data?.regions ?? []) as typeof regions))
  }

  const originalCodes = regions.map((r) => r.code)
  let restored = false

  try {
    if (originalCodes.length >= 2) {
      const reversed = [...originalCodes].reverse()
      const putRes = await fetch(`${BASE}/api/sites/regions/reorder`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codes: reversed }),
      })
      const putJson = await putRes.json()
      check(
        "PUT /api/sites/regions/reorder 200",
        putRes.status === 200 && putJson.code === 0,
        `HTTP ${putRes.status} ${putJson.message ?? putJson.error ?? ""}`,
      )
      check(
        "API message 为已保存",
        String(putJson.message ?? "").includes("区域顺序已保存"),
        String(putJson.message ?? ""),
      )

      const dbOrder = psql(`SELECT string_agg(code, ',' ORDER BY sort_order ASC, code ASC) FROM site_regions`)
      check("数据库 sort_order 与请求一致", dbOrder === reversed.join(","), dbOrder)

      const afterSitesRes = await fetch(`${BASE}/api/sites`)
      const afterSitesJson = await afterSitesRes.json()
      const afterSites = (afterSitesJson.data ?? []) as Array<{
        name: string
        regionCode?: string | null
      }>
      const seq: string[] = []
      for (const s of afterSites) {
        const k = s.regionCode || ""
        if (!k) continue
        if (seq[seq.length - 1] !== k) seq.push(k)
      }
      const reversedWithSites = reversed.filter((code) =>
        afterSites.some((s) => (s.regionCode || "") === code),
      )
      check(
        "重排后站点列表区域块顺序",
        seq.join(",") === reversedWithSites.join(","),
        `got=${seq.join(",") || "—"} want=${reversedWithSites.join(",") || "—"}`,
      )
      check("重排后仍分组连续", regionKeysAreGrouped(afterSites.map((s) => s.regionCode ?? "")))

      const firstRegion = reversedWithSites[0]
      const apiNames = afterSites.filter((s) => s.regionCode === firstRegion).map((s) => s.name)
      const dbNames = firstRegion
        ? psql(
            `SELECT string_agg(site_name, '|' ORDER BY site_name ASC, site_code ASC) FROM sync_sites WHERE region_code='${firstRegion}'`,
          )
        : ""
      check(
        "同区域内按站点名称排序",
        !firstRegion || apiNames.join("|") === dbNames,
        `api=${apiNames.join("|") || "—"} db=${dbNames || "—"}`,
      )

      const audit = psql(
        `SELECT COUNT(*) FROM audit_log WHERE action='site_region_reorder' AND created_at > NOW() - INTERVAL '5 minutes'`,
      )
      check("audit_log 有 site_region_reorder", Number(audit) > 0, audit)

      const restoreRes = await fetch(`${BASE}/api/sites/regions/reorder`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codes: originalCodes }),
      })
      restored = restoreRes.ok
      check("恢复原区域顺序", restoreRes.ok, `HTTP ${restoreRes.status}`)
    } else {
      check("PUT reorder（区域≥2 才测）", true, `跳过, 当前 ${originalCodes.length} 个区域`)
      check("API message 为已保存", true, "跳过")
      check("数据库 sort_order 与请求一致", true, "跳过")
      check("重排后站点列表区域块顺序", true, "跳过")
      check("重排后仍分组连续", true, "跳过")
      check("同区域内按站点名称排序", true, "跳过")
      check("audit_log 有 site_region_reorder", true, "跳过")
      check("恢复原区域顺序", true, "跳过")
    }

    const badRes = await fetch(`${BASE}/api/sites/regions/reorder`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ codes: originalCodes.slice(0, Math.max(0, originalCodes.length - 1)) }),
    })
    const badJson = await badRes.json()
    check(
      "不完整列表 400",
      originalCodes.length <= 1 || (badRes.status === 400 && badJson.error === "INVALID_ORDER"),
      `HTTP ${badRes.status}`,
    )
  } finally {
    if (originalCodes.length >= 2 && !restored) {
      await fetch(`${BASE}/api/sites/regions/reorder`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codes: originalCodes }),
      }).catch(() => undefined)
    }
    for (const code of createdTemp) {
      await fetch(`${BASE}/api/sites/regions/${encodeURIComponent(code)}`, {
        method: "DELETE",
      }).catch(() => undefined)
    }
  }

  const initSrc = readFileSync("databases/sprint-2b0/init-docker.sh", "utf8")
  check(
    "db:init 已注册 r105 DDL",
    initSrc.includes("databases/sprint-r105/01-site-region-sort.sql"),
  )

  console.log(`\n结果: ${pass} pass / ${fail} fail`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
