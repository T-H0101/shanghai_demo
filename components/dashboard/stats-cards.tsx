"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  LayoutGrid,
  Database,
  Activity,
  AlertTriangle,
} from "lucide-react"
import { siteStats } from "@/lib/mock/sites"
import { taskStats } from "@/lib/mock/tasks"

const statsData = [
  {
    icon: LayoutGrid,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    title: "全局站点",
    value: siteStats.total,
    unit: "个站点",
    details: [
      { label: "在线", value: siteStats.online, color: "text-slate-600" },
      { label: "负载高", value: siteStats.degraded, color: "text-amber-600" },
      { label: "离线", value: siteStats.offline, color: "text-red-600" },
    ],
  },
  {
    icon: Database,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    title: "存储容量",
    value: siteStats.avgStorageUsed,
    unit: "% 平均使用率",
    details: [
      { label: "同步中", value: siteStats.syncing, color: "text-blue-600" },
    ],
  },
  {
    icon: Activity,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    title: "运行任务",
    value: taskStats.running,
    unit: "进行中",
    extra: taskStats.total,
    extraUnit: "总任务",
  },
  {
    icon: AlertTriangle,
    iconBg: "bg-slate-100",
    iconColor: "text-red-600",
    title: "未处理告警",
    value: taskStats.failed + 1,
    unit: "条",
    alerts: [
      { level: 1, color: "bg-red-600" },
      { level: 2, color: "bg-amber-600" },
    ],
  },
]

export function StatsCards() {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {/* Card 1 - Sites */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded ${statsData[0].iconBg}`}>
            <LayoutGrid className={`h-5 w-5 ${statsData[0].iconColor}`} />
          </div>
          <span className="text-xs text-slate-500">{statsData[0].title}</span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-2xl font-bold text-slate-900">{statsData[0].value}</span>
          <span className="text-xs text-slate-500">{statsData[0].unit}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-600">{statsData[0].details[0].value} 在线</span>
          <span className="text-amber-600">{statsData[0].details[1].value} 负载高</span>
          <span className="text-red-600">{statsData[0].details[2].value} 离线</span>
        </div>
      </Card>

      {/* Card 2 - Capacity */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded ${statsData[1].iconBg}`}>
            <Database className={`h-5 w-5 ${statsData[1].iconColor}`} />
          </div>
          <span className="text-xs text-slate-500">{statsData[1].title}</span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-2xl font-bold text-slate-900">{statsData[1].value}</span>
          <span className="text-xs text-slate-500">{statsData[1].unit}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>使用率: {statsData[1].details[0].value}</span>
        </div>
      </Card>

      {/* Card 3 - Active Tasks */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded ${statsData[2].iconBg}`}>
            <Activity className={`h-5 w-5 ${statsData[2].iconColor}`} />
          </div>
          <span className="text-xs text-slate-500">{statsData[2].title}</span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-2xl font-bold text-slate-900">{statsData[2].value}</span>
          <span className="text-xs text-slate-500">{statsData[2].unit}</span>
        </div>
        {statsData[2].extra !== undefined && (
          <div className="text-xs text-slate-500">
            {statsData[2].extra} {statsData[2].extraUnit}
          </div>
        )}
      </Card>

      {/* Card 4 - Alerts */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded ${statsData[3].iconBg}`}>
            <AlertTriangle className={`h-5 w-5 ${statsData[3].iconColor}`} />
          </div>
          <span className="text-xs text-slate-500">{statsData[3].title}</span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-2xl font-bold text-red-600">{statsData[3].value}</span>
          <span className="text-xs text-slate-500">{statsData[3].unit}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-red-600"></span>
          <span className="h-4 w-4 rounded bg-amber-600"></span>
        </div>
      </Card>
    </div>
  )
}
