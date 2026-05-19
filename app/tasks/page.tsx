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
import { sites as mockSites } from "@/lib/mock/sites"
import type { TaskItem, TaskType } from "@/lib/types/task"
import type { TaskStatus, Priority } from "@/lib/types/common"
import { Activity, Pause, Play, RotateCcw, RefreshCw, AlertTriangle, ClipboardList, Search, Loader2, Download, WifiOff } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { getSession } from "@/lib/auth/session"

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
  const [exporting, setExporting] = useState(false)
  const [showOfflineQueue, setShowOfflineQueue] = useState(false)
  const siteNameByCode = Object.fromEntries(mockSites.map((site) => [site.code, site.name]))
  const nowString = () => new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-")
  const nowTime = () => new Date().toLocaleTimeString("zh-CN", { hour12: false })

  const appendTaskLog = (taskId: string, level: "info" | "warn" | "error", message: string, operator = "系统") => {
    setTaskLogs((prev) => [
      {
        id: `l${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        taskId,
        timestamp: nowTime(),
        level,
        message,
        operator,
      },
      ...prev,
    ])
  }

  // 计算离线队列中的任务（目标站点离线的待下发任务）
  const offlineQueueTasks = tasks.filter(t => {
    const site = mockSites.find(s => s.code === t.siteCode)
    return site?.status === "offline" && (t.status === "pending_dispatch" || t.status === "queued")
  })

  const filtered = tasks.filter((t) => {
    const matchTab = tab === "all" || t.type === tab
    const matchKw = !keyword || t.name.includes(keyword) || t.siteName.includes(keyword)
    const matchStatus = statusFilter === "all" || t.status === statusFilter
    return matchTab && matchKw && matchStatus
  })

  const logs = taskLogs.filter((l) => !selected || l.taskId === selected.id)

  const handlePause = (task: TaskItem) => {
    const updatedAt = nowString()
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "paused", updatedAt } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, status: "paused", updatedAt } : null)
    appendTaskLog(task.id, "warn", `[${task.type.toUpperCase()}] 任务已暂停，等待人工恢复`, task.operator)
    toast({ title: "任务已暂停", description: `任务「${task.name}」已暂停执行` })
  }

  const handleResume = (task: TaskItem) => {
    const updatedAt = nowString()
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "running", updatedAt } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, status: "running", updatedAt } : null)
    appendTaskLog(task.id, "info", `[${task.type.toUpperCase()}] 任务已恢复执行`, task.operator)
    toast({ title: "任务已恢复", description: `任务「${task.name}」已恢复执行` })
  }

  const handleRetry = (task: TaskItem) => {
    const updatedAt = nowString()
    setTasks(prev => prev.map(t => t.id === task.id ? {
      ...t,
      status: "running",
      errorMessage: undefined,
      retryCount: (t.retryCount || 0) + 1,
      lastRetryAt: updatedAt,
      updatedAt,
    } : t))
    if (selected?.id === task.id) {
      setSelected(prev => prev ? {
        ...prev,
        status: "running",
        errorMessage: undefined,
        retryCount: (prev.retryCount || 0) + 1,
        lastRetryAt: updatedAt,
        updatedAt,
      } : null)
    }
    appendTaskLog(task.id, "warn", `[${task.type.toUpperCase()}] 任务失败后触发第 ${(task.retryCount || 0) + 1} 次重试`, task.operator)
    toast({ title: "任务重试中", description: `任务「${task.name}」正在重新执行` })
  }

  const handleReset = (task: TaskItem) => {
    const updatedAt = nowString()
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, progress: 0, status: "queued", updatedAt } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, progress: 0, status: "queued", updatedAt } : null)
    appendTaskLog(task.id, "info", `[${task.type.toUpperCase()}] 任务已重置，等待重新下发`, task.operator)
    toast({ title: "任务已重置", description: `任务「${task.name}」进度已重置为 0%` })
  }

  const handlePriorityBoost = (task: TaskItem) => {
    const newPriority = task.priority === "high" ? "normal" : "high"
    const updatedAt = nowString()
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority: newPriority, updatedAt } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, priority: newPriority, updatedAt } : null)
    appendTaskLog(task.id, "info", `[${task.type.toUpperCase()}] 任务优先级已调整为 ${newPriority === "high" ? "高" : "普通"}`, task.operator)
    toast({ title: newPriority === "high" ? "优先级已提升" : "优先级已恢复", description: `任务「${task.name}」优先级已设为${newPriority === "high" ? "高" : "普通"}` })
  }

  const handleExportLog = () => {
    if (!selected) return
    setExporting(true)
    toast({ title: `正在导出任务日志...`, description: "请稍候，正在生成文件并添加数字签名" })
    setTimeout(() => {
      setExporting(false)
      const logContent = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n')
      const blob = new Blob([logContent], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `task_${selected.id}_${Date.now()}.log`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "导出成功", description: `任务「${selected.name}」的日志已导出为 .log 文件，共 ${logs.length} 条记录` })
    }, 1500)
  }

  const handleCreateTask = () => {
    if (!newTask.name) {
      toast({ title: "请填写任务名称", variant: "destructive" })
      return
    }

    // 权限最小化校验：集团管理员不能操作刻录/回迁任务
    const session = getSession()
    const isSuperAdmin = session?.role === "集团超级管理员" || session?.roleLevel === "group_admin"
    if (isSuperAdmin && (newTask.type === "burn" || newTask.type === "restore")) {
      toast({
        title: "权限不足",
        description: "集团管理员账户不能直接发起刻录/回迁任务，此类操作需由站点操作员在本地系统执行",
        variant: "destructive"
      })
      return
    }

    // 检查目标站点是否离线
    const targetSite = mockSites.find(s => s.code === newTask.siteCode)
    const isSiteOffline = targetSite?.status === "offline"

    const task: TaskItem = {
      id: `t${Date.now()}`,
      name: newTask.name,
      type: newTask.type,
      status: isSiteOffline ? "queued" : "pending_dispatch",
      priority: newTask.priority,
      progress: 0,
      siteName: siteNameByCode[newTask.siteCode] ?? newTask.siteCode,
      siteCode: newTask.siteCode,
      operator: "张建国",
      startedAt: "—",
      updatedAt: nowString(),
    }
    setTasks(prev => [...prev, task])
    setSelected(task)
    appendTaskLog(task.id, "info", `[${task.type.toUpperCase()}] 任务创建完成，进入${isSiteOffline ? "离线队列" : "待下发"}状态`, "张建国")
    setShowNewTask(false)
    setNewTask({ name: "", type: "backup", siteCode: "SH-RD-01", priority: "normal" })

    if (isSiteOffline) {
      toast({
        title: "任务已创建（离线队列）",
        description: `目标站点 ${targetSite?.name} 当前离线，任务已加入离线队列等待站点恢复`
      })
      return
    }

    toast({ title: "任务创建成功", description: `任务「${task.name}」已提交，正在等待下发至目标站点...` })

    // 模拟任务下发流程：pending_dispatch -> dispatched -> running
    setTimeout(() => {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "dispatched" } : t))
      if (selected?.id === task.id) {
        setSelected(prev => prev ? { ...prev, status: "dispatched", updatedAt: nowString() } : null)
      }
      appendTaskLog(task.id, "info", `[${task.type.toUpperCase()}] 任务已成功下发到站点执行队列`, "系统")
      toast({ title: "任务已下发", description: `任务「${task.name}」已成功下发至 ${task.siteName}，正在等待执行...` })
    }, 1500)

    setTimeout(() => {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "running", startedAt: nowString(), updatedAt: nowString() } : t))
      if (selected?.id === task.id) {
        setSelected(prev => prev ? { ...prev, status: "running", startedAt: nowString(), updatedAt: nowString() } : null)
      }
      appendTaskLog(task.id, "info", `[${task.type.toUpperCase()}] 任务开始执行`, "系统")
    }, 3000)
  }

  return (
    <AppShell>
      <PageHeader title="任务管理" description="备份、恢复、巡检、刻录任务统一调度" badge="TASK CENTER"
        actions={<Button size="sm" className="bg-blue-600" onClick={() => setShowNewTask(true)}><ClipboardList className="h-4 w-4 mr-1" />新建任务</Button>}
        extra={offlineQueueTasks.length > 0 ? (
          <Button variant="outline" size="sm" className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" onClick={() => setShowOfflineQueue(true)}>
            <WifiOff className="h-4 w-4 mr-1" />离线队列 ({offlineQueueTasks.length})
          </Button>
        ) : null}
      />

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
                    <SelectItem value="pending_dispatch">待下发</SelectItem>
                    <SelectItem value="dispatched">已下发</SelectItem>
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

        <DetailPanel title="实时任务日志" subtitle={selected?.name} empty={!selected}
          actions={selected && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportLog} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              导出日志
            </Button>
          )}>
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

      <Dialog open={showOfflineQueue} onOpenChange={setShowOfflineQueue}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><WifiOff className="h-5 w-5 inline mr-2 text-amber-600" />离线任务队列</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">以下任务因目标站点离线而暂停下发，等待站点恢复后将自动继续：</p>
            {offlineQueueTasks.length === 0 ? (
              <p className="text-center py-8 text-slate-400">当前无离线队列任务</p>
            ) : (
              <div className="space-y-2">
                {offlineQueueTasks.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.siteName} · {typeLabels[t.type]}</p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700">等待站点恢复</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowOfflineQueue(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
