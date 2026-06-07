/**
 * Sprint 2H.1 - Package 推送器 (签名 + 推送到总控)
 *
 * 用法:
 *   pnpm push:package exports/SH01/package.json
 *   pnpm push:package exports/SH01/package.json --url http://localhost:3000
 *
 * 行为:
 *   1. 读 package.json
 *   2. 校验 siteCode / batchId / tables
 *   3. 用 SYNC_PACKAGE_SECRET 计算 HMAC-SHA256
 *   4. POST /api/sync/package
 *   5. 打印结果 (HTTP code + body)
 *
 * 关键: 签名内容 = `${timestamp}.${nonce}.${rawBody}` (rawBody 是 bytes)
 * 关键: x-site-code 必须与 payload.siteCode 一致
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { createHmac, randomBytes } from 'crypto'

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnvLocal()

const SECRET = process.env.SYNC_PACKAGE_SECRET
if (!SECRET) {
  console.error('[push-package] 缺少 SYNC_PACKAGE_SECRET (在 .env.local 中设置)')
  process.exit(1)
}

function parseArgs(): { filePath: string; url: string; mode: 'strict' | 'dev' } {
  const args = process.argv.slice(2)
  const filePath = args[0]
  if (!filePath || filePath.startsWith('--')) {
    throw new Error('用法: pnpm push:package <package.json> [--url http://localhost:3000]')
  }
  let url = process.env.SYNC_CONTROL_URL ?? 'http://localhost:3000'
  let mode: 'strict' | 'dev' = (process.env.SYNC_PACKAGE_AUTH_MODE ?? 'strict') as 'strict' | 'dev'
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      url = args[i + 1]
      i++
    }
  }
  return { filePath: resolve(process.cwd(), filePath), url, mode }
}

function buildAuthHeaders(rawBody: string, siteCode: string) {
  const ts = Date.now()
  const nonce = randomBytes(8).toString('hex')
  const signingString = `${ts}.${nonce}.${rawBody}`
  const sig = createHmac('sha256', SECRET!).update(signingString, 'utf8').digest('hex')
  return {
    'Content-Type': 'application/json',
    'x-site-code': siteCode,
    'x-timestamp': String(ts),
    'x-nonce': nonce,
    'x-signature': sig,
  }
}

async function main() {
  const { filePath, url, mode } = parseArgs()
  console.log(`[push-package] file=${filePath}`)
  console.log(`[push-package] url=${url}`)
  console.log(`[push-package] authMode=${mode}`)

  if (!existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }

  // 1. 读 + 校验
  const pkg = JSON.parse(readFileSync(filePath, 'utf8'))
  if (!pkg.siteCode || !pkg.batchId || !Array.isArray(pkg.tables)) {
    throw new Error('package.json 格式错误: 缺 siteCode/batchId/tables')
  }
  if (mode === 'strict' && !pkg.siteCode) {
    throw new Error('strict 模式需要 payload.siteCode')
  }
  console.log(`[push-package] siteCode=${pkg.siteCode}`)
  console.log(`[push-package] batchId=${pkg.batchId}`)
  console.log(`[push-package] tableCount=${pkg.tables.length}`)
  console.log(`[push-package] totalRecords=${pkg.tables.reduce((s: number, t: any) => s + t.records.length, 0)}`)

  // 2. 守门: 不能推 tbl_file / tbl_folder
  for (const t of pkg.tables) {
    if (['tbl_file', 'tbl_folder'].includes(t.tableName)) {
      throw new Error(`拒绝推送: ${t.tableName} 在 FORBIDDEN 列表`)
    }
  }

  // 3. 序列化 + 签名
  const rawBody = JSON.stringify(pkg)
  const headers = buildAuthHeaders(rawBody, pkg.siteCode)

  // 4. POST
  console.log(`\n[push-package] POST ${url}/api/sync/package ...`)
  const res = await fetch(`${url}/api/sync/package`, {
    method: 'POST',
    headers,
    body: rawBody,
  })

  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }

  console.log(`\n=== PUSH RESULT ===`)
  console.log(`  HTTP ${res.status}`)
  console.log(`  body: ${JSON.stringify(body, null, 2)}`)

  if (res.status === 200) {
    console.log(`\n✅ push 成功`)
  } else {
    console.log(`\n❌ push 失败`)
    process.exitCode = 1
  }
}

main().catch(e => {
  console.error('[push-package] failed:', e instanceof Error ? e.message : e)
  process.exitCode = 1
})
