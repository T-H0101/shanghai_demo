"use client"

/**
 * Sprint 2F.4 - 全局 siteCode 状态
 * Sprint R.69 Task 1 - 中心注册表 (`sync_sites`) 成为站点单一来源
 *
 * 设计:
 * - React Context 提供 siteCode 状态
 * - localStorage 记忆 (selectedSiteCode)
 * - URL query 同步 (?siteCode=SH01)
 * - 优先级: URL query > localStorage > 默认 null (All Sites)
 * - "All Sites" 用 null 表示
 *
 * 候选站点列表 (Sprint R.69 修订):
 * - 不再硬编码 `SITE_CANDIDATES` 数组
 * - 唯一来源: 中心注册表 `/api/sync/config` → `sync_sites` 表 (R.61 已落地)
 * - 失败时降级: 仅 `[{code: ALL_SITES, label: "全部站点"}]`, 不默认 SH01
 * - 通过 `useSiteSites()` 暴露数据来源 (`sync_sites` / `error`)
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
}

export type SiteSource = "sync_sites" | "error"

export interface SiteSitesValue {
  sites: SiteOption[]
  loading: boolean
  error: string | null
  source: SiteSource
}

const STORAGE_KEY = "unified.selectedSiteCode"

const FALLBACK_SITES: SiteOption[] = [{ code: ALL_SITES, label: "全部站点" }]

interface SiteContextValue {
  siteCode: string | null // null = All Sites
  isAllSites: boolean
  setSiteCode: (code: string | null) => void
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
    }>
  }
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // null = All Sites; '' = 尚未初始化
  const [siteCode, setSiteCodeState] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Sprint R.69: 中心注册表作为唯一来源
  const [sites, setSites] = useState<SiteOption[]>(FALLBACK_SITES)
  const [sitesLoading, setSitesLoading] = useState<boolean>(true)
  const [sitesError, setSitesError] = useState<string | null>(null)
  const [sitesSource, setSitesSource] = useState<SiteSource>("sync_sites")

  // 初始化: URL query > localStorage > null
  useEffect(() => {
    const urlSite = searchParams.get("siteCode")
    if (urlSite !== null) {
      setSiteCodeState(urlSite === ALL_SITES ? null : urlSite)
      try {
        localStorage.setItem(STORAGE_KEY, urlSite)
      } catch {}
    } else {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored && stored !== ALL_SITES) {
          setSiteCodeState(stored)
        } else {
          setSiteCodeState(null) // 默认 All Sites
        }
      } catch {
        setSiteCodeState(null)
      }
    }
    setIsReady(true)
  }, []) // 仅初次加载, URL 变化由 setSiteCode 主动同步

  // Sprint R.69: 从中心注册表拉取真实站点列表
  useEffect(() => {
    let cancelled = false
    async function loadSites() {
      setSitesLoading(true)
      setSitesError(null)
      try {
        const res = await fetch("/api/sync/config", { cache: "no-store" })
        if (!res.ok) {
          throw new Error(`/api/sync/config HTTP ${res.status}`)
        }
        const json = (await res.json()) as SyncConfigSitesResponse
        const rows = json?.data?.sites ?? []
        const enabledRows = rows.filter((r) => r && r.enabled !== false)
        const mapped: SiteOption[] = enabledRows
          .map((r) => {
            const code = r.siteCode
            if (!code) return null
            const label = r.siteName ? `${code} ${r.siteName}` : code
            return { code, label }
          })
          .filter((v): v is SiteOption => v !== null)
        if (cancelled) return
        setSites(mapped)
        setSitesSource("sync_sites")
        setSitesError(null)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        // 失败降级: 只保留 ALL_SITES, 不默认 SH01
        setSites(FALLBACK_SITES)
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

  const setSiteCode = useCallback(
    (code: string | null) => {
      setSiteCodeState(code)
      try {
        if (code == null) {
          localStorage.setItem(STORAGE_KEY, ALL_SITES)
        } else {
          localStorage.setItem(STORAGE_KEY, code)
        }
      } catch {}

      // 同步 URL query
      const params = new URLSearchParams(searchParams.toString())
      if (code == null) {
        params.set("siteCode", ALL_SITES)
      } else {
        params.set("siteCode", code)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname]
  )

  const value = useMemo<SiteContextValue>(
    () => ({
      siteCode,
      isAllSites: siteCode == null,
      setSiteCode,
      isReady,
      sites,
      sitesLoading,
      sitesError,
      sitesSource,
    }),
    [siteCode, setSiteCode, isReady, sites, sitesLoading, sitesError, sitesSource]
  )

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext)
  if (!ctx) {
    // 兼容 SSR / 未在 Provider 内时返回安全默认值
    return {
      siteCode: null,
      isAllSites: true,
      setSiteCode: () => {},
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
