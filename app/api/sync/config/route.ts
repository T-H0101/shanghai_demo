import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

interface SyncSiteRow {
  site_code: string
  site_name: string
  enabled: boolean
  sync_interval_seconds: number
  status: string
  credential_ref: string | null
  last_connected_at: string | null
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
] as const

export async function GET() {
  try {
    const result = await query<SyncSiteRow>(
      `SELECT site_code, site_name, enabled, sync_interval_seconds, status,
              credential_ref, last_connected_at::text
       FROM sync_sites
       ORDER BY site_code`
    )

    return NextResponse.json({
      code: 0,
      message: "ok",
      source: "sync_sites",
      data: {
        sites: result.rows.map((row) => ({
          siteCode: row.site_code,
          siteName: row.site_name,
          enabled: row.enabled,
          intervalSeconds: row.sync_interval_seconds,
          status: row.status,
          credentialKeyRef: row.credential_ref,
          lastConnectedAt: row.last_connected_at,
          provenance: "central_configuration",
        })),
        runtime: {
          schedulerMode: "external_process",
          defaultIntervalSeconds: 3600,
          envKeyRefs: SAFE_ENV_KEY_REFS.map((key) => ({
            key,
            configured: Boolean(process.env[key]),
          })),
        },
        reality: {
          sourceEvidence: false,
          note: "sites/sync_sites 是中心配置，不代表源端 tbl_site 已有真实数据",
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
