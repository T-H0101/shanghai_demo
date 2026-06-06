/**
 * Sprint 2G.2 - Dashboard 真实数据 Provider
 *
 * 始终调用 /api/dashboard/* 真实端点, 由 API mode 决定是否使用,
 * 失败不回退到 mock 数据 (Dashboard 是真实总览).
 */

import { isApiMode } from "@/lib/api"

export interface DashboardSummaryData {
  taskCount: number
  deviceCount: number
  volumeCount: number
  userCount: number
  packageCount: number
  failedPackageCount: number
  lastSyncAt: string | null
  successRate: number | null
  siteCount: number | null
}

export interface DashboardSummaryResponse {
  code: number
  message?: string
  source: "database"
  data: DashboardSummaryData
  siteCode: string | null
  generatedAt: string
}

export interface RecentSyncItem {
  siteCode: string
  batchId: string
  status: string
  totalRecordCount: number
  successTableCount: number
  failedTableCount: number
  tableCount: number
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
}

export interface RecentSyncsResponse {
  code: number
  message?: string
  source: "database"
  data: RecentSyncItem[]
  count: number
  generatedAt: string
}

export type DashboardSource = "database" | "mock" | "unavailable"

export interface DashboardFetchResult<T> {
  data: T | null
  source: DashboardSource
  error: string | null
}

function buildUrl(base: string, params?: Record<string, string | null | undefined>): string {
  if (!params) return base
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v.length > 0 && v !== "__all__") {
      search.set(k, v)
    }
  }
  const q = search.toString()
  return q ? `${base}?${q}` : base
}

export async function fetchDashboardSummary(
  siteCode?: string | null,
): Promise<DashboardFetchResult<DashboardSummaryData>> {
  // mock mode 不走真实端点
  if (!isApiMode) {
    return { data: null, source: "mock", error: null }
  }
  try {
    const res = await fetch(buildUrl("/api/dashboard/summary", { siteCode }), {
      cache: "no-store",
    })
    if (!res.ok) {
      return { data: null, source: "unavailable", error: `HTTP ${res.status}` }
    }
    const json = (await res.json()) as DashboardSummaryResponse
    if (json.code !== 0 || !json.data) {
      return { data: null, source: "unavailable", error: json.message ?? "invalid response" }
    }
    return { data: json.data, source: "database", error: null }
  } catch (e) {
    return { data: null, source: "unavailable", error: e instanceof Error ? e.message : "fetch failed" }
  }
}

export async function fetchRecentSyncs(
  siteCode?: string | null,
  limit = 10,
): Promise<DashboardFetchResult<RecentSyncItem[]>> {
  if (!isApiMode) {
    return { data: null, source: "mock", error: null }
  }
  try {
    const res = await fetch(
      buildUrl("/api/dashboard/recent-syncs", {
        siteCode,
        limit: String(limit),
      }),
      { cache: "no-store" },
    )
    if (!res.ok) {
      return { data: null, source: "unavailable", error: `HTTP ${res.status}` }
    }
    const json = (await res.json()) as RecentSyncsResponse
    if (json.code !== 0) {
      return { data: null, source: "unavailable", error: json.message ?? "invalid response" }
    }
    return { data: json.data ?? [], source: "database", error: null }
  } catch (e) {
    return { data: null, source: "unavailable", error: e instanceof Error ? e.message : "fetch failed" }
  }
}
