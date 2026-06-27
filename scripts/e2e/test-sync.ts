/**
 * Sync 事件 e2e - Sprint R.6 实施
 *
 * 覆盖:
 *   - /sync 页面 200
 *   - /api/sync/packages 列表真实
 *   - /api/sync/logs 表日志真实
 *   - HMAC 鉴权 (无签名 401, R.2G.1)
 *   - siteCode 过滤
 *   - 失败包 (status=failed) 真实存在
 *   - DRY_RUN status=skipped 真实 (不真同步)
 *
 * 不实施: 真实浏览器 (R.6 占位说明)
 */

import { createHash } from "node:crypto"
import { installAuthenticatedFetch } from "./auth-helper"
import { query } from "@/lib/db/postgres"

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
  console.log("=== Sync 事件 e2e ===\n")

  // 1. 页面能打开
  const pageRes = await fetch(`${BASE}/sync`)
  check("页面 /sync 200", pageRes.status === 200, `HTTP ${pageRes.status}`)

  // 2. packages 列表真实
  const pkgRes = await fetch(`${BASE}/api/sync/packages?limit=10`)
  const pkg = await pkgRes.json()
  const pkgItems = pkg.data?.items ?? []
  check(
    "packages 真实加载 (sync_package_log)",
    pkg.code === 0 && Array.isArray(pkgItems) && pkgItems.length > 0,
    `items=${pkgItems.length} total=${pkg.data?.total}`
  )
  check(
    "packages 状态分布 (success/failed)",
    pkgItems.some((p: { status: string }) => p.status === "success") ||
      pkgItems.some((p: { status: string }) => p.status === "failed"),
    `statuses=${[...new Set(pkgItems.map((p: { status: string }) => p.status))].join(",")}`
  )

  // 3. table log 真实
  const logRes = await fetch(`${BASE}/api/sync/logs?limit=10`)
  const log = await logRes.json()
  const logItems = log.data ?? []
  check(
    "table log 真实 (sync_table_log)",
    Array.isArray(logItems) && logItems.length > 0,
    `items=${logItems.length}`
  )
  check(
    "table log 含 skipped (DRY_RUN 标记)",
    logItems.some((l: { status: string }) => l.status === "skipped"),
    `skipped=${logItems.filter((l: { status: string }) => l.status === "skipped").length}`
  )

  const exportKinds = ["package", "table", "scheduler", "consistency"] as const
  for (const kind of exportKinds) {
    const exportRes = await fetch(`${BASE}/api/sync/export?kind=${kind}&format=json`)
    const exportText = await exportRes.text()
    let exportJson: { data?: unknown[] } = {}
    try {
      exportJson = JSON.parse(exportText)
    } catch {
      exportJson = {}
    }
    check(
      `R.11B ${kind} 日志真实 JSON 导出`,
      exportRes.status === 200 &&
        Array.isArray(exportJson.data) &&
        exportJson.data.length > 0 &&
        exportRes.headers.get("x-export-kind") === kind &&
        exportRes.headers.get("x-content-sha256") ===
          createHash("sha256").update(exportText, "utf8").digest("hex"),
      `HTTP ${exportRes.status} rows=${exportJson.data?.length ?? 0}`
    )
  }

  const exportCsvRes = await fetch(
    `${BASE}/api/sync/export?kind=package&format=csv&siteCode=SH01`
  )
  const exportCsv = await exportCsvRes.text()
  check(
    "R.11B package CSV 站点过滤与附件内容可验证",
    exportCsvRes.status === 200 &&
      exportCsvRes.headers.get("content-type")?.includes("text/csv") === true &&
      exportCsvRes.headers.get("content-disposition")?.includes("sync-package-SH01-") === true &&
      exportCsvRes.headers.get("x-data-source") === "sync_package_log" &&
      exportCsv.split("\n").slice(1).filter(Boolean).every((line) => line.includes("SH01")) &&
      exportCsvRes.headers.get("x-content-sha256") ===
        createHash("sha256").update(exportCsv, "utf8").digest("hex"),
    `HTTP ${exportCsvRes.status} count=${exportCsvRes.headers.get("x-export-record-count")}`
  )

  // 4. HMAC 鉴权 (R.2G.1)
  const noAuthRes = await fetch(`${BASE}/api/sync/package`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  })
  check(
    "HMAC 鉴权 (无签名 401)",
    noAuthRes.status === 401,
    `HTTP ${noAuthRes.status}`
  )

  // 5. siteCode 过滤
  const allRes = await fetch(`${BASE}/api/sync/packages?limit=20`)
  const all = await allRes.json()
  const sh01Res = await fetch(`${BASE}/api/sync/packages?siteCode=SH01&limit=20`)
  const sh01 = await sh01Res.json()
  check(
    "siteCode=SH01 过滤生效",
    sh01.data?.total !== all.data?.total &&
      sh01.data?.items?.every((item: { siteCode?: string }) => item.siteCode === "SH01"),
    `sh01=${sh01.data?.total} all=${all.data?.total}`
  )

  // 6. 失败包真实存在 (R.3 验证 11 failed in DB, API limit=20 hardcoded 锁住)
  // 通过 docker exec psql 直接查 (不绕 API)
  const { exec } = await import("node:child_process")
  const { promisify } = await import("node:util")
  const execAsync = promisify(exec)
  let failedCount = 0
  try {
    const { stdout } = await execAsync(
      `docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -t -c "SELECT count(*) FROM sync_package_log WHERE status='failed';" 2>&1`
    )
    failedCount = parseInt(stdout.trim().split("\n").pop() ?? "0", 10) || 0
  } catch {
    failedCount = 0
  }
  check(
    "失败包真实存在 (R.3 验证 11 failed in DB)",
    failedCount > 0,
    `failed=${failedCount} (DB 直查)`
  )

  // 7. 不允许 mock 冒充
  const noMock = JSON.stringify(pkg)
  check(
    "禁止 mock 冒充 (R.1 §7)",
    !noMock.includes('"source":"mock"') && !noMock.includes("mockData"),
    "未发现 mock"
  )

  // ===== Sprint R.7: 一致性校验 5 项验证 =====
  // 8. 调一致性 API: 用不存在的 siteCode 测 not_run
  const notRunRes = await fetch(`${BASE}/api/sync/consistency?siteCode=DOES_NOT_EXIST_R7`)
  const notRun = await notRunRes.json()
  check(
    "R.7 /api/sync/consistency 返回 not_run 路径",
    notRunRes.status === 200 && notRun.status === "not_run",
    `HTTP ${notRunRes.status} status=${notRun.status}`
  )
  check(
    "R.7 not_run 含 recommendation 字段 (R.1 §1 强约束)",
    typeof notRun.recommendation === "string" && notRun.recommendation.includes("check:sync-consistency"),
    `recommendation=${notRun.recommendation?.slice(0, 50)}...`
  )

  // 9. /sync 页面 200 + 前端代码含一致性卡逻辑 (R.7 用 grep 验证 client component 代码)
  const syncPageRes = await fetch(`${BASE}/sync`)
  check(
    "R.7 /sync 页面 200 (HTTP 验证, client render 需浏览器)",
    syncPageRes.status === 200,
    `HTTP ${syncPageRes.status}`
  )
  // 读源文件验证前端代码含一致性卡 (client component, curl HTML 不含)
  const { readFile } = await import("node:fs/promises")
  const syncPageSrc = await readFile("app/sync/page.tsx", "utf8")
  const sidebarSrc = await readFile("components/dashboard/sidebar.tsx", "utf8")
  const commandPaletteSrc = await readFile("components/shared/command-palette.tsx", "utf8")
  check(
    "同步中心已加入主导航",
    sidebarSrc.includes('href: "/sync"') && sidebarSrc.includes("同步中心"),
    "sidebar /sync"
  )
  check(
    "同步中心已加入命令面板",
    commandPaletteSrc.includes('router.push("/sync")') && commandPaletteSrc.includes("同步中心"),
    "command palette /sync"
  )
  check(
    "手动同步按钮真实提交到 Agent 队列",
    syncPageSrc.includes("manual-sync-trigger-card") &&
      syncPageSrc.includes("manual-sync-trigger-incremental") &&
      syncPageSrc.includes("manual-sync-trigger-full") &&
      syncPageSrc.includes("已提交到控制队列"),
    "不隐藏按钮，不伪造同步完成"
  )
  check(
    "R.7 前端 /sync 代码含 consistency-card 元素",
    syncPageSrc.includes("consistency-card") && syncPageSrc.includes("数据一致性校验"),
    "前端代码含 consistency-card + 标题"
  )
  check(
    "R.7 前端 /sync 代码 fetch /api/sync/consistency",
    syncPageSrc.includes("/api/sync/consistency"),
    "前端代码含 API 调用"
  )

  // ===== Sprint R.78: 每站点最新状态 + 包/表日志区域 testid =====
  check(
    "R.78 sync page shows per-site latest status",
    syncPageSrc.includes("site-latest-sync-status") &&
      syncPageSrc.includes("site-latest-sync-row-") &&
      syncPageSrc.includes("站点最新同步状态") &&
      syncPageSrc.includes("/api/sync/sites/status"),
    "前端代码含 site-latest-sync-status + 每站点行 testid"
  )
  check(
    "R.78 sync page shows package and table logs",
    syncPageSrc.includes("sync-package-table-logs") &&
      syncPageSrc.includes("同步包与表级日志") &&
      syncPageSrc.includes("/api/sync/packages") &&
      syncPageSrc.includes("/api/sync/packages/${packageId}/tables"),
    "前端代码含 sync-package-table-logs + 包/表 API 调用"
  )

  // 10. 一致性 API 用真实 SH01 查 (之前 check-sync-consistency 跑过, 应有 log)
  const consistencySh01Res = await fetch(`${BASE}/api/sync/consistency?siteCode=SH01`)
  const consistencySh01 = await consistencySh01Res.json()
  check(
    "R.7 /api/sync/consistency SH01 返回真实数据 (非 not_run)",
    consistencySh01Res.status === 200 && consistencySh01.status !== "not_run" && typeof consistencySh01.tableCount === "number",
    `status=${consistencySh01.status} tableCount=${consistencySh01.tableCount}`
  )
  check(
    "R.7 SH01 结果含 matched/mismatched 计数",
    typeof consistencySh01.matchedTableCount === "number" && typeof consistencySh01.mismatchedTableCount === "number",
    `matched=${consistencySh01.matchedTableCount} mismatched=${consistencySh01.mismatchedTableCount}`
  )
  check(
    "R.7 dataSource 显式 (database/empty, 不允许 mock)",
    consistencySh01.dataSource?.includes("sync_consistency_log") || consistencySh01.dataSource?.includes("empty"),
    `dataSource=${consistencySh01.dataSource}`
  )

  // ===== Sprint R.10A: 多站点安全配置 =====
  const configRes = await fetch(`${BASE}/api/sync/config`)
  const config = await configRes.json()
  const configText = JSON.stringify(config)
  check(
    "R.10A /api/sync/config 返回中心库配置",
    configRes.status === 200 && config.code === 0 && config.source === "sync_sites",
    `HTTP=${configRes.status} source=${config.source}`
  )
  check(
    "R.10A 多站点配置包含安全字段",
    Array.isArray(config.data?.sites) &&
      config.data.sites.length > 0 &&
      config.data.sites.every((site: { siteCode?: string; intervalSeconds?: number }) =>
        typeof site.siteCode === "string" && typeof site.intervalSeconds === "number"
      ),
    `sites=${config.data?.sites?.length ?? 0}`
  )
  check(
    "R.10A 配置 API 不泄露连接值或 secret",
    !/databaseUrl\s*:\s*["']https?:\/\/|databaseUrl\s*:\s*["']postgres:\/\//i.test(configText) &&
      !/dbHost\s*[:=]\s*["'][^"']+/i.test(configText) &&
      !/dbUser\s*[:=]\s*["'][^"']+/i.test(configText) &&
      !/password\s*[:=]\s*["'][^"']{6,}["']/i.test(configText) &&
      !/secret\s*[:=]\s*["'][^"']{6,}["']/i.test(configText) &&
      !/postgres:\/\/|mysql:\/\/|mongodb:\/\//i.test(configText),
    "仅允许 credentialKeyRef / env key ref (envRefs 字段名允许, 但 VALUE 不带连接字符串)"
  )
  check(
    "R.10A /sync 页面展示多站点同步配置",
    syncPageSrc.includes("/api/sync/config") &&
      syncPageSrc.includes("多站点同步配置") &&
      syncPageSrc.includes("credentialKeyRef"),
    "前端需展示安全配置来源"
  )

  const siteStatusRes = await fetch(`${BASE}/api/sync/sites/status`)
  const siteStatusText = await siteStatusRes.text()
  let siteStatus: Record<string, any> = {}
  try {
    siteStatus = JSON.parse(siteStatusText)
  } catch {
    siteStatus = {}
  }
  const siteStatusItems = siteStatus.data?.items ?? []
  check(
    "R.11C 每站点最新状态 API 真实聚合",
    siteStatusRes.status === 200 &&
      siteStatus.dataSource === "sync_sites + latest sync logs (database)" &&
      siteStatusItems.length === config.data?.sites?.length,
    `HTTP ${siteStatusRes.status} sites=${siteStatusItems.length}`
  )
  check(
    "R.11C 状态覆盖 scheduler/package/consistency",
    siteStatusItems.length > 0 &&
    siteStatusItems.every((item: Record<string, unknown>) =>
      typeof item.siteCode === "string" &&
      typeof item.intervalSeconds === "number" &&
      typeof item.schedulerStatus === "string" &&
      typeof item.packageStatus === "string" &&
      typeof item.consistencyStatus === "string"
    ),
    `items=${siteStatusItems.length}`
  )
  check(
    "R.11C 无日志站点显式 not_run",
    siteStatusItems.some((item: Record<string, unknown>) =>
      item.schedulerStatus === "not_run" ||
      item.packageStatus === "not_run" ||
      item.consistencyStatus === "not_run"
    ),
    "不填充假成功状态"
  )
  check(
    "R.11C 聚合 API 不泄露 secret",
    !JSON.stringify(siteStatus).match(/databaseUrl|password|secretValue|dbHost|dbUser/),
    "仅返回安全状态字段"
  )
  check(
    "R.11C /sync 页面展示每站点最新状态",
    syncPageSrc.includes("/api/sync/sites/status") &&
      syncPageSrc.includes("site-sync-status-card") &&
      syncPageSrc.includes("每站点最新状态"),
    "前端需展示聚合状态"
  )

  check(
    "R.11B /sync 页面提供真实日志导出事件",
    syncPageSrc.includes("/api/sync/export") &&
      syncPageSrc.includes("URL.createObjectURL") &&
      // R.13 toast 文案允许本地导出完成态或严格的请求提交态。
      (syncPageSrc.includes("同步日志已导出") || syncPageSrc.includes("导出完成") || syncPageSrc.includes("导出请求已提交")),
    "前端需调用真实导出 API"
  )

  // ===== Sprint R.21: 同步失败告警摘要 =====
  const alertRes = await fetch(`${BASE}/api/alerts?pageSize=300`)
  const alertJson = await alertRes.json()
  const alertItems = alertJson.data?.items ?? []
  const syncAlertItems = alertItems.filter((item: { type?: string }) =>
    item.type === "sync" || item.type === "table"
  )
  check(
    "R.21 /api/alerts 聚合同步失败告警",
    alertRes.status === 200 &&
      alertJson.code === 0 &&
      Array.isArray(alertItems) &&
      syncAlertItems.length > 0,
    `HTTP ${alertRes.status} syncAlerts=${syncAlertItems.length} total=${alertJson.data?.total ?? 0}`
  )
  check(
    "R.21 同步告警来自真实同步日志",
    syncAlertItems.every((item: { id?: string; severity?: string; status?: string }) =>
      typeof item.id === "string" &&
      (item.id.startsWith("sync-pkg-") || item.id.startsWith("sync-tbl-")) &&
      (item.severity === "critical" || item.severity === "warning") &&
      item.status === "active"
    ),
    `ids=${syncAlertItems.slice(0, 3).map((item: { id?: string }) => item.id).join(",")}`
  )
  check(
    "R.21 /sync 页面展示同步告警摘要",
    syncPageSrc.includes("/api/alerts") &&
      syncPageSrc.includes("sync-alert-summary-card") &&
      syncPageSrc.includes("同步告警摘要") &&
      syncPageSrc.includes("sync_package_log / sync_table_log"),
    "前端需展示真实聚合来源"
  )

  // ===== Sprint R.39: 手动同步触发真实提交到 Agent 队列 =====
  await installAuthenticatedFetch(BASE)
  const triggerRes = await fetch(`${BASE}/api/sync/trigger`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ siteCode: "SH01", syncType: "incremental" }),
  })
  const triggerJson = await triggerRes.json().catch(() => ({}))
  check(
    "R.39 /api/sync/trigger 真实提交同步命令",
    triggerRes.status === 201 &&
      triggerJson.ok === true &&
      triggerJson.request?.requestNo &&
      triggerJson.request?.commandNo &&
      triggerJson.request?.status === "command_sent",
    `HTTP ${triggerRes.status} status=${triggerJson.request?.status}`
  )
  // R.55: Verify the command payload carries the pg_dump protocol metadata
  const commandNo = triggerJson.request?.commandNo
  let protocol = ""
  let forbiddenOk = false
  if (commandNo) {
    const cmdRows = await query<{ payload: unknown }>(
      `SELECT payload FROM control_command WHERE command_no = $1`,
      [commandNo]
    )
    const pl = cmdRows.rows[0]?.payload as
      | { protocol?: string; forbiddenTables?: string[] }
      | null
    protocol = pl?.protocol ?? ""
    forbiddenOk =
      Array.isArray(pl?.forbiddenTables) &&
      pl!.forbiddenTables.includes("tbl_file") &&
      pl!.forbiddenTables.includes("tbl_folder")
  }
  check(
    "R.55 /api/sync/trigger 命令 payload 含 pg_dump_table_backup 协议",
    protocol === "pg_dump_table_backup" && forbiddenOk,
    `protocol=${protocol} forbiddenOk=${forbiddenOk}`
  )
  check(
    "R.39 /sync 页面展示真实手动同步触发态",
    syncPageSrc.includes("manual-sync-trigger-card") &&
      syncPageSrc.includes("/api/sync/trigger") &&
      syncPageSrc.includes("manual-sync-trigger-incremental") &&
      syncPageSrc.includes("manual-sync-trigger-full") &&
      syncPageSrc.includes("已提交到控制队列") &&
      !syncPageSrc.includes("手动同步成功"),
    "提交到 Agent 队列, 不提供假同步成功"
  )

  console.log(`\n=== Sync: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("❌ sync test crashed:", err)
  process.exit(1)
})

export {}
