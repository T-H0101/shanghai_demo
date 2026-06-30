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
import { isApiMode } from "@/lib/api"
import { getChartPalette, type ChartPalette } from "@/lib/chart-theme"

const chartData = [
  { time: "08:00", backup: 12, restore: 8, verify: 5 },
  { time: "09:00", backup: 18, restore: 12, verify: 9 },
  { time: "10:00", backup: 24, restore: 15, verify: 12 },
  { time: "11:00", backup: 21, restore: 18, verify: 8 },
  { time: "12:00", backup: 15, restore: 10, verify: 6 },
  { time: "13:00", backup: 28, restore: 22, verify: 14 },
  { time: "14:00", backup: 35, restore: 25, verify: 18 },
]

interface SyncTrendChartProps {
  className?: string
}

export function SyncTrendChart({ className }: SyncTrendChartProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 防止 hydration mismatch: SSR 与首次客户端渲染使用 light,useEffect 后再切真实主题
  const isDark = mounted && resolvedTheme === "dark"
  const palette: ChartPalette = getChartPalette(isDark ? "dark" : "light")

  if (isApiMode) {
    return (
      <Card className={`gap-0 ${className || ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-50">任务执行趋势</CardTitle>
        </CardHeader>
        <CardContent className="h-[220px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          暂无趋势数据
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
              任务执行趋势
            </CardTitle>
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 text-xs dark:bg-slate-800 dark:text-slate-300">
              最近7日
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400" style={{ color: palette.legendText }}>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.bar1 }}></span>封包
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.bar2 }}></span>扫描
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.bar3 }}></span>校验
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 h-[calc(100%-2.5rem)]">
        <div className="h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
              barCategoryGap="25%"
              barGap={2}
            >
              <CartesianGrid strokeDasharray="1 1" vertical={false} stroke={palette.grid} />
              <XAxis
                dataKey="time"
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
              <Bar dataKey="backup" fill={palette.bar1} radius={[1, 1, 0, 0]} />
              <Bar dataKey="restore" fill={palette.bar2} radius={[1, 1, 0, 0]} />
              <Bar dataKey="verify" fill={palette.bar3} radius={[1, 1, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
