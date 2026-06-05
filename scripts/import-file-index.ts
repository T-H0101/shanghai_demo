/**
 * Sprint 2C.18A - guarded file index CLI skeleton.
 *
 * This command only validates arguments and prints the parsed config.
 * It does not read tbl_file/tbl_folder and does not write index tables.
 */

interface FileIndexCliConfig {
  siteCode: string
  taskId: string
  fromId: number
  limit: number
  batchId: string
}

const DEFAULT_LIMIT = 1000
const MAX_LIMIT = 5000

function usage() {
  return [
    'Usage: pnpm import:file-index -- <siteCode> <taskId> [--from-id <id>] [--limit <n>] [--batch-id <batchId>]',
    'Example: pnpm import:file-index -- TEST_CLEAN 1 --from-id 0 --limit 1000',
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

function parsePositiveInt(value: string | undefined, field: string, defaultValue: number): number {
  if (value === undefined) return defaultValue
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer`)
  }
  return parsed
}

export function parseArgs(rawArgs: string[]): FileIndexCliConfig {
  const args = rawArgs.filter((arg) => arg !== '--')
  const positional = args.filter((arg, index) => {
    if (arg.startsWith('--')) return false
    const previous = args[index - 1]
    return previous !== '--from-id' && previous !== '--limit' && previous !== '--batch-id'
  })

  const siteCode = positional[0]
  const taskId = positional[1]
  if (!siteCode || !taskId) {
    throw new Error('siteCode and taskId are required')
  }

  const fromId = parseNonNegativeInt(readOption(args, '--from-id'), 'from-id')
  const limit = parsePositiveInt(readOption(args, '--limit'), 'limit', DEFAULT_LIMIT)
  if (limit > MAX_LIMIT) {
    throw new Error(`limit must be <= ${MAX_LIMIT}`)
  }

  return {
    siteCode,
    taskId,
    fromId,
    limit,
    batchId: readOption(args, '--batch-id') ?? `FILEIDX-${siteCode}-${taskId}-${Date.now()}`,
  }
}

function main() {
  try {
    const config = parseArgs(process.argv.slice(2))
    console.log('[FileIndex] Skeleton only, no tbl_file/tbl_folder touched.')
    console.log('[FileIndex] No source reads, no center writes, no package-log writes.')
    console.log(JSON.stringify(config, null, 2))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[FileIndex] ${message}`)
    console.error(usage())
    process.exit(1)
  }
}

main()
