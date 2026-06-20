import {
  getSiteAgentRuntimeConfig,
  type SiteAgentRuntimeConfig,
} from "../../lib/site-agent/config"
import {
  getSafeAgentStartupLog,
  readSiteAgentControlStatus,
  readSiteAgentSyncStatus,
  sendSiteAgentHeartbeat,
} from "../../lib/site-agent/heartbeat-client"
import { FileSyncStore } from "../../lib/site-agent/sync/file-store"
import { PackageTransport } from "../../lib/site-agent/sync/package-transport"
import { PgSiteSourceReader } from "../../lib/site-agent/sync/source-reader"
import { SyncCoordinator } from "../../lib/site-agent/sync/coordinator"
import { FileControlStore } from "../../lib/site-agent/control/file-store"
import { ControlHttpTransport } from "../../lib/site-agent/control/transport"
import { PostgresSiteActionAdapter } from "../../lib/site-agent/control/postgres-adapter"
import { ControlCoordinator } from "../../lib/site-agent/control/coordinator"

function log(event: string, fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...fields,
    })
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function heartbeatOnce(
  config: SiteAgentRuntimeConfig,
  startedAt: string,
  store: FileSyncStore,
  controlStore: FileControlStore
) {
  const [syncStatus, controlStatus] = await Promise.all([
    readSiteAgentSyncStatus(store),
    readSiteAgentControlStatus(controlStore),
  ])
  const result = await sendSiteAgentHeartbeat(
    config,
    startedAt,
    syncStatus,
    controlStatus
  )
  log("heartbeat_recorded", {
    siteCode: config.siteCode,
    agentId: config.agentId,
    agentVersion: config.agentVersion,
    httpStatus: result.status,
    dataSource: result.dataSource,
    databaseReachable: result.heartbeat.databaseReachable,
    lastSyncAt: result.heartbeat.lastSyncAt,
    lastControlAt: result.heartbeat.lastControlAt,
    spoolDepth: result.heartbeat.spoolDepth,
    capabilities: result.heartbeat.capabilities,
  })
}

async function main() {
  const once = process.argv.includes("--once")
  const config = getSiteAgentRuntimeConfig()
  const startedAt = new Date().toISOString()
  const store = new FileSyncStore(config.stateDir)
  const syncCoordinator = new SyncCoordinator({
    siteCode: config.siteCode,
    version: config.agentVersion,
    overlapMs: config.overlapMs,
    retryMaxAttempts: config.retryMaxAttempts,
    retryBaseMs: config.retryBaseMs,
    retryMaxMs: config.retryMaxMs,
    store,
    source: new PgSiteSourceReader(config.siteDatabaseUrl),
    transport: new PackageTransport(config.platformUrl, config.packageSecret),
  })
  const controlStore = new FileControlStore(config.stateDir)
  const controlCoordinator = new ControlCoordinator({
    store: controlStore,
    transport: new ControlHttpTransport(
      config.platformUrl,
      config.siteCode,
      config.secret
    ),
    adapter: new PostgresSiteActionAdapter(config.siteDatabaseUrl),
    resync: async (input) => {
      return syncCoordinator.syncOnce({
        includeSnapshots: input?.includeSnapshots ?? false,
      })
    },
  })
  let stopping = false

  process.on("SIGINT", () => {
    stopping = true
  })
  process.on("SIGTERM", () => {
    stopping = true
  })

  log("agent_started", getSafeAgentStartupLog(config))
  let nextHeartbeatAt = 0
  let nextControlAt = 0
  let nextTaskSyncAt = 0
  let nextSnapshotSyncAt = 0
  do {
    const now = Date.now()
    const includeSnapshots = now >= nextSnapshotSyncAt
    if (once || now >= nextControlAt) {
      try {
        const result = await controlCoordinator.runOnce(
          config.controlBatchSize
        )
        log("control_cycle_completed", {
          siteCode: config.siteCode,
          replayed: result.replayed,
          polled: result.polled,
          executed: result.executed,
          finalized: result.finalized,
        })
        nextControlAt = Date.now() + config.controlPollIntervalMs
      } catch (error) {
        log("control_cycle_failed", {
          siteCode: config.siteCode,
          message: error instanceof Error ? error.message : "unknown error",
        })
        if (once) throw error
      }
    }
    try {
      if (once || now >= nextTaskSyncAt || includeSnapshots) {
        const result = await syncCoordinator.syncOnce({ includeSnapshots })
        log(
          result.status === "success" ? "sync_completed" : "sync_no_change",
          {
            siteCode: config.siteCode,
            replayed: result.replayed,
            tableCount: result.tableCount,
            recordCount: result.recordCount,
            lastSyncAt: result.lastSyncAt,
          }
        )
        nextTaskSyncAt = Date.now() + config.taskSyncIntervalMs
        if (includeSnapshots) {
          nextSnapshotSyncAt = Date.now() + config.snapshotSyncIntervalMs
        }
      }
    } catch (error) {
      log("sync_failed", {
        siteCode: config.siteCode,
        message: error instanceof Error ? error.message : "unknown error",
      })
      if (once) throw error
    }

    if (once || Date.now() >= nextHeartbeatAt) {
      try {
        await heartbeatOnce(config, startedAt, store, controlStore)
        nextHeartbeatAt = Date.now() + config.heartbeatIntervalMs
      } catch (error) {
        log("heartbeat_failed", {
          siteCode: config.siteCode,
          message: error instanceof Error ? error.message : "unknown error",
        })
        if (once) throw error
      }
    }

    if (!once && !stopping) {
      const nextAt = Math.min(
        nextHeartbeatAt,
        nextControlAt,
        nextTaskSyncAt,
        nextSnapshotSyncAt
      )
      await sleep(Math.max(100, Math.min(nextAt - Date.now(), 1_000)))
    }
  } while (!once && !stopping)

  log("agent_stopped", {
    siteCode: config.siteCode,
    reason: once ? "once_complete" : "signal",
  })
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "agent_failed",
      message: error instanceof Error ? error.message : "unknown error",
    })
  )
  process.exit(1)
})
