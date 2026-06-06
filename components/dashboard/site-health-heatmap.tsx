"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { rackProvider } from "@/lib/api"
import type { Rack } from "@/lib/types/rack"
import { cn } from "@/lib/utils"
import { MOCK_STORE_EVENT } from "@/lib/api/mock-store"

const statusBadge: Record<string, { label: string; color: string }> = {
  online: { label: "在线", color: "bg-emerald-100 text-emerald-700" },
  offline: { label: "离线", color: "bg-slate-100 text-slate-600" },
  error: { label: "异常", color: "bg-red-100 text-red-700" },
  maintenance: { label: "维护中", color: "bg-amber-100 text-amber-700" },
}

interface SiteHealthHeatmapProps {
  className?: string
}

export function SiteHealthHeatmap({ className }: SiteHealthHeatmapProps) {
  const pathname = usePathname()
  const [racks, setRacks] = useState<Rack[]>([])

  const loadRacks = () => {
    rackProvider.getAll().then(setRacks).catch(() => {})
  }

  // 首次加载 + 路由变化时重新读取
  useEffect(() => {
    loadRacks()
  }, [pathname])

  // 监听 localStorage 变化
  useEffect(() => {
    const handler = () => loadRacks()
    window.addEventListener(MOCK_STORE_EVENT, handler)
    return () => window.removeEventListener(MOCK_STORE_EVENT, handler)
  }, [])

  const sorted = [...racks].sort((a, b) => {
    const statusOrder: Record<string, number> = { error: 0, offline: 1, maintenance: 2, online: 3 }
    return (statusOrder[a.deviceStatus ?? "online"] ?? 3) - (statusOrder[b.deviceStatus ?? "online"] ?? 3)
  })

  return (
    <Card className={`gap-0 h-full ${className || ''}`}>
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-900">
            设备健康状态
          </CardTitle>
          <span className="text-xs text-slate-400">
            {racks.filter(r => r.deviceStatus === "online").length}/{racks.length} 在线
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex flex-col h-[calc(100%-2.5rem)]">
        <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
          {sorted.map((rack) => {
            const status = statusBadge[rack.deviceStatus ?? "online"] ?? statusBadge.online
            return (
              <div key={`${rack.siteCode}-${rack.rackId}-${rack.id}`} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700 truncate">{rack.rackId}</span>
                    <span className="text-[10px] text-slate-400">{rack.deviceType}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400">{rack.ip}</span>
                    <span className="text-[10px] text-slate-300">·</span>
                    <span className="text-[10px] text-slate-400">{rack.currentTaskCount ?? 0} 任务</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <Progress value={rack.usagePercent} className="h-1 w-12" />
                    <span className="text-[10px] text-slate-400">{rack.usagePercent}%</span>
                  </div>
                  <Badge className={cn("text-[10px]", status.color)}>{status.label}</Badge>
                </div>
              </div>
            )
          })}
          {racks.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-xs">暂无设备数据</div>
          )}
        </div>

        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>最后同步: {new Date().toLocaleTimeString("zh-CN", { hour12: false })}</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 正常
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 ml-2" /> 异常
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 ml-2" /> 维护
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
