import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

interface SiteStatusRow {
  site_code: string
  site_name: string
  enabled: boolean
  sync_interval_seconds: number
  config_status: string
  scheduler_status: string | null
  scheduler_started_at: string | null
  export_status: string | null
  push_status: string | null
  scheduler_consistency_status: string | null
  package_status: string | null
  package_batch_id: string | null
  package_created_at: string | null
  consistency_status: string | null
  consistency_checked_at: string | null
  matched_table_count: number | null
  mismatched_table_count: number | null
}

export async function GET() {
  try {
    const result = await query<SiteStatusRow>(
      `SELECT
         s.site_code,
         s.site_name,
         s.enabled,
         s.sync_interval_seconds,
         s.status AS config_status,
         scheduler.status AS scheduler_status,
         scheduler.started_at::text AS scheduler_started_at,
         scheduler.export_status,
         scheduler.push_status,
         scheduler.consistency_status AS scheduler_consistency_status,
         package.status AS package_status,
         package.batch_id AS package_batch_id,
         package.created_at::text AS package_created_at,
         consistency.status AS consistency_status,
         consistency.checked_at::text AS consistency_checked_at,
         consistency.matched_table_count,
         consistency.mismatched_table_count
       FROM sync_sites s
       LEFT JOIN LATERAL (
         SELECT status, started_at, export_status, push_status, consistency_status
         FROM sync_scheduler_log
         WHERE site_code = s.site_code
         ORDER BY started_at DESC
         LIMIT 1
       ) scheduler ON TRUE
       LEFT JOIN LATERAL (
         SELECT status, batch_id, created_at
         FROM sync_package_log
         WHERE site_code = s.site_code
         ORDER BY created_at DESC
         LIMIT 1
       ) package ON TRUE
       LEFT JOIN LATERAL (
         SELECT status, checked_at, matched_table_count, mismatched_table_count
         FROM sync_consistency_log
         WHERE site_code = s.site_code
         ORDER BY checked_at DESC
         LIMIT 1
       ) consistency ON TRUE
       ORDER BY s.site_code`
    )

    return NextResponse.json({
      code: 0,
      message: "ok",
      data: {
        items: result.rows.map((row) => ({
          siteCode: row.site_code,
          siteName: row.site_name,
          enabled: row.enabled,
          intervalSeconds: row.sync_interval_seconds,
          configStatus: row.config_status,
          schedulerStatus: row.scheduler_status ?? "not_run",
          schedulerStartedAt: row.scheduler_started_at,
          exportStatus: row.export_status ?? "not_run",
          pushStatus: row.push_status ?? "not_run",
          schedulerConsistencyStatus: row.scheduler_consistency_status ?? "not_run",
          packageStatus: row.package_status ?? "not_run",
          packageBatchId: row.package_batch_id,
          packageCreatedAt: row.package_created_at,
          consistencyStatus: row.consistency_status ?? "not_run",
          consistencyCheckedAt: row.consistency_checked_at,
          matchedTableCount: row.matched_table_count,
          mismatchedTableCount: row.mismatched_table_count,
          provenance: "central_configuration_with_latest_runtime_logs",
        })),
      },
      dataSource: "sync_sites + latest sync logs (database)",
      reality: {
        note: "sync_sites 是中心调度配置；无日志状态返回 not_run，不推断源端运行成功",
      },
      traceId: `api-${Date.now()}`,
    })
  } catch (error) {
    console.error("[API Error] /api/sync/sites/status:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        data: { items: [] },
        dataSource: "error",
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
