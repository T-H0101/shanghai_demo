/**
 * scripts/env/check.ts
 * R.92 — Validate .env.local configuration before any DB-dependent operation.
 *
 * Checks:
 *   1. DATABASE_URL exists and parseable
 *   2. DB triple consistency (DATABASE_URL password = POSTGRES_PASSWORD = DB_PASSWORD)
 *   3. Required secrets not placeholder/empty
 *   4. API mode is not mock
 *   5. --production mode: stricter checks
 *
 * Usage:
 *   pnpm env:check              # Development checks
 *   pnpm env:check:production   # Production-level checks
 */

import { existsSync, readFileSync } from "node:fs"

const PRODUCTION = process.argv.includes("--production") || process.argv.includes("--strict")
const ENV_LOCAL = ".env.local"

interface CheckResult {
  name: string
  passed: boolean
  detail: string
}

const results: CheckResult[] = []
let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail: string) {
  results.push({ name, passed: ok, detail })
  if (ok) {
    passed++
    console.log(`  ✅ ${name}: ${detail}`)
  } else {
    failed++
    console.log(`  ❌ ${name}: ${detail}`)
  }
}

function maskSecret(value: string): string {
  if (value.length <= 8) return value.slice(0, 2) + "..."
  return value.slice(0, 4) + "..." + value.slice(-2)
}

function parseEnvFile(filepath: string): Record<string, string> {
  if (!existsSync(filepath)) return {}
  const content = readFileSync(filepath, "utf8")
  const env: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match) {
      env[match[1].trim()] = match[2].trim()
    }
  }
  return env
}

function main() {
  console.log("=== R.92 环境检查 ===")
  if (PRODUCTION) console.log("  (生产模式)")
  console.log()

  // 1. .env.local exists
  if (!existsSync(ENV_LOCAL)) {
    check(".env.local 存在", false, `文件不存在。运行 pnpm env:init 生成。`)
    console.log(`\n=== 结果: ${passed} pass, ${failed} fail ===`)
    process.exit(1)
  }
  check(".env.local 存在", true, "文件存在")

  const env = parseEnvFile(ENV_LOCAL)

  // 2. DATABASE_URL exists
  const dbUrl = env["DATABASE_URL"]
  check(
    "DATABASE_URL 已配置",
    !!dbUrl && dbUrl.length > 0,
    dbUrl ? `已配置 (${dbUrl.split("@")[0]}...@...)` : "未配置"
  )

  // 3. Parse DATABASE_URL password
  let dbPassword = ""
  if (dbUrl) {
    try {
      const url = new URL(dbUrl)
      dbPassword = url.password
      check(
        "DATABASE_URL 格式正确",
        url.protocol === "postgresql:" && !!url.hostname && !!url.pathname,
        `host=${url.hostname} db=${url.pathname.slice(1)}`
      )
    } catch {
      check("DATABASE_URL 格式正确", false, "无法解析为 URL")
    }
  }

  // 4. DB triple consistency
  const postgresPassword = env["POSTGRES_PASSWORD"]
  const dbPasswordEnv = env["DB_PASSWORD"]

  check(
    "POSTGRES_PASSWORD 已配置",
    !!postgresPassword && postgresPassword.length > 0,
    postgresPassword ? "已配置" : "缺失 — Docker PG 初始化密码不匹配时会导致 SCRAM 错误"
  )

  check(
    "DB_PASSWORD 已配置",
    !!dbPasswordEnv && dbPasswordEnv.length > 0,
    dbPasswordEnv ? "已配置" : "缺失"
  )

  if (dbPassword && postgresPassword && dbPasswordEnv) {
    // Decode DATABASE_URL password for comparison (URL-encoded chars like %24 for $)
    const decodedDbPassword = decodeURIComponent(dbPassword)
    const tripleMatch = decodedDbPassword === postgresPassword && decodedDbPassword === dbPasswordEnv
    check(
      "DB 三元组一致 (DATABASE_URL = POSTGRES_PASSWORD = DB_PASSWORD)",
      tripleMatch,
      tripleMatch
        ? "三者一致"
        : `DATABASE_URL password="${maskSecret(decodedDbPassword)}" POSTGRES_PASSWORD="${maskSecret(postgresPassword)}" DB_PASSWORD="${maskSecret(dbPasswordEnv)}" — 不一致会导致 SCRAM 认证失败`
    )
  }

  // 5. Required secrets not placeholder
  const secretChecks = [
    { key: "AUTH_SESSION_SECRET", minLen: 24, label: "认证会话密钥" },
    { key: "SYNC_PACKAGE_SECRET", minLen: 32, label: "同步签名密钥" },
    { key: "ADMIN_TOKEN", minLen: 24, label: "管理令牌" },
  ]

  if (PRODUCTION) {
    secretChecks.push({ key: "SITE_AGENT_SECRET", minLen: 32, label: "站点代理密钥" })
  }

  for (const sc of secretChecks) {
    const value = env[sc.key] ?? ""
    const isPlaceholder = value.startsWith("replace-with-") || value.length === 0
    const tooShort = value.length < sc.minLen
    check(
      `${sc.label} (${sc.key}) 非占位符且 ≥${sc.minLen} 字符`,
      !isPlaceholder && !tooShort,
      isPlaceholder ? "仍是占位符 (replace-with-*)" : tooShort ? `仅 ${value.length} 字符 (需 ≥${sc.minLen})` : `${value.length} 字符`
    )
  }

  // 6. API mode is not mock
  const apiMode = env["NEXT_PUBLIC_API_MODE"] ?? "api"
  check(
    "NEXT_PUBLIC_API_MODE 不为 mock",
    apiMode !== "mock",
    apiMode === "mock" ? "mock 模式禁止用于验收" : `当前=${apiMode}`
  )

  // 7. Production-only checks
  if (PRODUCTION) {
    const authMode = env["AUTH_MODE"] ?? "local"
    check(
      "AUTH_MODE 为 strict 或 oidc/ldap (非 dev)",
      authMode !== "dev",
      `当前=${authMode}`
    )

    // No placeholder secrets at all
    const allEnvEntries = Object.entries(env)
    const placeholderEntries = allEnvEntries.filter(([k, v]) =>
      v.startsWith("replace-with-") && !k.endsWith("_REF") && !k.endsWith("_KEY_REF")
    )
    check(
      "无占位符密钥值 (除 _REF/_KEY_REF)",
      placeholderEntries.length === 0,
      placeholderEntries.length === 0 ? "无占位符" : `发现 ${placeholderEntries.length} 个: ${placeholderEntries.map(([k]) => k).join(", ")}`
    )
  }

  console.log(`\n=== 结果: ${passed} pass, ${failed} fail ===`)
  if (failed > 0) {
    console.log("\n❌ 环境检查失败。修复后重新运行 pnpm env:check。")
    if (failed >= 1) {
      console.log("\n常见修复:")
      console.log("  - 三元组不一致: pnpm env:init --force (重新生成一致的 .env.local)")
      console.log("  - 占位符密钥: pnpm env:init --force (生成随机密钥)")
      console.log("  - SCRAM 认证失败: pnpm db:down:volumes → pnpm db:up → pnpm db:init")
    }
    process.exit(1)
  }
  console.log("✅ 环境检查通过。")
  process.exit(0)
}

main()
