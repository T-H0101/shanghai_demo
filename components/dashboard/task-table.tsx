"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { tasks as mockTasks } from "@/lib/mock/tasks"
import { TaskStatusBadge, PriorityBadge } from "@/components/platform/status-badges"

const typeLabels: Record<string, string> = {
  backup: "备份",
  restore: "恢复",
  inspect: "巡检",
  burn: "刻录",
}

const typeColors: Record<string, string> = {
  backup: "bg-emerald-100 text-emerald-700 border-emerald-200",
  restore: "bg-cyan-100 text-cyan-700 border-cyan-200",
  inspect: "bg-orange-100 text-orange-700 border-orange-200",
  burn: "bg-purple-100 text-purple-700 border-purple-200",
}

// 实时任务：只显示running状态的任务
const runningTasks = mockTasks.filter(t => t.status === "running" || t.status === "paused")

export function TaskTable() {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold text-slate-900">
              任务执行队列
            </CardTitle>
            <Badge className="bg-red-600 text-white hover:bg-red-600 text-[10px] px-1.5">
              {runningTasks.length} ACTIVE
            </Badge>
          </div>
          <span className="text-xs text-slate-400">实时刷新</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-slate-100">
              <TableHead className="text-[10px] font-medium text-slate-500 uppercase h-8">
                任务名 / ID
              </TableHead>
              <TableHead className="text-[10px] font-medium text-slate-500 uppercase h-8">
                站点 / 设备
              </TableHead>
              <TableHead className="text-[10px] font-medium text-slate-500 uppercase h-8">
                类型
              </TableHead>
              <TableHead className="text-[10px] font-medium text-slate-500 uppercase h-8">
                进度 / 速率
              </TableHead>
              <TableHead className="text-[10px] font-medium text-slate-500 uppercase h-8">
                状态
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runningTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-slate-400 text-sm">
                  暂无运行中任务
                </TableCell>
              </TableRow>
            ) : runningTasks.map((task) => (
              <TableRow key={task.id} className="hover:bg-slate-50 border-b border-slate-50">
                <TableCell className="py-2">
                  <p className="font-medium text-slate-900 text-xs">{task.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{task.id} / {task.siteCode}</p>
                </TableCell>
                <TableCell className="py-2">
                  <p className="text-xs text-slate-700">{task.siteName}</p>
                  <p className="text-[10px] text-slate-400">{task.deviceName || "—"}</p>
                </TableCell>
                <TableCell className="py-2">
                  <Badge variant="outline" className={`${typeColors[task.type] || "bg-slate-100 text-slate-700"} text-[10px] px-1.5 py-0`}>
                    {typeLabels[task.type] || task.type}
                  </Badge>
                </TableCell>
                <TableCell className="py-2 min-w-[100px]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-600">{task.progress}%</span>
                    <span className="text-[10px] text-slate-400">{task.speed || "—"}</span>
                  </div>
                  <Progress value={task.progress} className="h-1" />
                </TableCell>
                <TableCell className="py-2">
                  <TaskStatusBadge status={task.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
