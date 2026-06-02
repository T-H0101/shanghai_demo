/**
 * Import from source_restore CLI
 * Sprint 2B.12 - 真实 source_restore Import 试点
 *
 * 用法：
 *   pnpm import:tasks
 *   pnpm import:devices SH01
 *   pnpm import:all -- SH01
 *
 * 默认 siteCode = SH01
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// 手动加载 .env.local（tsx 不自动加载）
function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvLocal()

import { importTasks } from '../lib/import/task-importer'
import { importDevices } from '../lib/import/device-importer'
import { closeSourcePool } from '../lib/db/source-pool'
import { closePool } from '../lib/db'

async function main() {
  // 过滤掉 pnpm 传入的 "--" 分隔符
  const args = process.argv.slice(2).filter((a) => a !== '--')
  const command = args[0]
  const siteCode = args[1] || 'SH01'

  if (!command || !['tasks', 'devices', 'all'].includes(command)) {
    console.error('Usage: pnpm import:tasks [siteCode]')
    console.error('       pnpm import:devices [siteCode]')
    console.error('       pnpm import:all [siteCode]')
    console.error('  Default siteCode: SH01')
    process.exit(1)
  }

  try {
    if (command === 'tasks' || command === 'all') {
      await importTasks(siteCode)
      if (command === 'all') console.log('')
    }
    if (command === 'devices' || command === 'all') {
      await importDevices(siteCode)
    }
  } catch (error) {
    console.error('[Import] Fatal error:', error)
    process.exit(1)
  } finally {
    await closeSourcePool()
    await closePool()
  }
}

main()
