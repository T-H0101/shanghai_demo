/**
 * Sprint R.39-R.43: Roadmap to 25/45 E2E 测试
 *
 * 运行: npx tsx scripts/e2e/test-roadmap-25.ts
 */

import { spawnSync } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { closePool, query } from "../../lib/db/postgres"
import { installAuthenticatedFetch } from "./auth-helper"

export {}

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000"
let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  ✅ ${label}`) }
  else { failed++; console.error(`  ❌ ${label}${detail ? `: ${detail}` : ""}`) }
}

async function getSyncRequest(
  requestNo: string,
  headers: HeadersInit,
): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${BASE}/api/sync/trigger?siteCode=SH01&limit=50`, { headers })
    if (!res.ok) return null
    const body = await res.json()
    return (body?.data?.items ?? []).find((item: any) => item.request_no === requestNo) ?? null
  } catch {
    return null
  }
}

async function waitForFinalSyncRequest(
  requestNo: string,
  headers: HeadersInit,
): Promise<Record<string, any> | null> {
  const finalStatuses = new Set(["completed", "failed"])
  for (let i = 0; i < 12; i++) {
    const row = await getSyncRequest(requestNo, headers)
    if (row && finalStatuses.has(row.status)) return row
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return getSyncRequest(requestNo, headers)
}

async function main() {
  console.log("\n📋 Sprint R.39-R.43: Roadmap to 25/45\n")

  const cookie = await installAuthenticatedFetch(BASE)
  const authHeaders: Record<string, string> = { "Content-Type": "application/json" }
  if (cookie) authHeaders.Cookie = `odp_session=${cookie}`
  const stateDir = await mkdtemp(join(tmpdir(), "roadmap-25-agent-"))

  try {
    // ── R.39: 同步策略闭环 ──
    console.log("─── R.39: 同步策略闭环 (REQ-2.3.2, REQ-1.2.1, REQ-6.1.3) ───")

  const triggerRes = await fetch(`${BASE}/api/sync/trigger`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ siteCode: "SH01", syncType: "incremental" }),
  })
  check("POST /api/sync/trigger 返回 201", triggerRes.status === 201, `status=${triggerRes.status}`)
  const triggerBody = await triggerRes.json()
  check("返回 ok=true", triggerBody?.ok === true)
  check("返回 requestNo", Boolean(triggerBody?.request?.requestNo))
  check("返回 commandNo", Boolean(triggerBody?.request?.commandNo))
  check("状态为 command_sent", triggerBody?.request?.status === "command_sent")
  check("包含 timing 信息", Boolean(triggerBody?.timing))

  // Full sync
  const fullRes = await fetch(`${BASE}/api/sync/trigger`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ siteCode: "SH01", syncType: "full" }),
  })
  check("全量同步 POST 返回 201", fullRes.status === 201)

  // GET sync requests
  const reqListRes = await fetch(`${BASE}/api/sync/trigger?limit=10`, { headers: authHeaders })
  check("GET /api/sync/trigger 返回列表", reqListRes.ok)
  const reqListBody = await reqListRes.json()
  check("有同步请求记录", reqListBody?.data?.items?.length > 0)

  const agentRun = spawnSync("pnpm", ["agent:site", "--", "--once"], {
    encoding: "utf8",
    env: {
      ...process.env,
      SITE_CODE: "SH01",
      SITE_AGENT_ID: "roadmap-25-e2e",
      SITE_AGENT_VERSION: "roadmap-25-e2e",
      PLATFORM_URL: BASE,
      SITE_AGENT_STATE_DIR: stateDir,
      SITE_AGENT_CONTROL_BATCH_SIZE: "100",
      SITE_AGENT_TASK_SYNC_INTERVAL_MS: "1000",
      SITE_AGENT_SNAPSHOT_SYNC_INTERVAL_MS: "5000",
    },
    timeout: 60_000,
  })
  check("Site Agent --once 执行成功", agentRun.status === 0, agentRun.stderr || agentRun.stdout)
  check("Agent 输出 control_cycle_completed", /control_cycle_completed/.test(agentRun.stdout), agentRun.stdout.slice(0, 300))

  const finalIncremental = await waitForFinalSyncRequest(triggerBody.request.requestNo, authHeaders)
  check(
    "增量同步请求进入最终状态",
    finalIncremental?.status === "completed" || finalIncremental?.status === "failed",
    `status=${finalIncremental?.status ?? "missing"}`,
  )
  check("增量同步请求记录 agent_polled_at", Boolean(finalIncremental?.agent_polled_at))
  check("增量同步请求记录 sync_completed_at", Boolean(finalIncremental?.sync_completed_at))

  // ── R.40: 系统监控 ──
  console.log("\n─── R.40: 系统监控 (REQ-6.4.2) ───")

  const metricsRes = await fetch(`${BASE}/api/system/metrics`)
  check("GET /api/system/metrics 返回 200", metricsRes.ok)
  const metricsBody = await metricsRes.json()
  check("包含 system.cpuCount", typeof metricsBody?.data?.system?.cpuCount === "number")
  check("包含 system.memory.percent", typeof metricsBody?.data?.system?.memory?.percent === "number")
  check("包含 database.healthy", typeof metricsBody?.data?.database?.healthy === "boolean")
  check("包含 process.heapUsedMB", typeof metricsBody?.data?.process?.heapUsedMB === "number")
  check("dataSource=system_api", metricsBody?.data?.dataSource === "system_api")

  // ── R.41: 审计防篡改 ──
  console.log("\n─── R.41: 审计防篡改 (REQ-6.2.3) ───")

  const verifyRes = await fetch(`${BASE}/api/audit/verify?limit=100`, { headers: authHeaders })
  check("GET /api/audit/verify 返回 200", verifyRes.ok)
  const verifyBody = await verifyRes.json()
  check("返回 total 数字", typeof verifyBody?.data?.total === "number")
  check("返回 verified 数字", typeof verifyBody?.data?.verified === "number")
  check("返回 chainHead", Boolean(verifyBody?.data?.chainHead))
  check("算法为 SHA-256", verifyBody?.data?.algorithm === "SHA-256")

  const tamperNo = `E2E-TAMPER-${Date.now()}`
  const inserted = await query<{ id: string }>(
    `INSERT INTO audit_log (command_no, action, target_table, target_id, actor, site_code, result)
     VALUES ($1, 'roadmap_hash_probe', 'audit_log', $1, 'e2e', 'SH01', 'success')
     RETURNING id::text`,
    [tamperNo],
  )
  const auditId = inserted.rows[0].id
  const beforeTamper = await fetch(`${BASE}/api/audit/verify?limit=10000`, { headers: authHeaders })
  const beforeTamperBody = await beforeTamper.json()
  check("审计 hash 初始化后无篡改", beforeTamperBody?.data?.tampered === 0, `tampered=${beforeTamperBody?.data?.tampered}`)

  await query(`UPDATE audit_log SET action = 'roadmap_hash_tampered' WHERE id = $1::uuid`, [auditId])
  const tamperedRes = await fetch(`${BASE}/api/audit/verify?limit=10000`, { headers: authHeaders })
  const tamperedBody = await tamperedRes.json()
  check("审计 hash chain 能检测篡改", tamperedBody?.data?.tampered > 0, `tampered=${tamperedBody?.data?.tampered}`)
  check("篡改记录 ID 被返回", (tamperedBody?.data?.tamperedIds ?? []).includes(auditId))

  await query(`UPDATE audit_log SET action = 'roadmap_hash_probe' WHERE id = $1::uuid`, [auditId])
  const repairedRes = await fetch(`${BASE}/api/audit/verify?limit=10000`, { headers: authHeaders })
  const repairedBody = await repairedRes.json()
  check("恢复审计记录后 hash chain 通过", repairedBody?.data?.tampered === 0, `tampered=${repairedBody?.data?.tampered}`)

  // ── R.42: 检索导出 ──
  console.log("\n─── R.42: 检索导出 (REQ-4.1.3, REQ-5.2.2) ───")

  const searchExportRes = await fetch(`${BASE}/api/search/export?format=csv`, { headers: authHeaders })
  check("GET /api/search/export 返回 200", searchExportRes.ok)
  check("CSV 有 x-sha256", Boolean(searchExportRes.headers.get("x-sha256")))
  check("CSV 有 x-record-count", Boolean(searchExportRes.headers.get("x-record-count")))

  const indexExportRes = await fetch(`${BASE}/api/sync/index/export?format=csv`, { headers: authHeaders })
  check("GET /api/sync/index/export 返回 200", indexExportRes.ok)

  const indexPostRes = await fetch(`${BASE}/api/sync/index/export`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ siteCode: "SH01", format: "json" }),
  })
  check("POST /api/sync/index/export 返回 201", indexPostRes.status === 201)
  const indexBody = await indexPostRes.json()
  check("返回 jobId", Boolean(indexBody?.data?.jobId))
  check("返回 sha256", Boolean(indexBody?.data?.sha256))

  // ── R.43: 任务日志 ──
  console.log("\n─── R.43: 任务日志 (REQ-5.1.1) ───")

  const logsRes = await fetch(`${BASE}/api/logs?type=control&limit=10`, { headers: authHeaders })
  check("控制命令日志可查询", logsRes.ok)
  const logsBody = await logsRes.json()
  check("返回日志数据", Array.isArray(logsBody?.data?.items))

  // ── Summary ──
  console.log(`\n${"═".repeat(60)}`)
  console.log(`📊 R.39-R.43 测试结果: ${passed} passed, ${failed} failed, ${passed + failed} total`)
  if (failed > 0) { console.log("❌ 有测试失败"); process.exitCode = 1 }
  else { console.log("✅ 全部通过") }
  } finally {
    await rm(stateDir, { recursive: true, force: true })
    await closePool()
  }
}

main().catch((e) => { console.error("测试运行失败:", e); process.exitCode = 1 })
