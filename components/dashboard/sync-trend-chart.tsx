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
  return (
    <Card className={`gap-0 ${className || ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold text-slate-900">
              任务执行趋势
            </CardTitle>
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 text-xs">
              最近7日
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-600"></span>封包
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-400"></span>扫描
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-300"></span>校验
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
              <CartesianGrid strokeDasharray="1 1" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                width={20}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "4px",
                  color: "#fff",
                  fontSize: "11px",
                }}
              />
              <Bar dataKey="backup" fill="#475569" radius={[1, 1, 0, 0]} />
              <Bar dataKey="restore" fill="#94a3b8" radius={[1, 1, 0, 0]} />
              <Bar dataKey="verify" fill="#cbd5e1" radius={[1, 1, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}