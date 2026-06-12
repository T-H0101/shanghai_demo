export interface SiteAgentConfigView {
  siteCode: string
  agentId: string
  agentVersion: string
  platformUrl: string
  siteDatabaseUrlKeyRef: "SITE_DATABASE_URL"
  agentSecretKeyRef: "SITE_AGENT_SECRET"
  agentSecretFallbackKeyRef: "SYNC_PACKAGE_SECRET"
}

export interface SiteAgentRuntimeConfig {
  siteCode: string
  agentId: string
  agentVersion: string
  platformUrl: string
  heartbeatIntervalMs: number
  siteDatabaseUrl: string
  secret: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
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
  }
}

export function getSiteAgentSecret(): string | null {
  return process.env.SITE_AGENT_SECRET ?? process.env.SYNC_PACKAGE_SECRET ?? null
}

export function getSiteAgentRuntimeConfig(): SiteAgentRuntimeConfig {
  const interval = Number(
    process.env.SITE_AGENT_HEARTBEAT_INTERVAL_MS ?? 5 * 60 * 1000
  )
  if (!Number.isInteger(interval) || interval < 10_000) {
    throw new Error(
      "SITE_AGENT_HEARTBEAT_INTERVAL_MS must be an integer >= 10000"
    )
  }
  const secret = getSiteAgentSecret()
  if (!secret) {
    throw new Error("SITE_AGENT_SECRET or SYNC_PACKAGE_SECRET is required")
  }

  return {
    siteCode: requiredEnv("SITE_CODE"),
    agentId: requiredEnv("SITE_AGENT_ID"),
    agentVersion: requiredEnv("SITE_AGENT_VERSION"),
    platformUrl: (process.env.PLATFORM_URL ?? "http://localhost:3000").replace(
      /\/+$/,
      ""
    ),
    heartbeatIntervalMs: interval,
    siteDatabaseUrl: requiredEnv("SITE_DATABASE_URL"),
    secret,
  }
}
