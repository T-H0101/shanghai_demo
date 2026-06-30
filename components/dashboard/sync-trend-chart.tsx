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

// R.94 补丁: 真实 API 数据源 — 从 /api/sync/packages/trend 拉取
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
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<TrendDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    fetch("/api/sync/packages/trend?days=7")
      .then(res => res.json())
      .then(json => {
        if (json.code === 0 && Array.isArray(json.data) && json.data.length > 0) {
          // 聚合所有站点的数据到一条时间线
          const dayMap = new Map<string, TrendDay>()
          for (const site of json.data as TrendSite[]) {
            for (const day of site.days) {
              if (!dayMap.has(day.date)) {
                dayMap.set(day.date, { date: day.date, success: 0, failed: 0, partial: 0, skipped: 0 })
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
        setData([])
        setLoading(false)
      })
  }, [mounted])

  // 防止 hydration mismatch: SSR 与首次客户端渲染使用 light, useEffect 后再切真实主题
  const isDark = mounted && resolvedTheme === "dark"
  const palette: ChartPalette = getChartPalette(isDark ? "dark" : "light")

  // 空状态: 无真实数据时显示空状态, 不 fallback 到 mock
  if (!loading && data.length === 0) {
    return (
      <Card className={`gap-0 ${className || ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-50">数据同步趋势</CardTitle>
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
      <Card className={`gap-0 ${className || ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-50">数据同步趋势</CardTitle>
        </CardHeader>
        <CardContent className="h-[220px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          加载中...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`gap-0 ${className || ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              数据同步趋势
            </CardTitle>
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 text-xs dark:bg-slate-800 dark:text-slate-300">
              最近7日
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
      <CardContent className="pt-0 h-[calc(100%-2.5rem)]">
        <div className="h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
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
              />
              <Bar dataKey="success" fill={palette.bar1} radius={[1, 1, 0, 0]} />
              <Bar dataKey="failed" fill={palette.bar2} radius={[1, 1, 0, 0]} />
              <Bar dataKey="partial" fill={palette.bar3} radius={[1, 1, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
