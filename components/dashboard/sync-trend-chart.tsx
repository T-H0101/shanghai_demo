"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { getChartPalette, type ChartPalette } from "@/lib/chart-theme"
import { useSite } from "@/lib/site/site-context"
import { formatBeijingDate } from "@/components/shared/time-format"

// R.94 补丁: 真实 API 数据源 — 从 /api/sync/packages/trend 拉取
// 业务维：跟随全局站点（单站带 siteCode；全部站点则汇总各站）
// 日历日与接口一致：Asia/Shanghai（勿用 toISOString 取日）
interface TrendDay {
  date: string
  success: number
  failed: number
  partial: number
  skipped: number
}

interface TrendSite {
  siteCode: string
  days: TrendDay[]
}

interface SyncTrendChartProps {
  className?: string
}

export function SyncTrendChart({ className }: SyncTrendChartProps) {
  const { resolvedTheme } = useTheme()
  const { siteCode, isAllSites, isReady } = useSite()
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<TrendDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !isReady) return
    let cancelled = false
    setLoading(true)

    const params = new URLSearchParams({ days: "7" })
    if (!isAllSites && siteCode) {
      params.set("siteCode", siteCode)
    }

    fetch(`/api/sync/packages/trend?${params}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.code === 0 && Array.isArray(json.data) && json.data.length > 0) {
          // 单站接口已过滤；全部站点时把各站按日加总
          const dayMap = new Map<string, TrendDay>()
          for (const site of json.data as TrendSite[]) {
            for (const day of site.days) {
              if (!dayMap.has(day.date)) {
                dayMap.set(day.date, {
                  date: day.date,
                  success: 0,
                  failed: 0,
                  partial: 0,
                  skipped: 0,
                })
              }
              const existing = dayMap.get(day.date)!
              existing.success += day.success
              existing.failed += day.failed
              existing.partial += day.partial
              existing.skipped += day.skipped
            }
          }
          setData(Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)))
        } else {
          setData([])
        }
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setData([])
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [mounted, isReady, isAllSites, siteCode])

  // 防止 hydration mismatch: SSR 与首次客户端渲染使用 light, useEffect 后再切真实主题
  const isDark = mounted && resolvedTheme === "dark"
  const palette: ChartPalette = getChartPalette(isDark ? "dark" : "light")
  const scopeLabel = !isAllSites && siteCode ? siteCode : "全部站点"

  // 空状态: 无真实数据时显示空状态, 不 fallback 到 mock
  if (!loading && data.length === 0) {
    return (
      <Card className={`gap-0 ${className || ""}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              数据同步趋势
            </CardTitle>
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 text-xs dark:bg-slate-800 dark:text-slate-300">
              最近7日 · {scopeLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="h-[220px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          暂无趋势数据
        </CardContent>
      </Card>
    )
  }

  // 加载态
  if (loading) {
    return (
      <Card className={`gap-0 ${className || ""}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              数据同步趋势
            </CardTitle>
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 text-xs dark:bg-slate-800 dark:text-slate-300">
              最近7日 · {scopeLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="h-[220px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          加载中...
        </CardContent>
      </Card>
    )
  }

  // Recharts 在只有 1 个 category 时柱状条几乎不可见。
  // 补齐「北京时间」最近 7 个日历日, 保证含今天且布局正常。
  const paddedData = (() => {
    const todayBj = formatBeijingDate(new Date()) || new Date().toISOString().slice(0, 10)
    const dataByDate = new Map(data.map((d) => [d.date, d]))
    const result: TrendDay[] = []
    // 以今天为终点向前补 7 天（含今天）
    const end = new Date(`${todayBj}T12:00:00+08:00`)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end)
      d.setTime(end.getTime() - i * 24 * 60 * 60 * 1000)
      const ds = formatBeijingDate(d) || d.toISOString().slice(0, 10)
      result.push(dataByDate.get(ds) ?? { date: ds, success: 0, failed: 0, partial: 0, skipped: 0 })
    }
    return result
  })()

  return (
    <Card className={`gap-0 ${className || ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              数据同步趋势
            </CardTitle>
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 text-xs dark:bg-slate-800 dark:text-slate-300">
              最近7日 · {scopeLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400" style={{ color: palette.legendText }}>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.bar1 }}></span>成功
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.bar2 }}></span>失败
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.bar3 }}></span>部分
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={paddedData}
              margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
              barCategoryGap="25%"
              barGap={2}
            >
              <CartesianGrid strokeDasharray="1 1" vertical={false} stroke={palette.grid} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: palette.axis }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: palette.axis }}
                width={20}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: palette.tooltipBg,
                  border: `1px solid ${palette.tooltipBorder}`,
                  borderRadius: "4px",
                  color: palette.tooltipText,
                  fontSize: "11px",
                }}
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    success: "成功",
                    failed: "失败",
                    partial: "部分",
                    skipped: "跳过",
                  }
                  const key = String(name)
                  return [value, labels[key] ?? key]
                }}
              />
              <Bar dataKey="success" name="成功" fill={palette.bar1} radius={[1, 1, 0, 0]} />
              <Bar dataKey="failed" name="失败" fill={palette.bar2} radius={[1, 1, 0, 0]} />
              <Bar dataKey="partial" name="部分" fill={palette.bar3} radius={[1, 1, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
