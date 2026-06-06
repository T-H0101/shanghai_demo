/**
 * Import user / site / platform CLI
 * Sprint 2E.2
 *
 * 用法:
 *   pnpm import:users
 *   pnpm import:sites
 *   pnpm import:platforms
 *   pnpm import:user-site-platforms [siteCode]
 *
 * 默认 siteCode = SH01
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import {
  importUsers,
  importSites,
  importPlatforms,
  importUserSitePlatforms,
} from '../lib/import/user-site-platform/importer'
import { closeSourcePool } from '../lib/db/source-pool'
import { closePool } from '../lib/db'

// 加载 .env.local
function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}
loadEnvLocal()

function usage() {
  return [
    'Usage: pnpm import:<target> [siteCode]',
    '  targets: users | sites | platforms | user-site-platforms',
    '  default siteCode: SH01',
    '',
    'Examples:',
    '  pnpm import:users',
    '  pnpm import:user-site-platforms SH01',
  ].join('\n')
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--')
  const target = args[0] ?? 'user-site-platforms'
  const siteCode = args[1] ?? 'SH01'

  if (!['users', 'sites', 'platforms', 'user-site-platforms'].includes(target)) {
    console.error(usage())
    process.exit(1)
  }

  console.log(`[CLI] target=${target} siteCode=${siteCode}`)

  try {
    if (target === 'users') {
      const r = await importUsers(siteCode)
      console.log(`[CLI] users: ${r.readCount} read, ${r.upserted} upserted, ${r.durationMs}ms`)
    } else if (target === 'sites') {
      const r = await importSites(siteCode)
      console.log(`[CLI] sites: ${r.readCount} read, ${r.upserted} upserted, ${r.durationMs}ms`)
    } else if (target === 'platforms') {
      const r = await importPlatforms(siteCode)
      console.log(`[CLI] platforms: ${r.readCount} read, ${r.upserted} upserted, ${r.durationMs}ms`)
    } else {
      const results = await importUserSitePlatforms(siteCode)
      for (const r of results) {
        console.log(`[CLI] ${r.target}: ${r.readCount} read, ${r.upserted} upserted, ${r.durationMs}ms`)
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[CLI] Failed: ${msg}`)
    process.exit(1)
  } finally {
    await closeSourcePool()
    await closePool()
  }
}

main()