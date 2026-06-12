export interface SiteAgentConfigView {
  siteCode: string
  agentId: string
  agentVersion: string
  platformUrl: string
  siteDatabaseUrlKeyRef: "SITE_DATABASE_URL"
  agentSecretKeyRef: "SITE_AGENT_SECRET"
  agentSecretFallbackKeyRef: "SYNC_PACKAGE_SECRET"
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
