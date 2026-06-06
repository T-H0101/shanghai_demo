"use client"

/**
 * Sprint 2F.4 - 全局 siteCode 选择器
 *
 * 放置位置: Header 右侧 (Sprint 2F.4)
 * 选项: SITE_CANDIDATES (不依赖 tbl_site)
 */

import { Globe } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSite, ALL_SITES, SITE_CANDIDATES } from "@/lib/site/site-context"
import { cn } from "@/lib/utils"

export function SiteSelector({ className }: { className?: string }) {
  const { siteCode, isAllSites, setSiteCode, isReady } = useSite()

  if (!isReady) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-slate-400", className)}>
        <Globe className="h-3.5 w-3.5" />
        <span>站点加载中…</span>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Globe className="h-3.5 w-3.5 text-slate-400" />
      <Select
        value={isAllSites ? ALL_SITES : (siteCode ?? ALL_SITES)}
        onValueChange={(v) => setSiteCode(v === ALL_SITES ? null : v)}
      >
        <SelectTrigger className="h-8 w-[140px] text-xs bg-slate-50 border-slate-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SITE_CANDIDATES.map(s => (
            <SelectItem key={s.code} value={s.code} className="text-xs">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
