import { randomBytes } from "node:crypto"
import { Client } from "pg"
import {
  getSiteAgentConfigView,
  type SiteAgentRuntimeConfig,
} from "./config"
import { signSiteAgentRequest } from "./hmac"
import type { AgentSyncStore } from "./sync/coordinator"
import type { FileControlStore } from "./control/file-store"

const HEARTBEAT_PATH = "/api/site-agent/heartbeat"

export interface SiteAgentHeartbeat {
  siteCode: string
  agentId: string
  agentVersion: string
  startedAt: string
  reportedAt: string
  databaseReachable: boolean
  lastSyncAt: string | null
  lastControlAt: string | null
  spoolDepth: number
  capabilities: Record<string, unknown>
}

export interface HeartbeatResult {
  status: number
  dataSource: string
  heartbeat: SiteAgentHeartbeat
}

export interface SiteAgentSyncStatus {
  lastSyncAt: string | null
  spoolDepth: number
}

export interface SiteAgentControlStatus {
  lastControlAt: string | null
}

export async function readSiteAgentSyncStatus(
  store: Pick<AgentSyncStore, "loadState" | "spoolDepth">
): Promise<SiteAgentSyncStatus> {
  const [state, spoolDepth] = await Promise.all([
    store.loadState(),
    store.spoolDepth(),
  ])
  return {
    lastSyncAt: state?.lastSyncAt ?? null,
    spoolDepth,
  }
}

export function getInitialCapabilities(): Record<string, unknown> {
  return {
    task_pause: {
      supported: true,
      adapter: "postgres",
      evidence:
        "tbl_task.status=20 with validated running pre-state",
    },
    task_resume: {
      supported: true,
      adapter: "postgres",
      evidence: "restores persisted pre-pause status",
    },
    task_reset: { supported: false, blocker: "official_semantics_missing" },
    task_priority_restore: {
      supported: false,
      blocker: "blocked_by_source_schema",
    },
    inspect_start: {
      supported: false,
      blocker: "blocked_by_source_schema",
    },
    recovery_start: {
      supported: false,
      blocker: "blocked_by_source_schema",
    },
  }
}

export async function checkSiteDatabase(
  connectionString: string
): Promise<boolean> {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5_000,
  })
  try {
    await client.connect()
    await client.query("SELECT 1")
    return true
  } catch {
    return false
  } finally {
    await client.end().catch(() => undefined)
  }
}

export async function sendSiteAgentHeartbeat(
  config: SiteAgentRuntimeConfig,
  startedAt: string,
  syncStatus: SiteAgentSyncStatus = { lastSyncAt: null, spoolDepth: 0 },
  controlStatus: SiteAgentControlStatus = { lastControlAt: null }
): Promise<HeartbeatResult> {
  const heartbeat: SiteAgentHeartbeat = {
    siteCode: config.siteCode,
    agentId: config.agentId,
    agentVersion: config.agentVersion,
    startedAt,
    reportedAt: new Date().toISOString(),
    databaseReachable: await checkSiteDatabase(config.siteDatabaseUrl),
    lastSyncAt: syncStatus.lastSyncAt,
    lastControlAt: controlStatus.lastControlAt,
    spoolDepth: syncStatus.spoolDepth,
    capabilities: getInitialCapabilities(),
  }
  const rawBody = JSON.stringify(heartbeat)
  const timestamp = String(Date.now())
  const nonce = randomBytes(16).toString("hex")
  const signature = signSiteAgentRequest({
    siteCode: config.siteCode,
    timestamp,
    nonce,
    method: "POST",
    path: HEARTBEAT_PATH,
    rawBody,
    secret: config.secret,
  })

  const response = await fetch(`${config.platformUrl}${HEARTBEAT_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-site-code": config.siteCode,
      "x-agent-timestamp": timestamp,
      "x-agent-nonce": nonce,
      "x-agent-signature": signature,
    },
    body: rawBody,
  })
  const responseBody = (await response.json().catch(() => ({}))) as {
    message?: string
    dataSource?: string
  }
  if (!response.ok) {
    throw new Error(
      `heartbeat rejected: HTTP ${response.status} ${responseBody.message ?? ""}`.trim()
    )
  }

  return {
    status: response.status,
    dataSource: responseBody.dataSource ?? "unknown",
    heartbeat,
  }
}

export function getSafeAgentStartupLog(config: SiteAgentRuntimeConfig) {
  return {
    ...getSiteAgentConfigView(),
    siteCode: config.siteCode,
    agentId: config.agentId,
    agentVersion: config.agentVersion,
    platformUrl: config.platformUrl,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    controlPollIntervalMs: config.controlPollIntervalMs,
    controlLeaseMs: config.controlLeaseMs,
    controlBatchSize: config.controlBatchSize,
  }
}

export async function readSiteAgentControlStatus(
  store: Pick<FileControlStore, "lastControlAt">
): Promise<SiteAgentControlStatus> {
  return { lastControlAt: await store.lastControlAt() }
}
