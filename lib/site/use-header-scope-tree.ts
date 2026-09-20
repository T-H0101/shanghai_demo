"use client"

/**
 * 拉取区域主数据并按顶栏范围构建页内分组树
 */

import { useEffect, useMemo, useState } from "react"
import { useSite, useSiteSites } from "@/lib/site/site-context"
import {
  buildHeaderScopeTree,
  type RegionCatalogEntry,
  type ScopeTreeModel,
} from "@/lib/site/scope-tree"

export function useHeaderScopeTree(): ScopeTreeModel & {
  loading: boolean
  ready: boolean
} {
  const { siteCode, regionCode, isAllSites, isRegionScope, isReady } = useSite()
  const { sites } = useSiteSites()
  const [catalog, setCatalog] = useState<RegionCatalogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isReady) return
    let cancelled = false
    setLoading(true)
    fetch("/api/sites/regions", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        const rows = (json?.data?.regions ?? []) as RegionCatalogEntry[]
        setCatalog(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setCatalog([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isReady, sites])

  const tree = useMemo(
    () =>
      buildHeaderScopeTree(
        { siteCode, regionCode, isAllSites, isRegionScope },
        sites,
        catalog,
      ),
    [siteCode, regionCode, isAllSites, isRegionScope, sites, catalog],
  )

  return {
    ...tree,
    loading: !isReady || loading,
    ready: isReady && !loading,
  }
}
