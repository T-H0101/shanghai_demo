/**
 * Aggregate Runner CLI
 * Sprint 2H.3 (autonomous) - 跑 3 张占位表的聚合器
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

import { aggregateLibTaskRuntimes } from '../lib/import/lib-task-aggregator'
import { aggregateVolumeSlots } from '../lib/import/volume-slot-aggregator'
import { aggregateUserTasks } from '../lib/import/user-task-aggregator'
import { closeSourcePool } from '../lib/db/source-pool'
import { closePool } from '../lib/db'

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
      const r = await aggregateLibTaskRuntimes(siteCode)
      console.log(
        `[Aggregates] lib-task: read=${r.readCount} distinctTasks=${r.distinctTasks} withRuntime=${r.tasksWithRuntime} updated=${r.unifiedRowsUpdated}/${r.unifiedRowsScanned} ${r.durationMs}ms`
      )
      if (r.perTaskRuntime && r.perTaskRuntime.length > 0) {
        console.log('  top 10:')
        r.perTaskRuntime.forEach((p) =>
          console.log(`    task_id=${p.taskId} runtime=${p.runtimeSeconds}s commands=${p.commandCount}`)
        )
      }
      if (target === 'all') console.log('')
    }
    if (target === 'volume-slot' || target === 'all') {
      const r = await aggregateVolumeSlots(siteCode)
      console.log(
        `[Aggregates] volume-slot: read=${r.readCount} distinctVolumes=${r.distinctVolumes} updated=${r.unifiedRowsUpdated} ${r.durationMs}ms`
      )
      if (r.sample) {
        r.sample.forEach((s) => console.log(`    volume_id=${s.volumeId} slots=${s.slotCount} (online=${s.online} offline=${s.offline})`))
      }
      if (target === 'all') console.log('')
    }
    if (target === 'user-task' || target === 'all') {
      const r = await aggregateUserTasks(siteCode)
      console.log(
        `[Aggregates] user-task: read=${r.readCount} distinctTasks=${r.distinctTasks} users=${r.userIds} updated=${r.unifiedRowsUpdated} ${r.durationMs}ms`
      )
      console.log(`  note: ${r.note}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[Aggregates] Failed: ${msg}`)
    process.exit(1)
  } finally {
    await closeSourcePool()
    await closePool()
  }
}
main()
