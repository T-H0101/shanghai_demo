"use client"
import { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { StatCard } from "@/components/platform/stat-card"
import { DetailPanel } from "@/components/platform/detail-panel"
import { TaskStatusBadge, PriorityBadge } from "@/components/platform/status-badges"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { taskStats, tasks as mockTasks, taskLogs as mockTaskLogs, taskAlerts } from "@/lib/mock/tasks"
import type { TaskItem, TaskType } from "@/lib/types/task"
import type { TaskStatus, Priority } from "@/lib/types/common"
import { Activity, Pause, Play, RotateCcw, RefreshCw, AlertTriangle, ClipboardList, Search, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

const typeLabels: Record<TaskType, string> = { backup: "备份任务", restore: "恢复任务", inspect: "巡检任务", burn: "刻录任务" }
const typeColors: Record<TaskType, string> = {
  backup: "bg-emerald-100 text-emerald-700",
  restore: "bg-cyan-100 text-cyan-700",
  inspect: "bg-orange-100 text-orange-700",
  burn: "bg-purple-100 text-purple-700",
}

export default function Page() {
  const [tasks, setTasks] = useState<TaskItem[]>(mockTasks)
  const [taskLogs, setTaskLogs] = useState(mockTaskLogs)
  const [tab, setTab] = useState<TaskType | "all">("all")
  const [selected, setSelected] = useState<TaskItem | null>(mockTasks[0])
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all")
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ name: "", type: "backup" as TaskType, siteCode: "SH-RD-01", priority: "normal" as Priority })

  const filtered = tasks.filter((t) => {
    const matchTab = tab === "all" || t.type === tab
    const matchKw = !keyword || t.name.includes(keyword) || t.siteName.includes(keyword)
    const matchStatus = statusFilter === "all" || t.status === statusFilter
    return matchTab && matchKw && matchStatus
  })

  const logs = taskLogs.filter((l) => !selected || l.taskId === selected.id)

  const handlePause = (task: TaskItem) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "paused" } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, status: "paused" } : null)
    toast({ title: "任务已暂停", description: `任务「${task.name}」已暂停执行` })
  }

  const handleResume = (task: TaskItem) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "running" } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, status: "running" } : null)
    toast({ title: "任务已恢复", description: `任务「${task.name}」已恢复执行` })
  }

  const handleRetry = (task: TaskItem) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "running", errorMessage: undefined } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, status: "running", errorMessage: undefined } : null)
    toast({ title: "任务重试中", description: `任务「${task.name}」正在重新执行` })
  }

  const handleReset = (task: TaskItem) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, progress: 0, status: "queued" } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, progress: 0, status: "queued" } : null)
    toast({ title: "任务已重置", description: `任务「${task.name}」进度已重置为 0%` })
  }

  const handlePriorityBoost = (task: TaskItem) => {
    const newPriority = task.priority === "high" ? "normal" : "high"
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority: newPriority } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, priority: newPriority } : null)
    toast({ title: newPriority === "high" ? "优先级已提升" : "优先级已恢复", description: `任务「${task.name}」优先级已设为${newPriority === "high" ? "高" : "普通"}` })
  }

  const handleCreateTask = () => {
    if (!newTask.name) {
      toast({ title: "请填写任务名称", variant: "destructive" })
      return
    }
    const task: TaskItem = {
      id: `t${Date.now()}`,
      name: newTask.name,
      type: newTask.type,
      status: "queued",
      priority: newTask.priority,
      progress: 0,
      siteName: newTask.siteCode,
      siteCode: newTask.siteCode,
      operator: "张建国",
      startedAt: "—",
      updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
    }
    setTasks(prev => [...prev, task])
    setShowNewTask(false)
    setNewTask({ name: "", type: "backup", siteCode: "SH-RD-01", priority: "normal" })
    toast({ title: "任务创建成功", description: `任务「${task.name}」已提交，等待调度执行` })
  }

  return (
    <AppShell>
      <PageHeader title="任务管理" description="备份、恢复、巡检、刻录任务统一调度" badge="TASK CENTER"
        actions={<Button size="sm" className="bg-blue-600" onClick={() => setShowNewTask(true)}><ClipboardList className="h-4 w-4 mr-1" />新建任务</Button>} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="任务总数" value={tasks.length} unit="个" icon={Activity} badge={<Badge className="bg-slate-900 text-white">LIVE</Badge>} />
        <StatCard title="运行中" value={tasks.filter(t => t.status === "running").length} unit="并发" icon={Play} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard title="已暂停" value={tasks.filter(t => t.status === "paused").length} icon={Pause} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatCard title="今日完成" value={taskStats.completedToday} unit="个" icon={RefreshCw} iconBg="bg-blue-50" iconColor="text-blue-600" />
      </div>

      {taskAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50/50 gap-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-red-600" /><span className="font-medium text-sm text-red-800">异常任务告警 ({taskAlerts.length})</span></div>
            {taskAlerts.map((a) => (
              <p key={a.id} className="text-xs text-red-700 py-1 border-b border-red-100 last:border-0">
                <Badge className="bg-red-500 text-white mr-2 text-[10px]">{a.level}</Badge>{a.taskName} — {a.message} <span className="text-red-400 ml-2">{a.time}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <Tabs value={tab} onValueChange={(v) => setTab(v as TaskType | "all")}>
                <TabsList className="h-9">
                  <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
                  <TabsTrigger value="backup" className="text-xs">备份</TabsTrigger>
                  <TabsTrigger value="restore" className="text-xs">恢复</TabsTrigger>
                  <TabsTrigger value="inspect" className="text-xs">巡检</TabsTrigger>
                  <TabsTrigger value="burn" className="text-xs">刻录</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | "all")}>
                  <SelectTrigger className="h-9 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="running">运行中</SelectItem>
                    <SelectItem value="paused">已暂停</SelectItem>
                    <SelectItem value="failed">失败</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="queued">排队中</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder="搜索任务..." className="pl-9 h-9" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent">
                <TableHead className="text-xs text-slate-500">任务</TableHead>
                <TableHead className="text-xs text-slate-500">类型</TableHead>
                <TableHead className="text-xs text-slate-500">站点</TableHead>
                <TableHead className="text-xs text-slate-500">优先级</TableHead>
                <TableHead className="text-xs text-slate-500">进度</TableHead>
                <TableHead className="text-xs text-slate-500">状态</TableHead>
                <TableHead className="text-xs text-slate-500">操作</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">未找到匹配的任务</TableCell></TableRow>
                ) : filtered.map((t) => (
                  <TableRow key={t.id} className={`cursor-pointer hover:bg-slate-50 ${selected?.id===t.id?"bg-blue-50":""}`} onClick={() => setSelected(t)}>
                    <TableCell><p className="font-medium text-sm">{t.name}</p><p className="text-xs text-slate-400">{t.operator}</p></TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs ${typeColors[t.type]}`}>{typeLabels[t.type]}</Badge></TableCell>
                    <TableCell><p className="text-sm">{t.siteName}</p><p className="text-xs text-slate-400">{t.siteCode}</p></TableCell>
                    <TableCell>
                      <button onClick={(e) => { e.stopPropagation(); handlePriorityBoost(t) }}>
                        <PriorityBadge priority={t.priority} />
                      </button>
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      <div className="flex justify-between text-xs mb-1"><span>{t.progress}%</span><span className={t.errorMessage?"text-red-500":"text-slate-500"}>{t.speed||"—"}</span></div>
                      <Progress value={t.progress} className="h-1.5" />
                    </TableCell>
                    <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {t.status === "running" ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="暂停" onClick={(e) => { e.stopPropagation(); handlePause(t) }}><Pause className="h-3.5 w-3.5"/></Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="恢复" onClick={(e) => { e.stopPropagation(); handleResume(t) }}><Play className="h-3.5 w-3.5"/></Button>
                        )}
                        {t.status === "failed" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="重试" onClick={(e) => { e.stopPropagation(); handleRetry(t) }}><RotateCcw className="h-3.5 w-3.5"/></Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="重置" onClick={(e) => { e.stopPropagation(); handleReset(t) }}><RefreshCw className="h-3.5 w-3.5"/></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <DetailPanel title="实时任务日志" subtitle={selected?.name} empty={!selected}>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2 font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-center text-slate-400 py-4">暂无日志</p>
              ) : logs.map((l) => (
                <div key={l.id} className={`p-2 rounded ${l.level==="error"?"bg-red-50 text-red-800":l.level==="warn"?"bg-amber-50 text-amber-800":"bg-slate-50 text-slate-700"}`}>
                  <span className="text-slate-400">[{l.timestamp}]</span> {l.message}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DetailPanel>
      </div>

      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>任务名称 *</Label>
              <Input value={newTask.name} onChange={(e) => setNewTask(prev => ({ ...prev, name: e.target.value }))} placeholder="如：临床试验数据回迁_A10" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>任务类型</Label>
                <Select value={newTask.type} onValueChange={(v) => setNewTask(prev => ({ ...prev, type: v as TaskType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backup">备份任务</SelectItem>
                    <SelectItem value="restore">恢复任务</SelectItem>
                    <SelectItem value="inspect">巡检任务</SelectItem>
                    <SelectItem value="burn">刻录任务</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>优先级</Label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask(prev => ({ ...prev, priority: v as Priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">紧急</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="normal">普通</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>站点编码</Label>
              <Select value={newTask.siteCode} onValueChange={(v) => setNewTask(prev => ({ ...prev, siteCode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SH-RD-01">上海研发中心 (SH-RD-01)</SelectItem>
                  <SelectItem value="BJ-HQ-02">北京总部机房 (BJ-HQ-02)</SelectItem>
                  <SelectItem value="GZ-PD-03">广州生产基地 (GZ-PD-03)</SelectItem>
                  <SelectItem value="NJ-DC-05">南京中心 (NJ-DC-05)</SelectItem>
                  <SelectItem value="WH-BK-06">武汉备份中心 (WH-BK-06)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTask(false)}>取消</Button>
            <Button onClick={handleCreateTask} className="bg-blue-600 hover:bg-blue-700">确认创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}