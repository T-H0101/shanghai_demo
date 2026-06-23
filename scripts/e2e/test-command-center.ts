/**
 * Command Center UI e2e
 *
 * White-box + API verification:
 * - Dashboard page is reachable.
 * - Command Center component is mounted from app/page.tsx.
 * - It consumes existing real APIs only; no new API/table/page.
 * - It does not import mock data.
 */

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
  console.log("=== Command Center UI e2e ===\n")
  await installAuthenticatedFetch(BASE)

  const pageRes = await fetch(`${BASE}/`)
  const html = await pageRes.text()
  check("首页 / 200", pageRes.status === 200, `HTTP ${pageRes.status}`)
  check("SSR/HTML 含 Dashboard shell", html.includes("dataSource") || html.includes("光盘库"), "dashboard content present")

  const endpoints = [
    "/api/dashboard/summary",
    "/api/sync/sites/status",
    "/api/sync/packages?pageSize=3",
    "/api/control/commands?limit=3",
    "/api/alerts?pageSize=3",
  ]

  for (const endpoint of endpoints) {
    const res = await fetch(`${BASE}${endpoint}`)
    const json = await res.json().catch(() => null)
    check(`真实 API ${endpoint} 200`, res.status === 200, `HTTP ${res.status}`)
    check(`真实 API ${endpoint} 非 mock`, JSON.stringify(json).toLowerCase().includes("mock") === false, "no mock marker")
  }

  const { readFile } = await import("node:fs/promises")
  const [pageSource, componentSource] = await Promise.all([
    readFile("app/page.tsx", "utf8"),
    readFile("components/dashboard/command-center-panel.tsx", "utf8"),
  ])

  check("app/page.tsx 使用 CommandCenterPanel", pageSource.includes("<CommandCenterPanel />"))
  check("Command Center 有首屏测试锚点", componentSource.includes('data-testid="command-center-panel"'))
  check("Command Center 有站点拓扑锚点", componentSource.includes('testid="command-center-site-topology"'))
  check("Command Center 有同步健康锚点", componentSource.includes('testid="command-center-sync-health"'))
  check("Command Center 有控制队列锚点", componentSource.includes('testid="command-center-control-queue"'))
  check("Command Center 消费 dashboard summary API", componentSource.includes("/api/dashboard/summary"))
  check("Command Center 消费 site status API", componentSource.includes("/api/sync/sites/status"))
  check("Command Center 消费 control commands API", componentSource.includes("/api/control/commands"))
  check("Command Center 消费 alerts API", componentSource.includes("/api/alerts"))
  check(
    "Command Center 不导入 mock 数据",
    !/from\s+["']@\/lib\/mock\//.test(componentSource) && !componentSource.includes("mockData"),
    "no mock import"
  )
  check(
    "Command Center 明确真实数据口径",
    componentSource.includes("实时数据") && componentSource.includes("中心库状态实时呈现"),
    "truth wording present"
  )

  // R.UI-CmdCenter: 4 大通道 + strict/candidate 状态
  check(
    "Command Center shows sync/control/search/security lanes",
    componentSource.includes("command-center-lane-sync") &&
      componentSource.includes("command-center-lane-control") &&
      componentSource.includes("command-center-lane-search") &&
      componentSource.includes("command-center-lane-security"),
    "4 lanes present",
  )
  check(
    "Command Center exposes blocked/candidate wording (strict + candidate)",
    componentSource.includes("strict 29/45") && componentSource.includes("candidate 45/45"),
    "strict/candidate badges present",
  )
  check(
    "Command Center 通道文案含同步/控制/检索/安全",
    componentSource.includes("白名单同步") &&
      componentSource.includes("命令队列") &&
      componentSource.includes("全文索引") &&
      componentSource.includes("本地登录"),
    "lane evidence text present",
  )

  console.log(`\nResult: ${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

export {}
