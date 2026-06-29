/**
 * scripts/env/init.ts
 * R.92 — Generate .env.local from .env.example with consistent DB triple + random secrets.
 *
 * Usage:
 *   pnpm env:init           # Create .env.local (skip if exists)
 *   pnpm env:init --force   # Force rebuild even if exists
 *
 * DB triple consistency: DATABASE_URL password = POSTGRES_PASSWORD = DB_PASSWORD.
 * Secrets: AUTH_SESSION_SECRET, SYNC_PACKAGE_SECRET, ADMIN_TOKEN, SITE_AGENT_SECRET
 * are auto-generated as 32-byte hex strings.
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"

const FORCE = process.argv.includes("--force")
const ENV_LOCAL = ".env.local"
const ENV_EXAMPLE = ".env.example"

function generateSecret(bytes: number = 32): string {
  return randomBytes(bytes).toString("hex")
}

function maskSecret(value: string): string {
  if (value.length <= 8) return value.slice(0, 4) + "..."
  return value.slice(0, 4) + "..." + value.slice(-2)
}

function main() {
  console.log("=== R.92 环境初始化 ===\n")

  if (existsSync(ENV_LOCAL) && !FORCE) {
    console.log(`✅ ${ENV_LOCAL} 已存在。使用 --force 重建。`)
    console.log(`   当前配置检查: pnpm env:check`)
    process.exit(0)
  }

  if (!existsSync(ENV_EXAMPLE)) {
    console.error(`❌ ${ENV_EXAMPLE} 不存在，无法初始化。`)
    process.exit(1)
  }

  // Copy .env.example → .env.local
  copyFileSync(ENV_EXAMPLE, ENV_LOCAL)
  console.log(`📋 ${ENV_EXAMPLE} → ${ENV_LOCAL} 已复制。`)

  // Read and modify .env.local
  let content = readFileSync(ENV_LOCAL, "utf8")

  // Generate random secrets
  const secrets: Record<string, string> = {
    AUTH_SESSION_SECRET: generateSecret(32),
    SYNC_PACKAGE_SECRET: generateSecret(32),
    ADMIN_TOKEN: generateSecret(24),
    SITE_AGENT_SECRET: generateSecret(32),
  }

  // Replace placeholder secrets
  for (const [key, value] of Object.entries(secrets)) {
    // Replace lines like: KEY=replace-with-... or KEY= (empty)
    const patterns = [
      new RegExp(`${key}=replace-with-[^\\s]+`, "g"),
      new RegExp(`${key}=\\s*$`, "gm"),
    ]
    for (const pattern of patterns) {
      content = content.replace(pattern, `${key}=${value}`)
    }
  }

  // Ensure DB triple consistency
  // Extract password from DATABASE_URL
  const dbUrlMatch = content.match(/DATABASE_URL=postgresql:\/\/[^:]+:([^@]+)@/)
  if (dbUrlMatch) {
    const password = dbUrlMatch[1]
    // URL-decode the password (e.g. %24 = $)
    const decodedPassword = decodeURIComponent(password)

    // Set POSTGRES_PASSWORD and DB_PASSWORD to match DATABASE_URL password
    content = content.replace(
      /POSTGRES_PASSWORD=[^\s]+/,
      `POSTGRES_PASSWORD=${decodedPassword}`
    )
    content = content.replace(
      /DB_PASSWORD=[^\s]+/,
      `DB_PASSWORD=${decodedPassword}`
    )

    console.log(`\n🔐 DB 三元组已统一:`)
    console.log(`   DATABASE_URL password: ${maskSecret(decodedPassword)}`)
    console.log(`   POSTGRES_PASSWORD:     ${maskSecret(decodedPassword)}`)
    console.log(`   DB_PASSWORD:           ${maskSecret(decodedPassword)}`)
  } else {
    console.warn(`⚠️  DATABASE_URL 格式无法解析密码, 请手动确保三元组一致。`)
  }

  // Print generated secrets (masked)
  console.log(`\n🔑 随机密钥已生成:`)
  for (const [key, value] of Object.entries(secrets)) {
    console.log(`   ${key}: ${maskSecret(value)}`)
  }

  // Set NEXT_PUBLIC_API_MODE=api (never mock)
  content = content.replace(
    /NEXT_PUBLIC_API_MODE=mock/,
    "NEXT_PUBLIC_API_MODE=api"
  )

  // Set AUTH_MODE=local (explicit)
  if (!content.includes("AUTH_MODE=local")) {
    content = content.replace(/AUTH_MODE=[^\s]+/, "AUTH_MODE=local")
  }

  // Write back
  writeFileSync(ENV_LOCAL, content, "utf8")
  console.log(`\n✅ ${ENV_LOCAL} 已写入。`)
  console.log(`\n下一步:`)
  console.log(`   1. pnpm env:check          # 验证配置`)
  console.log(`   2. pnpm db:down:volumes    # 清除旧 volume (密码不一致时必须)`)
  console.log(`   3. pnpm db:up              # 启动 PostgreSQL`)
  console.log(`   4. pnpm db:init            # 初始化中心库`)
  console.log(`   5. pnpm smoke:sync         # 验证同步链路`)
  process.exit(0)
}

main()
