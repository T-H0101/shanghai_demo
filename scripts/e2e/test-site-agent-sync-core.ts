import assert from "node:assert/strict"
import { createServer } from "node:http"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FileSyncStore } from "../../lib/site-agent/sync/file-store"
import {
  SyncCoordinator,
  type AgentSyncSource,
  type AgentSyncTransport,
} from "../../lib/site-agent/sync/coordinator"
import { buildSyncPackage } from "../../lib/site-agent/sync/package-builder"
import {
  PackageTransport,
  PackageTransportError,
} from "../../lib/site-agent/sync/package-transport"
import { PgSiteSourceReader } from "../../lib/site-agent/sync/source-reader"
import { hashRecords } from "../../lib/site-agent/sync/stable-json"
import { readSiteAgentSyncStatus } from "../../lib/site-agent/heartbeat-client"
import type {
  AgentSyncState,
  SpoolEntry,
} from "../../lib/site-agent/sync/types"
import type { SyncPackagePayload } from "../../lib/sync/package-schema"
import { ALLOWED_PACKAGE_TABLES } from "../../lib/sync/package-schema"
import { signSyncPackageBody } from "../../lib/sync/package-auth"

let passed = 0

async function check(name: string, test: () => void | Promise<void>) {
  await test()
  passed++
  console.log(`  PASS ${name}`)
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "site-agent-sync-core-"))
  try {
    await check("stable hash ignores object key and row order", () => {
      const hashA = hashRecords([{ b: 2, a: 1 }, { id: 2 }])
      const hashB = hashRecords([{ id: 2 }, { a: 1, b: 2 }])
      assert.equal(hashA, hashB)
      assert.equal(hashA.length, 64)
    })

    const store = new FileSyncStore(root)
    const state: AgentSyncState = {
      version: 1,
      taskWatermark: {
        maxId: "37",
        maxUpdateDt: "2026-06-15T00:00:00.000Z",
      },
      snapshotHashes: {
        tbl_disc_lib: "abc123",
      },
      lastSyncAt: "2026-06-15T00:00:01.000Z",
    }

    await check("state round trips atomically", async () => {
      await store.saveState(state)
      assert.deepEqual(await store.loadState(), state)
      const files = await readdir(root)
      assert(!files.some((file) => file.includes(".tmp-")))
    })

    const payload: SyncPackagePayload = {
      siteCode: "SH01",
      batchId: "SH01-core-test",
      snapshotAt: "2026-06-15T00:00:01.000Z",
      mode: "mixed",
      version: "r19c",
      checksum: "a".repeat(64),
      tables: [
        {
          tableName: "tbl_task",
          syncMode: "incremental",
          recordCount: 1,
          records: [{ id: 38 }],
        },
      ],
    }

    await check("spool preserves package and pending state commit", async () => {
      const expected: SpoolEntry = {
        payload,
        pendingCommit: { nextState: state },
      }
      await store.enqueue(expected)
      assert.deepEqual(await store.listPending(), [expected])
      assert.equal(await store.spoolDepth(), 1)
      const spoolFiles = await readdir(join(root, "spool"))
      assert(!spoolFiles.some((file) => file.includes(".tmp-")))
      await store.removePending(payload.batchId)
      assert.equal(await store.spoolDepth(), 0)
    })

    await check("invalid batch IDs are rejected", async () => {
      await assert.rejects(
        () =>
          store.enqueue({
            payload: { ...payload, batchId: "../escape" },
            pendingCommit: { nextState: state },
          }),
        /batchId/
      )
    })

    await check("corrupted state fails closed and remains available", async () => {
      const statePath = join(root, "sync-state.json")
      await writeFile(statePath, "{not-json", "utf8")
      await assert.rejects(() => store.loadState(), /sync state/)
      assert.equal(await readFile(statePath, "utf8"), "{not-json")
    })

    const siteDatabaseUrl = process.env.SITE_DATABASE_URL
    assert(siteDatabaseUrl, "SITE_DATABASE_URL is required")
    const reader = new PgSiteSourceReader(siteDatabaseUrl)
    await reader.connect()
    try {
      await check("source reader exposes only package whitelist", () => {
        assert.deepEqual(reader.allowedTables, [...ALLOWED_PACKAGE_TABLES])
      })

      await check("source reader rejects forbidden tables", async () => {
        await assert.rejects(
          () => reader.readSnapshot("tbl_file" as never),
          /not allowed/
        )
      })

      await check("source reader reads real task rows and incremental query", async () => {
        const snapshot = await reader.readSnapshot("tbl_task")
        assert(snapshot.length > 0)
        const changes = await reader.readTaskChanges(null, 10_000)
        assert.equal(changes.length, snapshot.length)
        assert(changes.every((row) => row.id !== undefined))
      })
    } finally {
      await reader.close()
    }

    await check("package builder uses existing schema and SHA-256", () => {
      const built = buildSyncPackage({
        siteCode: "SH01",
        version: "r19c-test",
        snapshotAt: "2026-06-15T00:00:01.000Z",
        tables: [
          {
            tableName: "tbl_task",
            syncMode: "incremental",
            records: [{ id: 38 }],
          },
          {
            tableName: "tbl_disc_lib",
            syncMode: "full",
            records: [{ id: 1 }],
          },
        ],
      })
      assert.equal(built.mode, "mixed")
      assert.equal(built.checksum?.length, 64)
      assert.equal(built.tables[0].recordCount, 1)
      assert(
        !built.tables.some((table) =>
          ["tbl_file", "tbl_folder"].includes(table.tableName)
        )
      )
    })

    await check("package transport signs success and classifies partial", async () => {
      const secret = "r19c-core-secret-value"
      let responseStatus = 200
      let responseBody = {
        status: "success",
        batchId: payload.batchId,
      }
      const server = createServer((request, response) => {
        let rawBody = ""
        request.setEncoding("utf8")
        request.on("data", (chunk) => {
          rawBody += chunk
        })
        request.on("end", () => {
          const timestamp = request.headers["x-timestamp"]
          const nonce = request.headers["x-nonce"]
          assert.equal(request.headers["x-site-code"], "SH01")
          assert.equal(typeof timestamp, "string")
          assert.equal(typeof nonce, "string")
          const expected = signSyncPackageBody({
            rawBody,
            timestamp: timestamp as string,
            nonce: nonce as string,
            secret,
          }).signature
          assert.equal(request.headers["x-signature"], expected)
          response.writeHead(responseStatus, {
            "content-type": "application/json",
          })
          response.end(JSON.stringify(responseBody))
        })
      })
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve)
      )
      try {
        const address = server.address()
        assert(address && typeof address === "object")
        const transport = new PackageTransport(
          `http://127.0.0.1:${address.port}`,
          secret
        )
        const result = await transport.send(payload)
        assert.equal(result.status, "success")

        responseStatus = 207
        responseBody = { status: "partial", batchId: payload.batchId }
        await assert.rejects(
          () => transport.send(payload),
          (error: unknown) =>
            error instanceof PackageTransportError &&
            error.httpStatus === 207 &&
            error.retryable === false
        )
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        )
      }
    })

    await check("coordinator keeps state behind spool and recovers first", async () => {
      const coordinatorRoot = join(root, "coordinator")
      const coordinatorStore = new FileSyncStore(coordinatorRoot)
      let connected = false
      let sourceTaskRows: Record<string, unknown>[] = [
        {
          id: "41",
          create_dt: new Date("2026-06-15T00:00:00.000Z"),
          update_dt: new Date("2026-06-15T00:00:01.000Z"),
          status: 1,
        },
      ]
      const source: AgentSyncSource = {
        allowedTables: [...ALLOWED_PACKAGE_TABLES],
        async connect() {
          connected = true
        },
        async close() {
          connected = false
        },
        async readTaskChanges() {
          assert(connected)
          return sourceTaskRows
        },
        async readSnapshot() {
          assert(connected)
          return []
        },
      }
      let attempts = 0
      let fail = true
      const sent: SyncPackagePayload[] = []
      const transport: AgentSyncTransport = {
        async send(packagePayload) {
          attempts++
          sent.push(packagePayload)
          if (fail) {
            throw new PackageTransportError("offline", true, null)
          }
          return {
            status: attempts === 2 ? "success" : "duplicated",
            httpStatus: 200,
            response: {},
          }
        },
      }
      const coordinator = new SyncCoordinator({
        siteCode: "SH01",
        version: "r19c-test",
        overlapMs: 10_000,
        retryMaxAttempts: 1,
        retryBaseMs: 1,
        retryMaxMs: 1,
        store: coordinatorStore,
        source,
        transport,
        sleep: async () => undefined,
        now: () => new Date("2026-06-15T00:00:02.000Z"),
      })

      await assert.rejects(() => coordinator.syncOnce({ includeSnapshots: true }))
      assert.equal(await coordinatorStore.spoolDepth(), 1)
      assert.equal(await coordinatorStore.loadState(), null)

      fail = false
      const recovered = await coordinator.syncOnce({ includeSnapshots: true })
      assert.equal(recovered.status, "no_change")
      assert.equal(await coordinatorStore.spoolDepth(), 0)
      assert((await coordinatorStore.loadState())?.lastSyncAt)
      assert.equal(attempts, 2)
      assert.equal(sent[0].tables.length, ALLOWED_PACKAGE_TABLES.length)

      const heartbeatStatus = await readSiteAgentSyncStatus(coordinatorStore)
      assert.equal(
        heartbeatStatus.lastSyncAt,
        (await coordinatorStore.loadState())?.lastSyncAt
      )
      assert.equal(heartbeatStatus.spoolDepth, 0)

      const noChange = await coordinator.syncOnce({ includeSnapshots: true })
      assert.equal(noChange.status, "no_change")
      assert.equal(attempts, 2)

      sourceTaskRows = [
        ...sourceTaskRows,
        {
          id: "42",
          create_dt: new Date("2026-06-15T00:00:03.000Z"),
          update_dt: null,
          status: 1,
        },
      ]
      const nullUpdateTask = await coordinator.syncOnce({
        includeSnapshots: false,
      })
      assert.equal(nullUpdateTask.status, "success")
      assert.equal(attempts, 3)
      assert.equal(
        (await coordinatorStore.loadState())?.taskWatermark?.maxId,
        "42"
      )
    })

    console.log(`\nR.19C core: ${passed} passed`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error("R.19C core failed:", error)
  process.exit(1)
})
