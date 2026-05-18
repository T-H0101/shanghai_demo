"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

type SiteStatus = "normal" | "warning" | "critical"

interface Site {
  name: string
  status: SiteStatus
  label: string
  metric?: string
}

const sites: Site[] = [
  { name: "北京", status: "normal", label: "健康hy", metric: "Latency: 12ms" },
  { name: "上海", status: "normal", label: "健康hy", metric: "Latency: 8ms" },
  { name: "深圳", status: "normal", label: "High Load", metric: "CPU: 88%" },
  { name: "成都", status: "normal", label: "健康hy", metric: "Latency: 24ms" },
  { name: "广州", status: "critical", label: "Abnorm异", metric: "Offline" },
  { name: "天津", status: "normal", label: "健康hy", metric: "Latency: 18ms" },
]

const statusColors: Record<SiteStatus, string> = {
  normal: "bg-emerald-500 hover:bg-emerald-600",
  warning: "bg-amber-500 hover:bg-amber-600",
  critical: "bg-red-500 hover:bg-red-600",
}

export function SiteHealthHeatmap() {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              站点健康热力图
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              核心城市机房实时状态
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <RefreshCw className="h-4 w-4 text-slate-500" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Sites Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {sites.map((site) => (
            <div
              key={site.name}
              className={cn(
                "p-3 rounded-lg text-white text-center cursor-pointer transition-colors",
                statusColors[site.status]
              )}
            >
              <p className="font-semibold text-sm">{site.name}</p>
              <p className="text-xs opacity-90">{site.label}</p>
            </div>
          ))}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4 text-xs text-slate-500">
          <div className="text-center">Latency: 12ms</div>
          <div className="text-center">Latency: 8ms</div>
          <div className="text-center">CPU: 88%</div>
          <div className="text-center">Latency: 24ms</div>
          <div className="text-center text-red-500">Offline</div>
          <div className="text-center">Latency: 18ms</div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 pt-3 border-t border-slate-100">
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            NORMAL
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
            WARNING
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
            CRITICAL
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
