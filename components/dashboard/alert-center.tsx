"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertTriangle, XCircle, CheckCircle, Clock } from "lucide-react"
import { taskAlerts } from "@/lib/mock/tasks"

const levelConfig = {
  critical: { label: "严重", color: "bg-red-600", text: "text-red-600", border: "border-l-red-600", bg: "bg-red-50" },
  warning: { label: "警告", color: "bg-amber-600", text: "text-amber-600", border: "border-l-amber-600", bg: "bg-amber-50" },
}

export function AlertCenter() {
  return (
    <Card className="gap-0 h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <CardTitle className="text-sm font-semibold text-slate-900">
              运维告警
            </CardTitle>
          </div>
          <Badge className="bg-red-600 text-white hover:bg-red-600 text-xs">
            {taskAlerts.length} ACTIVE
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="space-y-1.5">
            {taskAlerts.map((alert) => {
              const cfg = levelConfig[alert.level]
              return (
                <div key={alert.id} className={`p-2 rounded border-l-2 ${cfg.border} ${cfg.bg}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs px-1.5 py-0.5 rounded text-white font-medium">
                        {cfg.label}
                      </span>
                      <span className="text-xs font-medium text-slate-700 truncate max-w-[140px]">
                        {alert.taskName}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />{alert.time}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {alert.message}
                  </p>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" />未确认</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" />处理中</span>
            <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-500" />已解决</span>
          </div>
          <button className="text-xs text-blue-600 hover:text-blue-700">
            告警历史 &rarr;
          </button>
        </div>
      </CardContent>
    </Card>
  )
}