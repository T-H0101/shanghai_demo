"use client"
import { useState, useMemo, useCallback, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { StatCard } from "@/components/platform/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  taskProvider,
} from "@/lib/api/mock-providers"
import { racks as mockRacks } from "@/lib/mock/racks"
import type { TaskItem, TaskType, TaskPhase, TaskLogEntry } from "@/lib/types/task"
import { TASK_TYPE_LABELS, TASK_PHASE_LABELS, TASK_PHASE_COLORS, TASK_PHASES_BY_TYPE } from "@/lib/types/task"
import type { Rack } from "@/lib/types/rack"
import {
  Activity, Pause, Play, RotateCcw, RefreshCw, AlertTriangle, ClipboardList,
  Search, Download, X, Clock, CheckCircle2, AlertCircle, Timer, FileText,
  ChevronRight, Info, Package, BarChart3, Zap, Link2, HardDrive,
  SkipForward, CheckCheck, XCircle, Eye,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const typeColors: Record<string, string> = {
  full_scan: "bg-slate-100 text-slate-700", incremental_scan: "bg-blue-100 text-blue-700",
  full_package: "bg-violet-100 text-violet-700", incremental_package: "bg-indigo-100 text-indigo-700",
  backup: "bg-emerald-100 text-emerald-700", restore: "bg-cyan-100 text-cyan-700",
  migrate: "bg-amber-100 text-amber-700", device_scan: "bg-orange-100 text-orange-700",
  raid_check: "bg-pink-100 text-pink-700", other: "bg-slate-100 text-slate-500",
}

const logLevelColor: Record<string, string> = {
  info: "bg-slate-50 text-slate-700", warn: "bg-amber-50 text-amber-800", error: "bg-red-50 text-red-800",
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-slate-50 last:border-0 text-sm">
      <span className="text-slate-400 shrink-0 w-24 text-right">{label}</span>
      <span className="text-slate-900 min-w-0 break-words">{value}</span>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

// ── 主页面（带 Suspense 包裹 useSearchParams） ────────────────────

export default function Page() {
  return (
    <Suspense fallback={<AppShell><div className="flex items-center justify-center h-64 text-slate-400">加载中...</div></AppShell>}>
      <TasksPageContent />
    </Suspense>
  )
}

function TasksPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const deviceFilter = searchParams.get("device")

  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, running: 0, completed: 0, failed: 0, paused: 0 })
  const [keyword, setKeyword] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [phaseFilter, setPhaseFilter] = useState<string>("all")
  const [scopeFilter, setScopeFilter] = useState<string>("all")
  const [selected, setSelected] = useState<TaskItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<Partial<TaskItem>>({})
  const [tab, setTab] = useState<string>("all")

  // 加载数据
  const loadTasks = useCallback(async () => {
    const [list, s] = await Promise.all([
      taskProvider.getAll(),
      taskProvider.getStats(),
    ])
    setTasks(list)
    setStats(s)
    if (!selected) setSelected(list[0] ?? null)
  }, [selected])

  const loadFiltered = useCallback(async () => {
    const filters: Record<string, string> = {}
    if (keyword) filters.keyword = keyword
    if (typeFilter !== "all") filters.type = typeFilter
    if (deviceFilter) filters.keyword = deviceFilter
    const list = await taskProvider.getAll(filters as any)
    setTasks(list)
  }, [keyword, typeFilter, deviceFilter])

  // 初始加载
  useEffect(() => { loadTasks() }, [])

  const openDetail = (task: TaskItem) => { setSelected(task); setDrawerOpen(true) }

  // 计算统计
  const allStats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.phase === "pending").length,
      running: tasks.filter(t => ["scanning", "preparing", "splitting", "packaging", "verifying", "writing"].includes(t.phase)).length,
      completed: tasks.filter(t => t.phase === "completed").length,
      failed: tasks.filter(t => t.phase === "failed").length,
      paused: tasks.filter(t => t.phase === "paused").length,
    }
  }, [tasks])

  // 筛选
  const filtered = useMemo(() => {
    return tasks.filter(t => {
      const matchTab = tab === "all" || t.type === tab
      const matchPhase = phaseFilter === "all" || t.phase === phaseFilter
      const matchScope = scopeFilter === "all" || (t.backupScope ?? "") === scopeFilter
      return matchTab && matchPhase && matchScope
    })
  }, [tasks, tab, phaseFilter, scopeFilter])

  // 推进进度
  const handleAdvance = async (task: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      const updated = await taskProvider.advancePhase(task.id)
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
      if (selected?.id === task.id) setSelected(updated)
      const phases = TASK_PHASES_BY_TYPE[task.type]
      const nextPhase = phases[phases.indexOf(task.phase as TaskPhase) + 1]
      toast({ title: `推进${TASK_PHASE_LABELS[nextPhase] ?? nextPhase}`, description: `「${task.name}」已进入${TASK_PHASE_LABELS[nextPhase] ?? nextPhase}阶段` })
    } catch {
      toast({ title: "操作失败", variant: "destructive" })
    }
  }

  const handlePause = async (task: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await taskProvider.pauseTask(task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, phase: "paused", status: "paused" as const } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, phase: "paused", status: "paused" as const } : null)
    toast({ title: "任务已暂停", description: `「${task.name}」已暂停执行` })
  }

  const handleResume = async (task: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const updated = await taskProvider.resumeTask(task.id)
    const previousPhase = task.phase
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, phase: (previousPhase === "paused" ? "pending" : t.phase), status: "running" as const } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, phase: (previousPhase === "paused" ? "pending" : prev.phase), status: "running" as const } : null)
    toast({ title: "任务已恢复", description: `「${task.name}」已恢复执行` })
  }

  const handleComplete = async (task: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await taskProvider.completeTask(task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, phase: "completed", status: "completed" as const, progress: 100 } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, phase: "completed", status: "completed" as const, progress: 100 } : null)
    toast({ title: "任务已完成", description: `「${task.name}」已标记为完成` })
  }

  const handleFail = async (task: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await taskProvider.failTask(task.id, "手动标记失败")
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, phase: "failed", status: "failed" as const, errorMessage: "手动标记失败" } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, phase: "failed", status: "failed" as const, errorMessage: "手动标记失败" } : null)
    toast({ title: "任务已失败", description: `「${task.name}」已标记为失败` })
  }

  const handleExport = (task: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    toast({ title: "导出任务", description: `「${task.name}」数据导出中...` })
  }

  // 新建任务
  const handleCreate = async () => {
    if (!createForm.name || !createForm.archiveName) {
      toast({ title: "请填写必填项", description: "任务名称和档案馆名称为必填项", variant: "destructive" })
      return
    }
    try {
      const newTask = await taskProvider.createTask({
        name: createForm.name!,
        taskNo: `TK-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(tasks.length + 1).padStart(3, "0")}`,
        type: (createForm.type as TaskType) ?? "full_package",
        archiveName: createForm.archiveName!,
        dataClassification: createForm.dataClassification ?? "馆藏档案",
        siteCode: createForm.siteName ?? createForm.siteCode ?? "SH-RD-01",
        sourcePath: createForm.sourcePath ?? "/data/archive/",
        packagePath: createForm.packagePath ?? "/output/archive/",
        volumeId: createForm.volumeId,
        backupScope: (createForm.backupScope as any) ?? "full",
        packagingMode: (createForm.packagingMode as any) ?? "scan_while_package",
        deviceId: createForm.deviceId,
        rackId: createForm.rackId,
        priority: (createForm.priority as any) ?? "normal",
        operator: "张建国",
        department: createForm.department ?? "设备运维部",
      } as any)
      setTasks(prev => [newTask, ...prev])
      setSelected(newTask)
      setShowCreate(false)
      setCreateForm({})
      toast({ title: "任务创建成功", description: `「${newTask.name}」已创建` })
    } catch {
      toast({ title: "创建失败", variant: "destructive" })
    }
  }

  const handleResetFilters = () => {
    setKeyword(""); setTypeFilter("all"); setPhaseFilter("all"); setScopeFilter("all"); setTab("all")
  }

  const hasFilters = keyword || typeFilter !== "all" || phaseFilter !== "all" || scopeFilter !== "all" || tab !== "all"

  const nowTime = () => new Date().toLocaleTimeString("zh-CN", { hour12: false })

  // 辅助：获取当前任务的完整流程步骤
  const getPhases = (task: TaskItem): string[] => TASK_PHASES_BY_TYPE[task.type] ?? ["pending", "completed"]
  const getActivePhaseIndex = (task: TaskItem): number => getPhases(task).indexOf(task.phase as string)

  return (
    <AppShell>
      <PageHeader
        title="任务管理"
        description="档案数据封包、备份、恢复、扫描任务统一调度与监控"
        badge="TASK CENTER"
        actions={<Button size="sm" className="bg-blue-600" onClick={() => setShowCreate(true)}><ClipboardList className="h-4 w-4 mr-1" />新建任务</Button>}
      />

      {/* ── 统计卡片 ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard title="任务总数" value={allStats.total} unit="个" icon={Activity} badge={<Badge className="bg-slate-900 text-white text-[10px]">LIVE</Badge>} />
        <StatCard title="待处理" value={allStats.pending} icon={Clock} iconBg="bg-slate-50" iconColor="text-slate-600" />
        <StatCard title="进行中" value={allStats.running} icon={Play} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard title="已完成" value={allStats.completed} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard title="已失败" value={allStats.failed} icon={AlertCircle} iconBg="bg-red-50" iconColor="text-red-600" />
        <StatCard title="已暂停" value={allStats.paused} icon={Pause} iconBg="bg-amber-50" iconColor="text-amber-600" />
      </div>

      {/* ── 筛选区 ───────────────────────────────────────────── */}
      <Card className="gap-0">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-xs text-slate-500">关键词搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="任务名称 / 编号 / 档案馆" className="pl-9 h-9" value={keyword} onChange={e => setKeyword(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5 w-36">
              <Label className="text-xs text-slate-500">任务类型</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 w-36">
              <Label className="text-xs text-slate-500">当前阶段</Label>
              <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部阶段</SelectItem>
                  {Object.entries(TASK_PHASE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 w-28">
              <Label className="text-xs text-slate-500">备份范围</Label>
              <Select value={scopeFilter} onValueChange={setScopeFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="full">全量</SelectItem>
                  <SelectItem value="incremental">增量</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={handleResetFilters} disabled={!hasFilters}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />重置
            </Button>
          </div>
          {deviceFilter && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                设备筛选: {deviceFilter}
              </Badge>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => router.push("/racks")}>
                清除
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 任务表格 ─────────────────────────────────────────── */}
      <Card className="gap-0">
        <CardHeader className="pb-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
                <TabsTrigger value="full_package" className="text-xs">全量封包</TabsTrigger>
                <TabsTrigger value="incremental_package" className="text-xs">增量封包</TabsTrigger>
                <TabsTrigger value="backup" className="text-xs">备份</TabsTrigger>
                <TabsTrigger value="restore" className="text-xs">恢复</TabsTrigger>
                <TabsTrigger value="migrate" className="text-xs">移位</TabsTrigger>
                <TabsTrigger value="device_scan" className="text-xs">扫描</TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="text-xs text-slate-400 shrink-0">{filtered.length} / {tasks.length} 条</span>
          </div>
        </CardHeader>
        <CardContent className="pt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">任务编号</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">任务名称</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">档案馆</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">类型</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">范围</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap min-w-[140px]">进度</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">文件数</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">总大小</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">关联设备</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">状态</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-10 text-slate-400">未找到匹配的任务</TableCell></TableRow>
              ) : filtered.map(t => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openDetail(t)}>
                  <TableCell className="font-mono text-xs text-slate-500">{t.taskNo}</TableCell>
                  <TableCell>
                    <p className="font-medium text-sm truncate max-w-[180px]" title={t.name}>{t.name}</p>
                  </TableCell>
                  <TableCell className="text-sm">{t.archiveName}</TableCell>
                  <TableCell><Badge variant="outline" className={cn("text-[10px]", typeColors[t.type])}>{TASK_TYPE_LABELS[t.type]}</Badge></TableCell>
                  <TableCell className="text-xs">{t.backupScope === "full" ? "全量" : t.backupScope === "incremental" ? "增量" : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={t.progress} className="h-1.5 flex-1" />
                      <span className={cn("text-xs font-medium min-w-[32px] text-right", t.phase === "failed" ? "text-red-500" : "")}>{t.progress}%</span>
                    </div>
                    {t.speed && <p className="text-[10px] text-slate-400 mt-0.5">{t.speed}</p>}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">{t.fileCount?.toLocaleString() ?? "—"}</TableCell>
                  <TableCell className="text-xs">{t.totalSize ?? "—"}</TableCell>
                  <TableCell>
                    {t.deviceName ? (
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs text-blue-600" onClick={e => { e.stopPropagation(); router.push(`/tasks?device=${t.deviceName}`) }}>
                        {t.deviceName} <Link2 className="h-3 w-3 ml-0.5" />
                      </Button>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </TableCell>
                  <TableCell><Badge className={cn("text-[10px]", TASK_PHASE_COLORS[t.phase])}>{TASK_PHASE_LABELS[t.phase]}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-0.5 justify-end" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="详情" onClick={() => openDetail(t)}><Eye className="h-3.5 w-3.5" /></Button>
                      {t.phase === "pending" && <Button variant="ghost" size="icon" className="h-7 w-7" title="推进进度" onClick={e => handleAdvance(t, e)}><SkipForward className="h-3.5 w-3.5" /></Button>}
                      {["scanning", "preparing", "splitting", "packaging", "verifying", "writing"].includes(t.phase) && <Button variant="ghost" size="icon" className="h-7 w-7" title="推进" onClick={e => handleAdvance(t, e)}><SkipForward className="h-3.5 w-3.5" /></Button>}
                      {["scanning", "preparing", "splitting", "packaging", "verifying", "writing"].includes(t.phase) && <Button variant="ghost" size="icon" className="h-7 w-7" title="暂停" onClick={e => handlePause(t, e)}><Pause className="h-3.5 w-3.5" /></Button>}
                      {t.phase === "paused" && <Button variant="ghost" size="icon" className="h-7 w-7" title="恢复" onClick={e => handleResume(t, e)}><Play className="h-3.5 w-3.5" /></Button>}
                      {["pending", "scanning", "preparing", "splitting", "packaging", "verifying", "writing"].includes(t.phase) && <Button variant="ghost" size="icon" className="h-7 w-7" title="标记完成" onClick={e => handleComplete(t, e)}><CheckCheck className="h-3.5 w-3.5" /></Button>}
                      {["pending", "scanning", "preparing", "splitting", "packaging", "verifying", "writing", "paused"].includes(t.phase) && <Button variant="ghost" size="icon" className="h-7 w-7" title="标记失败" onClick={e => handleFail(t, e)}><XCircle className="h-3.5 w-3.5" /></Button>}
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="导出" onClick={e => handleExport(t, e)}><Download className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── 任务详情抽屉 ─────────────────────────────────────── */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className="!w-[680px] !max-w-[90vw]">
          <DrawerHeader className="border-b border-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <DrawerTitle className="text-base">{selected?.name}</DrawerTitle>
                <DrawerDescription className="text-xs mt-1">{selected?.taskNo} · {selected?.archiveName}</DrawerDescription>
              </div>
              {selected && <Badge className={cn("text-xs", TASK_PHASE_COLORS[selected.phase])}>{TASK_PHASE_LABELS[selected.phase]}</Badge>}
            </div>
          </DrawerHeader>
          <ScrollArea className="flex-1 h-[calc(100vh-100px)]">
            {selected && (
              <div className="p-5 space-y-5">
                {/* 基本信息 */}
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Info className="h-4 w-4 text-slate-400" />基本信息</h4>
                  <div className="text-sm">
                    <DetailRow label="任务编号" value={selected.taskNo} />
                    <DetailRow label="档案馆" value={selected.archiveName} />
                    <DetailRow label="数据分类" value={selected.dataClassification} />
                    <DetailRow label="任务类型" value={<Badge variant="outline" className={cn("text-[10px]", typeColors[selected.type])}>{TASK_TYPE_LABELS[selected.type]}</Badge>} />
                    <DetailRow label="备份范围" value={selected.backupScope === "full" ? "全量" : selected.backupScope === "incremental" ? "增量" : "—"} />
                    <DetailRow label="封包流程" value={selected.packagingMode === "scan_while_package" ? "边扫描边封包" : "先扫描后封包"} />
                    <DetailRow label="负责人" value={selected.operator} />
                    <DetailRow label="分配部门" value={selected.department ?? "—"} />
                    <DetailRow label="关联设备" value={
                      selected.deviceName ? (
                        <button
                          className="text-blue-600 hover:text-blue-700 underline"
                          onClick={() => { setDrawerOpen(false); router.push(`/racks?device=${selected.deviceId}`) }}
                        >
                          {selected.deviceName}
                        </button>
                      ) : "—"
                    } />
                    <DetailRow label="目标存储卷" value={selected.volumeId ?? "—"} />
                  </div>
                </section>

                <Separator />

                {/* 路径信息 */}
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><HardDrive className="h-4 w-4 text-slate-400" />路径信息</h4>
                  <div className="text-sm">
                    <DetailRow label="源数据路径" value={<span className="font-mono text-xs break-all">{selected.sourcePath}</span>} />
                    <DetailRow label="封包路径" value={<span className="font-mono text-xs break-all">{selected.packagePath}</span>} />
                  </div>
                </section>

                <Separator />

                {/* 进度流程 */}
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-slate-400" />进度流程</h4>
                  <div className="flex items-center gap-0 overflow-x-auto pb-2">
                    {getPhases(selected).map((phase, i) => {
                      const activeIdx = getActivePhaseIndex(selected)
                      const isCompleted = i < activeIdx
                      const isActive = i === activeIdx
                      const isFailed = selected.phase === "failed" && i === activeIdx
                      return (
                        <div key={phase} className="flex items-center">
                          <div className="flex flex-col items-center gap-1 min-w-[56px]">
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2",
                              isFailed ? "bg-red-50 border-red-300 text-red-600" :
                              isCompleted ? "bg-emerald-50 border-emerald-300 text-emerald-600" :
                              isActive ? "bg-blue-50 border-blue-400 text-blue-600" :
                              "bg-slate-50 border-slate-200 text-slate-400"
                            )}>
                              {isFailed ? <AlertCircle className="h-3.5 w-3.5" /> : isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                            </div>
                            <span className={cn("text-[10px] whitespace-nowrap", isActive ? "text-blue-600 font-medium" : isCompleted ? "text-emerald-600" : isFailed ? "text-red-600" : "text-slate-400")}>
                              {TASK_PHASE_LABELS[phase as TaskPhase] ?? phase}
                            </span>
                          </div>
                          {i < getPhases(selected).length - 1 && (
                            <div className={cn("h-0.5 w-5 mx-0.5", i < activeIdx ? "bg-emerald-300" : "bg-slate-200")} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* 多线程封包 */}
                {selected.packagingThreads && selected.packagingThreads.length > 0 && (
                  <>
                    <Separator />
                    <section>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-slate-400" />多线程封包进度</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {selected.packagingThreads.map(th => (
                          <div key={th.id} className={cn("p-2.5 rounded-lg border", th.status === "error" ? "border-red-200 bg-red-50/50" : "border-slate-100 bg-slate-50/50")}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-slate-700">{th.name}</span>
                              <span className={cn("text-[10px]", th.status === "completed" ? "text-emerald-600" : th.status === "running" ? "text-blue-600" : th.status === "error" ? "text-red-600" : "text-slate-400")}>
                                {th.status === "completed" ? "已完成" : th.status === "running" ? "运行中" : th.status === "error" ? "异常" : "等待中"}
                              </span>
                            </div>
                            <Progress value={th.progress} className={cn("h-1.5", th.status === "error" ? "[&>div]:bg-red-400" : "")} />
                            <p className="text-right text-[10px] text-slate-400 mt-1">{th.progress}%{th.speed ? ` · ${th.speed}` : ""}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                <Separator />

                {/* 统计数据 */}
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Package className="h-4 w-4 text-slate-400" />统计数据</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <MiniStat label="扫描文件数" value={selected.fileCount?.toLocaleString() ?? "—"} />
                    <MiniStat label="总文件大小" value={selected.totalSize ?? "—"} />
                    <MiniStat label="封包数量" value={selected.packageCount?.toString() ?? "—"} />
                    <MiniStat label="成功数" value={selected.successCount?.toString() ?? "—"} />
                    <MiniStat label="异常数" value={selected.errorCount?.toString() ?? "—"} />
                    <MiniStat label="当前速度" value={selected.speed ?? "—"} />
                    <MiniStat label="任务进度" value={`${selected.progress}%`} />
                    <MiniStat label="SM3 状态" value={selected.sm3Status === "completed" ? "通过" : selected.sm3Status === "failed" ? "失败" : selected.sm3Status === "in_progress" ? "进行中" : "待校验"} />
                  </div>
                  {selected.errorMessage && (
                    <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-xs text-red-700"><span className="font-medium">失败原因：</span>{selected.errorMessage}</p>
                    </div>
                  )}
                </section>

                <Separator />

                {/* 时间信息 */}
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" />时间信息</h4>
                  <div className="text-sm">
                    <DetailRow label="开始时间" value={selected.startedAt} />
                    <DetailRow label="更新时间" value={selected.updatedAt} />
                    <DetailRow label="完成时间" value={selected.completedAt ?? "—"} />
                    <DetailRow label="重试次数" value={(selected.retryCount ?? 0).toString()} />
                  </div>
                </section>

                <Separator />

                {/* 执行日志 */}
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Timer className="h-4 w-4 text-slate-400" />执行日志</h4>
                  <div className="space-y-1.5">
                    {selected.recentLogs.slice(0, 8).map(l => (
                      <div key={l.id} className={cn("p-2 rounded text-xs font-mono", logLevelColor[l.level])}>
                        <span className="text-slate-400">[{l.timestamp}]</span> {l.message}
                      </div>
                    ))}
                    {selected.recentLogs.length === 0 && <p className="text-xs text-slate-400 text-center py-4">暂无日志</p>}
                  </div>
                </section>

                {/* 任务操作 */}
                <Separator />
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-slate-400" />任务操作</h4>
                  <div className="flex flex-wrap gap-2">
                    {selected.phase !== "completed" && selected.phase !== "failed" && (
                      <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleAdvance(selected)}>
                        <SkipForward className="h-3.5 w-3.5 mr-1" />推进进度
                      </Button>
                    )}
                    {["scanning", "preparing", "splitting", "packaging", "verifying", "writing"].includes(selected.phase) && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handlePause(selected)}>
                          <Pause className="h-3.5 w-3.5 mr-1" />暂停
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleComplete(selected)}>
                          <CheckCheck className="h-3.5 w-3.5 mr-1" />标记完成
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleFail(selected)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" />标记失败
                        </Button>
                      </>
                    )}
                    {selected.phase === "paused" && (
                      <Button size="sm" variant="outline" onClick={() => handleResume(selected)}>
                        <Play className="h-3.5 w-3.5 mr-1" />恢复
                      </Button>
                    )}
                    {selected.phase === "failed" && (
                      <Button size="sm" variant="outline" onClick={() => handleRetry(selected)}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />重试
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleExport(selected)}>
                      <Download className="h-3.5 w-3.5 mr-1" />导出
                    </Button>
                  </div>
                </section>
              </div>
            )}
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* ── 新建任务弹窗 ─────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="!max-w-2xl">
          <DialogHeader><DialogTitle>新建任务</DialogTitle><DialogDescription>创建档案数据封包、备份、扫描任务</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="col-span-2 space-y-2">
              <Label>任务名称 *</Label>
              <Input value={createForm.name ?? ""} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="如：苏州市档案馆全量封包" />
            </div>
            <div className="space-y-2">
              <Label>任务类型</Label>
              <Select value={createForm.type ?? "full_package"} onValueChange={v => setCreateForm(f => ({ ...f, type: v as TaskType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>档案馆名称 *</Label>
              <Input value={createForm.archiveName ?? ""} onChange={e => setCreateForm(f => ({ ...f, archiveName: e.target.value }))} placeholder="如：苏州市档案馆" />
            </div>
            <div className="space-y-2">
              <Label>数据分类</Label>
              <Input value={createForm.dataClassification ?? ""} onChange={e => setCreateForm(f => ({ ...f, dataClassification: e.target.value }))} placeholder="如：馆藏档案" />
            </div>
            <div className="space-y-2">
              <Label>备份范围</Label>
              <Select value={createForm.backupScope ?? "full"} onValueChange={v => setCreateForm(f => ({ ...f, backupScope: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">全量</SelectItem>
                  <SelectItem value="incremental">增量</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>封包流程</Label>
              <Select value={createForm.packagingMode ?? "scan_while_package"} onValueChange={v => setCreateForm(f => ({ ...f, packagingMode: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scan_while_package">边扫描边封包</SelectItem>
                  <SelectItem value="scan_then_package">先扫描后封包</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>优先级</Label>
              <Select value={createForm.priority ?? "normal"} onValueChange={v => setCreateForm(f => ({ ...f, priority: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">紧急</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="normal">普通</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>源数据路径</Label>
              <Input value={createForm.sourcePath ?? ""} onChange={e => setCreateForm(f => ({ ...f, sourcePath: e.target.value }))} placeholder="/data/archive/" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>封包路径</Label>
              <Input value={createForm.packagePath ?? ""} onChange={e => setCreateForm(f => ({ ...f, packagePath: e.target.value }))} placeholder="/output/archive/" />
            </div>
            <div className="space-y-2">
              <Label>关联设备</Label>
              <Select value={createForm.deviceId ?? "__none__"} onValueChange={v => {
                const rack = v === "__none__" ? null : mockRacks.find(r => r.id === v)
                setCreateForm(f => ({ ...f, deviceId: v === "__none__" ? undefined : v, rackId: v === "__none__" ? undefined : v, deviceName: rack?.rackId }))
              }}>
                <SelectTrigger><SelectValue placeholder="选择设备（可选）" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不指定设备</SelectItem>
                  {mockRacks.map(r => <SelectItem key={r.id} value={r.id}>{r.rackId}（{r.deviceType}）</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>分配部门</Label>
              <Input value={createForm.department ?? ""} onChange={e => setCreateForm(f => ({ ...f, department: e.target.value }))} placeholder="如：设备运维部" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">创建任务</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
