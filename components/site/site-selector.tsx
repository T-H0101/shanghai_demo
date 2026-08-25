"use client"

/**
 * 全局 siteCode 选择器
 * - 站点列表来自中心注册表 (sync_sites)
 * - 放置位置: Header 右侧
 * - 选项来源: useSiteSites() -> /api/sync/config
 * - 必须包含「全部站点」选项：否则 value=__all__ 无匹配项时 Radix 会回落到第一项并误写站点
 * - 「进入站点」：选中具体站时 SSO 跳转；全部站点时禁用
 */

import { useState } from "react"
import { ExternalLink, Globe, Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { AppTooltip } from "@/components/shared/tooltip"
import { useSite, ALL_SITES, useSiteSites } from "@/lib/site/site-context"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

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
  const { siteCode, isAllSites, setSiteCode, isReady } = useSite()
  const { sites, loading, error, source } = useSiteSites()
  const [ssoJumping, setSsoJumping] = useState(false)

  const canEnterSite = Boolean(siteCode) && !isAllSites && !ssoJumping

  const handleEnterSite = async () => {
    if (!siteCode || isAllSites) {
      toast({
        title: "请先选择站点",
        description: "选中具体站点后再进入站点系统；「全部站点」不可跳转",
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
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setSsoJumping(false)
    }
  }

  const enterSiteButton = (
    <AppTooltip
      content={
        isAllSites || !siteCode
          ? "请先在左侧选择具体站点（全部站点不可进入）"
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
          "flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500",
          className
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

  // 失败或空: 仅 ALL_SITES 可选, 其余 disabled
  const hasError = error !== null
  const hasNoSites = sites.length === 0
  if (hasError || hasNoSites) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500",
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
            className="h-8 w-[220px] text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed"
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
        {enterSiteButton}
      </div>
    )
  }

  const options = [{ code: ALL_SITES, label: "全部站点" }, ...sites]
  const rawValue = isAllSites ? ALL_SITES : siteCode ?? ALL_SITES
  const selectValue = options.some((s) => s.code === rawValue) ? rawValue : ALL_SITES

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Globe className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
      <Select
        value={selectValue}
        onValueChange={(v) => {
          // Radix remount 时可能回落第一项并误触发；值未变则忽略
          if (v === selectValue) return
          setSiteCode(v === ALL_SITES ? null : v)
        }}
      >
        <SelectTrigger
          className="h-8 w-[220px] text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          data-testid="site-selector-trigger"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((s) => (
            <SelectItem key={s.code} value={s.code} className="text-xs">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span data-testid="site-selector-source" className="hidden">
        {error ? "error" : source}
      </span>
      {enterSiteButton}
    </div>
  )
}
