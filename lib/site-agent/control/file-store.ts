import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
} from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import type {
  ControlExecution,
  PauseState,
  PendingControlResult,
  SiteActionResult,
} from "./types"

const CONTROL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/

function assertControlId(value: string): void {
  if (!CONTROL_ID_PATTERN.test(value)) {
    throw new Error(`invalid control id: ${value}`)
  }
}

function assertObject(value: unknown, label: string): asserts value is object {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`invalid ${label}`)
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

async function readJson(path: string, label: string): Promise<unknown | null> {
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
  try {
    return JSON.parse(raw) as unknown
  } catch (error) {
    throw new Error(
      `failed to load ${label}: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    )
  }
}

export class FileControlStore {
  private readonly executionsDir: string
  private readonly resultsDir: string
  private readonly pausedDir: string

  constructor(rootDir: string) {
    const controlDir = join(rootDir, "control")
    this.executionsDir = join(controlDir, "executions")
    this.resultsDir = join(controlDir, "results")
    this.pausedDir = join(controlDir, "paused")
  }

  async loadExecution(commandId: string): Promise<ControlExecution | null> {
    assertControlId(commandId)
    const value = await readJson(
      join(this.executionsDir, `${commandId}.json`),
      "control execution"
    )
    if (value === null) return null
    assertObject(value, "control execution")
    const execution = value as ControlExecution
    if (
      !execution.command ||
      execution.command.id !== commandId ||
      typeof execution.executedAt !== "string" ||
      !execution.result
    ) {
      throw new Error("invalid control execution")
    }
    return execution
  }

  async saveExecution(
    commandId: string,
    execution: ControlExecution
  ): Promise<void> {
    assertControlId(commandId)
    if (execution.command.id !== commandId) {
      throw new Error("control execution command ID mismatch")
    }
    await atomicWriteJson(
      join(this.executionsDir, `${commandId}.json`),
      execution
    )
  }

  async enqueueResult(
    commandId: string,
    result: SiteActionResult
  ): Promise<void> {
    assertControlId(commandId)
    await atomicWriteJson(join(this.resultsDir, `${commandId}.json`), {
      commandId,
      result,
    } satisfies PendingControlResult)
  }

  async listPendingResults(): Promise<PendingControlResult[]> {
    let files: string[]
    try {
      files = await readdir(this.resultsDir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
      throw error
    }

    const entries: PendingControlResult[] = []
    for (const file of files.filter((name) => name.endsWith(".json")).sort()) {
      const commandId = file.slice(0, -5)
      assertControlId(commandId)
      const value = await readJson(
        join(this.resultsDir, file),
        `pending control result ${file}`
      )
      assertObject(value, "pending control result")
      const entry = value as PendingControlResult
      if (entry.commandId !== commandId || !entry.result) {
        throw new Error(`invalid pending control result ${file}`)
      }
      entries.push(entry)
    }
    return entries
  }

  async removePendingResult(commandId: string): Promise<void> {
    assertControlId(commandId)
    await rm(join(this.resultsDir, `${commandId}.json`), { force: true })
  }

  async loadPauseState(targetId: string): Promise<PauseState | null> {
    assertControlId(targetId)
    const value = await readJson(
      join(this.pausedDir, `${targetId}.json`),
      "pause state"
    )
    if (value === null) return null
    assertObject(value, "pause state")
    const state = value as PauseState
    if (
      state.targetId !== targetId ||
      !Number.isInteger(state.previousStatus) ||
      typeof state.pausedAt !== "string"
    ) {
      throw new Error("invalid pause state")
    }
    return state
  }

  async savePauseState(targetId: string, state: PauseState): Promise<void> {
    assertControlId(targetId)
    if (state.targetId !== targetId || !Number.isInteger(state.previousStatus)) {
      throw new Error("invalid pause state")
    }
    await atomicWriteJson(join(this.pausedDir, `${targetId}.json`), state)
  }

  async clearPauseState(targetId: string): Promise<void> {
    assertControlId(targetId)
    await rm(join(this.pausedDir, `${targetId}.json`), { force: true })
  }

  async lastControlAt(): Promise<string | null> {
    let files: string[]
    try {
      files = await readdir(this.executionsDir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
      throw error
    }

    let latest: string | null = null
    for (const file of files.filter((name) => name.endsWith(".json"))) {
      const commandId = file.slice(0, -5)
      const execution = await this.loadExecution(commandId)
      if (
        execution &&
        (!latest || execution.executedAt > latest)
      ) {
        latest = execution.executedAt
      }
    }
    return latest
  }
}
