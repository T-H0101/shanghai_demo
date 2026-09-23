"use client"

/**
 * 全局站点/区域选择器
 * - 第一级：区域 + 未挂靠站点平铺；均标 ·区域 / ·站点
 * - 区域下站点同样标 ·站点
 * - 仅展示权限内至少有 1 个可用站的区域（空区域 / 无权区域不展示）
 * - 点区域 → regionCode；点站点 → siteCode；全部 → 清范围
 * - 「进入站点」仅具体站可点
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronRight, ExternalLink, Globe, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppTooltip } from "@/components/shared/tooltip"
import { useSite, ALL_SITES, useSiteSites } from "@/lib/site/site-context"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatApiErrorMessage } from "@/lib/api/http-error"

type RegionNode = {
  code: string
  name: string
  sites: Array<{ code: string; label: string }>
}

async function jumpToSiteSso(siteCode: string) {
  const res = await fetch(`/api/sites/${encodeURIComponent(siteCode)}/sso`, {
    cache: "no-store",
    credentials: "include",
  })
  const json = await res.json().catch(() => ({}))
  if (res.status === 401) {
    throw new Error("请先登录总控后再进入站点")
  }
  if (!res.ok) {
    throw new Error(json.message || `HTTP ${res.status}`)
  }
  if (json.status !== "ready" || !json.jumpUrl) {
    throw new Error(json.message || json.blocker || "站点侧或密钥未配置，无法跳转")
  }
  return String(json.jumpUrl)
}

export function SiteSelector({ className }: { className?: string }) {
  const {
    siteCode,
    regionCode,
    isAllSites,
    isRegionScope,
    setSiteCode,
    setRegionCode,
    clearScope,
    isReady,
  } = useSite()
  const { sites, loading, error, source } = useSiteSites()
  const [ssoJumping, setSsoJumping] = useState(false)
  const [open, setOpen] = useState(false)
  const [regions, setRegions] = useState<RegionNode[]>([])
  const [regionsLoading, setRegionsLoading] = useState(false)
  /** 区域 API 成功拉取后才校验 URL region（失败时不清，避免误伤） */
  const [regionsFetchOk, setRegionsFetchOk] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const rootRef = useRef<HTMLDivElement>(null)

  // 预加载区域列表：仅展示「权限内至少有 1 个可用站」的区域
  useEffect(() => {
    if (!isReady) return
    let cancelled = false
    setRegionsLoading(true)
    fetch("/api/sites/regions", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        const rows = (json?.data?.regions ?? []) as Array<{
          code: string
          name: string
          status?: string
          sites?: Array<{ code: string; name: string }>
        }>
        // sites 已在 SiteContext 按 accessibleSites 裁剪；不含「全部站点」伪码
        const allowed = new Set(
          sites.filter((s) => s.code !== ALL_SITES).map((s) => s.code),
        )
        const active = rows
          .filter((r) => r.status !== "inactive")
          .map((r) => ({
            code: r.code,
            name: r.name?.trim() || r.code,
            sites: (r.sites ?? [])
              .filter((s) => allowed.has(s.code))
              .map((s) => ({
                code: s.code,
                label: s.name?.trim() || s.code,
              })),
          }))
          // 权限内无站的区域不展示（含：全平台空区域、或用户无权的区域）
          .filter((r) => r.sites.length > 0)
        setRegions(active)
        setRegionsFetchOk(true)
      })
      .catch(() => {
        if (!cancelled) {
          setRegions([])
          setRegionsFetchOk(false)
        }
      })
      .finally(() => {
        if (!cancelled) setRegionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isReady, sites])

  // URL / 本地残留：inactive、未知、或权限内已无可用站的区域 → 回退全部
  useEffect(() => {
    if (!isReady || regionsLoading || !regionCode || !regionsFetchOk) return
    if (!regions.some((r) => r.code === regionCode)) {
      clearScope()
    }
  }, [isReady, regionCode, regions, regionsLoading, regionsFetchOk, clearScope])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const assignedCodes = useMemo(() => {
    const set = new Set<string>()
    for (const r of regions) {
      for (const s of r.sites) set.add(s.code)
    }
    return set
  }, [regions])

  const unassignedSites = useMemo(
    () => sites.filter((s) => s.code !== ALL_SITES && !assignedCodes.has(s.code)),
    [sites, assignedCodes],
  )

  const triggerLabel = useMemo(() => {
    if (isRegionScope && regionCode) {
      const r = regions.find((x) => x.code === regionCode)
      return r ? `${r.name}（区域）` : `区域 ${regionCode}`
    }
    if (!isAllSites && siteCode) {
      return sites.find((s) => s.code === siteCode)?.label ?? siteCode
    }
    return "全部站点"
  }, [isRegionScope, regionCode, regions, isAllSites, siteCode, sites])

  const canEnterSite = Boolean(siteCode) && !isAllSites && !isRegionScope && !ssoJumping

  const handleEnterSite = async () => {
    if (!siteCode || isAllSites || isRegionScope) {
      toast({
        title: "请先选择站点",
        description: "选中具体站点后再进入站点系统；「全部站点」与「区域」不可跳转",
        variant: "destructive",
      })
      return
    }
    setSsoJumping(true)
    try {
      const jumpUrl = await jumpToSiteSso(siteCode)
      const label = sites.find((s) => s.code === siteCode)?.label ?? siteCode
      toast({
        title: "正在打开站点",
        description: `已签发跳转票据 → ${label}（${siteCode}）`,
      })
      window.open(jumpUrl, "_blank", "noopener,noreferrer")
    } catch (e) {
      toast({
        title: "进入站点失败",
        description: formatApiErrorMessage(e),
        variant: "destructive",
      })
    } finally {
      setSsoJumping(false)
    }
  }

  const toggleExpand = useCallback((code: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }, [])

  const enterSiteButton = (
    <AppTooltip
      content={
        isAllSites || !siteCode || isRegionScope
          ? "请先选择具体站点（全部站点与区域不可进入）"
          : "打开当前站点本地管理系统（SSO 免登）"
      }
      side="bottom"
    >
      <span className="inline-flex">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs gap-1 shrink-0"
          disabled={!canEnterSite}
          onClick={() => void handleEnterSite()}
          data-testid="header-enter-site"
          aria-label="进入站点"
        >
          {ssoJumping ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ExternalLink className="h-3.5 w-3.5" />
          )}
          进入站点
        </Button>
      </span>
    </AppTooltip>
  )

  if (!isReady) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500",
          className,
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        <span>站点加载中…</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500",
          className,
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        <span data-testid="site-selector-loading">加载中</span>
        <span data-testid="site-selector-source" className="hidden">
          {error ? "error" : "sync_sites"}
        </span>
        {enterSiteButton}
      </div>
    )
  }

  const hasError = error !== null
  const hasNoSites = sites.length === 0
  if (hasError || hasNoSites) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500",
          className,
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          className="h-8 w-[220px] justify-between text-xs opacity-60"
          data-testid="site-selector-trigger"
        >
          未注册站点
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
        <span data-testid="site-selector-source" className="hidden">
          {error ? "error" : source}
        </span>
        {enterSiteButton}
      </div>
    )
  }

  return (
    <div className={cn("relative flex items-center gap-1.5", className)} ref={rootRef}>
      <Globe className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-[220px] justify-between gap-1 bg-slate-50 px-2.5 text-xs dark:bg-slate-800"
        data-testid="site-selector-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 opacity-50", open && "rotate-180")} />
      </Button>
      <span data-testid="site-selector-source" className="hidden">
        {error ? "error" : source}
      </span>
      {enterSiteButton}

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+4px)] z-50 max-h-80 w-[280px] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          role="listbox"
          data-testid="site-selector-panel"
        >
          <button
            type="button"
            className={cn(
              "flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
              isAllSites && !isRegionScope && "bg-slate-100 font-medium dark:bg-slate-800",
            )}
            onClick={() => {
              clearScope()
              setOpen(false)
            }}
            data-testid="site-selector-all"
          >
            全部站点
          </button>

          {regionsLoading && (
            <p className="px-3 py-2 text-xs text-slate-400">区域加载中…</p>
          )}

          {!regionsLoading &&
            regions.map((region) => {
              const isOpenRegion = expanded.has(region.code)
              const selected = isRegionScope && regionCode === region.code
              return (
                <div key={region.code}>
                  <div
                    className={cn(
                      "flex w-full items-center gap-0.5 px-1 py-0.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                      selected && "bg-slate-100 font-medium dark:bg-slate-800",
                    )}
                  >
                    <button
                      type="button"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400"
                      aria-label={isOpenRegion ? "收起" : "展开"}
                      onClick={(e) => toggleExpand(region.code, e)}
                    >
                      {isOpenRegion ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1 py-1.5 pr-2 text-left"
                      onClick={() => {
                        setRegionCode(region.code)
                        setOpen(false)
                      }}
                      data-testid={`site-selector-region-${region.code}`}
                    >
                      <span className="truncate">{region.name}</span>
                      <span className="shrink-0 text-[10px] text-slate-400">·区域</span>
                    </button>
                  </div>
                  {isOpenRegion &&
                    region.sites.map((s) => (
                      <button
                        key={s.code}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-1 py-1.5 pl-10 pr-3 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                          siteCode === s.code && "bg-slate-100 font-medium dark:bg-slate-800",
                        )}
                        onClick={() => {
                          setSiteCode(s.code)
                          setOpen(false)
                        }}
                        data-testid={`site-selector-site-${s.code}`}
                      >
                        <span className="truncate">{s.label}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">·站点</span>
                      </button>
                    ))}
                </div>
              )
            })}

          {!regionsLoading &&
            unassignedSites.map((s) => (
              <button
                key={s.code}
                type="button"
                className={cn(
                  "flex w-full items-center gap-1 px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                  siteCode === s.code && "bg-slate-100 font-medium dark:bg-slate-800",
                )}
                onClick={() => {
                  setSiteCode(s.code)
                  setOpen(false)
                }}
                data-testid={`site-selector-site-${s.code}`}
              >
                <span className="truncate">{s.label}</span>
                <span className="shrink-0 text-[10px] text-slate-400">·站点</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
