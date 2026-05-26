"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { taskProvider } from "@/lib/api/mock-providers"
import type { TaskAlert } from "@/lib/types/task"
import {
  Bell,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronRight,
} from "lucide-react"

const alertLevelIcon: Record<string, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const alertLevelColor: Record<string, string> = {
  error: "text-red-600",
  warning: "text-amber-600",
  info: "text-blue-600",
}

export function AlertCenter() {
  const [alerts, setAlerts] = useState<TaskAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    taskProvider.getAlerts().then((data) => {
      setAlerts(data.slice(0, 6))
      setLoading(false)
    })
  }, [])

  return (
    <Card className="gap-0 relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5 text-slate-400" />
            系统告警
          </CardTitle>
          <button
            onClick={() => {}}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            查看全部 <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">暂无告警信息</div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => {
              const Icon = alertLevelIcon[alert.level] ?? Info
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", alertLevelColor[alert.level])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{alert.message}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{alert.timestamp}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}