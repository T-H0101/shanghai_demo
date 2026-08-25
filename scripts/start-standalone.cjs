/**
 * 无 bash 时用 Node 启动 standalone，并加载项目根 .env.local
 *
 * 用法:
 *   node scripts/start-standalone.cjs
 *   ./node/node scripts/start-standalone.cjs
 */

const { existsSync, readFileSync, cpSync, rmSync, mkdirSync } = require('fs')
const { spawn } = require('child_process')
const { join, dirname } = require('path')

const repoRoot = join(__dirname, '..')
const envFile = join(repoRoot, '.env.local')
const standaloneDir = join(repoRoot, '.next', 'standalone')
const serverJs = join(standaloneDir, 'server.js')

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    console.error(`[start-standalone] 未找到 .env.local: ${filePath}`)
    console.error('[start-standalone] 请先在项目根执行: pnpm env:init')
    process.exit(1)
  }
  const text = readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

function prepareAssets() {
  const staticSrc = join(repoRoot, '.next', 'static')
  const staticDest = join(standaloneDir, '.next', 'static')
  const publicSrc = join(repoRoot, 'public')
  const publicDest = join(standaloneDir, 'public')
  if (!existsSync(staticSrc)) {
    console.error('[start-standalone] 缺少 .next/static，请先 pnpm build')
    process.exit(1)
  }
  mkdirSync(join(standaloneDir, '.next'), { recursive: true })
  rmSync(staticDest, { recursive: true, force: true })
  cpSync(staticSrc, staticDest, { recursive: true })
  if (existsSync(publicSrc)) {
    rmSync(publicDest, { recursive: true, force: true })
    cpSync(publicSrc, publicDest, { recursive: true })
  }
  console.log('[start-standalone] 已同步 static / public 到 standalone 目录')
}

if (!existsSync(serverJs)) {
  console.error(`[start-standalone] 未找到 ${serverJs}，请先 pnpm build`)
  process.exit(1)
}

loadEnvFile(envFile)

// Next.js standalone 用 HOSTNAME 表示监听地址；勿沿用系统 HOSTNAME（常为 localhost）。
const bindFromEnv = (process.env.BIND_HOST || process.env.HOST || '').trim()
process.env.HOSTNAME = bindFromEnv || '0.0.0.0'
process.env.PORT = process.env.PORT || '3000'
process.env.NODE_ENV = process.env.NODE_ENV || 'production'

if (!existsSync(join(standaloneDir, '.next', 'static')) || !existsSync(join(standaloneDir, 'public'))) {
  prepareAssets()
}

for (const key of ['DATABASE_URL', 'SYNC_PACKAGE_SECRET']) {
  if (!process.env[key]) {
    console.error(`[start-standalone] .env.local 缺少 ${key}`)
    process.exit(1)
  }
}

console.log(`[start-standalone] repo=${repoRoot}`)
console.log(`[start-standalone] env=${envFile}`)
console.log(`[start-standalone] listen=http://${process.env.HOSTNAME}:${process.env.PORT}`)
const pub = (process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim()
if (!pub) {
  console.warn(
    '[start-standalone] 警告: 未设 PUBLIC_APP_URL。HOSTNAME=0.0.0.0 时登录/OIDC/站点回跳不能用监听地址。请设为浏览器可打开的 https://IP或域名:对外端口',
  )
} else if (pub.includes('0.0.0.0')) {
  console.warn(
    '[start-standalone] 警告: PUBLIC_APP_URL 含 0.0.0.0，浏览器无法打开。请改为对外真实地址',
  )
} else {
  console.log(`[start-standalone] PUBLIC_APP_URL=${pub} (对外 Origin)`)
}
console.log(`[start-standalone] SYNC_PACKAGE_SECRET len=${process.env.SYNC_PACKAGE_SECRET.length}`)
console.log('[start-standalone] 提示: 请用本脚本启动；直接 node .next/standalone/server.js 不会加载 .env.local')

const child = spawn(process.execPath, ['server.js'], {
  cwd: standaloneDir,
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
