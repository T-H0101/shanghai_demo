"use client"

/**
 * Sprint 2G.2 - Dashboard 最近同步记录
 *
 * API mode: 真实 sync_package_log 最近 10 条
 * Mock mode: 不渲染
 * 失败: 显示空态
 */

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, RefreshCw, Package } from "lucide-react"
import { useSite } from "@/lib/site/site-context"
import { TimeDisplay } from "@/components/shared/time-format"
import { isApiMode } from "@/lib/api"
import {
  fetchRecentSyncs,
  type RecentSyncItem,
  type DashboardSource,
} from "@/lib/api/dashboard-provider"

const statusBadge: Record<string, { label: string; color: string }> = {
  success: { label: "成功", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" },
  failed: { label: "失败", color: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800" },
  partial: { label: "部分成功", color: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800" },
  running: { label: "运行中", color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800" },
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms < 0) return "—"
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m${Math.floor((ms % 60_000) / 1000)}s`
}

export function DashboardRecentSyncs() {
  const { siteCode, isReady } = useSite()
  const [items, setItems] = useState<RecentSyncItem[]>([])
  const [source, setSource] = useState<DashboardSource>("unavailable")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isReady) return
    if (!isApiMode) return
    let cancelled = false
    setLoading(true)
    fetchRecentSyncs(siteCode, 10).then((res) => {
      if (cancelled) return
      setItems(res.data ?? [])
      setSource(res.source)
      setError(res.error)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [isReady, siteCode])

  if (!isApiMode) return null

  if (source === "unavailable" || error) {
    return (
      <Card className="gap-0 h-full bg-white dark:bg-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">最近同步</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>同步记录加载失败{error ? ` (${error})` : ""}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              fetchRecentSyncs(siteCode, 10).then((res) => {
                setItems(res.data ?? [])
                setSource(res.source)
                setError(res.error)
                setLoading(false)
              })
            }}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 self-start"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            重试
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="gap-0 h-full bg-white dark:bg-slate-800" data-testid="dashboard-recent-syncs">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">最近同步</CardTitle>
            <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-[10px]">
              实时
            </Badge>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {loading ? "加载中..." : `${items.length} 条`}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex flex-col h-[calc(100%-3.5rem)]">
        <div className="flex-1 space-y-1.5 overflow-y-auto min-h-0">
          {items.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-1">
              <Package className="h-5 w-5 text-slate-300 dark:text-slate-600" />
              <span>暂无同步记录</span>
            </div>
          ) : (
            items.map((it) => {
              const badge = statusBadge[it.status] ?? {
                label: it.status,
                color: "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
              }
              return (
                <div
                  key={`${it.siteCode}-${it.batchId}`}
                  className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                        {it.siteCode}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {it.batchId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                      <TimeDisplay value={it.finishedAt} mode="datetime" />
                      <span>·</span>
                      <span>耗时 {formatDuration(it.durationMs)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {it.successTableCount}/{it.tableCount} 表
                    </span>
                    <Badge className={`text-[10px] ${badge.color}`}>{badge.label}</Badge>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
