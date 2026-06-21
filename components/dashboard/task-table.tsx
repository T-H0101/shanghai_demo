"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { taskProvider } from "@/lib/api"
import type { TaskItem } from "@/lib/types/task"
import { TASK_PHASE_LABELS } from "@/lib/types/task"
import {
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useSite } from "@/lib/site/site-context"

const statusBadge: Record<string, string> = {
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  pending: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  pending_dispatch: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
}

export function TaskTable() {
  const router = useRouter()
  const { siteCode, isAllSites, isReady } = useSite()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isReady) return
    taskProvider.getAll(!isAllSites && siteCode ? { siteCode } : undefined).then((data) => {
      setTasks(
        data
          .filter((task) => task.status === "running" || task.phase === "pending")
          .slice(0, 5)
      )
      setLoading(false)
    })
  }, [isReady, isAllSites, siteCode])

  return (
    <Card className="gap-0 bg-white dark:bg-slate-800" data-testid="dashboard-task-table">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <ClipboardList className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            进行中任务
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
              <div key={`task-skeleton-${i}`} className="h-12 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">暂无进行中任务</div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                onClick={() => router.push(`/tasks?device=${task.deviceId ?? task.rackId ?? ""}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">{task.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{task.siteName}</span>
                    <span className="text-[10px] text-slate-300 dark:text-slate-400">·</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{task.type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <Progress value={task.phase === "completed" ? 100 : (task.progress ?? 0)} className="h-1.5 w-16 mb-0.5" />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {task.phase === "completed" ? "100%" : task.progress && task.progress > 0 ? `${task.progress}%` : "—"}
                    </span>
                  </div>
                  <Badge className={cn("text-[10px]", statusBadge[task.status] ?? "bg-slate-100 dark:bg-slate-700")}>
                    {task.phase === "pending" ? "待处理" : TASK_PHASE_LABELS[task.phase] ?? task.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
