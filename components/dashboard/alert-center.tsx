"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertTriangle } from "lucide-react"
import { taskAlerts } from "@/lib/mock/tasks"

type AlertLevel = "CRITICAL" | "WARNING" | "INFO"

interface Alert {
  id: string
  level: AlertLevel
  title: string
  description: string
  time: string
}

const alerts: Alert[] = [
  {
    id: "1",
    level: "CRITICAL" as AlertLevel,
    title: "核心站点连接超时",
    description:
      "站点 [成都研发基地] 核心交换机无响应，冗余链路尝试切换失败。",
    time: "14:22:05",
  },
  {
    id: "2",
    level: "WARNING" as AlertLevel,
    title: "存储池容量预警",
    description:
      "光盘库 [南京中心_B] 可用空间 < 10%，请执行扩容或迁移计划。",
    time: "13:10:11",
  },
  {
    id: "3",
    level: "INFO" as AlertLevel,
    title: "系统版本升级提醒",
    description:
      "发现新固件版本 v3.8.4 (包含3个安全性修补)，建议在非业务时段更新。",
    time: "",
  },
]

const levelColors: Record<AlertLevel, string> = {
  CRITICAL: "bg-red-600",
  WARNING: "bg-amber-600",
  INFO: "bg-slate-500",
}

const levelBorderColors: Record<AlertLevel, string> = {
  CRITICAL: "border-l-red-600",
  WARNING: "border-l-amber-600",
  INFO: "border-l-slate-400",
}

export function AlertCenter() {
  // 使用真实告警数据
  const displayAlerts = taskAlerts.slice(0, 3).map(alert => ({
    id: alert.id,
    level: (alert.level === "critical" ? "CRITICAL" : "WARNING") as AlertLevel,
    title: alert.taskName,
    description: alert.message,
    time: alert.time,
  }))

  return (
    <Card className="gap-0 h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-slate-600" />
            <CardTitle className="text-sm font-semibold text-slate-900">
              告警中心
            </CardTitle>
          </div>
          <span className="text-xs text-slate-500">{taskAlerts.length} 未处理</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {displayAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-2.5 rounded border-l-2 bg-slate-50 ${levelBorderColors[alert.level]}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1 py-0.5 rounded ${levelColors[alert.level]} text-white`}>
                      {alert.level}
                    </span>
                    <span className="text-xs font-medium text-slate-900">
                      {alert.title}
                    </span>
                  </div>
                  {alert.time && (
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {alert.time}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-snug">
                  {alert.description}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="pt-3 mt-3 border-t border-slate-200">
          <button className="w-full text-xs text-slate-500 hover:text-slate-700 py-1">
            查看全部告警 &rarr;
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
