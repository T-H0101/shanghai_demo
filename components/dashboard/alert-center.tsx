"use client"

/**
 * 控制台任务告警 — 最近 10 条失败任务，更多进入任务管理
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { TaskDTO } from "@/lib/api/dto"
import { AlertCircle, ChevronRight, Clock, Info } from "lucide-react"
import { useSite, useSiteSites } from "@/lib/site/site-context"
import { formatBeijingTime } from "@/components/shared/time-format"

const PREVIEW_LIMIT = 10
const FETCH_INIT: RequestInit = { cache: "no-store", credentials: "include" }

/** 注册表 label 形如「SH01 上海站」，取站点名称部分 */
function resolveSiteDisplayName(code: string, registryLabel?: string): string {
  if (!registryLabel || registryLabel === code) return code
  const trimmed = registryLabel.trim()
  if (trimmed.startsWith(`${code} `)) {
    const name = trimmed.slice(code.length + 1).trim()
    return name || code
  }
  return trimmed
}

/** 告警列表仅展示业务终态：警告 / 中止 */
function taskAlertStatusLabel(statusLabel?: string): string {
  if (statusLabel === "警告" || statusLabel === "中止") return statusLabel
  return statusLabel?.trim() || "—"
}

export function AlertCenter() {
  const router = useRouter()
  const pathname = usePathname()
  const { siteCode, regionCode, isAllSites, isReady } = useSite()
  const { sites } = useSiteSites()
  const siteLabelByCode = useMemo(
    () => new Map(sites.map((s) => [s.code, s.label])),
    [sites],
  )
  const [tasks, setTasks] = useState<TaskDTO[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadFailedTasks = useCallback(async () => {
    try {
      setLoading(true)
      const qs = new URLSearchParams()
      qs.set("statusFilter", "alert")
      qs.set("orderBy", "recent")
      qs.set("pageSize", String(PREVIEW_LIMIT))
      qs.set("page", "1")
      if (!isAllSites && siteCode) qs.set("siteCode", siteCode)
      else if (regionCode) qs.set("regionCode", regionCode)

      const res = await fetch(`/api/tasks?${qs.toString()}`, FETCH_INIT)
      const json = (await res.json()) as {
        code?: number
        data?: { items?: TaskDTO[]; total?: number }
      }
      if (!res.ok || json.code !== 0) {
        setTasks([])
        setTotal(0)
        return
      }
      setTasks(json.data?.items ?? [])
      setTotal(json.data?.total ?? 0)
    } catch {
      setTasks([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [isAllSites, siteCode, regionCode])

  useEffect(() => {
    if (isReady) void loadFailedTasks()
  }, [pathname, isReady, loadFailedTasks])

  return (
    <Card className="gap-0 relative bg-white dark:bg-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <AlertCircle className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            任务告警
            {total > 0 && (
              <Badge variant="destructive" className="ml-1">
                {total}
              </Badge>
            )}
          </CardTitle>
          <button
            type="button"
            onClick={() => router.push("/tasks")}
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
                key={`alert-skeleton-${i}`}
                className="h-10 bg-slate-100 dark:bg-slate-700 rounded animate-pulse"
              />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm flex flex-col items-center gap-2">
            <Info className="h-8 w-8 text-slate-300 dark:text-slate-400" />
            <span>暂无任务告警</span>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                onClick={() => router.push("/tasks")}
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm break-words line-clamp-2 text-slate-900 dark:text-slate-100">
                    任务告警：{task.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {resolveSiteDisplayName(task.siteCode, siteLabelByCode.get(task.siteCode))}
                    </span>
                    <span className="text-[10px] text-slate-300 dark:text-slate-400">·</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {taskAlertStatusLabel(task.statusLabel)}
                    </span>
                    <span className="text-[10px] text-slate-300 dark:text-slate-400">·</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {task.startedAt ? formatBeijingTime(task.startedAt) || "—" : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
