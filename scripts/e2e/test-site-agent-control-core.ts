import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { Client } from "pg"
import { FileControlStore } from "../../lib/site-agent/control/file-store"
import { PostgresSiteActionAdapter } from "../../lib/site-agent/control/postgres-adapter"
import {
  ControlCoordinator,
  type AgentControlStore,
  type ControlTransport,
  type SiteActionAdapter,
} from "../../lib/site-agent/control/coordinator"
import type {
  AgentControlCommand,
  ControlExecution,
  PauseState,
  PendingControlResult,
  SiteActionResult,
} from "../../lib/site-agent/control/types"

let passed = 0

async function check(name: string, test: () => void | Promise<void>) {
  await test()
  passed++
  console.log(`  PASS ${name}`)
}

function command(
  commandType: "task_pause" | "task_resume",
  targetId: string
): AgentControlCommand {
  return {
    id: randomUUID(),
    commandNo: `CTRL-SH01-${Date.now()}`,
    sourceSiteId: "SH01",
    commandType,
    targetType: "task",
    targetId,
    payload: {},
  }
}

async function main() {
  const siteDatabaseUrl = process.env.SITE_DATABASE_URL
  assert(siteDatabaseUrl, "SITE_DATABASE_URL is required")

  const root = await mkdtemp(join(tmpdir(), "site-agent-control-core-"))
  const client = new Client({ connectionString: siteDatabaseUrl })
  await client.connect()
  let taskId: string | null = null
  let blockedTaskId: string | null = null

  try {
    const marker = `R19D-CONTROL-${randomUUID()}`
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO tbl_task(task_type, status, task_name, create_dt, update_dt)
       VALUES (0, 19, $1, NOW(), NOW())
       RETURNING id::text`,
      [marker]
    )
    taskId = inserted.rows[0].id

    const blocked = await client.query<{ id: string }>(
      `INSERT INTO tbl_task(task_type, status, task_name, create_dt, update_dt)
       VALUES (0, 0, $1, NOW(), NOW())
       RETURNING id::text`,
      [`${marker}-BLOCKED`]
    )
    blockedTaskId = blocked.rows[0].id

    const store = new FileControlStore(root)
    const adapter = new PostgresSiteActionAdapter(siteDatabaseUrl)

    await check("execution and result files round trip atomically", async () => {
      const cmd = command("task_pause", taskId!)
      await store.saveExecution(cmd.id, {
        command: cmd,
        executedAt: "2026-06-15T00:00:00.000Z",
        result: {
          status: "success",
          before: { id: taskId!, taskType: 0, status: 19, updateDt: null },
          after: { id: taskId!, taskType: 0, status: 20, updateDt: null },
          previousStatus: 19,
        },
      })
      assert.equal((await store.loadExecution(cmd.id))?.command.id, cmd.id)
      await store.enqueueResult(cmd.id, {
        status: "success",
        before: null,
        after: null,
      })
      assert.equal((await store.listPendingResults()).length, 1)
      await store.removePendingResult(cmd.id)
      assert.equal((await store.listPendingResults()).length, 0)
    })

    await check("invalid persistent IDs fail closed", async () => {
      await assert.rejects(
        () => store.loadExecution("../escape"),
        /invalid control id/
      )
    })

    await check("pause and resume restore exact previous status", async () => {
      const paused = await adapter.execute(command("task_pause", taskId!))
      assert.equal(paused.status, "success")
      assert.equal(paused.before?.status, 19)
      assert.equal(paused.after?.status, 20)
      assert.equal(paused.previousStatus, 19)

      await store.savePauseState(taskId!, {
        targetId: taskId!,
        previousStatus: paused.previousStatus!,
        pausedAt: new Date().toISOString(),
      })
      const pauseState = await store.loadPauseState(taskId!)
      assert.equal(pauseState?.previousStatus, 19)

      const resumed = await adapter.execute(
        command("task_resume", taskId!),
        pauseState ?? undefined
      )
      assert.equal(resumed.status, "success")
      assert.equal(resumed.before?.status, 20)
      assert.equal(resumed.after?.status, 19)
    })

    await check("completed task cannot be paused", async () => {
      const result = await adapter.execute(
        command("task_pause", blockedTaskId!)
      )
      assert.equal(result.status, "unsupported")
      assert.equal(result.before?.status, 0)
    })

    await check("resume without persisted previous status is unsupported", async () => {
      await client.query(
        "UPDATE tbl_task SET status = 20, update_dt = NOW() WHERE id = $1",
        [taskId]
      )
      const result = await adapter.execute(command("task_resume", taskId!))
      assert.equal(result.status, "unsupported")
      assert.match(result.reason ?? "", /previous status/)
    })

    await check("coordinator persists before result and does not re-execute", async () => {
      const events: string[] = []
      const controlCommand = command("task_pause", taskId!)
      const executions = new Map<string, ControlExecution>()
      const pending = new Map<string, SiteActionResult>()
      const pauseStates = new Map<string, PauseState>()
      let adapterExecutionCount = 0
      let failResultUpload = true
      let pollCount = 0

      const memoryStore: AgentControlStore = {
        async loadExecution(id) {
          return executions.get(id) ?? null
        },
        async saveExecution(id, execution) {
          events.push("save_execution")
          executions.set(id, execution)
        },
        async enqueueResult(id, result) {
          events.push("enqueue_result")
          pending.set(id, result)
        },
        async listPendingResults() {
          return [...pending].map(
            ([commandId, result]): PendingControlResult => ({
              commandId,
              result,
            })
          )
        },
        async removePendingResult(id) {
          pending.delete(id)
        },
        async loadPauseState(id) {
          return pauseStates.get(id) ?? null
        },
        async savePauseState(id, state) {
          pauseStates.set(id, state)
        },
        async clearPauseState(id) {
          pauseStates.delete(id)
        },
      }
      const transport: ControlTransport = {
        async poll() {
          pollCount++
          return pollCount === 1 ? [controlCommand] : []
        },
        async ack() {
          events.push("ack")
        },
        async result() {
          events.push("result")
          if (failResultUpload) throw new Error("offline")
        },
      }
      const actionAdapter: SiteActionAdapter = {
        async execute() {
          adapterExecutionCount++
          events.push("execute")
          return {
            status: "success",
            before: {
              id: taskId!,
              taskType: 0,
              status: 19,
              updateDt: null,
            },
            after: {
              id: taskId!,
              taskType: 0,
              status: 20,
              updateDt: null,
            },
            previousStatus: 19,
          }
        },
      }
      const coordinator = new ControlCoordinator({
        store: memoryStore,
        transport,
        adapter: actionAdapter,
        resync: async () => {
          events.push("resync")
        },
      })

      await assert.rejects(() => coordinator.runOnce(20), /offline/)
      assert.deepEqual(events.slice(0, 6), [
        "ack",
        "execute",
        "save_execution",
        "enqueue_result",
        "resync",
        "result",
      ])
      assert.equal(adapterExecutionCount, 1)

      events.length = 0
      failResultUpload = false
      await coordinator.runOnce(20)
      assert.equal(adapterExecutionCount, 1)
      assert.deepEqual(events, ["resync", "result"])
    })

    await check("unsupported commands never reach the SQL adapter", async () => {
      const resetCommand = {
        ...command("task_pause", taskId!),
        commandType: "task_reset",
      }
      let adapterExecutionCount = 0
      const finalResults: SiteActionResult[] = []
      const store = new FileControlStore(join(root, "unsupported"))
      const coordinator = new ControlCoordinator({
        store,
        transport: {
          async poll() {
            return [resetCommand]
          },
          async ack() {},
          async result(_id, result) {
            finalResults.push(result)
          },
        },
        adapter: {
          async execute() {
            adapterExecutionCount++
            throw new Error("must not execute")
          },
        },
        resync: async () => undefined,
      })
      await coordinator.runOnce(20)
      assert.equal(adapterExecutionCount, 0)
      assert.equal(finalResults[0]?.status, "unsupported")
    })

    console.log(`\nR.19D control core: ${passed} passed`)
  } finally {
    if (taskId) {
      await client.query("DELETE FROM tbl_task WHERE id = $1", [taskId])
    }
    if (blockedTaskId) {
      await client.query("DELETE FROM tbl_task WHERE id = $1", [blockedTaskId])
    }
    await client.end()
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error("R.19D control core: FAIL", error)
  process.exit(1)
})
