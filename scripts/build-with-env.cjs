/**
 * 生产构建: 从 .env.local（或 .env.example）加载配置, 并确保 NEXT_PUBLIC_API_MODE=api 写入客户端 bundle。
 *
 * Next.js 规则: 已在 shell 中导出的环境变量会覆盖 .env.local。
 * 本脚本以 env 文件为准, 避免 root 的 bashrc 里残留 mock 导致前端永远走演示模式。
 *
 * 离线打包说明:
 * - build 需要 env 文件里的 NEXT_PUBLIC_*（可用 .env.example，不必含真实密钥）
 * - 同步到服务器时不要覆盖服务器上的 .env.local（运行时密钥/DB 密码）
 */

const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("fs")
const { spawnSync } = require("child_process")
const { join } = require("path")

const repoRoot = join(__dirname, "..")
const envLocalPath = join(repoRoot, ".env.local")
const envExamplePath = join(repoRoot, ".env.example")

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return null
  }
  const text = readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "")
  const values = {}
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }
  return values
}

const envSource = existsSync(envLocalPath)
  ? envLocalPath
  : existsSync(envExamplePath)
    ? envExamplePath
    : null

if (!envSource) {
  console.error(`[build-with-env] 未找到 .env.local 或 .env.example（目录: ${repoRoot}）`)
  process.exit(1)
}

if (envSource === envExamplePath) {
  console.warn("[build-with-env] 未找到 .env.local，回退使用 .env.example（仅满足 NEXT_PUBLIC_* 构建）")
}

const fileEnv = loadEnvFile(envSource)
if (!fileEnv) {
  console.error(`[build-with-env] 无法读取 ${envSource}`)
  process.exit(1)
}

const shellApiMode = process.env.NEXT_PUBLIC_API_MODE
const fileApiMode = (fileEnv.NEXT_PUBLIC_API_MODE ?? "api").trim() || "api"

if (shellApiMode && shellApiMode.trim() !== fileApiMode) {
  console.warn(
    `[build-with-env] 警告: shell NEXT_PUBLIC_API_MODE=${shellApiMode} 与 ${envSource} (${fileApiMode}) 不一致`,
  )
  console.warn("[build-with-env] 将以 env 文件为准写入客户端 bundle")
}

process.env.NEXT_PUBLIC_API_MODE = fileApiMode

for (const [key, value] of Object.entries(fileEnv)) {
  if (key.startsWith("NEXT_PUBLIC_")) {
    process.env[key] = value
  }
}

console.log(`[build-with-env] 来源: ${envSource}`)
console.log(`[build-with-env] 客户端 API 模式: ${process.env.NEXT_PUBLIC_API_MODE}`)

const result = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "next", "build"], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const stampPath = join(repoRoot, ".next", "BUILD_API_MODE")
mkdirSync(join(repoRoot, ".next"), { recursive: true })
writeFileSync(
  stampPath,
  JSON.stringify(
    {
      nextPublicApiMode: process.env.NEXT_PUBLIC_API_MODE,
      envSource: envSource === envLocalPath ? ".env.local" : ".env.example",
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
  "utf8",
)
console.log(`[build-with-env] 已写入 ${stampPath}`)
