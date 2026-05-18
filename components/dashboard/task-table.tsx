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

interface Task {
  id: string
  name: string
  uuid: string
  site: string
  siteCode: string
  opType: "RECOVER" | "BACKUP" | "VERIFY"
  progress: number
  speed: string
  status: "RUNNING" | "PAUSED"
  hasError?: boolean
}

const tasks: Task[] = [
  {
    id: "1",
    name: "临床试验数据回迁_A09",
    uuid: "UUID: 82ef-91be-22cc",
    site: "上海研发中心三",
    siteCode: "B101",
    opType: "RECOVER",
    progress: 78,
    speed: "420 MB/s",
    status: "RUNNING",
  },
  {
    id: "2",
    name: "年度合规归档_2023_P1",
    uuid: "UUID: a01c-6622-df31",
    site: "北京总部机房三",
    siteCode: "V02",
    opType: "BACKUP",
    progress: 45,
    speed: "1.2 GB/s",
    status: "RUNNING",
  },
  {
    id: "3",
    name: "磁盘健康度批量校验_H1",
    uuid: "UUID: d921-bc01-ee0a",
    site: "广州生产基地三",
    siteCode: "S04",
    opType: "VERIFY",
    progress: 12,
    speed: "I/O ERROR",
    status: "PAUSED",
    hasError: true,
  },
]

const opTypeColors = {
  RECOVER: "bg-cyan-100 text-cyan-700 border-cyan-200",
  BACKUP: "bg-emerald-100 text-emerald-700 border-emerald-200",
  VERIFY: "bg-orange-100 text-orange-700 border-orange-200",
}

export function TaskTable() {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-semibold text-slate-900">
              实时任务流水线
            </CardTitle>
            <Badge className="bg-slate-900 text-white hover:bg-slate-900 text-xs">
              LIVE MONITOR
            </Badge>
          </div>
          <button className="text-sm text-blue-600 hover:underline">
            查看完整控制台
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium text-slate-500 uppercase">
                TASK INFO
              </TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase">
                INFRASTRUCTURE SITE
              </TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase">
                OP TYPE
              </TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase">
                PERFORMANCE
              </TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase">
                STATUS
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id} className="hover:bg-slate-50">
                <TableCell>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">
                      {task.name}
                    </p>
                    <p className="text-xs text-slate-400">{task.uuid}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm text-slate-900">{task.site}</p>
                    <p className="text-xs text-slate-400">{task.siteCode}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`${opTypeColors[task.opType]} text-xs font-medium`}
                  >
                    {task.opType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="min-w-[120px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600">
                        {task.progress}% Complete
                      </span>
                      <span
                        className={`text-xs ${
                          task.hasError ? "text-red-500" : "text-slate-500"
                        }`}
                      >
                        {task.speed}
                      </span>
                    </div>
                    <Progress
                      value={task.progress}
                      className={`h-1.5 ${task.hasError ? "bg-red-100" : ""}`}
                    />
                    {task.hasError && (
                      <p className="text-xs text-red-500 mt-1">12% Halted</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      task.status === "RUNNING"
                        ? "text-emerald-600"
                        : "text-red-500"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        task.status === "RUNNING"
                          ? "bg-emerald-500"
                          : "bg-red-500"
                      }`}
                    ></span>
                    {task.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
