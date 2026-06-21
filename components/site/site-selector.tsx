"use client"

/**
 * Sprint 2F.4 - 全局 siteCode 选择器
 * Sprint R.69 - 站点列表来自中心注册表 (`sync_sites`)
 *
 * 放置位置: Header 右侧 (Sprint 2F.4)
 * 选项来源: useSiteSites() -> /api/sync/config (R.61 已落地)
 */

import { Globe } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSite, ALL_SITES, useSiteSites } from "@/lib/site/site-context"
import { cn } from "@/lib/utils"

export function SiteSelector({ className }: { className?: string }) {
  const { siteCode, isAllSites, setSiteCode, isReady } = useSite()
  const { sites, loading, error, source } = useSiteSites()

  if (!isReady) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs text-slate-400",
          className
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        <span>站点加载中…</span>
      </div>
    )
  }

  // 加载中: 显示 loading 文案
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs text-slate-400",
          className
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        <span data-testid="site-selector-loading">加载中</span>
        <span data-testid="site-selector-source" className="hidden">
          {error ? "error" : "sync_sites"}
        </span>
      </div>
    )
  }

  // 失败或空: 仅 ALL_SITES 可选, 其余 disabled
  const hasError = error !== null
  const hasNoSites = sites.length === 0
  if (hasError || hasNoSites) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs text-slate-400",
          className
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        <Select
          value={ALL_SITES}
          onValueChange={() => {
            /* disabled in error/empty state */
          }}
          disabled
        >
          <SelectTrigger
            className="h-8 w-[140px] text-xs bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
            data-testid="site-selector-trigger"
          >
            <SelectValue placeholder="未注册站点" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SITES} className="text-xs">
              未注册站点
            </SelectItem>
          </SelectContent>
        </Select>
        <span data-testid="site-selector-source" className="hidden">
          {error ? "error" : source}
        </span>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Globe className="h-3.5 w-3.5 text-slate-400" />
      <Select
        value={isAllSites ? ALL_SITES : siteCode ?? ALL_SITES}
        onValueChange={(v) => setSiteCode(v === ALL_SITES ? null : v)}
      >
        <SelectTrigger
          className="h-8 w-[140px] text-xs bg-slate-50 border-slate-200"
          data-testid="site-selector-trigger"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sites.map((s) => (
            <SelectItem key={s.code} value={s.code} className="text-xs">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span data-testid="site-selector-source" className="hidden">
        {error ? "error" : source}
      </span>
    </div>
  )
}
