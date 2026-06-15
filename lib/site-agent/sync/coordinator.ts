import {
  ALLOWED_PACKAGE_TABLES,
  type AllowedPackageTable,
  type SyncPackagePayload,
} from "../../sync/package-schema"
import { buildSyncPackage } from "./package-builder"
import type {
  AgentSyncState,
  SpoolEntry,
  TaskWatermark,
} from "./types"
import { EMPTY_SYNC_STATE } from "./types"
import { hashRecords } from "./stable-json"
import type { PackageTransportResult } from "./package-transport"
import { PackageTransportError } from "./package-transport"

const SNAPSHOT_TABLES = ALLOWED_PACKAGE_TABLES.filter(
  (table): table is Exclude<AllowedPackageTable, "tbl_task"> =>
    table !== "tbl_task"
)

export interface AgentSyncSource {
  readonly allowedTables: AllowedPackageTable[]
  connect(): Promise<void>
  close(): Promise<void>
  readTaskChanges(
    watermark: TaskWatermark | null,
    overlapMs: number
  ): Promise<Record<string, unknown>[]>
  readSnapshot(
    tableName: AllowedPackageTable
  ): Promise<Record<string, unknown>[]>
}

export interface AgentSyncStore {
  loadState(): Promise<AgentSyncState | null>
  saveState(state: AgentSyncState): Promise<void>
  enqueue(entry: SpoolEntry): Promise<void>
  listPending(): Promise<SpoolEntry[]>
  removePending(batchId: string): Promise<void>
  spoolDepth(): Promise<number>
}

export interface AgentSyncTransport {
  send(payload: SyncPackagePayload): Promise<PackageTransportResult>
}

export interface SyncCoordinatorOptions {
  siteCode: string
  version: string
  overlapMs: number
  retryMaxAttempts: number
  retryBaseMs: number
  retryMaxMs: number
  store: AgentSyncStore
  source: AgentSyncSource
  transport: AgentSyncTransport
  sleep?: (ms: number) => Promise<void>
  now?: () => Date
}

export interface SyncCycleResult {
  status: "success" | "no_change"
  replayed: number
  tableCount: number
  recordCount: number
  lastSyncAt: string | null
}

function cloneEmptyState(): AgentSyncState {
  return {
    ...EMPTY_SYNC_STATE,
    snapshotHashes: {},
  }
}

function dateValue(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }
  if (typeof value === "string") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return null
}

function maxTaskWatermark(
  previous: TaskWatermark | null,
  rows: Record<string, unknown>[]
): TaskWatermark | null {
  let maxId = BigInt(previous?.maxId ?? "0")
  let maxUpdateDt = previous?.maxUpdateDt ?? null
  for (const row of rows) {
    if (row.id !== null && row.id !== undefined) {
      const rowId = BigInt(String(row.id))
      if (rowId > maxId) maxId = rowId
    }
    const updateDt = dateValue(row.update_dt)
    if (updateDt && (!maxUpdateDt || updateDt > maxUpdateDt)) {
      maxUpdateDt = updateDt
    }
  }
  if (!previous && rows.length === 0) return null
  return { maxId: maxId.toString(), maxUpdateDt }
}

function taskWindowRows(
  rows: Record<string, unknown>[],
  watermark: TaskWatermark | null,
  overlapMs: number
): Record<string, unknown>[] {
  if (!watermark?.maxUpdateDt) return []
  const threshold = new Date(watermark.maxUpdateDt).getTime() - overlapMs
  return rows.filter((row) => {
    const updateDt = dateValue(row.update_dt)
    return updateDt !== null && new Date(updateDt).getTime() >= threshold
  })
}

export class SyncCoordinator {
  private readonly sleep: (ms: number) => Promise<void>
  private readonly now: () => Date

  constructor(private readonly options: SyncCoordinatorOptions) {
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    this.now = options.now ?? (() => new Date())
  }

  async syncOnce(input: {
    includeSnapshots: boolean
  }): Promise<SyncCycleResult> {
    const replayed = await this.replayPending()
    const storedState = await this.options.store.loadState()
    const state = storedState ?? cloneEmptyState()
    const bootstrap = storedState === null

    await this.options.source.connect()
    try {
      const taskRows = await this.options.source.readTaskChanges(
        state.taskWatermark,
        this.options.overlapMs
      )
      const nextWatermark = maxTaskWatermark(state.taskWatermark, taskRows)
      const nextTaskWindowHash = hashRecords(
        taskWindowRows(taskRows, nextWatermark, this.options.overlapMs)
      )
      const maxIdAdvanced =
        nextWatermark !== null &&
        BigInt(nextWatermark.maxId) >
          BigInt(state.taskWatermark?.maxId ?? "0")
      const taskChanged =
        bootstrap ||
        maxIdAdvanced ||
        (taskRows.length > 0 &&
          nextTaskWindowHash !== (state.taskWindowHash ?? null))

      const nextSnapshotHashes = { ...state.snapshotHashes }
      const snapshotRows = new Map<
        Exclude<AllowedPackageTable, "tbl_task">,
        Record<string, unknown>[]
      >()
      if (bootstrap || input.includeSnapshots) {
        for (const tableName of SNAPSHOT_TABLES) {
          const rows = await this.options.source.readSnapshot(tableName)
          const hash = hashRecords(rows)
          nextSnapshotHashes[tableName] = hash
          if (bootstrap || state.snapshotHashes[tableName] !== hash) {
            snapshotRows.set(tableName, rows)
          }
        }
      }

      const tables: Parameters<typeof buildSyncPackage>[0]["tables"] = []
      if (taskChanged) {
        tables.push({
          tableName: "tbl_task",
          syncMode: "incremental",
          records: taskRows,
        })
      }
      for (const [tableName, records] of snapshotRows) {
        tables.push({ tableName, syncMode: "full", records })
      }

      if (tables.length === 0) {
        return {
          status: "no_change",
          replayed,
          tableCount: 0,
          recordCount: 0,
          lastSyncAt: state.lastSyncAt,
        }
      }

      const lastSyncAt = this.now().toISOString()
      const nextState: AgentSyncState = {
        version: 1,
        taskWatermark: nextWatermark,
        taskWindowHash: nextTaskWindowHash,
        snapshotHashes: nextSnapshotHashes,
        lastSyncAt,
      }
      const payload = buildSyncPackage({
        siteCode: this.options.siteCode,
        version: this.options.version,
        snapshotAt: lastSyncAt,
        tables,
      })
      const entry: SpoolEntry = {
        payload,
        pendingCommit: { nextState },
      }
      await this.options.store.enqueue(entry)
      await this.sendWithRetry(payload)
      await this.options.store.saveState(nextState)
      await this.options.store.removePending(payload.batchId)

      return {
        status: "success",
        replayed,
        tableCount: tables.length,
        recordCount: tables.reduce(
          (sum, table) => sum + table.records.length,
          0
        ),
        lastSyncAt,
      }
    } finally {
      await this.options.source.close()
    }
  }

  private async replayPending(): Promise<number> {
    const pending = await this.options.store.listPending()
    for (const entry of pending) {
      await this.sendWithRetry(entry.payload)
      await this.options.store.saveState(entry.pendingCommit.nextState)
      await this.options.store.removePending(entry.payload.batchId)
    }
    return pending.length
  }

  private async sendWithRetry(payload: SyncPackagePayload): Promise<void> {
    for (
      let attempt = 1;
      attempt <= this.options.retryMaxAttempts;
      attempt++
    ) {
      try {
        await this.options.transport.send(payload)
        return
      } catch (error) {
        const retryable =
          error instanceof PackageTransportError && error.retryable
        if (!retryable || attempt === this.options.retryMaxAttempts) throw error
        const delay = Math.min(
          this.options.retryBaseMs * 2 ** (attempt - 1),
          this.options.retryMaxMs
        )
        await this.sleep(delay)
      }
    }
  }
}
