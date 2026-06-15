import { resolve } from "node:path"

export interface SiteAgentConfigView {
  siteCode: string
  agentId: string
  agentVersion: string
  platformUrl: string
  siteDatabaseUrlKeyRef: "SITE_DATABASE_URL"
  agentSecretKeyRef: "SITE_AGENT_SECRET"
  agentSecretFallbackKeyRef: "SYNC_PACKAGE_SECRET"
  syncPackageSecretKeyRef: "SYNC_PACKAGE_SECRET"
  stateDirKeyRef: "SITE_AGENT_STATE_DIR"
}

export interface SiteAgentRuntimeConfig {
  siteCode: string
  agentId: string
  agentVersion: string
  platformUrl: string
  heartbeatIntervalMs: number
  controlPollIntervalMs: number
  controlLeaseMs: number
  controlBatchSize: number
  taskSyncIntervalMs: number
  snapshotSyncIntervalMs: number
  retryMaxAttempts: number
  retryBaseMs: number
  retryMaxMs: number
  overlapMs: number
  stateDir: string
  siteDatabaseUrl: string
  secret: string
  packageSecret: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function integerEnv(name: string, fallback: number, minimum: number): number {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`)
  }
  return value
}

export function getSiteAgentConfigView(): SiteAgentConfigView {
  return {
    siteCode: process.env.SITE_CODE ?? "",
    agentId: process.env.SITE_AGENT_ID ?? "",
    agentVersion: process.env.SITE_AGENT_VERSION ?? "dev",
    platformUrl: process.env.PLATFORM_URL ?? "http://localhost:3000",
    siteDatabaseUrlKeyRef: "SITE_DATABASE_URL",
    agentSecretKeyRef: "SITE_AGENT_SECRET",
    agentSecretFallbackKeyRef: "SYNC_PACKAGE_SECRET",
    syncPackageSecretKeyRef: "SYNC_PACKAGE_SECRET",
    stateDirKeyRef: "SITE_AGENT_STATE_DIR",
  }
}

export function getSiteAgentSecret(): string | null {
  return process.env.SITE_AGENT_SECRET ?? process.env.SYNC_PACKAGE_SECRET ?? null
}

export function getSiteAgentRuntimeConfig(): SiteAgentRuntimeConfig {
  const interval = integerEnv(
    "SITE_AGENT_HEARTBEAT_INTERVAL_MS",
    5 * 60 * 1000,
    10_000
  )
  const secret = getSiteAgentSecret()
  if (!secret) {
    throw new Error("SITE_AGENT_SECRET or SYNC_PACKAGE_SECRET is required")
  }
  const packageSecret = requiredEnv("SYNC_PACKAGE_SECRET")

  return {
    siteCode: requiredEnv("SITE_CODE"),
    agentId: requiredEnv("SITE_AGENT_ID"),
    agentVersion: requiredEnv("SITE_AGENT_VERSION"),
    platformUrl: (process.env.PLATFORM_URL ?? "http://localhost:3000").replace(
      /\/+$/,
      ""
    ),
    heartbeatIntervalMs: interval,
    controlPollIntervalMs: integerEnv(
      "SITE_AGENT_CONTROL_POLL_INTERVAL_MS",
      5_000,
      1_000
    ),
    controlLeaseMs: integerEnv(
      "SITE_AGENT_CONTROL_LEASE_MS",
      30_000,
      5_000
    ),
    controlBatchSize: integerEnv(
      "SITE_AGENT_CONTROL_BATCH_SIZE",
      20,
      1
    ),
    taskSyncIntervalMs: integerEnv(
      "SITE_AGENT_TASK_SYNC_INTERVAL_MS",
      5_000,
      1_000
    ),
    snapshotSyncIntervalMs: integerEnv(
      "SITE_AGENT_SNAPSHOT_SYNC_INTERVAL_MS",
      60_000,
      5_000
    ),
    retryMaxAttempts: integerEnv(
      "SITE_AGENT_SYNC_RETRY_MAX_ATTEMPTS",
      5,
      1
    ),
    retryBaseMs: integerEnv("SITE_AGENT_SYNC_RETRY_BASE_MS", 1_000, 0),
    retryMaxMs: integerEnv("SITE_AGENT_SYNC_RETRY_MAX_MS", 30_000, 1),
    overlapMs: integerEnv("SITE_AGENT_SYNC_OVERLAP_MS", 10_000, 0),
    stateDir:
      process.env.SITE_AGENT_STATE_DIR?.trim() ||
      resolve(process.cwd(), ".site-agent-state"),
    siteDatabaseUrl: requiredEnv("SITE_DATABASE_URL"),
    secret,
    packageSecret,
  }
}
