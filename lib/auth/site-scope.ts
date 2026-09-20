/**
 * 站点数据权限范围（accessible_sites / *）
 * - 登录 session 携带 accessibleSites
 * - group_admin (*) → 全部已注册站点
 * - 其他角色 → 仅 listed 站点；「全部站点」= 可访问站点并集
 * - 可选 regionCode：展开为 listed（区域 ∩ 权限）；空区域 → listed:[]
 */

import type { AuthUser } from "./server"
import { getVisibleSites, requireSiteAccess } from "./middleware"
import { query } from "@/lib/db"

export type SiteScope =
  | { kind: "single"; siteCode: string }
  | { kind: "all_registered" }
  | { kind: "listed"; siteCodes: string[] }

export function hasAllSitesAccess(accessibleSites: string[] | null | undefined): boolean {
  return (accessibleSites ?? []).includes("*")
}

/** 解析请求站点：单站校验权限；未指定 = 可访问范围（全部注册站或 listed） */
export function resolveSiteScope(
  session: AuthUser,
  requestedSiteCode?: string | null,
): SiteScope {
  const raw = requestedSiteCode?.trim()
  const siteCode = raw && raw !== "__all__" ? raw : null
  if (siteCode) {
    requireSiteAccess(session, siteCode)
    return { kind: "single", siteCode }
  }
  const visible = getVisibleSites(session)
  if (visible === null) {
    return { kind: "all_registered" }
  }
  return { kind: "listed", siteCodes: visible }
}

/**
 * 解析请求范围：具体 siteCode 优先；否则按 regionCode 展开为 listed；
 * 区域下 0 站或权限交集为空 → listed:[]（页面空数据，不回退全部）。
 */
export async function resolveRequestScope(
  session: AuthUser,
  opts: { siteCode?: string | null; regionCode?: string | null },
): Promise<SiteScope> {
  const rawSite = opts.siteCode?.trim()
  const siteCode = rawSite && rawSite !== "__all__" ? rawSite : null
  if (siteCode) {
    return resolveSiteScope(session, siteCode)
  }

  const regionRaw = opts.regionCode?.trim()
  if (!regionRaw || regionRaw.toLowerCase() === "all") {
    return resolveSiteScope(session, null)
  }

  const regionCode = regionRaw.toUpperCase()
  const base = resolveSiteScope(session, null)

  let siteCodes: string[] = []
  try {
    const { rows } = await query<{ site_code: string }>(
      `SELECT site_code FROM sync_sites
       WHERE enabled IS DISTINCT FROM FALSE
         AND UPPER(TRIM(COALESCE(region_code, ''))) = $1
       ORDER BY site_code ASC`,
      [regionCode],
    )
    siteCodes = rows.map((r) => r.site_code).filter(Boolean)
  } catch {
    siteCodes = []
  }

  if (base.kind === "single") {
    siteCodes = siteCodes.filter((c) => c === base.siteCode)
  } else if (base.kind === "listed") {
    siteCodes = filterRegistrySiteCodes(siteCodes, base.siteCodes)
  }
  // all_registered：保留区域内全部启用站

  return { kind: "listed", siteCodes }
}

/** 从 URLSearchParams / Next searchParams 读取 site+region 并解析 */
export async function resolveRequestScopeFromSearchParams(
  session: AuthUser,
  searchParams: URLSearchParams | { get(name: string): string | null },
): Promise<SiteScope> {
  return resolveRequestScope(session, {
    siteCode: searchParams.get("siteCode"),
    regionCode: searchParams.get("regionCode") ?? searchParams.get("region"),
  })
}

/** 生成列 ∈ 站点范围的 SQL 片段（单参 $n 可复用于同一条查询） */
export function sqlColumnInSiteScope(
  column: string,
  scope: SiteScope,
  paramIndex = 1,
): { sql: string; params: unknown[]; nextParam: number } {
  if (scope.kind === "single") {
    return {
      sql: `${column} = $${paramIndex}`,
      params: [scope.siteCode],
      nextParam: paramIndex + 1,
    }
  }
  if (scope.kind === "all_registered") {
    return {
      sql: `${column} IN (SELECT site_code FROM sync_sites WHERE enabled = true)`,
      params: [],
      nextParam: paramIndex,
    }
  }
  if (scope.siteCodes.length === 0) {
    return { sql: "FALSE", params: [], nextParam: paramIndex }
  }
  return {
    sql: `${column} = ANY($${paramIndex})`,
    params: [scope.siteCodes],
    nextParam: paramIndex + 1,
  }
}

export function siteCodeAllowed(
  siteCode: string,
  accessibleSites: string[] | null | undefined,
): boolean {
  const sites = accessibleSites ?? []
  if (sites.includes("*")) return true
  return sites.includes(siteCode)
}

export function filterRegistrySiteCodes(
  codes: string[],
  accessibleSites: string[] | null | undefined,
): string[] {
  if (hasAllSitesAccess(accessibleSites)) return codes
  const allowed = new Set((accessibleSites ?? []).map(String))
  return codes.filter((c) => allowed.has(c))
}

export function filterSiteOptions<T extends { code: string }>(
  options: T[],
  accessibleSites: string[] | null | undefined,
): T[] {
  if (hasAllSitesAccess(accessibleSites)) return options
  const allowed = new Set((accessibleSites ?? []).map(String))
  return options.filter((o) => o.code !== "__all__" && allowed.has(o.code))
}

/** 告警等内存合并后按 scope 过滤 */
export function rawAlertInScope(
  siteCode: string | null | undefined,
  scope: SiteScope,
): boolean {
  if (!siteCode) return scope.kind !== "listed" || scope.siteCodes.length > 0
  if (scope.kind === "single") return siteCode === scope.siteCode
  if (scope.kind === "all_registered") return true
  return scope.siteCodes.includes(siteCode)
}

/** 生成「两列站点码均在范围内」的 SQL（盘笼移位：源站与目标站都可见才返回） */
export function sqlBothSiteCodesInScope(
  sourceColumn: string,
  targetColumn: string,
  scope: SiteScope,
  paramIndex = 1,
): { sql: string; params: unknown[]; nextParam: number } {
  if (scope.kind === "single") {
    return {
      sql: `${sourceColumn} = $${paramIndex} AND ${targetColumn} = $${paramIndex}`,
      params: [scope.siteCode],
      nextParam: paramIndex + 1,
    }
  }
  if (scope.kind === "all_registered") {
    return {
      sql: `${sourceColumn} IN (SELECT site_code FROM sync_sites WHERE enabled = true)
        AND ${targetColumn} IN (SELECT site_code FROM sync_sites WHERE enabled = true)`,
      params: [],
      nextParam: paramIndex,
    }
  }
  if (scope.siteCodes.length === 0) {
    return { sql: "FALSE", params: [], nextParam: paramIndex }
  }
  return {
    sql: `${sourceColumn} = ANY($${paramIndex}) AND ${targetColumn} = ANY($${paramIndex})`,
    params: [scope.siteCodes],
    nextParam: paramIndex + 1,
  }
}

/** 源站与目标站是否都在站点权限范围内 */
export function bothSiteCodesInScope(
  sourceSiteCode: string,
  targetSiteCode: string,
  scope: SiteScope,
): boolean {
  return rawAlertInScope(sourceSiteCode, scope) && rawAlertInScope(targetSiteCode, scope)
}
