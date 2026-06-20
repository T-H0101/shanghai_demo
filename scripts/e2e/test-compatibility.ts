/**
 * Sprint R.35: 前端兼容性测试
 *
 * REQ-6.3.1: Chrome/Firefox/Edge 最新版, 分辨率 >=1920x1080
 *
 * 运行: npx tsx scripts/e2e/test-compatibility.ts
 *
 * 注意: 完整浏览器兼容性测试需要 Playwright/Puppeteer。
 * 本脚本验证: 页面 HTML 结构、viewport meta、CSS 断点、任务类型区分。
 */

export {}

import { readFileSync } from "node:fs"

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000"
let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  ✅ ${label}`) }
  else { failed++; console.error(`  ❌ ${label}${detail ? `: ${detail}` : ""}`) }
}

async function main() {
  console.log("\n📋 Sprint R.35: 前端兼容性 (REQ-6.3.1)\n")

  // ── 1. 页面可访问性 ──
  console.log("─── 1. 页面可访问性 ───")

  const pages = [
    { path: "/", name: "Dashboard" },
    { path: "/tasks", name: "Tasks" },
    { path: "/racks", name: "Racks" },
    { path: "/volumes", name: "Volumes" },
    { path: "/search", name: "Search" },
    { path: "/sites", name: "Sites" },
    { path: "/logs", name: "Logs" },
    { path: "/users", name: "Users" },
    { path: "/settings", name: "Settings" },
    { path: "/sync", name: "Sync" },
  ]

  for (const page of pages) {
    const res = await fetch(`${BASE}${page.path}`)
    check(`${page.name} 页面 HTTP 200`, res.ok, `status=${res.status}`)
    const html = await res.text()
    check(`${page.name} 包含 viewport meta`, html.includes("viewport"))
    check(`${page.name} 包含 lang=zh-CN`, html.includes('lang="zh-CN"'))
  }

  // ── 2. 响应式断点检查 ──
  console.log("\n─── 2. 响应式断点 ───")

  const homeRes = await fetch(`${BASE}/`)
  const homeHtml = await homeRes.text()
  check("HTML 包含 Tailwind 响应式类 (sm:/md:/lg:/xl:)", /class="[^"]*\b(sm|md|lg|xl):/.test(homeHtml))
  check("HTML 不使用固定宽度 (无 width=px)", !/width="\d+px"/.test(homeHtml))

  // ── 3. 任务类型区分 ──
  console.log("\n─── 3. 任务类型区分展示 ───")

  const tasksRes = await fetch(`${BASE}/tasks`)
  const tasksHtml = await tasksRes.text()
  const tasksSource = readFileSync("app/tasks/page.tsx", "utf8")
  check("Tasks 页面包含任务类型相关 UI", tasksHtml.includes("task") || tasksHtml.includes("任务"))
  check("Tasks 页面包含状态 Badge", tasksSource.includes("Badge") || tasksSource.includes("badge"))

  // ── 4. CSS 兼容性 ──
  console.log("\n─── 4. CSS 兼容性 ───")

  check("使用 Tailwind CSS (class 命名)", homeHtml.includes("class="))
  check("不使用 IE-only CSS (无 @media screen\\9)", !homeHtml.includes("@media screen\\9"))
  check("不使用 webkit-only 属性 (无 -webkit-box)", !homeHtml.includes("-webkit-box"))

  // ── 5. 无 JavaScript 错误标记 ──
  console.log("\n─── 5. 结构检查 ───")

  check("使用 Next.js 资源 (包含 _next chunks)", homeHtml.includes("/_next/") || homeHtml.includes("self.__next"))
  check("包含 App Shell 挂载内容", homeHtml.length > 1000 && homeHtml.includes("<body"))

  // ── Summary ──
  console.log(`\n${"═".repeat(60)}`)
  console.log(`📊 R.35 测试结果: ${passed} passed, ${failed} failed, ${passed + failed} total`)
  console.log("ℹ️  完整浏览器兼容性需 Playwright 在 Chrome/Firefox/Edge 中验证")
  if (failed > 0) { process.exitCode = 1 }
}

main().catch((e) => { console.error("测试运行失败:", e); process.exitCode = 1 })
