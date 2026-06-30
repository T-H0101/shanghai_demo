/**
 * Sprint 2H.1 - 导出 + 签名 + 推送 一键脚本
 *
 * 用法:
 *   pnpm export-and-push SH01
 *   pnpm export-and-push TEST_CLEAN
 *
 * 行为:
 *   1. 调 export-package (导出到 exports/<site>/package.json)
 *   2. 调 push-package (签名 + POST /api/sync/package)
 *   3. 打印汇总
 */

import { spawnSync } from 'child_process'
import { resolve } from 'path'

function parseArgs(): { siteCode: string; url: string; tables: string[]; all: boolean } {
  const args = process.argv.slice(2)
  const siteCode = args[0]
  if (!siteCode || siteCode.startsWith('--')) {
    throw new Error('用法: pnpm export-and-push <siteCode> [--url ...] [--tables t1,t2] [--all]')
  }
  let url = process.env.SYNC_CONTROL_URL ?? 'http://localhost:3000'
  const tables: string[] = []
  let all = false
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      url = args[i + 1]
      i++
    } else if (args[i] === '--tables' && args[i + 1]) {
      tables.push(args[i + 1])
      i++
    } else if (args[i] === '--all') {
      all = true
    }
  }
  return { siteCode, url, tables, all }
}

function runTsx(script: string, args: string[]) {
  const res = spawnSync('pnpm', ['exec', 'tsx', script, ...args], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  if (res.status !== 0) {
    throw new Error(`${script} 退出码 ${res.status}`)
  }
}

async function main() {
  const { siteCode, url, tables, all } = parseArgs()
  console.log('=========================================')
  console.log(`  Sprint 2H.1 export-and-push ${siteCode}${all ? ' (ALL 141 tables)' : ''}`)
  console.log('=========================================\n')

  // 1. export
  console.log(`[1/2] EXPORT ${siteCode} ...`)
  const exportArgs = [siteCode]
  if (all) exportArgs.push('--all')
  else if (tables.length > 0) exportArgs.push('--tables', tables.join(','))
  runTsx('scripts/export-package.ts', exportArgs)
  console.log('')

  // 2. push
  const pkgPath = resolve(process.cwd(), 'exports', siteCode, 'package.json')
  console.log(`[2/2] PUSH ${pkgPath} ...`)
  runTsx('scripts/push-package.ts', [pkgPath, '--url', url])
  console.log('')

  console.log('=== EXPORT-AND-PUSH DONE ===')
}

main().catch(e => {
  console.error('[export-and-push] failed:', e instanceof Error ? e.message : e)
  process.exitCode = 1
})
