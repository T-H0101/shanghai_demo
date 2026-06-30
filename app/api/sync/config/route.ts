import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSafeAuthConfig } from "@/lib/auth/config"

export const dynamic = "force-dynamic"

interface SyncSiteRow {
  site_code: string
  site_name: string
  enabled: boolean
  sync_interval_seconds: number
  status: string
  credential_ref: string | null
  last_connected_at: string | null
  agent_id: string | null
  agent_version: string | null
  agent_reported_at: string | null
  agent_database_reachable: boolean | null
  scheduler_status: string | null
  scheduler_started_at: string | null
}

const SAFE_ENV_KEY_REFS = [
  "DATABASE_URL",
  "SOURCE_DATABASE_URL",
  "SITE_DATABASE_URL",
  "SYNC_PACKAGE_AUTH_MODE",
  "SYNC_PACKAGE_SECRET",
  "SITE_WORKER_SITE_CODE",
  "SITE_WORKER_POLL_INTERVAL_MS",
  "SITE_WORKER_DRY_RUN",
  "SITE_AGENT_SECRET",
] as const

const ENV_REF_GROUP = {
  databaseUrl: "DATABASE_URL",
  sourceDatabaseUrl: "SOURCE_DATABASE_URL",
  siteDatabaseUrl: "SITE_DATABASE_URL",
  siteAgentSecret: "SITE_AGENT_SECRET",
  syncPackageSecret: "SYNC_PACKAGE_SECRET",
} as const

function agentStatusFromRow(row: Pick<SyncSiteRow, "agent_reported_at" | "agent_database_reachable">): string {
  if (!row.agent_reported_at) return "not_registered"
  const ageMs = Date.now() - Date.parse(row.agent_reported_at)
  if (ageMs <= 5 * 60 * 1000) {
    return row.agent_database_reachable ? "online" : "degraded"
  }
  if (ageMs <= 15 * 60 * 1000) return "stale"
  return "offline"
}

function schedulerEnabledFromRow(row: Pick<SyncSiteRow, "enabled" | "scheduler_status">): boolean {
  if (!row.enabled) return false
  if (!row.scheduler_status) return false
  return row.scheduler_status !== "disabled"
}

export async function GET() {
  try {
    const result = await query<SyncSiteRow>(
      `SELECT
         s.site_code,
         s.site_name,
         s.enabled,
         s.sync_interval_seconds,
         s.status,
         s.credential_ref,
         s.last_connected_at::text,
         agent.agent_id,
         agent.agent_version,
         agent.reported_at::text AS agent_reported_at,
         agent.database_reachable AS agent_database_reachable,
         scheduler.status AS scheduler_status,
         scheduler.started_at::text AS scheduler_started_at
       FROM sync_sites s
       LEFT JOIN site_agent_runtime agent ON agent.site_code = s.site_code
       LEFT JOIN LATERAL (
         SELECT status, started_at
         FROM sync_scheduler_log
         WHERE site_code = s.site_code
         ORDER BY started_at DESC
         LIMIT 1
       ) scheduler ON TRUE
       ORDER BY s.site_code`
    )

    const sites = result.rows.map((row) => ({
      siteCode: row.site_code,
      siteName: row.site_name,
      enabled: row.enabled,
      intervalSeconds: row.sync_interval_seconds,
      status: row.status,
      credentialKeyRef: row.credential_ref,
      lastConnectedAt: row.last_connected_at,
      schedulerEnabled: schedulerEnabledFromRow(row),
      agentStatus: agentStatusFromRow(row),
      agentVersion: row.agent_version,
      agentReportedAt: row.agent_reported_at,
      provenance: "central_configuration_with_latest_runtime_logs",
    }))

    return NextResponse.json({
      code: 0,
      message: "ok",
      source: "sync_sites",
      data: {
        sites,
        scheduler: {
          intervalMinutes: 60,
          source: "center_config",
          note: "每 60 分钟触发一次全量同步；个别站点可在中心配置覆盖同步周期",
        },
        envKeyRefs: SAFE_ENV_KEY_REFS.map((key) => ({
          key,
          configured: Boolean(process.env[key]),
        })),
        envRefs: ENV_REF_GROUP,
        runtime: {
          schedulerMode: "external_process",
          defaultIntervalSeconds: 3600,
          envKeyRefs: SAFE_ENV_KEY_REFS.map((key) => ({
            key,
            configured: Boolean(process.env[key]),
          })),
        },
        auth: getSafeAuthConfig(),
        reality: {
          sourceEvidence: false,
          note: "同步策略由总控统一管理。",
        },
      },
      traceId: `api-${Date.now()}`,
    })
  } catch (error) {
    console.error("[API Error] /api/sync/config:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        source: "error",
        data: null,
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
