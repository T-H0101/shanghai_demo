/**
 * Aggregate Runner CLI
 * Sprint 2H.3 — 占位表聚合（推送路径已改为只消费 records，本 CLI 不再连 SOURCE_DATABASE_URL）
 *
 * 用法:
 *   pnpm tsx scripts/import-aggregates.ts lib-task [siteCode]
 *   pnpm tsx scripts/import-aggregates.ts volume-slot [siteCode]
 *   pnpm tsx scripts/import-aggregates.ts user-task [siteCode]
 *   pnpm tsx scripts/import-aggregates.ts all [siteCode]
 *
 * 默认 siteCode = SH01
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnvLocal()

import { closePool } from '../lib/db'

const SKIP_MSG =
  'skipped — 已改为仅消费站点推包 records，请通过 syncDB/Agent 推送对应表，总控勿再连 SOURCE_DATABASE_URL'

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--')
  const target = args[0] ?? 'all'
  const siteCode = args[1] ?? 'SH01'

  if (!['lib-task', 'volume-slot', 'user-task', 'all'].includes(target)) {
    console.error('Usage: pnpm tsx scripts/import-aggregates.ts <target> [siteCode]')
    console.error('  targets: lib-task | volume-slot | user-task | all')
    process.exit(1)
  }

  console.log(`[Aggregates] target=${target} siteCode=${siteCode}`)

  try {
    if (target === 'lib-task' || target === 'all') {
      console.log(`[Aggregates] lib-task: ${SKIP_MSG}`)
      if (target === 'all') console.log('')
    }
    if (target === 'volume-slot' || target === 'all') {
      console.log(`[Aggregates] volume-slot: ${SKIP_MSG}`)
      if (target === 'all') console.log('')
    }
    if (target === 'user-task' || target === 'all') {
      console.log(`[Aggregates] user-task: ${SKIP_MSG}`)
    }
  } finally {
    await closePool()
  }
}
main()
