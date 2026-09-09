/**
 * 统一检索 — 区域筛选与 facets
 */

import type { AuthUser } from "@/lib/auth/server"
import { filterRegistrySiteCodes, resolveSiteScope, type SiteScope } from "@/lib/auth/site-scope"
import { query } from "@/lib/db"
import { esSiteCodesFromScope } from "@/lib/search/search-site-scope"

export type SearchRegionFilter =
  | { kind: "all"; siteCodes: string[] }
  | { kind: "region"; regionCode: string; siteCodes: string[] }

export async function loadAccessibleRegionFacets(): Promise<
  Array<{ code: string; name: string }>
> {
  try {
    const { rows } = await query<{ code: string; name: string }>(
      `SELECT code, name FROM site_regions WHERE status = 'active' ORDER BY sort_order ASC, code ASC`,
    )
    return rows.map((r) => ({
      code: r.code,
      name: r.name?.trim() || r.code,
    }))
  } catch {
    return []
  }
}

export async function resolveSearchRegionFilter(
  session: AuthUser,
  regionCodeParam?: string | null,
  siteScope?: SiteScope,
): Promise<SearchRegionFilter> {
  const scope = siteScope ?? resolveSiteScope(session, null)
  const regionCode = regionCodeParam?.trim()
  if (!regionCode || regionCode.toLowerCase() === "all") {
    const siteCodes = await esSiteCodesFromScope(scope)
    return { kind: "all", siteCodes }
  }

  const normalized = regionCode.toUpperCase()
  const { rows } = await query<{ site_code: string }>(
    `SELECT site_code FROM sync_sites
     WHERE enabled IS DISTINCT FROM FALSE
       AND region_code = $1
     ORDER BY site_code ASC`,
    [normalized],
  )
  let siteCodes = rows.map((r) => r.site_code).filter(Boolean)
  if (scope.kind === "single") {
    siteCodes = siteCodes.filter((c) => c === scope.siteCode)
  } else if (scope.kind === "listed") {
    siteCodes = filterRegistrySiteCodes(siteCodes, scope.siteCodes)
  }
  return { kind: "region", regionCode: normalized, siteCodes }
}
