"use client"

import { Card } from "@/components/ui/card"
import {
  LayoutGrid,
  Database,
  Activity,
  AlertTriangle,
} from "lucide-react"
import { siteStats } from "@/lib/mock/sites"
import { taskStats } from "@/lib/mock/tasks"

export function StatsCards() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {/* Card 1 - Sites */}
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded bg-slate-100">
            <LayoutGrid className="h-4 w-4 text-slate-600" />
          </div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">全局站点</span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-xl font-bold text-slate-900">{siteStats.total}</span>
          <span className="text-[10px] text-slate-500">个</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-slate-600">{siteStats.online} 在线</span>
          <span className="text-amber-600">{siteStats.degraded} 降级</span>
          <span className="text-red-600">{siteStats.offline} 离线</span>
        </div>
      </Card>

      {/* Card 2 - Capacity */}
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded bg-slate-100">
            <Database className="h-4 w-4 text-slate-600" />
          </div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">存储容量</span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-xl font-bold text-slate-900">{siteStats.avgStorageUsed}</span>
          <span className="text-[10px] text-slate-500">% 使用率</span>
        </div>
        <div className="text-[10px] text-slate-500">
          {siteStats.syncing} 站点同步中
        </div>
      </Card>

      {/* Card 3 - Active Tasks */}
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded bg-slate-100">
            <Activity className="h-4 w-4 text-slate-600" />
          </div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">运行任务</span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-xl font-bold text-slate-900">{taskStats.running}</span>
          <span className="text-[10px] text-slate-500">进行中</span>
        </div>
        <div className="text-[10px] text-slate-500">
          共 {taskStats.total} 个任务
        </div>
      </Card>

      {/* Card 4 - Alerts */}
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">未处理告警</span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-xl font-bold text-red-600">{taskStats.failed + 1}</span>
          <span className="text-[10px] text-slate-500">条</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded bg-red-600"></span>
          <span className="h-2 w-2 rounded bg-amber-600"></span>
          <span className="text-[10px] text-slate-500 ml-1">严重 / 警告</span>
        </div>
      </Card>
    </div>
  )
}