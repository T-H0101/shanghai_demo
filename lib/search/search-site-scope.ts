/**
 * 统一检索 — 站点数据权限（accessibleSites / resolveSiteScope）
 */

import type { NextRequest } from "next/server"
import type { AuthUser } from "@/lib/auth/server"
import { requirePermission, requireSession } from "@/lib/auth/middleware"
import {
  filterRegistrySiteCodes,
  rawAlertInScope,
  resolveSiteScope,
  sqlColumnInSiteScope,
  type SiteScope,
} from "@/lib/auth/site-scope"
import { query } from "@/lib/db"

export type { SiteScope }

export async function requireSearchSession(request: NextRequest): Promise<AuthUser> {
  const session = await requireSession(request)
  requirePermission(session, "platform:read")
  return session
}

export function resolveSearchSiteScope(
  session: AuthUser,
  requestedSiteCode?: string | null,
): SiteScope {
  return resolveSiteScope(session, requestedSiteCode)
}

/** 筛选项下拉：始终返回用户可访问的全部站点（不受当前 siteCode 筛选影响） */
export function resolveAccessibleSiteScope(session: AuthUser): SiteScope {
  return resolveSiteScope(session, null)
}

export async function loadAccessibleSiteFacets(
  session: AuthUser,
): Promise<Array<{ code: string; name: string }>> {
  return loadScopedSiteFacets(resolveAccessibleSiteScope(session))
}

export async function loadAccessibleDeviceFacets(
  session: AuthUser,
): Promise<Array<{ siteCode: string; deviceIp: string; name: string }>> {
  return loadScopedDeviceFacets(resolveAccessibleSiteScope(session))
}

/** 将 SiteScope 转为 ES source_site_id terms 过滤列表 */
export async function esSiteCodesFromScope(scope: SiteScope): Promise<string[]> {
  if (scope.kind === "single") return [scope.siteCode]
  if (scope.kind === "listed") return [...scope.siteCodes]
  const { rows } = await query<{ site_code: string }>(
    `SELECT site_code FROM sync_sites WHERE enabled IS DISTINCT FROM FALSE ORDER BY site_code`,
  )
  return rows.map((r) => r.site_code).filter(Boolean)
}

export function searchScopeIsEmpty(scope: SiteScope): boolean {
  return scope.kind === "listed" && scope.siteCodes.length === 0
}

export function filterSearchHitsByScope<
  T extends { sourceSiteId?: string; displaySiteCode?: string | null },
>(hits: T[], scope: SiteScope): T[] {
  return hits.filter((hit) => {
    const code = hit.displaySiteCode?.trim() || hit.sourceSiteId?.trim() || null
    return rawAlertInScope(code, scope)
  })
}

export async function loadScopedSiteFacets(
  scope: SiteScope,
): Promise<Array<{ code: string; name: string }>> {
  const { rows } = await query<{ site_code: string; site_name: string | null }>(
    `SELECT site_code, site_name FROM sync_sites WHERE enabled IS DISTINCT FROM FALSE ORDER BY site_code`,
  )
  let codes = rows.map((r) => r.site_code)
  if (scope.kind === "single") {
    codes = codes.filter((c) => c === scope.siteCode)
  } else if (scope.kind === "listed") {
    codes = filterRegistrySiteCodes(codes, scope.siteCodes)
  }
  const nameMap = new Map(rows.map((r) => [r.site_code, r.site_name?.trim() || r.site_code]))
  return codes.map((code) => ({ code, name: nameMap.get(code) || code }))
}

type DeviceRow = {
  source_site_id: string
  device_ip: string
  device_name: string | null
}

export async function loadScopedDeviceFacets(
  scope: SiteScope,
): Promise<Array<{ siteCode: string; deviceIp: string; name: string }>> {
  const scopeFilter = sqlColumnInSiteScope("source_site_id", scope, 1)
  const deviceSql = `SELECT source_site_id,
            NULLIF(TRIM(ip_address), '') AS device_ip,
            NULLIF(TRIM(device_name), '') AS device_name
     FROM unified_devices
     WHERE NULLIF(TRIM(ip_address), '') IS NOT NULL
       AND ${scopeFilter.sql}
     ORDER BY source_site_id, device_name NULLS LAST, device_ip`
  const deviceRows = await query<DeviceRow>(deviceSql, scopeFilter.params)
  const seen = new Set<string>()
  const facets: Array<{ siteCode: string; deviceIp: string; name: string }> = []
  for (const row of deviceRows.rows) {
    const ip = row.device_ip?.trim()
    if (!ip) continue
    const key = `${row.source_site_id}::${ip}`
    if (seen.has(key)) continue
    seen.add(key)
    facets.push({
      siteCode: row.source_site_id,
      deviceIp: ip,
      name: row.device_name?.trim() || ip,
    })
  }
  return facets
}
