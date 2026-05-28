"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  LayoutGrid,
  Database,
  Activity,
  AlertTriangle,
  HardDrive,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react"
import { taskProvider, rackProvider } from "@/lib/api"
import { MOCK_STORE_EVENT } from "@/lib/api/mock-store"

export function StatsCards() {
  const pathname = usePathname()
  const [taskStats, setTaskStats] = useState({ total: 0, running: 0, completed: 0, failed: 0, pending: 0 })
  const [rackStats, setRackStats] = useState({ total: 0, online: 0, offline: 0, avgUsage: 0, totalCapacity: "0 TB", remainingCapacity: "0 TB", usedSlots: 0, totalSlotsAll: 0 })

  const loadStats = async () => {
    try {
      const [tStats, rStats] = await Promise.all([taskProvider.getStats(), rackProvider.getStats()])
      setTaskStats(tStats)
      setRackStats(rStats)
    } catch { /* ignore */ }
  }

  // 首次加载 + 路由变化时重新读取
  useEffect(() => {
    loadStats()
  }, [pathname])

  // 监听 localStorage 变化
  useEffect(() => {
    const handler = () => loadStats()
    window.addEventListener(MOCK_STORE_EVENT, handler)
    return () => window.removeEventListener(MOCK_STORE_EVENT, handler)
  }, [])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1 - 任务总数 */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded bg-blue-50">
            <Activity className="h-4 w-4 text-blue-600" />
          </div>
          <span className="text-xs text-slate-500 uppercase tracking-wide">任务总数</span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-2xl font-bold text-slate-900">{taskStats.total}</span>
          <span className="text-xs text-slate-500">个</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-blue-600 flex items-center gap-1"><Clock className="h-3 w-3" />{taskStats.running} 运行中</span>
          <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{taskStats.completed} 已完成</span>
        </div>
      </Card>

      {/* Card 2 - 运行任务 */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded bg-emerald-50">
            <Activity className="h-4 w-4 text-emerald-600" />
          </div>
          <span className="text-xs text-slate-500 uppercase tracking-wide">运行任务</span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-2xl font-bold text-emerald-600">{taskStats.running}</span>
          <span className="text-xs text-slate-500">进行中</span>
        </div>
        <div className="text-xs text-slate-500">
          {taskStats.pending} 待处理 · {taskStats.failed} 失败
        </div>
      </Card>

      {/* Card 3 - 设备在线 */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded bg-indigo-50">
            <HardDrive className="h-4 w-4 text-indigo-600" />
          </div>
          <span className="text-xs text-slate-500 uppercase tracking-wide">设备在线</span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-2xl font-bold text-slate-900">{rackStats.online}/{rackStats.total}</span>
          <span className="text-xs text-slate-500">台</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-600">{rackStats.online} 在线</span>
          <span className="text-red-600">{rackStats.offline} 离线</span>
        </div>
      </Card>

      {/* Card 4 - 存储使用率 */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded bg-amber-50">
            <Database className="h-4 w-4 text-amber-600" />
          </div>
          <span className="text-xs text-slate-500 uppercase tracking-wide">存储使用率</span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-2xl font-bold text-slate-900">{rackStats.avgUsage}%</span>
        </div>
        <Progress value={rackStats.avgUsage} className="h-1.5 mb-1" />
        <div className="text-xs text-slate-500">
          已用 {rackStats.usedSlots}/{rackStats.totalSlotsAll} 盘位
        </div>
      </Card>
    </div>
  )
}