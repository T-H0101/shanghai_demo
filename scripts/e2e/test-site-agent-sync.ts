import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Client } from "pg"
import { SyncCoordinator, type AgentSyncTransport } from "../../lib/site-agent/sync/coordinator"
import { FileSyncStore } from "../../lib/site-agent/sync/file-store"
import { PackageTransport } from "../../lib/site-agent/sync/package-transport"
import { PgSiteSourceReader } from "../../lib/site-agent/sync/source-reader"
import type { SyncPackagePayload } from "../../lib/sync/package-schema"

const databaseUrl = process.env.DATABASE_URL
const siteDatabaseUrl = process.env.SITE_DATABASE_URL
const secret = process.env.SYNC_PACKAGE_SECRET
const baseUrl = (process.env.BASE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  ""
)

assert(databaseUrl, "DATABASE_URL is required")
assert(siteDatabaseUrl, "SITE_DATABASE_URL is required")
assert(secret, "SYNC_PACKAGE_SECRET is required")

let passed = 0

function check(name: string, condition: unknown, detail: string) {
  assert(condition, `${name}: ${detail}`)
  passed++
  console.log(`  PASS ${name}: ${detail}`)
}

class RecordingTransport implements AgentSyncTransport {
  readonly payloads: SyncPackagePayload[] = []

  constructor(private readonly delegate: PackageTransport) {}

  async send(payload: SyncPackagePayload) {
    this.payloads.push(payload)
    return this.delegate.send(payload)
  }
}

async function cleanupSite(client: Client, siteCode: string) {
  await client.query("DELETE FROM sync_package_log WHERE site_code = $1", [
    siteCode,
  ])
  const columns = await client.query<{
    table_name: string
    column_name: string
  }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name LIKE 'unified_%'
       AND column_name IN ('source_site_id', 'site_code')
     ORDER BY table_name, column_name`
  )
  const byTable = new Map<string, string[]>()
  for (const row of columns.rows) {
    const tableColumns = byTable.get(row.table_name) ?? []
    tableColumns.push(row.column_name)
    byTable.set(row.table_name, tableColumns)
  }
  for (const [tableName, tableColumns] of byTable) {
    const predicate = tableColumns
      .map((column, index) => `"${column}" = $${index + 1}`)
      .join(" OR ")
    await client.query(
      `DELETE FROM "${tableName}" WHERE ${predicate}`,
      tableColumns.map(() => siteCode)
    )
  }
}

async function packageCount(client: Client, siteCode: string) {
  const result = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM sync_package_log WHERE site_code = $1",
    [siteCode]
  )
  return Number(result.rows[0].count)
}

function coordinatorFor(input: {
  siteCode: string
  stateDir: string
  platformUrl: string
  transport?: AgentSyncTransport
}) {
  return new SyncCoordinator({
    siteCode: input.siteCode,
    version: "r19c-e2e",
    overlapMs: 10_000,
    retryMaxAttempts: 1,
    retryBaseMs: 1,
    retryMaxMs: 1,
    store: new FileSyncStore(input.stateDir),
    source: new PgSiteSourceReader(siteDatabaseUrl!),
    transport:
      input.transport ?? new PackageTransport(input.platformUrl, secret!),
  })
}

async function main() {
  const siteCode = `R19C${Date.now()}`
  const stateDir = await mkdtemp(join(tmpdir(), "r19c-site-agent-e2e-"))
  const center = new Client({ connectionString: databaseUrl })
  await center.connect()

  try {
    await cleanupSite(center, siteCode)
    const store = new FileSyncStore(stateDir)
    const recording = new RecordingTransport(
      new PackageTransport(baseUrl, secret!)
    )
    const coordinator = coordinatorFor({
      siteCode,
      stateDir,
      platformUrl: baseUrl,
      transport: recording,
    })

    const bootstrap = await coordinator.syncOnce({ includeSnapshots: true })
    check("bootstrap succeeds", bootstrap.status === "success", bootstrap.status)
    check("bootstrap contains 13 tables", bootstrap.tableCount === 13, String(bootstrap.tableCount))

    const packageRow = await center.query<{
      status: string
      table_count: number
      success_table_count: number
    }>(
      `SELECT status, table_count, success_table_count
       FROM sync_package_log
       WHERE site_code = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [siteCode]
    )
    check(
      "center package log succeeds",
      packageRow.rows[0]?.status === "success",
      packageRow.rows[0]?.status ?? "missing"
    )
    check(
      "center writes 13 successful table logs",
      packageRow.rows[0]?.table_count === 13 &&
        packageRow.rows[0]?.success_table_count === 13,
      JSON.stringify(packageRow.rows[0] ?? {})
    )

    const beforeNoChange = await packageCount(center, siteCode)
    const noChange = await coordinator.syncOnce({ includeSnapshots: true })
    const afterNoChange = await packageCount(center, siteCode)
    check("no-change skips package", noChange.status === "no_change", noChange.status)
    check("no-change leaves package count", beforeNoChange === afterNoChange, `${beforeNoChange}`)

    const current = await store.loadState()
    assert(current)
    await store.saveState({
      ...current,
      taskWatermark: { maxId: "0", maxUpdateDt: null },
      taskWindowHash: "force-task-incremental",
    })
    const incremental = await coordinator.syncOnce({ includeSnapshots: false })
    check("task incremental succeeds", incremental.status === "success", incremental.status)
    const incrementalPayload = recording.payloads.at(-1)
    check(
      "task incremental sends only tbl_task",
      incrementalPayload?.tables.length === 1 &&
        incrementalPayload.tables[0].tableName === "tbl_task" &&
        incrementalPayload.tables[0].syncMode === "incremental" &&
        incrementalPayload.tables[0].recordCount > 0,
      JSON.stringify(
        incrementalPayload?.tables.map((table) => ({
          tableName: table.tableName,
          syncMode: table.syncMode,
          recordCount: table.recordCount,
        })) ?? []
      )
    )

    const beforeOutage = await store.loadState()
    assert(beforeOutage)
    await store.saveState({
      ...beforeOutage,
      snapshotHashes: {
        ...beforeOutage.snapshotHashes,
        tbl_site: "force-outage-package",
      },
    })
    const offline = coordinatorFor({
      siteCode,
      stateDir,
      platformUrl: "http://127.0.0.1:1",
    })
    await assert.rejects(() => offline.syncOnce({ includeSnapshots: true }))
    check("offline package remains spooled", (await store.spoolDepth()) === 1, "depth=1")

    const recoveryRecording = new RecordingTransport(
      new PackageTransport(baseUrl, secret!)
    )
    const recovery = coordinatorFor({
      siteCode,
      stateDir,
      platformUrl: baseUrl,
      transport: recoveryRecording,
    })
    const recovered = await recovery.syncOnce({ includeSnapshots: true })
    check("recovery replays before new work", recovered.replayed === 1, `replayed=${recovered.replayed}`)
    check("recovery drains spool", (await store.spoolDepth()) === 0, "depth=0")

    const replayPayload = recoveryRecording.payloads[0]
    assert(replayPayload)
    const duplicate = await new PackageTransport(baseUrl, secret!).send(
      replayPayload
    )
    check("same batch is idempotent", duplicate.status === "duplicated", duplicate.status)

    const taskCount = await center.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM unified_tasks WHERE source_site_id = $1",
      [siteCode]
    )
    check(
      "real task rows reach center",
      Number(taskCount.rows[0].count) > 0,
      taskCount.rows[0].count
    )

    console.log(`\nR.19C Site Agent sync e2e: ${passed} passed`)
  } finally {
    await cleanupSite(center, siteCode).catch((error) => {
      console.error("cleanup failed:", error)
    })
    await center.end()
    await rm(stateDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error("R.19C Site Agent sync e2e failed:", error)
  process.exit(1)
})
