"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { sites } from "@/lib/mock/sites"
import { OnlineStatusBadge } from "@/components/platform/status-badges"

const statusRank: Record<string, number> = { online: 0, degraded: 1, offline: 2 }

export function SiteHealthHeatmap() {
  const sorted = [...sites].sort((a, b) => statusRank[a.status] - statusRank[b.status])

  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-900">
            站点状态总览
          </CardTitle>
          <span className="text-[10px] text-slate-400">
            {sites.filter(s => s.status === "online").length}/{sites.length} 在线
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {sorted.map((site) => (
            <div key={site.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${
                  site.status === "online" ? "bg-emerald-500" :
                  site.status === "degraded" ? "bg-amber-500" : "bg-red-500"
                }`} />
                <span className="text-xs font-medium text-slate-700">{site.name}</span>
                <span className="text-[10px] text-slate-400">{site.code}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400">{site.ip}</span>
                <OnlineStatusBadge status={site.status} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <span>最后同步: 14:32:05</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 正常
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 ml-2" /> 降级
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 ml-2" /> 离线
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
