"use client"

/**
 * Sprint 2F.4 - 全局 siteCode 状态
 * Sprint R.69 Task 1 - 中心注册表 (`sync_sites`) 成为站点单一来源
 * Sprint R.region - 全局 regionCode（点区域筛选；不改写 siteCode 单值契约）
 *
 * 设计:
 * - React Context 提供 siteCode + regionCode
 * - localStorage 记忆 (selectedSiteCode / selectedRegionCode)
 * - URL: ?siteCode= / ?regionCode=
 * - 优先级: 具体 siteCode 覆盖 regionCode；点区域时 siteCode=__all__
 * - "All Sites" 用 siteCode=null 且 regionCode=null 表示
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

export const ALL_SITES = "__all__" as const

export interface SiteOption {
  code: string
  label: string
  regionCode?: string | null
}

export type SiteSource = "sync_sites" | "error"

export interface SiteSitesValue {
  sites: SiteOption[]
  loading: boolean
  error: string | null
  source: SiteSource
}

const STORAGE_KEY = "unified.selectedSiteCode"
const REGION_STORAGE_KEY = "unified.selectedRegionCode"

const FALLBACK_SITES: SiteOption[] = [{ code: ALL_SITES, label: "全部站点" }]

interface SiteContextValue {
  siteCode: string | null // null = All Sites (或区域模式)
  regionCode: string | null
  isAllSites: boolean
  /** siteCode==null 且 regionCode 有值 */
  isRegionScope: boolean
  setSiteCode: (code: string | null) => void
  setRegionCode: (code: string | null) => void
  /** 全部站点（清站 + 清区域） */
  clearScope: () => void
  /** 仅更新状态 + localStorage（登录成功等需改站点但不走当前 pathname 的场景） */
  syncSiteCode: (code: string | null) => void
  isReady: boolean
  sites: SiteOption[]
  sitesLoading: boolean
  sitesError: string | null
  sitesSource: SiteSource
}

const SiteContext = createContext<SiteContextValue | null>(null)

interface SyncConfigSitesResponse {
  code?: number
  data?: {
    sites?: Array<{
      siteCode?: string
      siteName?: string | null
      enabled?: boolean
      regionCode?: string | null
    }>
  }
}

interface AuthMeResponse {
  code?: number | string
  data?: {
    user?: {
      accessibleSites?: string[]
    }
  }
}

function filterSitesForSession(
  registered: SiteOption[],
  accessible: string[] | null | undefined,
): SiteOption[] {
  if (accessible == null) return registered
  if (accessible.includes("*")) return registered
  const allowed = new Set(accessible.map(String))
  return registered.filter((s) => allowed.has(s.code))
}

function readStoredSiteCode(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored || stored === ALL_SITES) return null
    return stored
  } catch {
    return null
  }
}

function writeStoredSiteCode(code: string | null) {
  try {
    localStorage.setItem(STORAGE_KEY, code == null ? ALL_SITES : code)
  } catch {
    /* ignore */
  }
}

function readStoredRegionCode(): string | null {
  try {
    const stored = localStorage.getItem(REGION_STORAGE_KEY)
    if (!stored || !stored.trim()) return null
    return stored.trim().toUpperCase()
  } catch {
    return null
  }
}

function writeStoredRegionCode(code: string | null) {
  try {
    if (code == null || !code.trim()) {
      localStorage.removeItem(REGION_STORAGE_KEY)
    } else {
      localStorage.setItem(REGION_STORAGE_KEY, code.trim().toUpperCase())
    }
  } catch {
    /* ignore */
  }
}

function applyTaskDeepLinkCleanup(params: URLSearchParams, basePath: string) {
  if (basePath === "/tasks" || basePath.startsWith("/tasks/")) {
    params.delete("deviceId")
    params.delete("deviceName")
    params.delete("device")
  }
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [siteCode, setSiteCodeState] = useState<string | null>(null)
  const [regionCode, setRegionCodeState] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  const [sites, setSites] = useState<SiteOption[]>(FALLBACK_SITES)
  const [sitesLoading, setSitesLoading] = useState<boolean>(true)
  const [sitesError, setSitesError] = useState<string | null>(null)
  const [sitesSource, setSitesSource] = useState<SiteSource>("sync_sites")
  const [accessibleSites, setAccessibleSites] = useState<string[] | null>(null)

  const urlSiteParam = searchParams?.get("siteCode") ?? null
  const urlRegionParam = searchParams?.get("regionCode") ?? null
  const isLoginPath = (pathname ?? "").startsWith("/login")

  useEffect(() => {
    const rawSite = urlSiteParam
    const rawRegion = urlRegionParam?.trim() ? urlRegionParam.trim().toUpperCase() : null

    // URL 有 siteCode 时：具体站覆盖区域；__all__ 时可保留 region
    if (rawSite !== null) {
      const nextSite = rawSite === ALL_SITES ? null : rawSite
      let nextRegion: string | null = null
      if (nextSite != null) {
        nextRegion = null
      } else if (rawRegion) {
        nextRegion = rawRegion
      } else {
        nextRegion = readStoredRegionCode()
      }
      setSiteCodeState(nextSite)
      setRegionCodeState(nextRegion)
      writeStoredSiteCode(nextSite)
      writeStoredRegionCode(nextRegion)
      setIsReady(true)

      // 具体站时清 URL 上的 regionCode，避免双参并存
      if (!isLoginPath && nextSite != null && rawRegion) {
        const params = new URLSearchParams(searchParams?.toString() ?? "")
        params.delete("regionCode")
        const qs = params.toString()
        const basePath = pathname ?? "/"
        router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false })
      }
      return
    }

    // 无 siteCode：回退 localStorage；region 优先 URL，否则 storage
    const storedSite = readStoredSiteCode()
    const nextRegion =
      storedSite != null ? null : rawRegion ?? readStoredRegionCode()
    setSiteCodeState(storedSite)
    setRegionCodeState(nextRegion)
    writeStoredSiteCode(storedSite)
    writeStoredRegionCode(nextRegion)
    setIsReady(true)

    if (isLoginPath) return
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("siteCode", storedSite == null ? ALL_SITES : storedSite)
    if (nextRegion) {
      params.set("regionCode", nextRegion)
    } else {
      params.delete("regionCode")
    }
    const qs = params.toString()
    const basePath = pathname ?? "/"
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false })
  }, [urlSiteParam, urlRegionParam, pathname, router, searchParams, isLoginPath])

  useEffect(() => {
    let cancelled = false
    async function loadSites() {
      setSitesLoading(true)
      setSitesError(null)
      try {
        const [configRes, meRes] = await Promise.all([
          fetch("/api/sync/config", { cache: "no-store", credentials: "include" }),
          fetch("/api/auth/me", { cache: "no-store", credentials: "include" }),
        ])
        if (!configRes.ok) {
          throw new Error(`/api/sync/config HTTP ${configRes.status}`)
        }
        const json = (await configRes.json()) as SyncConfigSitesResponse
        const meJson = meRes.ok ? ((await meRes.json()) as AuthMeResponse) : null
        const accessible = meJson?.data?.user?.accessibleSites ?? null

        const rows = json?.data?.sites ?? []
        const enabledRows = rows.filter((r) => r && r.enabled !== false)
        const mapped: SiteOption[] = enabledRows.flatMap((r) => {
          const code = r.siteCode
          if (!code) return []
          const label = r.siteName?.trim() || code
          return [
            {
              code,
              label,
              regionCode: r.regionCode?.trim()
                ? r.regionCode.trim().toUpperCase()
                : null,
            },
          ]
        })
        const filtered = filterSitesForSession(mapped, accessible)
        if (cancelled) return
        setAccessibleSites(accessible)
        setSites(filtered)
        setSitesSource("sync_sites")
        setSitesError(null)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setSites(FALLBACK_SITES)
        setAccessibleSites(null)
        setSitesSource("error")
        setSitesError(message)
      } finally {
        if (!cancelled) setSitesLoading(false)
      }
    }
    void loadSites()
    return () => {
      cancelled = true
    }
  }, [])

  const syncSiteCode = useCallback((code: string | null) => {
    setSiteCodeState(code)
    writeStoredSiteCode(code)
    if (code != null) {
      setRegionCodeState(null)
      writeStoredRegionCode(null)
    }
  }, [])

  // 当前选中站点不在权限列表时，回退到「全部站点」
  useEffect(() => {
    if (!isReady || sitesLoading || accessibleSites == null) return
    if (accessibleSites.includes("*")) return
    if (siteCode == null) return
    const allowed = new Set(accessibleSites.map(String))
    if (!allowed.has(siteCode)) {
      syncSiteCode(null)
      if (isLoginPath) return
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      params.set("siteCode", ALL_SITES)
      params.delete("regionCode")
      const qs = params.toString()
      const basePath = pathname ?? "/"
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false })
    }
  }, [
    isReady,
    sitesLoading,
    accessibleSites,
    siteCode,
    syncSiteCode,
    isLoginPath,
    pathname,
    router,
    searchParams,
  ])

  const replaceScopeUrl = useCallback(
    (nextSite: string | null, nextRegion: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      params.set("siteCode", nextSite == null ? ALL_SITES : nextSite)
      if (nextSite != null || !nextRegion) {
        params.delete("regionCode")
      } else {
        params.set("regionCode", nextRegion)
      }
      const basePath = pathname ?? "/"
      applyTaskDeepLinkCleanup(params, basePath)
      const qs = params.toString()
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false })
    },
    [searchParams, router, pathname],
  )

  const setSiteCode = useCallback(
    (code: string | null) => {
      setSiteCodeState(code)
      writeStoredSiteCode(code)
      setRegionCodeState(null)
      writeStoredRegionCode(null)
      replaceScopeUrl(code, null)
    },
    [replaceScopeUrl],
  )

  const setRegionCode = useCallback(
    (code: string | null) => {
      const normalized = code?.trim() ? code.trim().toUpperCase() : null
      setSiteCodeState(null)
      writeStoredSiteCode(null)
      setRegionCodeState(normalized)
      writeStoredRegionCode(normalized)
      replaceScopeUrl(null, normalized)
    },
    [replaceScopeUrl],
  )

  const clearScope = useCallback(() => {
    setSiteCodeState(null)
    writeStoredSiteCode(null)
    setRegionCodeState(null)
    writeStoredRegionCode(null)
    replaceScopeUrl(null, null)
  }, [replaceScopeUrl])

  const isRegionScope = siteCode == null && regionCode != null
  // isAllSites：未选具体站（含「全部」与「区域」）；区域模式用 isRegionScope 区分
  const isAllSites = siteCode == null

  const value = useMemo<SiteContextValue>(
    () => ({
      siteCode,
      regionCode,
      isAllSites,
      isRegionScope,
      setSiteCode,
      setRegionCode,
      clearScope,
      syncSiteCode,
      isReady,
      sites,
      sitesLoading,
      sitesError,
      sitesSource,
    }),
    [
      siteCode,
      regionCode,
      isAllSites,
      isRegionScope,
      setSiteCode,
      setRegionCode,
      clearScope,
      syncSiteCode,
      isReady,
      sites,
      sitesLoading,
      sitesError,
      sitesSource,
    ],
  )

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext)
  if (!ctx) {
    return {
      siteCode: null,
      regionCode: null,
      isAllSites: true,
      isRegionScope: false,
      setSiteCode: () => {},
      setRegionCode: () => {},
      clearScope: () => {},
      syncSiteCode: () => {},
      isReady: false,
      sites: FALLBACK_SITES,
      sitesLoading: false,
      sitesError: null,
      sitesSource: "sync_sites",
    }
  }
  return ctx
}

/**
 * Sprint R.69: 暴露站点数据来源状态供 UI / e2e 使用。
 * 与 `useSite()` 共享同一份状态, 字段名 `source` 用于 e2e 断言。
 */
export function useSiteSites(): SiteSitesValue {
  const { sites, sitesLoading, sitesError, sitesSource } = useSite()
  return {
    sites,
    loading: sitesLoading,
    error: sitesError,
    source: sitesSource,
  }
}

/** 构造带全局站点/区域筛选的 query（供各页 fetch 复用） */
export function appendScopeParams(
  params: URLSearchParams,
  opts: { siteCode: string | null; regionCode: string | null; isAllSites: boolean },
) {
  if (!opts.isAllSites && opts.siteCode) {
    params.set("siteCode", opts.siteCode)
    params.delete("regionCode")
    return
  }
  if (opts.regionCode) {
    params.set("regionCode", opts.regionCode)
  }
}
