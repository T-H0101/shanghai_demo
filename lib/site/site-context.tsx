"use client"

/**
 * Sprint 2F.4 - 全局 siteCode 状态
 *
 * 设计:
 * - React Context 提供 siteCode 状态
 * - localStorage 记忆 (selectedSiteCode)
 * - URL query 同步 (?siteCode=SH01)
 * - 优先级: URL query > localStorage > 默认 null (All Sites)
 * - "All Sites" 用 null 表示
 *
 * 候选站点列表:
 * - 不依赖 tbl_site (Sprint 2E.3 已确认 tbl_site 是监控域, 非总控站点主表)
 * - 固定候选: All Sites + 已确认的真实站点
 * - 用户可继续扩展
 */

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

export const ALL_SITES = "__all__" as const

// 候选站点列表 (固定, 不依赖 tbl_site)
// 顺序: 总控逻辑站点优先
export const SITE_CANDIDATES: Array<{ code: string; label: string }> = [
  { code: ALL_SITES, label: "全部站点" },
  { code: "SH01", label: "SH01" },
  { code: "TEST_CLEAN", label: "TEST_CLEAN" },
  { code: "TEST_PKG", label: "TEST_PKG" },
  { code: "TEST_SMOKE", label: "TEST_SMOKE" },
  { code: "BJ02", label: "BJ02" },
]

const STORAGE_KEY = "unified.selectedSiteCode"

interface SiteContextValue {
  siteCode: string | null  // null = All Sites
  isAllSites: boolean
  setSiteCode: (code: string | null) => void
  isReady: boolean
}

const SiteContext = createContext<SiteContextValue | null>(null)

export function SiteProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // null = All Sites; '' = 尚未初始化
  const [siteCode, setSiteCodeState] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  // 初始化: URL query > localStorage > null
  useEffect(() => {
    const urlSite = searchParams.get("siteCode")
    if (urlSite !== null) {
      setSiteCodeState(urlSite === ALL_SITES ? null : urlSite)
      try { localStorage.setItem(STORAGE_KEY, urlSite) } catch {}
    } else {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored && stored !== ALL_SITES) {
          setSiteCodeState(stored)
        } else {
          setSiteCodeState(null)  // 默认 All Sites
        }
      } catch {
        setSiteCodeState(null)
      }
    }
    setIsReady(true)
  }, [])  // 仅初次加载, URL 变化由 setSiteCode 主动同步

  const setSiteCode = useCallback((code: string | null) => {
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
  }, [searchParams, router, pathname])

  const value = useMemo<SiteContextValue>(() => ({
    siteCode,
    isAllSites: siteCode == null,
    setSiteCode,
    isReady,
  }), [siteCode, setSiteCode, isReady])

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
    }
  }
  return ctx
}
