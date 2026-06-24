"use client"

/**
 * Sprint 2G.2 - Dashboard 真实总览摘要
 *
 * API mode: 调用 /api/dashboard/summary, 跟随全局 siteCode
 * Mock mode: 隐藏不渲染 (保持原 mock 卡片)
 * 失败: 显示"统计加载失败"占位
 */

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Activity,
  Database,
  HardDrive,
  Users,
  Package,
  AlertTriangle,
  RefreshCw,
  Building2,
  CheckCircle2,
} from "lucide-react"
import { useSite } from "@/lib/site/site-context"
import { formatBeijingTime, formatBeijingTimeOnly } from "@/components/shared/time-format"
import { isApiMode } from "@/lib/api"
import {
  fetchDashboardSummary,
  type DashboardSummaryData,
  type DashboardSource,
} from "@/lib/api/dashboard-provider"

interface StatTile {
  label: string
  value: string
  hint?: string
  icon: typeof Activity
  tone: "blue" | "indigo" | "amber" | "emerald" | "slate" | "red"
}

function toneClasses(tone: StatTile["tone"]): string {
  switch (tone) {
    case "blue":
      return "bg-blue-50 text-blue-600"
    case "indigo":
      return "bg-indigo-50 text-indigo-600"
    case "amber":
      return "bg-amber-50 text-amber-600"
    case "emerald":
      return "bg-emerald-50 text-emerald-600"
    case "red":
      return "bg-red-50 text-red-600"
    default:
      return "bg-slate-50 text-slate-600"
  }
}

function formatLastSync(value: string | null): string {
  if (!value) return "—"
  return formatBeijingTime(value)
}

function formatRate(value: number | null): string {
  if (value === null || value === undefined) return "—"
  return `${value}%`
}

function buildTiles(d: DashboardSummaryData): StatTile[] {
  return [
    {
      label: "任务",
      value: String(d.taskCount),
      hint: d.taskCount > 0 ? `累计入中心库` : "暂无任务",
      icon: Activity,
      tone: "blue",
    },
    {
      label: "设备",
      value: String(d.deviceCount),
      hint: d.deviceCount > 0 ? `已注册统一设备` : "暂无设备",
      icon: HardDrive,
      tone: "indigo",
    },
    {
      label: "卷",
      value: String(d.volumeCount),
      hint: d.volumeCount > 0 ? `统一卷条目` : "暂无卷",
      icon: Database,
      tone: "amber",
    },
    {
      label: "用户",
      value: String(d.userCount),
      hint: d.userCount > 0 ? `统一用户条目` : "暂无用户",
      icon: Users,
      tone: "slate",
    },
    {
      label: "同步包",
      value: String(d.packageCount),
      hint:
        d.packageCount > 0
          ? `失败 ${d.failedPackageCount} · 成功率 ${formatRate(d.successRate)}`
          : "暂无同步包",
      icon: Package,
      tone: d.failedPackageCount > 0 ? "red" : "emerald",
    },
    {
      label: "最后同步",
      value: formatLastSync(d.lastSyncAt),
      hint: d.siteCount !== null ? `已接入 ${d.siteCount} 站点` : "单站点视图",
      icon: d.siteCount !== null ? Building2 : CheckCircle2,
      tone: "slate",
    },
  ]
}

export function DashboardSummaryBar() {
  const { siteCode, isReady } = useSite()
  const [data, setData] = useState<DashboardSummaryData | null>(null)
  const [source, setSource] = useState<DashboardSource>("unavailable")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isReady) return
    if (!isApiMode) {
      setData(null)
      setSource("mock")
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchDashboardSummary(siteCode).then((res) => {
      if (cancelled) return
      setData(res.data)
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
      <Card className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>统计加载失败{error ? ` (${error})` : ""}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            fetchDashboardSummary(siteCode).then((res) => {
              setData(res.data)
              setSource(res.source)
              setError(res.error)
              setLoading(false)
            })
          }}
          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          重试
        </button>
      </Card>
    )
  }

  if (!data) return null

  const tiles = buildTiles(data)
  const siteLabel = siteCode ?? "全部站点"

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">总览统计</span>
          <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 text-[10px]">
            {siteLabel}
          </Badge>
          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200 text-[10px]">
            实时
          </Badge>
        </div>
        <span className="text-[10px] text-slate-400">
          {loading ? "加载中..." : `刷新于 ${formatBeijingTimeOnly(new Date())}`}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <div
              key={tile.label}
              className="flex flex-col gap-1.5 rounded border border-slate-100 bg-slate-50/50 p-3"
            >
              <div className="flex items-center gap-1.5">
                <div className={`p-1 rounded ${toneClasses(tile.tone)}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] text-slate-500 uppercase tracking-wide">
                  {tile.label}
                </span>
              </div>
              <div className="text-xl font-bold text-slate-900 leading-tight">
                {tile.value}
              </div>
              {tile.hint && (
                <div className="text-[10px] text-slate-500 leading-tight">
                  {tile.hint}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
