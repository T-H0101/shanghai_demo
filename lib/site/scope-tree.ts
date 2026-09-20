/**
 * 顶栏范围内的「区域 → 站点」树（页内分组筛选用）
 *
 * 规则（与产品锁定一致）:
 * - 顶栏全部 → 权限内全部区域-站点 + 未挂靠站点平铺
 * - 顶栏区域 → 仅该区域 + 其下有权限站点（无未挂靠）
 * - 顶栏具体站 → 该站所属区域 + 仅该站；无区域则只平铺该站
 * - 空区域 / 权限内无站的区域不出现
 */

import { ALL_SITES, type SiteOption } from "@/lib/site/site-context"

export type ScopeTreeSiteNode = {
  code: string
  label: string
}

export type ScopeTreeRegionNode = {
  code: string
  name: string
  sites: ScopeTreeSiteNode[]
}

export type ScopeTreeModel = {
  regions: ScopeTreeRegionNode[]
  unassigned: ScopeTreeSiteNode[]
}

export type ScopeTreeSelection =
  | { kind: "all" }
  | { kind: "region"; code: string }
  | { kind: "site"; code: string }

export type RegionCatalogEntry = {
  code: string
  name: string
  status?: string
  sites?: Array<{ code: string; name: string }>
}

export type HeaderScopeForTree = {
  siteCode: string | null
  regionCode: string | null
  isAllSites: boolean
  isRegionScope: boolean
}

function siteLabel(code: string, name?: string | null): string {
  const n = name?.trim()
  return n || code
}

/** 从注册表 + 区域主数据构建「权限内」完整树，再按顶栏收窄 */
export function buildHeaderScopeTree(
  header: HeaderScopeForTree,
  sites: SiteOption[],
  catalog: RegionCatalogEntry[],
): ScopeTreeModel {
  const allowed = sites.filter((s) => s.code !== ALL_SITES)
  const allowedSet = new Set(allowed.map((s) => s.code))
  const siteMeta = new Map(allowed.map((s) => [s.code, s]))

  const fullRegions: ScopeTreeRegionNode[] = catalog
    .filter((r) => r.status !== "inactive")
    .map((r) => ({
      code: r.code,
      name: r.name?.trim() || r.code,
      sites: (r.sites ?? [])
        .filter((s) => allowedSet.has(s.code))
        .map((s) => ({
          code: s.code,
          label: siteLabel(s.code, s.name),
        })),
    }))
    .filter((r) => r.sites.length > 0)

  const assigned = new Set<string>()
  for (const r of fullRegions) {
    for (const s of r.sites) assigned.add(s.code)
  }

  const fullUnassigned: ScopeTreeSiteNode[] = allowed
    .filter((s) => !assigned.has(s.code))
    .map((s) => ({ code: s.code, label: s.label }))

  // 顶栏：具体站点
  if (!header.isAllSites && header.siteCode && !header.isRegionScope) {
    const code = header.siteCode
    const meta = siteMeta.get(code)
    const label = meta?.label ?? code
    const regionFromMeta = meta?.regionCode?.trim()
      ? meta.regionCode.trim().toUpperCase()
      : null
    const regionFromCatalog =
      fullRegions.find((r) => r.sites.some((s) => s.code === code)) ?? null

    if (regionFromCatalog) {
      return {
        regions: [
          {
            code: regionFromCatalog.code,
            name: regionFromCatalog.name,
            sites: [{ code, label }],
          },
        ],
        unassigned: [],
      }
    }
    if (regionFromMeta) {
      const cat = catalog.find(
        (r) => r.code === regionFromMeta && r.status !== "inactive",
      )
      return {
        regions: [
          {
            code: regionFromMeta,
            name: cat?.name?.trim() || regionFromMeta,
            sites: [{ code, label }],
          },
        ],
        unassigned: [],
      }
    }
    return {
      regions: [],
      unassigned: [{ code, label }],
    }
  }

  // 顶栏：区域
  if (header.isRegionScope && header.regionCode) {
    const code = header.regionCode.trim().toUpperCase()
    const region = fullRegions.find((r) => r.code === code)
    return {
      regions: region ? [region] : [],
      unassigned: [],
    }
  }

  // 顶栏：全部
  return {
    regions: fullRegions,
    unassigned: fullUnassigned,
  }
}

/** 选中节点覆盖的站点码集合；kind=all 返回 null 表示不限制 */
export function siteCodesForSelection(
  selection: ScopeTreeSelection,
  tree: ScopeTreeModel,
): string[] | null {
  if (selection.kind === "all") return null
  if (selection.kind === "site") return [selection.code]
  const region = tree.regions.find((r) => r.code === selection.code)
  return region ? region.sites.map((s) => s.code) : []
}

/** 区域角标 = 子站 counts 之和 */
export function sumRegionCount(
  siteCodes: string[],
  counts: Record<string, number> | undefined,
): number {
  if (!counts) return 0
  return siteCodes.reduce((sum, code) => sum + (counts[code] ?? 0), 0)
}
