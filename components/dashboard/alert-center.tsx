"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Lightbulb, Plus } from "lucide-react"

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
    level: "CRITICAL",
    title: "核心站点连接超时",
    description:
      "站点 [成都研发基地] 核心交换机无响应，冗余链路尝试切换失败。",
    time: "14:22:05",
  },
  {
    id: "2",
    level: "WARNING",
    title: "存储池容量预警",
    description:
      "光盘库 [南京中心_B] 可用空间 < 10%，请执行扩容或迁移计划。",
    time: "13:10:11",
  },
  {
    id: "3",
    level: "INFO",
    title: "系统版本升级提醒",
    description:
      "发现新固件版本 v3.8.4 (包含3个安全性修补)，建议在非业务时段更新。",
    time: "",
  },
]

const levelColors: Record<AlertLevel, string> = {
  CRITICAL: "bg-red-500",
  WARNING: "bg-amber-500",
  INFO: "bg-blue-500",
}

const levelBorderColors: Record<AlertLevel, string> = {
  CRITICAL: "border-l-red-500",
  WARNING: "border-l-amber-500",
  INFO: "border-l-blue-500",
}

export function AlertCenter() {
  return (
    <Card className="gap-0 h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-slate-600" />
            <CardTitle className="text-base font-semibold text-slate-900">
              智能告警中心
            </CardTitle>
          </div>
          <Badge className="bg-red-500 text-white hover:bg-red-500">
            5 Priority
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col">
        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border-l-4 bg-slate-50 ${
                  levelBorderColors[alert.level]
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`${
                        levelColors[alert.level]
                      } text-white text-[10px] px-1.5 py-0 hover:${
                        levelColors[alert.level]
                      }`}
                    >
                      {alert.level}
                    </Badge>
                    <span className="text-sm font-medium text-slate-900">
                      {alert.title}
                    </span>
                  </div>
                  {alert.time && (
                    <span className="text-xs text-slate-400 shrink-0">
                      {alert.time}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {alert.description}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Add Button */}
        <Button
          size="icon"
          className="absolute bottom-16 right-6 h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg"
        >
          <Plus className="h-5 w-5" />
        </Button>

        {/* Acknowledge All */}
        <div className="pt-4 mt-auto border-t border-slate-100">
          <Button variant="outline" className="w-full text-sm">
            ACKNOWLEDGE ALL
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
