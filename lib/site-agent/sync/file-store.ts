import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
} from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import type { AgentSyncState, SpoolEntry } from "./types"

const BATCH_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/

function assertBatchId(batchId: string): void {
  if (!BATCH_ID_PATTERN.test(batchId)) {
    throw new Error(`invalid batchId: ${batchId}`)
  }
}

function assertState(value: unknown): asserts value is AgentSyncState {
  const state = value as AgentSyncState | null
  if (
    !state ||
    state.version !== 1 ||
    (state.taskWatermark !== null &&
      (typeof state.taskWatermark?.maxId !== "string" ||
        (state.taskWatermark.maxUpdateDt !== null &&
          typeof state.taskWatermark.maxUpdateDt !== "string"))) ||
    (state.taskWindowHash !== undefined &&
      state.taskWindowHash !== null &&
      typeof state.taskWindowHash !== "string") ||
    !state.snapshotHashes ||
    typeof state.snapshotHashes !== "object" ||
    (state.lastSyncAt !== null && typeof state.lastSyncAt !== "string")
  ) {
    throw new Error("invalid sync state")
  }
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = join(
    dirname(path),
    `.${basename(path)}.tmp-${process.pid}-${Date.now()}`
  )
  const file = await open(temporaryPath, "wx", 0o600)
  try {
    await file.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8")
    await file.sync()
  } finally {
    await file.close()
  }
  await rename(temporaryPath, path)
  const directory = await open(dirname(path), "r")
  try {
    await directory.sync()
  } finally {
    await directory.close()
  }
}

export class FileSyncStore {
  private readonly statePath: string
  private readonly spoolDir: string

  constructor(private readonly rootDir: string) {
    this.statePath = join(rootDir, "sync-state.json")
    this.spoolDir = join(rootDir, "spool")
  }

  async loadState(): Promise<AgentSyncState | null> {
    let raw: string
    try {
      raw = await readFile(this.statePath, "utf8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
      throw error
    }

    try {
      const parsed: unknown = JSON.parse(raw)
      assertState(parsed)
      return parsed
    } catch (error) {
      throw new Error(
        `failed to load sync state: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      )
    }
  }

  async saveState(state: AgentSyncState): Promise<void> {
    assertState(state)
    await atomicWriteJson(this.statePath, state)
  }

  async enqueue(entry: SpoolEntry): Promise<void> {
    assertBatchId(entry.payload.batchId)
    assertState(entry.pendingCommit.nextState)
    await atomicWriteJson(
      join(this.spoolDir, `${entry.payload.batchId}.json`),
      entry
    )
  }

  async listPending(): Promise<SpoolEntry[]> {
    let files: string[]
    try {
      files = await readdir(this.spoolDir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
      throw error
    }

    const entries: SpoolEntry[] = []
    for (const file of files.filter((name) => name.endsWith(".json")).sort()) {
      const raw = await readFile(join(this.spoolDir, file), "utf8")
      let entry: SpoolEntry
      try {
        entry = JSON.parse(raw) as SpoolEntry
        assertBatchId(entry.payload.batchId)
        assertState(entry.pendingCommit.nextState)
      } catch (error) {
        throw new Error(
          `failed to load spooled package ${file}: ${
            error instanceof Error ? error.message : "unknown error"
          }`
        )
      }
      entries.push(entry)
    }
    return entries
  }

  async removePending(batchId: string): Promise<void> {
    assertBatchId(batchId)
    await rm(join(this.spoolDir, `${batchId}.json`), { force: true })
  }

  async spoolDepth(): Promise<number> {
    return (await this.listPending()).length
  }
}
