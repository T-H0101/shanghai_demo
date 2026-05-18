"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

const chartData = [
  { date: "05月6", 备份: 45, 还原: 32, 校验: 28 },
  { date: "05月7", 备份: 52, 还原: 38, 校验: 35 },
  { date: "05月8", 备份: 48, 还原: 42, 校验: 32 },
  { date: "05月9", 备份: 55, 还原: 35, 校验: 38 },
  { date: "05月0", 备份: 62, 还原: 45, 校验: 42 },
  { date: "05月1", 备份: 58, 还原: 48, 校验: 45 },
  { date: "今日", 备份: 85, 还原: 65, 校验: 55 },
]

export function SyncTrendChart() {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              7日数据同步趋势分析
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              多维业务同步流量统计 (单位: TB)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                备份
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                还原
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                校验
              </span>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs">
                本周
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500">
                上月
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="备份" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="还原" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="校验" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
