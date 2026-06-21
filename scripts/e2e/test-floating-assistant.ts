import { installAuthenticatedFetch } from "./auth-helper"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++
    console.log(`  ✅ ${name}${detail ? `: ${detail}` : ""}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? `: ${detail}` : ""}`)
  }
}

async function main() {
  await installAuthenticatedFetch(BASE)
  const { readFile } = await import("node:fs/promises")
  const src = await readFile("components/ui/global-control-ball.tsx", "utf8")

  console.log("=== Floating Assistant e2e ===\n")

  check("组件存在", src.includes("GlobalControlBall"))
  check("不再导入 mock notifications", !src.includes("lib/mock/notifications"))
  check("接真实 alerts API", src.includes("/api/alerts"))
  check("接真实 system health API", src.includes("/api/system/health"))
  check("接真实 db health API", src.includes("/api/system/db-health"))
  check("接真实 control commands API", src.includes("/api/control/commands"))
  check("接真实 sync sites status API", src.includes("/api/sync/sites/status"))
  check("不再硬编码 CPU 23%", !src.includes("23%"))
  check("不再硬编码内存 45%", !src.includes("45%"))
  check("不再硬编码 正常运行", !src.includes("正常运行"))
  check("不再硬编码 已同步", !src.includes("已同步"))
  check("不再硬编码 已保护", !src.includes("已保护"))
  check("存在待接入状态文案", src.includes("待认证接入") && src.includes("待外部服务"))

  const pageRes = await fetch(`${BASE}/`)
  check("首页 200", pageRes.status === 200, `HTTP ${pageRes.status}`)

  const [healthRes, dbHealthRes, alertsRes, controlRes, siteStatusRes] = await Promise.all([
    fetch(`${BASE}/api/system/health`),
    fetch(`${BASE}/api/system/db-health`),
    fetch(`${BASE}/api/alerts?pageSize=5`),
    fetch(`${BASE}/api/control/commands?limit=5`),
    fetch(`${BASE}/api/sync/sites/status`),
  ])

  check("/api/system/health 200", healthRes.status === 200, `HTTP ${healthRes.status}`)
  check("/api/system/db-health 响应", dbHealthRes.status === 200 || dbHealthRes.status === 503, `HTTP ${dbHealthRes.status}`)
  check("/api/alerts 200", alertsRes.status === 200, `HTTP ${alertsRes.status}`)
  check("/api/control/commands 200", controlRes.status === 200, `HTTP ${controlRes.status}`)
  check("/api/sync/sites/status 200", siteStatusRes.status === 200, `HTTP ${siteStatusRes.status}`)

  console.log(`\n=== Floating Assistant: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error("❌ floating assistant test crashed:", error)
  process.exit(1)
})

export {}
