"use client"

import { useState, useEffect } from "react"
import { useSite } from "@/lib/site/site-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { AlertTriangle, ClipboardList, FileText, RefreshCw, Shield, Clock } from "lucide-react"

interface InspectionRecord {
  id: string
  taskName: string
  status: string
  executedAt: string
}

interface InspectionStats {
  totalTasks: number
  totalPolicies: number
  recentLogs: number
}

export function InspectionView() {
  const { siteCode } = useSite()

  const [stats, setStats] = useState<InspectionStats | null>(null)
  const [records, setRecords] = useState<InspectionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(false)

      try {
        const params = new URLSearchParams()
        if (siteCode) params.set("siteCode", siteCode)

        const res = await fetch(`/api/inspection/summary?${params.toString()}`, {
          cache: "no-store",
        })

        if (cancelled) return

        if (!res.ok) {
          // API not available — show empty state
          setStats(null)
          setRecords([])
          return
        }

        const json = await res.json()

        if (cancelled) return

        // Gracefully handle missing or unexpected data shapes
        if (json?.inspection) {
          setStats({
            totalTasks: json.inspection.totalTasks ?? 0,
            totalPolicies: json.inspection.totalPolicies ?? 0,
            recentLogs: json.inspection.recentLogs ?? 0,
          })
          setRecords(
            (json.inspection.recentRecords ?? []).map((r: any) => ({
              id: r.id ?? "",
              taskName: r.taskName ?? "",
              status: r.status ?? "",
              executedAt: r.executedAt ?? "",
            }))
          )
        } else {
          setStats(null)
          setRecords([])
        }
      } catch {
        if (!cancelled) {
          setStats(null)
          setRecords([])
          setError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchData()
    return () => { cancelled = true }
  }, [siteCode])

  const siteLabel = siteCode ?? "全部站点"

  // ── Loading state ──
  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>巡检概览</CardTitle>
            <CardDescription>站点巡检状态汇总 ({siteLabel})</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-6 w-6 text-slate-400" />
              <span className="ml-2 text-sm text-slate-500">加载中...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>巡检概览</CardTitle>
            <CardDescription>站点巡检状态汇总 ({siteLabel})</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-500 mb-3" />
              <p className="text-sm text-slate-600 dark:text-slate-300">巡检数据加载失败</p>
              <p className="text-xs text-slate-400 mt-1">请检查网络连接或稍后重试</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Empty state ──
  const isEmpty = !stats && records.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>巡检概览</CardTitle>
          <CardDescription>站点巡检状态汇总 ({siteLabel})</CardDescription>
        </CardHeader>
      </Card>

      {/* Empty state */}
      {isEmpty && (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-base font-medium text-slate-700 dark:text-slate-200">暂无巡检记录</p>
              <p className="text-sm text-slate-400 mt-1">请先完成站点同步</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-500" />
                检查任务
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{stats.totalTasks}</p>
              <p className="text-xs text-slate-400 mt-1">全部巡检任务</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-500" />
                巡检策略
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{stats.totalPolicies}</p>
              <p className="text-xs text-slate-400 mt-1">已配置策略</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                最近日志
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{stats.recentLogs}</p>
              <p className="text-xs text-slate-400 mt-1">近 7 天记录</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent records */}
      {records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">最近巡检记录</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {records.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between px-6 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-slate-900">{rec.taskName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      className={
                        rec.status === "success" || rec.status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : rec.status === "running" || rec.status === "processing"
                          ? "bg-blue-100 text-blue-700"
                          : rec.status === "failed" || rec.status === "error"
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-600"
                      }
                    >
                      {rec.status === "success" || rec.status === "completed"
                        ? "已完成"
                        : rec.status === "running" || rec.status === "processing"
                        ? "执行中"
                        : rec.status === "failed" || rec.status === "error"
                        ? "失败"
                        : rec.status || "—"}
                    </Badge>
                    <span className="text-xs text-slate-400">{rec.executedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}