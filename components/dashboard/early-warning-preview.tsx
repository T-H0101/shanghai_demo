"use client"

/**
 * 控制台站点预警预览 — 未处理/处理中最近 10 条，更多进入 /early-warning
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, ChevronRight, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSite, useSiteSites } from "@/lib/site/site-context"
import { formatBeijingTime } from "@/components/shared/time-format"
import { formatSiteLabel } from "@/components/users/site-field"
import type { EarlyWarningListItem } from "@/lib/early-warning/display"

const PREVIEW_LIMIT = 10
const FETCH_INIT: RequestInit = { cache: "no-store", credentials: "include" }

function levelTextClass(level: number | null): string {
  if (level == null || level === 0) return "text-amber-600 dark:text-amber-400"
  if (level === 1) return "text-orange-600 dark:text-orange-400"
  return "text-red-600 dark:text-red-400"
}

export function EarlyWarningPreview() {
  const router = useRouter()
  const pathname = usePathname()
  const { siteCode, isAllSites, isReady } = useSite()
  const { sites } = useSiteSites()
  const siteLabelByCode = useMemo(
    () => new Map(sites.map((s) => [s.code, s.label])),
    [sites],
  )

  const [items, setItems] = useState<EarlyWarningListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadPreview = useCallback(async () => {
    try {
      setLoading(true)
      const qs = new URLSearchParams()
      qs.set("limit", String(PREVIEW_LIMIT))
      qs.set("offset", "0")
      qs.set("statusGroup", "open")
      if (!isAllSites && siteCode) qs.set("siteCode", siteCode)

      const res = await fetch(`/api/early-warning?${qs.toString()}`, FETCH_INIT)
      const json = (await res.json()) as {
        code?: number
        data?: { items?: EarlyWarningListItem[]; total?: number }
      }
      if (!res.ok || json.code !== 0) {
        setItems([])
        setTotal(0)
        return
      }
      setItems(json.data?.items ?? [])
      setTotal(json.data?.total ?? 0)
    } catch {
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [isAllSites, siteCode])

  useEffect(() => {
    if (isReady) void loadPreview()
  }, [pathname, isReady, loadPreview])

  return (
    <Card className="gap-0 bg-white dark:bg-slate-800" data-testid="dashboard-early-warning">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <AlertTriangle className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            站点预警
            {total > 0 && (
              <Badge variant="destructive" className="ml-1">
                {total}
              </Badge>
            )}
          </CardTitle>
          <button
            type="button"
            onClick={() => router.push("/early-warning")}
            className="text-xs text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 flex items-center gap-1"
          >
            查看全部 <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={`ew-skeleton-${i}`}
                className="h-10 bg-slate-100 dark:bg-slate-700 rounded animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
            暂无待处理站点预警
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const siteLabel = formatSiteLabel(
                item.sourceSiteId,
                siteLabelByCode.get(item.sourceSiteId),
              )
              return (
                <div
                  key={`${item.sourceSiteId}-${item.sourceRecordId}`}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  onClick={() => router.push("/early-warning")}
                >
                  <AlertTriangle
                    className={cn("h-4 w-4 shrink-0 mt-0.5", levelTextClass(item.level))}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm break-words line-clamp-2 text-slate-900 dark:text-slate-100">
                      {item.title || "—"}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {siteLabel}
                      </span>
                      <span className="text-[10px] text-slate-300 dark:text-slate-400">·</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {item.typeLabel}
                      </span>
                      <span className="text-[10px] text-slate-300 dark:text-slate-400">·</span>
                      <span className={cn("text-[10px]", levelTextClass(item.level))}>
                        {item.levelLabel}
                      </span>
                      <span className="text-[10px] text-slate-300 dark:text-slate-400">·</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {item.triggeredAt
                          ? formatBeijingTime(item.triggeredAt) || "—"
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
