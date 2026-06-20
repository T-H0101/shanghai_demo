/**
 * Sprint R.37: 任务监控 E2E 测试
 *
 * REQ-4.2.4: 任务状态 <=10s 刷新, 失败/超时告警
 *
 * 运行: npx tsx scripts/e2e/test-task-monitor.ts
 */

export {}

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000"
let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  ✅ ${label}`) }
  else { failed++; console.error(`  ❌ ${label}${detail ? `: ${detail}` : ""}`) }
}

async function loginCookie(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin", siteCode: "SH01" }),
  })
  return res.headers.get("set-cookie")?.match(/odp_session=([^;]+)/)?.[1] ?? ""
}

async function main() {
  console.log("\n📋 Sprint R.37: 任务监控 (REQ-4.2.4)\n")
  const cookie = await loginCookie()
  const authHeaders: HeadersInit = cookie ? { Cookie: `odp_session=${cookie}` } : {}

  // ── 1. 任务 API 响应时间 ──
  console.log("─── 1. 任务 API 响应时间 ───")

  const start = Date.now()
  const res = await fetch(`${BASE}/api/tasks?pageSize=50`, { headers: authHeaders })
  const elapsed = Date.now() - start
  check("Tasks API 返回 200", res.ok)
  check(`Tasks API 响应时间 ${elapsed}ms < 1000ms`, elapsed < 1000, `${elapsed}ms`)

  const body = await res.json()
  check("返回任务列表", Array.isArray(body?.data?.items))
  check("返回 total 数字", typeof body?.data?.total === "number")

  // ── 2. 告警 API ──
  console.log("\n─── 2. 告警 API ───")

  const alertRes = await fetch(`${BASE}/api/alerts`)
  check("告警 API 可访问", alertRes.ok || alertRes.status === 401, `status=${alertRes.status}`)

  // ── 3. 任务页面结构 ──
  console.log("\n─── 3. 任务页面结构 ───")

  const tasksPageRes = await fetch(`${BASE}/tasks`)
  check("Tasks 页面可访问", tasksPageRes.ok)
  const tasksHtml = await tasksPageRes.text()
  check("Tasks 页面包含任务列表", tasksHtml.includes("task") || tasksHtml.includes("任务"))
  check("Tasks 页面包含状态筛选", tasksHtml.includes("status") || tasksHtml.includes("状态"))

  // ── 4. 连续请求测试 (模拟 10s 轮询) ──
  console.log("\n─── 4. 轮询稳定性 ───")

  const pollResults: number[] = []
  for (let i = 0; i < 3; i++) {
    const s = Date.now()
    const r = await fetch(`${BASE}/api/tasks?pageSize=10`, { headers: authHeaders })
    pollResults.push(Date.now() - s)
    check(`轮询 ${i + 1}: HTTP ${r.status}`, r.ok)
    if (i < 2) await new Promise(resolve => setTimeout(resolve, 1000))
  }
  const avgPoll = Math.round(pollResults.reduce((a, b) => a + b, 0) / pollResults.length)
  check(`平均轮询时间 ${avgPoll}ms < 500ms`, avgPoll < 500, `times=${pollResults.join(",")}`)

  // ── 5. 刻录/回迁区分 ──
  console.log("\n─── 5. 刻录/回迁区分 ───")

  if (body?.data?.items?.length > 0) {
    const types = new Set(body.data.items.map((t: any) => t.taskType || t.type))
    check("任务有类型字段", types.size > 0, `types=${[...types].join(",")}`)
  } else {
    check("任务数据为空 (跳过类型检查)", true, "no tasks in DB")
  }

  // ── Summary ──
  console.log(`\n${"═".repeat(60)}`)
  console.log(`📊 R.37 测试结果: ${passed} passed, ${failed} failed, ${passed + failed} total`)
  if (failed > 0) { process.exitCode = 1 }
}

main().catch((e) => { console.error("测试运行失败:", e); process.exitCode = 1 })
