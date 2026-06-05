/**
 * Sprint 2C.18B - File Index CLI
 *
 * Usage: pnpm import:file-index -- <siteCode> <taskId> [--from-id <id>] [--limit <n>] [--batch-id <batchId>]
 * Example: pnpm import:file-index -- TEST_CLEAN 1 --from-id 0 --limit 1000
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

import { importFileIndex } from '../lib/import/file-index/file-index-importer'
import { closeSourcePool } from '../lib/db/source-pool'
import { closePool } from '../lib/db'

const DEFAULT_LIMIT = 1000
const MAX_LIMIT = 5000

function usage() {
  return [
    'Usage: pnpm import:file-index -- <siteCode> <taskId> [--from-id <id>] [--limit <n>] [--batch-id <batchId>]',
    'Example: pnpm import:file-index -- TEST_CLEAN 1 --from-id 0 --limit 1000',
    '',
    'Arguments:',
    '  siteCode  (required) - Site code, e.g., TEST_CLEAN',
    '  taskId    (required) - Task ID to index',
    '  --from-id (optional) - Starting ID (watermark), default: 0',
    '  --limit   (optional) - Max records to import, max: 5000, default: 1000',
    '  --batch-id (optional) - Custom batch ID, auto-generated if not provided',
  ].join('\n')
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}

function parseNonNegativeInt(value: string | undefined, field: string): number {
  if (value === undefined) return 0
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${field} must be a non-negative integer`)
  }
  return parsed
}

function parsePositiveInt(
  value: string | undefined,
  field: string,
  defaultValue: number
): number {
  if (value === undefined) return defaultValue
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer`)
  }
  return parsed
}

interface FileIndexCliConfig {
  siteCode: string
  taskId: string
  fromId: number
  limit: number
  batchId: string
}

function parseArgs(rawArgs: string[]): FileIndexCliConfig {
  const args = rawArgs.filter((arg) => arg !== '--')
  const positional = args.filter((arg, index) => {
    if (arg.startsWith('--')) return false
    const previous = args[index - 1]
    return (
      previous !== '--from-id' &&
      previous !== '--limit' &&
      previous !== '--batch-id'
    )
  })

  const siteCode = positional[0]
  const taskId = positional[1]

  // Guard: 必须提供 siteCode 和 taskId
  if (!siteCode || !taskId) {
    throw new Error('siteCode and taskId are required')
  }

  const fromId = parseNonNegativeInt(readOption(args, '--from-id'), 'from-id')
  const limit = parsePositiveInt(
    readOption(args, '--limit'),
    'limit',
    DEFAULT_LIMIT
  )

  // Guard: limit 不能超过 5000
  if (limit > MAX_LIMIT) {
    throw new Error(`limit must be <= ${MAX_LIMIT}`)
  }

  return {
    siteCode,
    taskId,
    fromId,
    limit,
    batchId:
      readOption(args, '--batch-id') ??
      `FILEIDX-${siteCode}-${taskId}-${Date.now()}`,
  }
}

async function main() {
  try {
    const config = parseArgs(process.argv.slice(2))
    console.log('[FileIndex] CLI starting...')
    console.log(`[FileIndex] Config: ${JSON.stringify(config, null, 2)}`)

    const result = await importFileIndex(config)

    console.log(`[FileIndex] Result: ${JSON.stringify(result, null, 2)}`)

    if (result.status === 'failed') {
      console.error(`[FileIndex] Import failed: ${result.errorMessage}`)
      process.exit(1)
    }

    console.log('[FileIndex] CLI completed successfully')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[FileIndex] ${message}`)
    console.error(usage())
    process.exit(1)
  } finally {
    // 确保关闭数据库连接
    await closePool()
    await closeSourcePool()
  }
}

main()