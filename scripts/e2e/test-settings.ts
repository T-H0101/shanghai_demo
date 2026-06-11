/**
 * Settings 事件 e2e - R.10B 真实只读化
 */

import { readFile } from "node:fs/promises"

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
  console.log("=== Settings 事件 e2e (R.10B) ===\n")

  const pageRes = await fetch(`${BASE}/settings`)
  check("页面 /settings 200", pageRes.status === 200, `HTTP ${pageRes.status}`)

  const [syncRes, healthRes, dbHealthRes] = await Promise.all([
    fetch(`${BASE}/api/sync/config`),
    fetch(`${BASE}/api/system/health`),
    fetch(`${BASE}/api/system/db-health`),
  ])
  const sync = await syncRes.json()
  const health = await healthRes.json()
  const dbHealth = await dbHealthRes.json()

  check("同步配置 API 真实可读", syncRes.status === 200 && sync.source === "sync_sites")
  check("系统健康 API 真实可读", healthRes.status === 200 && health.status === "ok")
  check(
    "数据库健康 API 真实可读",
    (dbHealthRes.status === 200 || dbHealthRes.status === 503) &&
      typeof dbHealth.database?.connected === "boolean"
  )

  const source = await readFile("app/settings/page.tsx", "utf8")
  check(
    "页面不再导入 mock settings",
    !/from\s+["']@\/lib\/mock\/settings["']/.test(source)
  )
  check(
    "页面读取 3 个真实接口",
    source.includes("/api/sync/config") &&
      source.includes("/api/system/health") &&
      source.includes("/api/system/db-health")
  )
  check(
    "页面不含假保存/导出/邮件成功",
    !source.includes("保存成功") &&
      !source.includes("导出成功") &&
      !source.includes("发送成功")
  )
  check(
    "未接入写配置与认证能力显式阻塞",
    source.includes("blocked_by_auth") &&
      source.includes("not_implemented") &&
      source.includes("只读")
  )
  check(
    "安全配置只展示环境变量键引用",
    source.includes("envKeyRefs") && source.includes("credentialKeyRef")
  )

  console.log(`\n=== Settings: ${pass} pass, ${fail} fail ===`)
  if (fail > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
