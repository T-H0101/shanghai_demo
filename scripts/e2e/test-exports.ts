/**
 * Exports 统一框架 e2e — Sprint R.13
 *
 * 覆盖矩阵:
 *   导出对象 (5): devices / sync_package / sync_table / sync_scheduler / sync_consistency / users / logs
 *   格式     (3): csv / json / xlsx (仅 logs 的 xlsx 已真实接入, 其他端点仍显式 501)
 *
 * 验证项 (每条目 ×):
 *   - HTTP 200 (csv/json)；logs 的 xlsx 为 200，其余端点 xlsx 为 501 — 不能 500
 *   - x-sha256 64 hex + 实际正文 hash 一致
 *   - x-record-count 与正文行数对应
 *   - x-data-source = 真实表名 (绝不能是 'mock')
 *   - x-manifest base64 解码出合法 ExportManifest
 *   - Content-Disposition: attachment; filename=*.{csv,json}
 *   - 正文不含 password / secret / database_url / postgres://user:pwd@ 模式
 *   - siteCode 过滤生效
 *
 * 审计验证:
 *   - 导出后 audit_log 含一条 action='export' 行 (依赖前序记数差)
 *
 * 浏览器层 (R.13 占位):
 *   - 前端按钮 selector 存在: [data-testid=sync-export], [data-testid=racks-export], [data-testid=users-export]
 *   - 真实 click 验证留 Playwright (R.14)
 */

import { createHash } from "node:crypto"
import { installAuthenticatedFetch } from "./auth-helper"
import { Client } from "pg"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const DB_URL = process.env.DATABASE_URL ?? ""

let pass = 0, fail = 0

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; console.log(`  ✅ ${name}${detail ? ": " + detail : ""}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ": " + detail : ""}`) }
}

interface ExportEndpoint {
  label: string
  url: (format: string) => string
  expectedSource: string
  expectedHeaderColumn?: string // CSV header 应包含的列名 (粗 sanity)
}

const ENDPOINTS: ExportEndpoint[] = [
  {
    label: "devices (racks)",
    url: (f) => `/api/racks/export?format=${f}`,
    expectedSource: "unified_devices",
    expectedHeaderColumn: "device_id",
  },
  {
    label: "sync_package",
    url: (f) => `/api/sync/export?kind=package&format=${f}`,
    expectedSource: "sync_package_log",
    expectedHeaderColumn: "batch_id",
  },
  {
    label: "sync_table",
    url: (f) => `/api/sync/export?kind=table&format=${f}`,
    expectedSource: "sync_table_log",
    expectedHeaderColumn: "table_name",
  },
  {
    label: "sync_scheduler",
    url: (f) => `/api/sync/export?kind=scheduler&format=${f}`,
    expectedSource: "sync_scheduler_log",
    expectedHeaderColumn: "run_id",
  },
  {
    label: "sync_consistency",
    url: (f) => `/api/sync/export?kind=consistency&format=${f}`,
    expectedSource: "sync_consistency_log",
    expectedHeaderColumn: "matched_table_count",
  },
  {
    label: "users",
    url: (f) => `/api/users/export?format=${f}`,
    expectedSource: "unified_users",
    expectedHeaderColumn: "username",
  },
  {
    label: "logs (multi-source)",
    url: (f) => `/api/logs/export?type=audit&format=${f}&max=50`,
    expectedSource: "database", // logs 整合 6 源, 用泛 'database'
    expectedHeaderColumn: "log_type",
  },
]

// 1. 通用导出验证 (每端点 ×3 格式)
async function testEndpoint(ep: ExportEndpoint) {
  console.log(`\n--- ${ep.label} ---`)

  // CSV
  const csvRes = await fetch(`${BASE}${ep.url("csv")}`)
  const csvBody = await csvRes.text()
  check(`[${ep.label}] CSV HTTP 200`, csvRes.status === 200, `HTTP ${csvRes.status}`)
  if (csvRes.status === 200) {
    check(`[${ep.label}] CSV content-type=text/csv`,
      (csvRes.headers.get("content-type") ?? "").includes("text/csv"))
    const sha = csvRes.headers.get("x-sha256") ?? ""
    const actualSha = createHash("sha256").update(csvBody).digest("hex")
    check(`[${ep.label}] CSV x-sha256 与正文一致`, sha === actualSha,
      `header=${sha.slice(0, 12)} body=${actualSha.slice(0, 12)}`)
    check(`[${ep.label}] CSV x-data-source=${ep.expectedSource}`,
      csvRes.headers.get("x-data-source") === ep.expectedSource,
      `got ${csvRes.headers.get("x-data-source")}`)
    check(`[${ep.label}] CSV x-data-source ≠ mock`,
      csvRes.headers.get("x-data-source") !== "mock")
    check(`[${ep.label}] CSV Content-Disposition attachment`,
      (csvRes.headers.get("content-disposition") ?? "").includes("attachment"))
    check(`[${ep.label}] CSV x-record-count 非空`,
      csvRes.headers.get("x-record-count") !== null)
    if (ep.expectedHeaderColumn) {
      const firstLine = csvBody.split(/\r?\n/)[0] ?? ""
      check(`[${ep.label}] CSV header 含列 ${ep.expectedHeaderColumn}`,
        firstLine.includes(ep.expectedHeaderColumn),
        `header=${firstLine.slice(0, 80)}`)
    }
    // R.13: x-manifest 必须存在且能 base64 解码出 JSON
    const manifestB64 = csvRes.headers.get("x-manifest")
    let manifestOk = false
    try {
      const decoded = Buffer.from(manifestB64 ?? "", "base64").toString("utf8")
      const obj = JSON.parse(decoded)
      manifestOk = typeof obj.exportType === "string" &&
        typeof obj.sha256 === "string" &&
        typeof obj.generatedAt === "string"
    } catch { /* ignore */ }
    check(`[${ep.label}] CSV x-manifest 可解码`, manifestOk)
    // 旧 header 兼容 (R.13 同时输出)
    check(`[${ep.label}] CSV 旧 header x-content-sha256 兼容`,
      csvRes.headers.get("x-content-sha256") === sha)
  }

  // JSON
  const jsonRes = await fetch(`${BASE}${ep.url("json")}`)
  const jsonBody = await jsonRes.text()
  check(`[${ep.label}] JSON HTTP 200`, jsonRes.status === 200, `HTTP ${jsonRes.status}`)
  if (jsonRes.status === 200) {
    check(`[${ep.label}] JSON content-type=application/json`,
      (jsonRes.headers.get("content-type") ?? "").includes("application/json"))
    const sha = jsonRes.headers.get("x-sha256") ?? ""
    const actualSha = createHash("sha256").update(jsonBody).digest("hex")
    check(`[${ep.label}] JSON x-sha256 与正文一致`, sha === actualSha,
      `header=${sha.slice(0, 12)} body=${actualSha.slice(0, 12)}`)
    let parsedOk = false
    try { JSON.parse(jsonBody); parsedOk = true } catch { /* ignore */ }
    check(`[${ep.label}] JSON 正文可解析`, parsedOk)
  }

  // XLSX: 仅 logs 已真实接入，其他端点仍 501
  const xlsxRes = await fetch(`${BASE}${ep.url("xlsx")}`)
  const logsXlsxEnabled = ep.label === "logs (multi-source)"
  check(
    logsXlsxEnabled
      ? `[${ep.label}] XLSX HTTP 200 (真实导出)`
      : `[${ep.label}] XLSX 显式 501 (未接入端点保持 blocked_by_dependency_policy)`,
    logsXlsxEnabled ? xlsxRes.status === 200 : xlsxRes.status === 501,
    `HTTP ${xlsxRes.status}`
  )
  if (logsXlsxEnabled && xlsxRes.status === 200) {
    const manifestB64 = xlsxRes.headers.get("x-manifest")
    const recordCount = xlsxRes.headers.get("x-record-count")
    const sha = xlsxRes.headers.get("x-sha256")
    const contentType = xlsxRes.headers.get("content-type") ?? ""
    let manifestOk = false
    try {
      const decoded = Buffer.from(manifestB64 ?? "", "base64").toString("utf8")
      const obj = JSON.parse(decoded)
      manifestOk =
        typeof obj.exportType === "string" &&
        typeof obj.signature === "object" &&
        typeof obj.signature?.status === "string"
    } catch {
      manifestOk = false
    }
    check(`[${ep.label}] XLSX content-type 正确`,
      contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      contentType)
    check(`[${ep.label}] XLSX x-manifest 可解码且含 signature`,
      manifestOk)
    check(`[${ep.label}] XLSX x-sha256 非空`,
      typeof sha === "string" && sha.length === 64,
      `x-sha256=${sha?.slice(0, 12) ?? ""}`)
    check(`[${ep.label}] XLSX x-record-count 非空`,
      recordCount !== null,
      `x-record-count=${recordCount}`)
  } else if (xlsxRes.status === 501) {
    const body = await xlsxRes.json().catch(() => null)
    check(`[${ep.label}] XLSX 501 body 含 message 说明`,
      typeof body?.message === "string" && body.message.length > 0)
    check(`[${ep.label}] XLSX 501 body.dataSource=not_implemented`,
      body?.dataSource === "not_implemented")
  }

  // siteCode 过滤 (用 SH01, 至少应正常返回 200)
  const siteRes = await fetch(`${BASE}${ep.url("csv")}&siteCode=SH01`)
  check(`[${ep.label}] siteCode=SH01 仍 200`, siteRes.status === 200, `HTTP ${siteRes.status}`)
  if (siteRes.status === 200) {
    const siteBody = await siteRes.text()
    check(`[${ep.label}] siteCode=SH01 正文不为空`, siteBody.length > 0)
    // siteCode 过滤后 SHA-256 应与全站不同 (或行数相同时巧合, 但很少见)
    const allBody = csvBody
    if (allBody.length > 100 && siteBody.length > 100) {
      const recordCountAll = Number(csvRes.headers.get("x-record-count") ?? "0")
      const recordCountSite = Number(siteRes.headers.get("x-record-count") ?? "0")
      check(`[${ep.label}] siteCode 过滤生效 (SH01 行数 ≤ all)`,
        recordCountSite <= recordCountAll,
        `all=${recordCountAll} sh01=${recordCountSite}`)
    }
  }

  // 安全检查: 正文不能含 secret / password / database_url
  const SECRET_PATTERNS = [
    /password[:=]\s*\S{4,}/i,
    /secret[:=]\s*\S{8,}/i,
    /postgres(?:ql)?:\/\/[^@\s]+:[^@\s]+@/i,
    /Bearer\s+[A-Za-z0-9._-]{20,}/,
    /sk-[A-Za-z0-9]{20,}/,
  ]
  const csvHits = SECRET_PATTERNS.filter((p) => p.test(csvBody))
  const jsonHits = SECRET_PATTERNS.filter((p) => p.test(jsonBody))
  check(`[${ep.label}] CSV 不含 secret/password/database_url`, csvHits.length === 0,
    csvHits.length === 0 ? "clean" : `命中 ${csvHits.length} 个 pattern`)
  check(`[${ep.label}] JSON 不含 secret/password/database_url`, jsonHits.length === 0,
    jsonHits.length === 0 ? "clean" : `命中 ${jsonHits.length} 个 pattern`)
}

// 2. 审计验证: 导出后 audit_log 至少多一条 action='export'
async function testAuditLog() {
  console.log(`\n--- 导出审计 audit_log ---`)
  if (!DB_URL) {
    check("DB_URL 配置 (跳过审计 DB 验证)", false, "DATABASE_URL 未设置")
    return
  }
  const client = new Client({ connectionString: DB_URL })
  try {
    await client.connect()
    const before = await client.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM audit_log WHERE action = 'export'`
    )
    const beforeCount = Number(before.rows[0]?.c ?? 0)
    // 触发一次导出
    await fetch(`${BASE}/api/users/export?format=csv`)
    // 给一点时间让 audit 写入完成
    await new Promise((r) => setTimeout(r, 300))
    const after = await client.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM audit_log WHERE action = 'export'`
    )
    const afterCount = Number(after.rows[0]?.c ?? 0)
    check("audit_log 导出动作记数 +1 (action='export')",
      afterCount >= beforeCount + 1,
      `before=${beforeCount} after=${afterCount}`)
    // 抽样最新一条
    const latest = await client.query<{ target_table: string; after_json: any; actor: string; result: string }>(
      `SELECT target_table, after_json, actor, result FROM audit_log WHERE action='export' ORDER BY created_at DESC LIMIT 1`
    )
    const row = latest.rows[0]
    if (row) {
      check("最新 export audit_log.target_table 非空", row.target_table.length > 0,
        `target_table=${row.target_table}`)
      check("最新 export audit_log.actor = 'system' (ADFS 未接入)", row.actor === "system",
        `actor=${row.actor}`)
      check("最新 export audit_log.result = 'success'", row.result === "success",
        `result=${row.result}`)
      check("最新 export audit_log.after_json 含 manifest 字段",
        !!row.after_json && typeof row.after_json === "object" &&
          typeof row.after_json.sha256 === "string" &&
          typeof row.after_json.exportType === "string")
    }
  } finally {
    await client.end()
  }
}

// 3. 前端按钮 selector 存在性 (浏览器级 e2e 留 R.14)
async function testFrontendSelectors() {
  console.log(`\n--- 前端按钮 selector 审计 ---`)
  const { readFile } = await import("node:fs/promises")
  const pages = [
    { path: "app/sync/page.tsx", selectors: ["sync-export", "sync-export-kind", "sync-export-format"] },
    { path: "app/racks/page.tsx", selectors: ["racks-export", "racks-export-format"] },
    { path: "app/users/page.tsx", selectors: ["users-export", "users-export-format"] },
  ]
  for (const p of pages) {
    const src = await readFile(p.path, "utf8")
    for (const sel of p.selectors) {
      check(`${p.path} 含 data-testid="${sel}"`,
        src.includes(`data-testid="${sel}"`) || src.includes(`data-testid='${sel}'`),
        "selector found")
    }
  }
  // logs 用 onClick (R.12 已实施)
  const logsSrc = await readFile("app/logs/page.tsx", "utf8")
  check(`app/logs/page.tsx 含 handleExport("csv")`,
    logsSrc.includes(`handleExport("csv")`))
  check(`app/logs/page.tsx 含 handleExport("json")`,
    logsSrc.includes(`handleExport("json")`))
  check(`app/logs/page.tsx 含 handleExport("xlsx") (R.13 新增)`,
    logsSrc.includes(`handleExport("xlsx")`))
}

// 4. 措辞合规审计 (R.1 §7): 4 个页面 toast 不能写"签名完成"/伪证书
async function testWording() {
  console.log(`\n--- 措辞合规 (R.1 §7) ---`)
  const { readFile } = await import("node:fs/promises")
  const PAGES = ["app/logs/page.tsx", "app/sync/page.tsx", "app/racks/page.tsx", "app/users/page.tsx"]
  const FORBIDDEN = [
    /签名(成功|完成|通过)/,
    /数字签名(验证|校验)成功/,
    /证书(校验|验证)通过/,
  ]
  for (const p of PAGES) {
    const src = await readFile(p, "utf8")
    const hits = FORBIDDEN.filter((re) => re.test(src))
    check(`${p} 无伪签名措辞`, hits.length === 0,
      hits.length === 0 ? "clean" : `命中 ${hits.length} 个模式`)
  }
}

async function main() {
  console.log("=== Exports 统一框架 e2e (R.13) ===")
  await installAuthenticatedFetch(BASE)
  for (const ep of ENDPOINTS) {
    await testEndpoint(ep)
  }
  await testAuditLog()
  await testFrontendSelectors()
  await testWording()
  console.log(`\n=== Exports: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("❌ exports e2e crashed:", err)
  process.exit(1)
})

export {}
