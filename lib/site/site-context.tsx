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
 * - URL 无 siteCode 时从 localStorage 恢复并写回 URL（登录页除外）
 * - URL 的 siteCode 变化会同步到 Context（含登录成功跳转）
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

export function SiteProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [siteCode, setSiteCodeState] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  const [sites, setSites] = useState<SiteOption[]>(FALLBACK_SITES)
  const [sitesLoading, setSitesLoading] = useState<boolean>(true)
  const [sitesError, setSitesError] = useState<string | null>(null)
  const [sitesSource, setSitesSource] = useState<SiteSource>("sync_sites")
  const [accessibleSites, setAccessibleSites] = useState<string[] | null>(null)

  // 依赖具体 query 字符串，避免 searchParams 对象引用不变导致不刷新
  const urlSiteParam = searchParams?.get("siteCode") ?? null
  const isLoginPath = (pathname ?? "").startsWith("/login")

  useEffect(() => {
    if (urlSiteParam !== null) {
      const next = urlSiteParam === ALL_SITES ? null : urlSiteParam
      setSiteCodeState(next)
      writeStoredSiteCode(next)
      setIsReady(true)
      return
    }

    // 侧栏跳转常丢掉 query：回退 localStorage，保证登录写入的站点仍生效
    const stored = readStoredSiteCode()
    setSiteCodeState(stored)
    setIsReady(true)

    // 写回 URL，避免页面切换后 Select remount 时与 URL 脱节、误落到列表第一项
    if (isLoginPath) return
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("siteCode", stored == null ? ALL_SITES : stored)
    const qs = params.toString()
    const basePath = pathname ?? "/"
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false })
  }, [urlSiteParam, pathname, router, searchParams, isLoginPath])

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
        const mapped: SiteOption[] = enabledRows
          .map((r) => {
            const code = r.siteCode
            if (!code) return null
            const label = r.siteName ? `${code} ${r.siteName}` : code
            return { code, label }
          })
          .filter((v): v is SiteOption => v !== null)
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
  }, [])

  // 当前选中站点不在权限列表时，回退到「全部站点」（= 可访问站点并集）
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

  const setSiteCode = useCallback(
    (code: string | null) => {
      syncSiteCode(code)

      const params = new URLSearchParams(searchParams?.toString() ?? "")
      if (code == null) {
        params.set("siteCode", ALL_SITES)
      } else {
        params.set("siteCode", code)
      }
      const qs = params.toString()
      const basePath = pathname ?? "/"
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false })
    },
    [searchParams, router, pathname, syncSiteCode]
  )

  const value = useMemo<SiteContextValue>(
    () => ({
      siteCode,
      isAllSites: siteCode == null,
      setSiteCode,
      syncSiteCode,
      isReady,
      sites,
      sitesLoading,
      sitesError,
      sitesSource,
    }),
    [siteCode, setSiteCode, syncSiteCode, isReady, sites, sitesLoading, sitesError, sitesSource]
  )

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext)
  if (!ctx) {
    return {
      siteCode: null,
      isAllSites: true,
      setSiteCode: () => {},
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
