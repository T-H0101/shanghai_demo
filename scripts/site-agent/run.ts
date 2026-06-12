import {
  getSiteAgentRuntimeConfig,
  type SiteAgentRuntimeConfig,
} from "../../lib/site-agent/config"
import {
  getSafeAgentStartupLog,
  sendSiteAgentHeartbeat,
} from "../../lib/site-agent/heartbeat-client"

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
  startedAt: string
) {
  const result = await sendSiteAgentHeartbeat(config, startedAt)
  log("heartbeat_recorded", {
    siteCode: config.siteCode,
    agentId: config.agentId,
    agentVersion: config.agentVersion,
    httpStatus: result.status,
    dataSource: result.dataSource,
    databaseReachable: result.heartbeat.databaseReachable,
    capabilities: result.heartbeat.capabilities,
  })
}

async function main() {
  const once = process.argv.includes("--once")
  const config = getSiteAgentRuntimeConfig()
  const startedAt = new Date().toISOString()
  let stopping = false

  process.on("SIGINT", () => {
    stopping = true
  })
  process.on("SIGTERM", () => {
    stopping = true
  })

  log("agent_started", getSafeAgentStartupLog(config))
  do {
    try {
      await heartbeatOnce(config, startedAt)
    } catch (error) {
      log("heartbeat_failed", {
        siteCode: config.siteCode,
        message: error instanceof Error ? error.message : "unknown error",
      })
      if (once) throw error
    }
    if (!once && !stopping) {
      await sleep(config.heartbeatIntervalMs)
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
