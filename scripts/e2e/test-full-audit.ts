/**
 * Full Page Audit (R.14F)
 *
 * 一次性扫描 11 个页面, 输出每页的:
 *   1. dataSource 是否显式 (database/empty/error, 禁止 mock)
 *   2. 是否调真实 API (fetch /api/...) 而非 mock 列表
 *   3. 是否 mock (从 lib/mock/* 导入即为 mock)
 *   4. 是否 blocked 标识 (ADFS / XLSX / Excel / RBAC 等 amber banner)
 *   5. 是否 e2e 覆盖 (data-testid 数量, 已存在 e2e:XX 脚本数)
 *   6. 是否含假成功 toast (R.1 §7 禁: "已暂停" / "暂停成功" / "签名通过" / "导出成功" / "任务成功")
 *
 * 全部 6 项输出后, 通过性 = (无 mock) AND (dataSource 显式) AND (无假成功 toast) AND (有 e2e selector)
 */

import { readFile, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

let pass = 0, fail = 0

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; console.log(`  ✅ ${name}${detail ? ": " + detail : ""}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ": " + detail : ""}`) }
}

interface PageAudit {
  path: string  // e.g. "app/racks/page.tsx"
  label: string // e.g. "Racks"
  route: string // e.g. "/racks"
}

const PAGES: PageAudit[] = [
  { path: "app/page.tsx",          label: "Dashboard",  route: "/" },
  { path: "app/sites/page.tsx",    label: "Sites",      route: "/sites" },
  { path: "app/sync/page.tsx",     label: "Sync",       route: "/sync" },
  { path: "app/logs/page.tsx",     label: "Logs",       route: "/logs" },
  { path: "app/racks/page.tsx",    label: "Racks",      route: "/racks" },
  { path: "app/tasks/page.tsx",    label: "Tasks",      route: "/tasks" },
  { path: "app/users/page.tsx",    label: "Users",      route: "/users" },
  { path: "app/settings/page.tsx", label: "Settings",   route: "/settings" },
  { path: "app/search/page.tsx",   label: "Search",     route: "/search" },
  { path: "app/control/page.tsx",  label: "Control",    route: "/control" },
  { path: "app/login/page.tsx",    label: "Login",      route: "/login" },
]

// 真实 API 路径白名单 (e.g. /api/racks, /api/logs 等), 出现即视为调真实数据
const REAL_API_PREFIXES = ["/api/", "/_next/data/"]

// 数据源标识 (R.10D 起的统一规范)
const DATA_SOURCE_TOKENS = ["dataSource", "database", "empty", "error", "not_implemented"]

// 假成功 / 伪签名 / 伪证书 措辞 (R.1 §7 禁)
const FORBIDDEN_WORDS = [
  /toast[^}]*已暂停/,
  /toast[^}]*暂停成功/,
  /toast[^}]*恢复成功/,
  /toast[^}]*重置成功/,
  /toast[^}]*删除成功/,
  /toast[^}]*创建成功/,
  /toast[^}]*新建成功/,
  /toast[^}]*编辑成功/,
  /toast[^}]*保存成功/,
  /toast[^}]*注册成功/,
  /toast[^}]*启用成功/,
  /toast[^}]*禁用成功/,
  /toast[^}]*任务成功/,
  /toast[^}]*执行成功/,
  /toast[^}]*签名验证成功/,
  /toast[^}]*签名通过/,
  /toast[^}]*校验通过/,
  /toast[^}]*导出成功(?!请求)/,  // "导出成功" 禁, "导出完成" 允许
  /数字签名(验证|校验)通过/,
]

// 阻塞标识 (真实做不到的能力必须 amber banner)
const BLOCKER_TOKENS = ["blocked_by", "未接入", "blocked", "ADFS", "RBAC", "not_implemented", "未实现"]

// 已存在的 e2e 脚本
async function findE2eScriptFor(page: string): Promise<string | null> {
  const scriptsDir = "scripts/e2e"
  if (!existsSync(scriptsDir)) return null
  const files = await readdir(scriptsDir)
  const candidates: Record<string, string> = {
    "/": "test-dashboard",
    "/sites": "test-sites",
    "/sync": "test-sync",
    "/logs": "test-logs",
    "/racks": "test-racks",
    "/tasks": "test-tasks",
    "/users": "test-users",
    "/settings": "test-settings",
    "/search": "test-search",
    "/control": "test-control",
    "/login": null as any,
  }
  const wanted = candidates[page]
  if (!wanted) return null
  const tsPath = path.join(scriptsDir, `${wanted}.ts`)
  if (existsSync(tsPath)) return tsPath
  return null
}

async function auditPage(p: PageAudit) {
  console.log(`\n--- ${p.label} (${p.route}) ---`)

  // 1. 页面 HTTP 可达
  const res = await fetch(`${BASE}${p.route}`)
  check(`[${p.label}] 页面 ${p.route} 200`, res.status === 200, `HTTP ${res.status}`)

  // 读源
  let src = ""
  if (existsSync(p.path)) {
    src = await readFile(p.path, "utf8")
  } else {
    check(`[${p.label}] 源文件存在 ${p.path}`, false, "missing file")
    return
  }
  check(`[${p.label}] 源文件存在`, true, p.path)

  // 2. dataSource 显式
  const hasDataSource = DATA_SOURCE_TOKENS.some((tok) => src.includes(tok))
  // login 页面例外 (无 dataSource 概念)
  if (p.route === "/login") {
    check(`[${p.label}] /login 不需 dataSource (auth 页面)`, true, "N/A")
  } else {
    check(`[${p.label}] dataSource 标识显式 (database/empty/error)`, hasDataSource,
      hasDataSource ? "found" : "missing")
  }

  // 3. 调真实 API
  const callsRealApi = REAL_API_PREFIXES.some((p) => src.includes(`fetch(\`${p}`) || src.includes(`fetch("${p}`) || src.includes(`fetch('/api/`))
  // /login 不需 API (auth 自身)
  if (p.route === "/login") {
    check(`[${p.label}] /login 不需 API (auth 自身)`, true, "N/A")
  } else {
    check(`[${p.label}] 调真实 API (fetch /api/...)`, callsRealApi,
      callsRealApi ? "found" : "missing — 可能 mock 列表")
  }

  // 4. 是否含 mock 导入
  const mockImports = src.match(/from\s+["']@\/lib\/mock\/[^"']+["']/g) ?? []
  // 一些页面用 mockAuditLogs 等是不允许的 (R.12 已修 /logs)
  check(`[${p.label}] 无 lib/mock 导入 (R.1 §1)`, mockImports.length === 0,
    mockImports.length === 0 ? "clean" : `命中 ${mockImports.length}: ${mockImports.slice(0, 2).join(", ")}`)

  // 5. blocked 标识 (不能宣称"完成")
  // login 不需要
  if (p.route === "/login") {
    check(`[${p.label}] /login 不需 blocked (auth 自身)`, true, "N/A")
  } else {
    const hasBlocker = BLOCKER_TOKENS.some((tok) => src.includes(tok))
    check(`[${p.label}] 阻塞能力有 amber banner / 显式 blocker 标识`, hasBlocker,
      hasBlocker ? "found" : "missing — 是否有未显式标注的 blocked 能力?")
  }

  // 6. 假成功 toast 措辞 (R.1 §7)
  const forbiddenHits = FORBIDDEN_WORDS.filter((re) => re.test(src))
  check(`[${p.label}] 无假成功 toast 措辞 (R.1 §7)`, forbiddenHits.length === 0,
    forbiddenHits.length === 0 ? "clean" : `命中 ${forbiddenHits.length} 个 pattern`)

  // 7. e2e 覆盖
  const e2eScript = await findE2eScriptFor(p.route)
  if (p.route === "/login") {
    check(`[${p.label}] /login 不需 e2e (auth 自身)`, true, "N/A")
  } else {
    check(`[${p.label}] e2e 脚本存在 ${e2eScript ?? "❌"}`, !!e2eScript,
      e2eScript ? "covered" : "no e2e")
  }

  // 8. 关键 data-testid (R.5 强约束: 按钮必须可定位)
  const testidCount = (src.match(/data-testid=/g) ?? []).length
  check(`[${p.label}] data-testid 数量 ≥ 1 (R.5 强约束)`, testidCount >= 1,
    `count=${testidCount}`)
}

async function main() {
  console.log("=== R.14F 全页面前端审查 ===")
  for (const p of PAGES) {
    await auditPage(p)
  }
  console.log(`\n=== Full Audit: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("❌ full-audit crashed:", err)
  process.exit(1)
})

export {}
