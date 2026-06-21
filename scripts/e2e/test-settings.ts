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

  const [syncRes, healthRes, dbHealthRes, sitesRes, siteStatusRes] = await Promise.all([
    fetch(`${BASE}/api/sync/config`),
    fetch(`${BASE}/api/system/health`),
    fetch(`${BASE}/api/system/db-health`),
    fetch(`${BASE}/api/sites`),
    fetch(`${BASE}/api/sync/sites/status`),
  ])
  const sync = await syncRes.json()
  const health = await healthRes.json()
  const dbHealth = await dbHealthRes.json()
  const sites = await sitesRes.json()
  const siteStatus = await siteStatusRes.json()

  check("同步配置 API 真实可读", syncRes.status === 200 && sync.source === "sync_sites")
  check("系统健康 API 真实可读", healthRes.status === 200 && health.status === "ok")
  check(
    "数据库健康 API 真实可读",
    (dbHealthRes.status === 200 || dbHealthRes.status === 503) &&
      typeof dbHealth.database?.connected === "boolean"
  )
  check(
    "站点注册 API 显式真实或派生来源",
    sitesRes.status === 200 &&
      ["database", "derived", "empty"].includes(sites.dataSource) &&
      typeof sites.source === "string",
    `dataSource=${sites.dataSource} source=${sites.source}`
  )
  check(
    "每站点调度状态 API 真实可读",
    siteStatusRes.status === 200 &&
      siteStatus.dataSource === "sync_sites + latest sync logs (database)" &&
      Array.isArray(siteStatus.data?.items),
    `items=${siteStatus.data?.items?.length ?? 0}`
  )

  const source = await readFile("app/settings/page.tsx", "utf8")
  check(
    "页面不再导入 mock settings",
    !/from\s+["']@\/lib\/mock\/settings["']/.test(source)
  )
  check(
    "settings shows sync config source",
    source.includes("settings-sync-config") &&
      source.includes("同步配置 (只读)") &&
      source.includes("凭据引用") &&
      source.includes("不展示敏感值"),
    "settings-sync-config 卡片存在且显示产品化配置引用"
  )
  check(
    "settings shows site registry",
    source.includes("settings-site-registry") &&
      source.includes("站点注册状态") &&
      source.includes("registrySites"),
    "settings-site-registry 卡片存在"
  )
  check(
    "settings shows scheduler config",
    source.includes("settings-scheduler-config") &&
      source.includes("调度配置") &&
      source.includes("60") &&
      source.includes("平台配置"),
    "settings-scheduler-config 卡片存在且标注 60 分钟 + 平台配置"
  )
  check(
    "settings shows auth boundary",
    source.includes("settings-auth-boundary") &&
      source.includes("认证边界") &&
      source.includes("本地登录已启用") &&
      source.includes("blocked_by_auth"),
    "settings-auth-boundary 卡片存在"
  )
  check(
    "settings shows external boundary",
    source.includes("settings-external-boundary") &&
      source.includes("外部存储边界") &&
      source.includes("blocked_by_external_system"),
    "settings-external-boundary 卡片存在"
  )
  check(
    "settings does not display secret values in source",
    !/postgres:\/\/[^"'\s]+/.test(source) &&
      !/mysql:\/\/[^"'\s]+/.test(source) &&
      !/password\s*[:=]\s*[^"'\s]+/i.test(source),
    "源代码不含真实连接字符串或 password= 赋值"
  )

  // 拉取 /settings HTML 并验证同样无 secret 泄露 (防御性)
  const settingsPageRes2 = await fetch(`${BASE}/settings`)
  const settingsHtml = await settingsPageRes2.text()
  const configText = JSON.stringify(sync.data ?? {})
  const configTextLower = configText.toLowerCase()
  check(
    "settings does not display secret values in /api/sync/config response",
    !/postgres:\/\/[^<\s]+/.test(configText) &&
      !/mysql:\/\/[^<\s]+/.test(configText) &&
      !/dbpassword=[^<\s]+/i.test(configText) &&
      !/password\s*[:=]\s*[^<\s"]+/i.test(configText),
    "API 不返回连接字符串或 password= 形式"
  )
  check(
    "settings API exposes envRefs grouped names only",
    sync.data?.envRefs?.databaseUrl === "DATABASE_URL" &&
      sync.data?.envRefs?.siteDatabaseUrl === "SITE_DATABASE_URL" &&
      sync.data?.envRefs?.siteAgentSecret === "SITE_AGENT_SECRET" &&
      !/siteagentsecret\s*[:=]\s*["']?[a-z0-9_-]{8,}/i.test(configText) &&
      !/siteagents?secret\s*[:=]\s*[^"'\s<]+/i.test(configText.replace(/"siteAgentSecret"\s*:\s*"SITE_AGENT_SECRET"/g, "")),
    "envRefs 只返回 key 名, 不返回 secret 值 (移除自身 key 名后扫描)"
  )
  check(
    "settings HTML payload does not embed secret connection strings",
    !/postgres:\/\/[^<\s]+/.test(settingsHtml) &&
      !/mysql:\/\/[^<\s]+/.test(settingsHtml) &&
      !/password\s*[:=]\s*[^<\s]+/i.test(settingsHtml),
    "/settings 页面 HTML 不含 secret 值"
  )
  check(
    "页面读取 5 个真实接口",
    source.includes("/api/sync/config") &&
      source.includes("/api/system/health") &&
      source.includes("/api/system/db-health") &&
      source.includes("/api/sites") &&
      source.includes("/api/sync/sites/status")
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
  check(
    "Auth 可替换配置边界只返回安全状态",
    sync.data?.auth?.mode === "disabled" &&
      sync.data?.auth?.issuerUrlConfigured === false &&
      sync.data?.auth?.clientIdConfigured === false &&
      sync.data?.auth?.clientSecretKeyRef === "AUTH_CLIENT_SECRET" &&
      sync.data?.auth?.jwksUrlConfigured === false &&
      sync.data?.auth?.ldapUrlConfigured === false &&
      sync.data?.auth?.ldapBaseDnConfigured === false
  )
  check(
    "Auth 配置 API 不泄露 secret 值",
    !JSON.stringify(sync.data?.auth ?? {}).includes(
      process.env.AUTH_CLIENT_SECRET || "__not_configured__"
    )
  )
  check(
    "Settings 页面展示 Auth 安全配置状态",
    source.includes("settings-auth-config") &&
      source.includes("clientSecretKeyRef") &&
      source.includes("认证配置边界")
  )
  check(
    "页面区分站点注册来源与中心调度配置",
    source.includes("settings-site-registry") &&
      source.includes("settings-site-runtime") &&
      source.includes("站点注册状态") &&
      source.includes("中心调度配置"),
    "provenance 不混称"
  )
  check(
    "页面展示每站点周期与最近状态",
    source.includes("intervalSeconds") &&
      source.includes("schedulerStatus") &&
      source.includes("consistencyStatus") &&
      source.includes("not_run"),
    "缺日志不显示假成功"
  )

  console.log(`\n=== Settings: ${pass} pass, ${fail} fail ===`)
  if (fail > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
