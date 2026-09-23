/**
 * GET /api/sites/reachability
 *
 * 异步探测各站 sync_sites.db_host:db_port（TCP）。
 * 与 GET /api/sites 解耦：列表不阻塞；前端状态列先 loading 再刷在线/离线。
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireDashboardReadOr, requireSession } from "@/lib/auth/middleware"
import { filterRegistrySiteCodes } from "@/lib/auth/site-scope"
import { deriveSiteReachability } from "@/lib/site/reachability"
import { isProbeableEndpoint, probeTcpHost } from "@/lib/site/probe-tcp"

export const dynamic = "force-dynamic"

const PROBE_TIMEOUT_MS = 2_000

interface RegistryProbeRow {
  site_code: string
  db_host: string
  db_port: number
  enabled: boolean
}

export interface SiteReachabilityItem {
  code: string
  status: "online" | "offline"
  reachabilitySource: string
  reachabilityNote: string
  latencyMs?: number
}

export async function GET(req: NextRequest) {
  const traceId = crypto.randomUUID()
  try {
    const session = await requireSession(req)
    requireDashboardReadOr(session, "sites:list")

    const result = await query<RegistryProbeRow>(
      `SELECT site_code, db_host, db_port, enabled
       FROM sync_sites
       ORDER BY site_code`,
    )

    const allowedCodes = filterRegistrySiteCodes(
      result.rows.map((r) => r.site_code),
      session.accessibleSites,
    )
    const allowedSet = new Set(allowedCodes)
    const visible = result.rows.filter((r) => allowedSet.has(r.site_code))

    const items: SiteReachabilityItem[] = await Promise.all(
      visible.map(async (row) => {
        const canProbe = row.enabled && isProbeableEndpoint(row.db_host, row.db_port)
        const probe = canProbe
          ? await probeTcpHost(row.db_host.trim(), Number(row.db_port), PROBE_TIMEOUT_MS)
          : null
        const reachability = deriveSiteReachability({
          enabled: row.enabled,
          dbHost: row.db_host,
          dbPort: row.db_port,
          probe,
        })
        // 本接口探测已结束：不应再返回 checking
        const status =
          reachability.status === "online"
            ? ("online" as const)
            : ("offline" as const)
        return {
          code: row.site_code,
          status,
          reachabilitySource:
            reachability.status === "checking" ? "probe_error" : reachability.source,
          reachabilityNote:
            reachability.status === "checking"
              ? `探测未返回结果（${row.db_host}:${row.db_port}）`
              : reachability.note,
          ...(probe ? { latencyMs: probe.latencyMs } : {}),
        }
      }),
    )

    return NextResponse.json({
      code: 0,
      message: "ok",
      data: items,
      dataSource: "tcp_probe",
      meta: {
        timeoutMs: PROBE_TIMEOUT_MS,
        note: "Parallel TCP probe of sync_sites.db_host:db_port; does not block GET /api/sites",
      },
      traceId,
    })
  } catch (error) {
    if (error instanceof NextResponse) return error
    console.error("[API Error] /api/sites/reachability:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "未知异常",
        data: null,
        dataSource: "error",
        error: error instanceof Error ? error.message : String(error),
        traceId,
      },
      { status: 500 },
    )
  }
}
