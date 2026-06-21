"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { taskProvider, rackProvider } from "@/lib/api"
import type { TaskItem } from "@/lib/types/task"
import type { Rack } from "@/lib/types/rack"
import { cn } from "@/lib/utils"
import { MOCK_STORE_EVENT } from "@/lib/api/mock-store"
import {
  Bell,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  HardDrive,
  Clock,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useSite } from "@/lib/site/site-context"

interface AlertItem {
  id: string
  type: "task_failed" | "device_offline" | "device_error"
  level: "error" | "warning"
  message: string
  detail: string
  time: string
  target?: string
}

export function AlertCenter() {
  const router = useRouter()
  const pathname = usePathname()
  const { siteCode, isAllSites, isReady } = useSite()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadAlerts = async () => {
    try {
      setLoading(true)
      const filterSite = isAllSites ? undefined : siteCode ?? undefined
      const [tasks, racks] = await Promise.all([
        taskProvider.getAll(filterSite ? { siteCode: filterSite } : undefined),
        rackProvider.getAll(filterSite),
      ])
      const items: AlertItem[] = []

      // 失败任务
      tasks.filter(t => t.phase === "failed").forEach(t => {
        items.push({
          id: `task-${t.siteCode}-${t.taskNo}-${t.id}`,
          type: "task_failed",
          level: "error",
          message: `任务失败：${t.name}`,
          detail: t.errorMessage || "任务执行异常",
          time: t.updatedAt,
          target: "/tasks",
        })
      })

      // 异常/离线设备
      racks.filter(r => r.deviceStatus === "offline" || r.deviceStatus === "error").forEach(r => {
        items.push({
          id: `device-${r.siteCode}-${r.rackId}-${r.id}`,
          type: r.deviceStatus === "offline" ? "device_offline" : "device_error",
          level: r.deviceStatus === "offline" ? "warning" : "error",
          message: `设备${r.deviceStatus === "offline" ? "离线" : "异常"}：${r.rackId}`,
          detail: `${r.siteName} · ${r.ip || "未知IP"}`,
          time: r.lastSyncAt,
          target: "/racks",
        })
      })

      // 高使用率设备
      racks.filter(r => r.usagePercent >= 90).forEach(r => {
        items.push({
          id: `usage-${r.siteCode}-${r.rackId}-${r.id}`,
          type: "device_error",
          level: "warning",
          message: `容量告警：${r.rackId}`,
          detail: `使用率 ${r.usagePercent}%`,
          time: r.lastSyncAt,
          target: "/racks",
        })
      })

      setAlerts(items.slice(0, 8))
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  // 首次加载 + 路由变化时重新读取
  useEffect(() => {
    if (isReady) loadAlerts()
  }, [pathname, isReady, siteCode, isAllSites])

  // 监听 localStorage 变化
  useEffect(() => {
    const handler = () => loadAlerts()
    window.addEventListener(MOCK_STORE_EVENT, handler)
    return () => window.removeEventListener(MOCK_STORE_EVENT, handler)
  }, [])

  const getIcon = (type: string) => {
    switch (type) {
      case "task_failed": return AlertCircle
      case "device_offline": return HardDrive
      case "device_error": return AlertTriangle
      default: return Info
    }
  }

  const getLevelColor = (level: string) => {
    return level === "error" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
  }

  return (
    <Card className="gap-0 relative bg-white dark:bg-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Bell className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            系统告警
            {alerts.length > 0 && <Badge variant="destructive" className="ml-1">{alerts.length}</Badge>}
          </CardTitle>
          <button
            onClick={() => router.push("/tasks")}
            className="text-xs text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 flex items-center gap-1"
          >
            查看全部 <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={`alert-skeleton-${i}`} className="h-10 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm flex flex-col items-center gap-2">
            <Info className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <span>系统运行正常</span>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => {
              const Icon = getIcon(alert.type)
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  onClick={() => alert.target && router.push(alert.target)}
                >
                  <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", getLevelColor(alert.level))} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate text-slate-900 dark:text-slate-100">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{alert.detail}</span>
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />{alert.time}
                      </span>
                    </div>
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
