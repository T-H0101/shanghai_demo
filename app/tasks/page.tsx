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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GlassPanel } from "@/components/platform/glass-panel"
// 暂时隐藏：文件索引
// import { TaskFileIndexPanel } from "@/components/tasks/task-file-index-panel"
import { ControlCommandPanel } from "@/components/tasks/control-command-panel"
import { AppTooltip } from "@/components/shared/tooltip"
import {
  taskProvider,
  isApiMode,
  fetchTasksPage,
} from "@/lib/api"
import { formatApiErrorMessage, httpStatusMessage, isSessionExpiredError } from "@/lib/api/http-error"
import type { TaskItem, TaskPhase } from "@/lib/types/task"
// import type { TaskLogEntry } from "@/lib/types/task" // 执行日志暂时隐藏
import { TASK_TYPE_LABELS, TASK_PHASE_LABELS, TASK_PHASE_COLORS, TASK_PHASES_BY_TYPE, TASK_PROGRESS_FLOW_LABELS_BY_TYPE } from "@/lib/types/task"
import {
  taskStatusLabelColorClass,
  TASK_STATUS_FILTER_OPTIONS,
  PHASE_QUERY_TO_STATUS_FILTER,
  normalizePhaseForProgressFlow,
} from "@/lib/tasks/task-status-display"
import { TASK_TYPE_FILTER_OPTIONS } from "@/lib/tasks/task-type-display"
import {
  formatRestoreFileStatus,
  isPhysicalRestoreTask,
} from "@/lib/tasks/restore-file-display"
import { useSite } from "@/lib/site/site-context"
import { buildTaskDeviceFilterHref, parseTaskDeviceFilter } from "@/lib/tasks/task-device-filter"
import {
  Activity, Pause, Play, RotateCcw, RefreshCw, AlertTriangle, ClipboardList,
  Search, Download, X, Clock, CheckCircle2, AlertCircle,
  ChevronRight, Info, Package, BarChart3, Zap, Link2, HardDrive,
  // Timer, FileText, // 执行日志暂时隐藏
  SkipForward, CheckCheck, XCircle, Eye,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatBeijingTime, formatBeijingTimeOnly } from "@/components/shared/time-format"
import { TASK_TYPE_COLORS } from "@/lib/types/colors"
// import { LOG_LEVEL_COLORS } from "@/lib/types/colors" // 执行日志暂时隐藏

const typeColors = TASK_TYPE_COLORS
// const logLevelColor = LOG_LEVEL_COLORS // 执行日志暂时隐藏

function taskTypeDisplay(task: TaskItem): string {
  return task.typeLabel ?? TASK_TYPE_LABELS[task.type]
}

function taskStatusDisplay(task: TaskItem): string {
  return task.statusLabel ?? TASK_PHASE_LABELS[task.phase]
}

function taskStatusBadgeClass(task: TaskItem): string {
  if (task.statusLabel) return taskStatusLabelColorClass(task.statusLabel)
  return TASK_PHASE_COLORS[task.phase]
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-[5px] text-sm">
      <span className="text-slate-400 shrink-0 w-24 text-right">{label}</span>
      <span className="text-slate-900 min-w-0 break-words">{value}</span>
    </div>
  )
}

/** 短字段两列网格：上标签下值，避免单列 DetailRow 右侧大片留白 */
function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 min-w-0 break-words">{value}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 text-center">
      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

// Sprint 2F.3: 字段展示语义收口
// 1) runtime: 有值格式化 (秒/分秒/时分秒), null/undefined → "—"
function formatRuntime(seconds: number | null | undefined): string {
  if (seconds == null) return "—"
  if (seconds < 0) return "—"
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return s > 0 ? `${m}m${s}s` : `${m}m`
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

function formatTaskTime(value: string | null | undefined): string {
  return formatBeijingTime(value) || "—"
}

// 3) 计数字段 (packageCount/successCount/errorCount): null → "—", 0 → "0"
function formatCount(n: number | null | undefined): string {
  if (n == null) return "—"
  return n.toString()
}

/** 字节 → 可读大小，非 B 单位保留两位小数（API 为原始字节，mock 可能已是文案） */
function formatTotalSize(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—"
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return "—"
    // 已含单位的展示串（如 mock「2.8 TB」）原样返回
    if (/[A-Za-z]/.test(trimmed)) return trimmed
    const n = Number(trimmed)
    if (!Number.isFinite(n)) return trimmed
    return formatBytesFixed2(n)
  }
  if (!Number.isFinite(value)) return "—"
  return formatBytesFixed2(value)
}

function formatBytesFixed2(bytes: number): string {
  if (bytes < 0) return "—"
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  if (i === 0) return `${Math.round(n)} B`
  return `${n.toFixed(2)} ${units[i]}`
}

// 4) 无源字段: 统一提示文案（当前速度/剩余时间已隐藏，暂不用）
// const NO_REALTIME_DATA = "暂无实时数据"
// const LOG_NOT_CONNECTED = "运行日志未接入" // 执行日志暂时隐藏
const RUNNING_PHASES = ["scanning", "preparing", "splitting", "packaging", "verifying", "writing"]
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const

// 5) 进度展示: null → "—", 否则数字
function formatProgress(p: number | null | undefined, phase: string | null | undefined): string {
  if (phase === "completed") return "100%"
  if (p == null) return "—"
  if (p <= 0) return "—"
  return `${p}%`
}

// 6) 数据源徽章 (用于头部, 标识当前是 API 还是 mock)
function DataSourceBadge() {
  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded font-mono",
        isApiMode() ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
      )}
      title={isApiMode() ? "实时数据模式" : "演示数据模式"}
    >
      {isApiMode() ? "实时" : "演示"}
    </span>
  )
}

// 7) 轻量提示条 — 当前速度/剩余时间已隐藏，暂不展示
// function RuntimeDataNotice() {
//   if (!isApiMode()) return null
//   return (
//     <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
//       <Info className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
//       <span>实时速度、剩余时间、当前文件等字段需站点推送实时运行状态后显示。</span>
//     </div>
//   )
// }

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
  const { deviceId: deviceIdFilter, deviceName: deviceNameFilter, siteCode: deviceFilterSiteCode } =
    parseTaskDeviceFilter(searchParams)
  const legacyDeviceFilter = searchParams?.get("device") ?? null
  const phaseQuery = searchParams?.get("phase") ?? null
  const phaseGroupQuery = searchParams?.get("phaseGroup") ?? null
  const initialStatusFilter =
    (phaseQuery && PHASE_QUERY_TO_STATUS_FILTER[phaseQuery]) ||
    (phaseQuery && TASK_STATUS_FILTER_OPTIONS.some((o) => o.value === phaseQuery) ? phaseQuery : null) ||
    "all"

  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [keyword, setKeyword] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter)
  const [scopeFilter, setScopeFilter] = useState<string>("all")
  const [selected, setSelected] = useState<TaskItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [tab, setTab] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(false)
  // 用本地 state 驱动视图：刷新后仅靠删 URL searchParam 时，Next.js 可能不重渲染 useSearchParams
  const [view, setViewState] = useState<"tasks" | "commands">(
    () => (searchParams?.get("view") === "commands" ? "commands" : "tasks"),
  )

  // Sprint 2F.4: 全局 siteCode
  const { siteCode, isAllSites, isReady: siteReady } = useSite()

  const resolvedType = typeFilter !== "all" ? typeFilter : tab !== "all" ? tab : undefined

  // 加载数据（服务端分页）
  const loadTasks = useCallback(async () => {
    setListLoading(true)
    try {
      const listSiteCode =
        deviceIdFilter && deviceFilterSiteCode && deviceFilterSiteCode !== "__all__"
          ? deviceFilterSiteCode
          : !isAllSites && siteCode
            ? siteCode
            : undefined
      const filters = {
        siteCode: listSiteCode,
        keyword: keyword.trim() || undefined,
        type: resolvedType as any,
        statusFilter: statusFilter !== "all" ? statusFilter : undefined,
        deviceId: deviceIdFilter || undefined,
        device: !deviceIdFilter && legacyDeviceFilter ? legacyDeviceFilter : undefined,
        page,
        pageSize,
      }

      if (isApiMode()) {
        const params = { ...filters } as any
        if (phaseGroupQuery === "running" && statusFilter === "all") {
          // 用专用 query：API 支持 phaseGroup=running
          const qs = new URLSearchParams()
          if (filters.siteCode) qs.set("siteCode", filters.siteCode)
          if (filters.keyword) qs.set("keyword", filters.keyword)
          if (filters.type) qs.set("type", String(filters.type))
          if (filters.deviceId) qs.set("deviceId", filters.deviceId)
          else if (filters.device) qs.set("device", filters.device)
          qs.set("phaseGroup", "running")
          qs.set("page", String(page))
          qs.set("pageSize", String(pageSize))
          const res = await fetch(`/api/tasks?${qs.toString()}`, { cache: "no-store" })
          if (!res.ok) throw new Error(httpStatusMessage(res.status))
          const json = await res.json()
          if (json.code !== 0) throw new Error(json.message)
          const items = json.data?.items ?? []
          setTasks(items)
          setTotal(Number(json.data?.total) || 0)
          setSelected((prev) => {
            if (!prev) return items[0] ?? null
            return items.find((t: TaskItem) => t.id === prev.id) ?? items[0] ?? null
          })
        } else {
          const result = await fetchTasksPage(filters)
          setTasks(result.items)
          setTotal(result.total)
          setSelected((prev) => {
            if (!prev) return result.items[0] ?? null
            return result.items.find((t: TaskItem) => t.id === prev.id) ?? result.items[0] ?? null
          })
        }
      } else {
        const list = await taskProvider.getAll({
          siteCode: filters.siteCode,
          keyword: filters.keyword,
          type: filters.type,
          deviceId: filters.deviceId,
          device: filters.device,
        })
        let result = list
        if (filters.deviceId) {
          result = result.filter(
            (t) =>
              (t.deviceId ?? "") === filters.deviceId &&
              (!filters.siteCode || t.siteCode === filters.siteCode),
          )
        } else if (filters.device) {
          const q = filters.device.toLowerCase()
          result = result.filter(
            (t) =>
              (t.deviceId ?? "").toLowerCase() === q ||
              (t.deviceName ?? "").toLowerCase().includes(q),
          )
        }
        if (phaseGroupQuery === "running") {
          result = result.filter((t) => RUNNING_PHASES.includes(t.phase))
        }
        if (statusFilter !== "all") {
          if (statusFilter === "finished") {
            result = result.filter((t) => {
              const label = t.statusLabel ?? TASK_PHASE_LABELS[t.phase]
              return label === "成功" || label === "警告" || label === "中止"
            })
          } else if (statusFilter === "running") {
            result = result.filter((t) => {
              const label = t.statusLabel ?? TASK_PHASE_LABELS[t.phase]
              return !["成功", "警告", "中止", "暂停"].includes(label)
            })
          } else if (statusFilter === "alert") {
            result = result.filter((t) => {
              const label = t.statusLabel ?? TASK_PHASE_LABELS[t.phase]
              return label === "警告" || label === "中止"
            })
          } else {
            const opt = TASK_STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)
            if (opt) result = result.filter((t) => (t.statusLabel ?? TASK_PHASE_LABELS[t.phase]) === opt.label)
          }
        }
        if (scopeFilter !== "all") {
          result = result.filter((t) => (t.backupScope ?? "") === scopeFilter)
        }
        setTotal(result.length)
        const start = (page - 1) * pageSize
        const pageItems = result.slice(start, start + pageSize)
        setTasks(pageItems)
        setSelected((prev) => {
          if (!prev) return pageItems[0] ?? null
          return pageItems.find((t) => t.id === prev.id) ?? pageItems[0] ?? null
        })
      }
    } catch (e) {
      setTasks([])
      setTotal(0)
      const expired = isSessionExpiredError(e)
      toast({
        title: expired ? "登录已过期，请重新登录" : "任务列表加载失败",
        description: expired ? undefined : formatApiErrorMessage(e),
        variant: "destructive",
      })
    } finally {
      setListLoading(false)
    }
  }, [
    isAllSites,
    siteCode,
    keyword,
    resolvedType,
    statusFilter,
    deviceIdFilter,
    legacyDeviceFilter,
    deviceFilterSiteCode,
    phaseGroupQuery,
    scopeFilter,
    page,
    pageSize,
  ])

  // 筛选变更时回到第 1 页
  useEffect(() => {
    setPage(1)
  }, [keyword, typeFilter, statusFilter, scopeFilter, tab, phaseGroupQuery, deviceIdFilter, legacyDeviceFilter, deviceFilterSiteCode, isAllSites, siteCode])

  // 初始加载 + 条件变化重新加载
  useEffect(() => {
    if (siteReady) void loadTasks()
  }, [loadTasks, siteReady])

  // R.76: 同步 ?phase= 查询参数 → statusFilter
  useEffect(() => {
    if (!phaseQuery) return
    const mapped =
      PHASE_QUERY_TO_STATUS_FILTER[phaseQuery] ??
      (TASK_STATUS_FILTER_OPTIONS.some((o) => o.value === phaseQuery) ? phaseQuery : null)
    if (mapped) setStatusFilter(mapped)
  }, [phaseQuery])

  const openDetail = (task: TaskItem) => { setSelected(task); setDrawerOpen(true) }

  // 计算统计（当前页；总数用服务端 total）
  const allStats = useMemo(() => {
    return {
      total,
      pending: tasks.filter(t => t.phase === "pending").length,
      running: tasks.filter(t => RUNNING_PHASES.includes(t.phase)).length,
      completed: tasks.filter(t => t.phase === "completed").length,
      failed: tasks.filter(t => t.phase === "failed").length,
      paused: tasks.filter(t => t.phase === "paused").length,
    }
  }, [tasks, total])

  // 本页展示列表（api 模式 scope 仍前端裁一层；其余已在服务端过滤）
  const filtered = useMemo(() => {
    if (isApiMode()) {
      if (scopeFilter === "all") return tasks
      return tasks.filter((t) => (t.backupScope ?? "") === scopeFilter)
    }
    return tasks
  }, [tasks, scopeFilter])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // 筛选后总页数变少时，把页码夹回合法范围
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const showApiWriteUnavailable = (action: string) => {
    toast({
      title: "任务操作未接入",
      description: `当前仅支持任务查看，暂不能${action}`,
    })
  }

  // 推进进度
  const handleAdvance = async (task: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (isApiMode()) return showApiWriteUnavailable("推进任务")
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

  const handleComplete = async (task: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (isApiMode()) return showApiWriteUnavailable("标记任务完成")
    await taskProvider.completeTask(task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, phase: "completed", status: "completed" as const, progress: 100 } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, phase: "completed", status: "completed" as const, progress: 100 } : null)
    toast({ title: "任务已标记完成", description: `「${task.name}」状态已在当前视图更新。` })
  }

  const handleFail = async (task: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (isApiMode()) return showApiWriteUnavailable("标记任务失败")
    await taskProvider.failTask(task.id, "手动标记失败")
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, phase: "failed", status: "failed" as const, errorMessage: "手动标记失败" } : t))
    if (selected?.id === task.id) setSelected(prev => prev ? { ...prev, phase: "failed", status: "failed" as const, errorMessage: "手动标记失败" } : null)
    toast({ title: "任务已失败", description: `「${task.name}」已标记为失败` })
  }

  const handleExport = (task: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (isApiMode()) return showApiWriteUnavailable("导出任务")
    toast({ title: "导出任务", description: `「${task.name}」数据导出中...` })
  }

  // 暂停 / 重置并继续：总控直调站点业务 HTTP（实时预检 + 原业务逻辑）
  const handleControlCommand = async (
    task: TaskItem,
    commandType: "task_pause" | "task_resume" | "task_reset",
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation()
    if (!isApiMode()) {
      toast({ title: "当前模式不支持此操作", description: "请切换到实时数据模式", variant: "destructive" })
      return
    }
    if (isPhysicalRestoreTask(task.type, task.taskMode ?? null)) {
      toast({
        title: "暂不支持此操作",
        description: "物理回迁任务暂不提供暂停/重置，请通过详情查看进度",
        variant: "destructive",
      })
      return
    }
    try {
      // targetId 必须是站点 tbl_task.id（source_id）
      const targetId = (task as { sourceId?: string }).sourceId ?? task.id
      const res = await fetch("/api/control/commands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceSiteId: task.siteCode,
          commandType,
          targetType: "task",
          targetId,
          payload: { taskNo: task.taskNo, name: task.name, phase: task.phase, unifiedId: task.id },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || "提交失败")
      }
      toast({ title: "请求成功" })
      void loadTasks()
    } catch (err) {
      toast({
        title: "提交失败",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      })
    }
  }

  const [createJumpOpen, setCreateJumpOpen] = useState(false)

  const handleOpenCreateTask = () => {
    if (!siteReady || isAllSites || !siteCode) {
      toast({
        title: "请先选择站点",
        description: "新建任务需要明确目标站点",
        variant: "destructive",
      })
      return
    }
    setCreateJumpOpen(true)
  }

  const handleConfirmJumpToSite = async () => {
    setCreateJumpOpen(false)
    if (!siteCode) return
    try {
      const res = await fetch(`/api/sites/${encodeURIComponent(siteCode)}/sso`, {
        method: "GET",
        credentials: "include",
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`)
      }
      if (json.status !== "ready" || !json.jumpUrl) {
        throw new Error(json.message || "跳转票据签发失败")
      }
      // 延迟打开，等 Dialog 关闭动画完成
      setTimeout(() => {
        window.open(json.jumpUrl, "_blank", "noopener,noreferrer")
      }, 100)
    } catch (err) {
      toast({
        title: "跳转失败",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      })
    }
  }

  const handleResetFilters = () => {
    setKeyword(""); setTypeFilter("all"); setStatusFilter("all"); setScopeFilter("all"); setTab("all")
    setPage(1)
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.delete("phase")
    params.delete("phaseGroup")
    params.delete("deviceId")
    params.delete("deviceName")
    params.delete("device")
    const qs = params.toString()
    router.replace(`/tasks${qs ? `?${qs}` : ""}`)
  }

  const hasDeviceFilter = Boolean(deviceIdFilter || legacyDeviceFilter)
  const deviceFilterLabel = deviceNameFilter || legacyDeviceFilter || deviceIdFilter

  const handleClearDeviceFilter = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.delete("deviceId")
    params.delete("deviceName")
    params.delete("device")
    const qs = params.toString()
    router.push(`/tasks${qs ? `?${qs}` : ""}`)
  }

  const hasFilters = keyword || typeFilter !== "all" || statusFilter !== "all" || phaseGroupQuery === "running" || scopeFilter !== "all" || tab !== "all" || hasDeviceFilter

  const nowTime = () => formatBeijingTimeOnly(new Date())

  // 辅助：获取当前任务的完整流程步骤（备份类为五步：开始-准备-分盘-刻录-结束）
  const getPhases = (task: TaskItem): string[] => TASK_PHASES_BY_TYPE[task.type] ?? ["pending", "completed"]
  const getActivePhaseIndex = (task: TaskItem): number => {
    const phases = getPhases(task)
    if (task.phase === "failed" || task.phase === "paused") {
      const lastRunning = phases.findIndex((p) => p === "completed")
      return Math.max(0, (lastRunning >= 0 ? lastRunning : phases.length) - 1)
    }
    const normalized = normalizePhaseForProgressFlow(task.phase, task.type)
    const idx = phases.indexOf(normalized)
    return idx >= 0 ? idx : 0
  }
  const flowPhaseLabel = (task: TaskItem, phase: string) =>
    TASK_PROGRESS_FLOW_LABELS_BY_TYPE[task.type]?.[phase as TaskPhase] ?? TASK_PHASE_LABELS[phase as TaskPhase] ?? phase
  /** 分盘步骤下：已分盘数；刻录步骤下：已刻/总数（分盘中不把 burn_success=1 当已刻） */
  const flowPhaseSubtext = (task: TaskItem, phase: string, activeIdx: number, stepIdx: number): string | null => {
    const total = task.packageCount
    const normalized = normalizePhaseForProgressFlow(task.phase, task.type)
    if (phase === "splitting") {
      if (total == null) return null
      if (activeIdx < stepIdx) return null
      return `${total} 盘`
    }
    if (phase === "writing") {
      if (total == null || total <= 0) return null
      if (activeIdx < stepIdx) return null
      // 分盘阶段 burn_success 常全为 1，不能当已刻数
      if (normalized === "splitting") return null
      const burned = task.successCount ?? 0
      return `${burned}/${total}`
    }
    return null
  }

  const setView = (nextView: "tasks" | "commands") => {
    setViewState(nextView)
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    if (nextView === "commands") params.set("view", "commands")
    else params.delete("view")
    const qs = params.toString()
    router.replace(qs ? `/tasks?${qs}` : "/tasks")
  }

  const viewSwitcher = (
    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-sm" aria-label="任务中心视图">
      <Button
        variant={view === "tasks" ? "default" : "ghost"}
        size="sm"
        className={cn("h-8", view === "tasks" && "bg-slate-900 hover:bg-slate-800")}
        onClick={() => setView("tasks")}
        data-testid="task-view-tasks"
      >
        任务列表
      </Button>
      <Button
        variant={view === "commands" ? "default" : "ghost"}
        size="sm"
        className={cn("h-8", view === "commands" && "bg-slate-900 hover:bg-slate-800")}
        onClick={() => setView("commands")}
        data-testid="task-view-commands"
      >
        控制命令
      </Button>
    </div>
  )

  if (view === "commands") {
    return (
      <AppShell>
        <PageHeader
          title="任务管理"
          description="集中查看任务状态、提交控制并跟踪站点代理执行结果"
          badge="TASK CENTER"
          actions={viewSwitcher}
        />
        <ControlCommandPanel />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader
        title="任务管理"
        description="档案数据封包、备份、恢复、扫描任务统一调度与监控"
        badge="TASK CENTER"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {viewSwitcher}
            <DataSourceBadge />
            <Button
              size="sm"
              data-testid="task-create-open"
              disabled={!siteReady || isAllSites}
              title={
                isAllSites
                  ? "请先选择站点"
                  : "跳转到站点业务系统创建任务"
              }
              onClick={handleOpenCreateTask}
            >
              <ClipboardList className="h-4 w-4 mr-1" />
              新建任务
            </Button>
          </div>
        }
      />

      {/* ── 统计卡片 ─────────────────────────────────────────── */}
      <GlassPanel
        testId="tasks-hero-glass-panel"
        title="任务概览"
        description="当前过滤条件下的任务运行态分布, 实时更新"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard horizontal title="任务总数" value={allStats.total} unit="个" icon={Activity} />
          <StatCard horizontal title="待处理" value={allStats.pending} icon={Clock} iconBg="bg-slate-50" iconColor="text-slate-600" />
          <StatCard horizontal title="进行中" value={allStats.running} icon={Play} iconBg="bg-blue-50" iconColor="text-blue-600" />
          <StatCard horizontal title="已完成" value={allStats.completed} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard horizontal title="已失败" value={allStats.failed} icon={AlertCircle} iconBg="bg-red-50" iconColor="text-red-600" />
          <StatCard horizontal title="暂停命令已提交" value={allStats.paused} icon={Pause} iconBg="bg-amber-50" iconColor="text-amber-600" />
        </div>
      </GlassPanel>

      {/* ── 筛选区 ───────────────────────────────────────────── */}
      <Card className="gap-0 py-0">
        <CardContent className="px-4 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-xs text-slate-500">关键词搜索</Label>
              <AppTooltip content="按任务名称 / 编号模糊搜索, 实时过滤">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="任务名称 / 编号"
                    className="pl-9 h-9"
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    data-testid="tasks-search-input"
                    aria-label="搜索任务"
                  />
                </div>
              </AppTooltip>
            </div>
            <div className="space-y-1.5 w-40">
              <Label className="text-xs text-slate-500">任务类型</Label>
              <AppTooltip content="按业务任务类型筛选 (磁光电)">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9" data-testid="tasks-type-filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    {TASK_TYPE_FILTER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AppTooltip>
            </div>
            <div className="space-y-1.5 w-40">
              <Label className="text-xs text-slate-500">状态</Label>
              <AppTooltip content="全部 / 正在运行中 / 已经结束 / 成功 / 警告 / 中止 / 暂停">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9" data-testid="tasks-phase-filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    {TASK_STATUS_FILTER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AppTooltip>
            </div>
            <div className="space-y-1.5 w-28">
              <Label className="text-xs text-slate-500">备份范围</Label>
              <AppTooltip content="全量 / 增量封包范围">
                <Select value={scopeFilter} onValueChange={setScopeFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="full">全量</SelectItem>
                    <SelectItem value="incremental">增量</SelectItem>
                  </SelectContent>
                </Select>
              </AppTooltip>
            </div>
            <AppTooltip content="清除所有筛选条件, 显示全部任务">
              <Button
                variant="outline"
                size="sm"
                className="h-9 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={handleResetFilters}
                disabled={!hasFilters}
                data-testid="tasks-reset-filters"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />重置
              </Button>
            </AppTooltip>
          </div>
          {hasDeviceFilter && deviceFilterLabel && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                设备筛选: {deviceFilterLabel}
                {deviceIdFilter && deviceFilterSiteCode && deviceFilterSiteCode !== "__all__" ? (
                  <span className="ml-1 text-[10px] font-normal opacity-80">({deviceFilterSiteCode})</span>
                ) : null}
              </Badge>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleClearDeviceFilter}>
                清除
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sprint 2F.3: 实时运行状态提示 — 当前速度/剩余时间已隐藏 */}
      {/* <RuntimeDataNotice /> */}

      {/* ── 任务表格 ─────────────────────────────────────────── */}
      <Card className="gap-0">
        <CardHeader className="pb-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
                <TabsTrigger value="0,7" className="text-xs">备份</TabsTrigger>
                <TabsTrigger value="1-0,1-1,1-2" className="text-xs">恢复</TabsTrigger>
                <TabsTrigger value="1-12" className="text-xs">巡检</TabsTrigger>
                <TabsTrigger value="4" className="text-xs">扫描</TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="text-xs text-slate-400 shrink-0">
              {listLoading ? "加载中…" : `本页 ${filtered.length} 条 · 共 ${total} 条`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">任务编号</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">任务名称</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">类型</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">范围</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap min-w-[140px]">进度</TableHead>
                <TableHead className="text-xs text-slate-500 whitespace-nowrap">运行耗时</TableHead>
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
                <TableRow key={`${t.siteCode}-${t.taskNo}-${t.id}`} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => openDetail(t)}>
                  <TableCell className="font-mono text-xs text-slate-500">{t.taskNo}</TableCell>
                  <TableCell>
                    <p className="font-medium text-sm truncate max-w-[180px]" title={t.name}>{t.name}</p>
                  </TableCell>
                  <TableCell><Badge variant="outline" className={cn("text-[10px]", typeColors[t.type])}>{taskTypeDisplay(t)}</Badge></TableCell>
                  <TableCell className="text-xs">{t.backupScope === "full" ? "全量" : t.backupScope === "incremental" ? "增量" : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {t.progress != null && t.progress > 0 ? (
                        <>
                          <Progress value={t.progress} className="h-1.5 flex-1" />
                          <span className={cn("text-xs font-medium min-w-[32px] text-right", t.phase === "failed" ? "text-red-500" : "")}>{t.progress}%</span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                    {t.speed && <p className="text-[10px] text-slate-400 mt-0.5">{t.speed}</p>}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {t.runtime != null ? (
                      <span className="text-slate-700 font-medium">{formatRuntime(t.runtime)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">{t.fileCount?.toLocaleString() ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatTotalSize(t.totalSize)}</TableCell>
                  <TableCell>
                    {t.deviceName && t.deviceId && t.siteCode ? (
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs text-blue-600" onClick={e => { e.stopPropagation(); router.push(buildTaskDeviceFilterHref({ siteCode: t.siteCode, deviceId: t.deviceId!, deviceName: t.deviceName })) }}>
                        {t.deviceName} <Link2 className="h-3 w-3 ml-0.5" />
                      </Button>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </TableCell>
                  <TableCell><Badge className={cn("text-[10px]", taskStatusBadgeClass(t))}>{taskStatusDisplay(t)}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-0.5 justify-end" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="详情" aria-label="查看任务详情" onClick={() => openDetail(t)}><Eye className="h-3.5 w-3.5" /></Button>
                      {isApiMode() && !isPhysicalRestoreTask(t.type, t.taskMode ?? null) && RUNNING_PHASES.includes(t.phase) && (
                        <AppTooltip content="暂停任务">
                          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" data-testid="task-row-pause" onClick={e => handleControlCommand(t, "task_pause", e)} aria-label="暂停任务">
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        </AppTooltip>
                      )}
                      {isApiMode() && !isPhysicalRestoreTask(t.type, t.taskMode ?? null) && (t.phase === "failed" || t.phase === "paused" || t.statusLabel === "中止" || t.statusLabel === "警告") && (
                        <AppTooltip content="重置任务状态并继续任务">
                          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" data-testid="task-row-reset" onClick={e => handleControlCommand(t, "task_reset", e)} aria-label="重置任务状态并继续任务">
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </AppTooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {total > 0 && (
            <div className="flex flex-col items-center justify-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-3">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page <= 1 || listLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <span className="text-xs text-slate-500 tabular-nums">
                  第 {page} / {totalPages} 页 · 共 {total} 条
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page >= totalPages || listLoading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一页
                </Button>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">每页</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v))
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-[88px]" aria-label="每页条数">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} 条</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 任务详情抽屉 ─────────────────────────────────────── */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className="!w-[680px] !max-w-[90vw] !h-full">
          <DrawerHeader className="border-b border-slate-100 dark:border-slate-700 shrink-0">
            <div className="flex items-start justify-between">
              <DrawerTitle className="text-base">{selected?.name}</DrawerTitle>
              {selected && <Badge className={cn("text-xs", taskStatusBadgeClass(selected))}>{taskStatusDisplay(selected)}</Badge>}
            </div>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            {selected && (
              <div className="h-full overflow-hidden pt-[13px] px-5 pb-5 flex flex-col">
                {/* 1. 进度流程：备份类为 开始→准备→分盘→刻录→已完成；分盘/刻录步骤下挂盘数 */}
                <section className="shrink-0">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-slate-400" />进度流程</h4>
                  <div className="flex w-full items-start">
                    {getPhases(selected).map((phase, i) => {
                      const activeIdx = getActivePhaseIndex(selected)
                      const isCompleted = selected.phase !== "failed" && selected.phase !== "paused" && i < activeIdx
                      const isActive = i === activeIdx
                      const isFailed = selected.phase === "failed" && i === activeIdx
                      const subtext = flowPhaseSubtext(selected, phase, activeIdx, i)
                      const phasesLen = getPhases(selected).length
                      return (
                        <div key={phase} className="flex flex-1 items-start min-w-0">
                          <div className="flex min-w-0 flex-1 flex-col items-center">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 shrink-0",
                              isFailed ? "bg-red-50 border-red-300 text-red-600 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300" :
                              isCompleted ? "bg-emerald-50 border-emerald-300 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300" :
                              isActive ? "bg-blue-50 border-blue-400 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300" :
                              "bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-500"
                            )}>
                              {isFailed ? <AlertCircle className="h-5 w-5" /> : isCompleted ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                            </div>
                            <span className={cn("mt-2 whitespace-nowrap text-xs leading-none", isActive ? "text-blue-600 dark:text-blue-300 font-medium" : isCompleted ? "text-emerald-600 dark:text-emerald-300" : isFailed ? "text-red-600 dark:text-red-300" : "text-slate-400")}>
                              {flowPhaseLabel(selected, phase)}
                            </span>
                            {/* 固定高度占位，避免有数字的步骤把圆点顶歪 */}
                            <span className={cn(
                              "mt-1.5 h-4 text-[11px] font-mono whitespace-nowrap tabular-nums leading-none",
                              subtext == null ? "invisible" : isActive ? "text-blue-500 dark:text-blue-400" : isCompleted ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-slate-400"
                            )}>
                              {subtext ?? "0"}
                            </span>
                          </div>
                          {i < phasesLen - 1 && (
                            <div className="mt-5 h-0.5 flex-1 min-w-[8px] self-start">
                              <div className={cn("h-full w-full", i < activeIdx && selected.phase !== "failed" ? "bg-emerald-300 dark:bg-emerald-700" : "bg-slate-200 dark:bg-slate-700")} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* 多线程封包 (Sprint 2F.3: 仅 mock 模式展示, API 模式无源数据) */}
                {!isApiMode() && selected.packagingThreads && selected.packagingThreads.length > 0 && (
                  <>
                    <Separator className="mt-2 mb-[15px] shrink-0" />
                    <section className="shrink-0">
                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-slate-400" />多线程封包进度</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {selected.packagingThreads.map(th => (
                          <div key={th.id} className={cn("p-2.5 rounded-lg border", th.status === "error" ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20" : "border-slate-100 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/40")}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{th.name}</span>
                              <span className={cn("text-[10px]", th.status === "completed" ? "text-emerald-600 dark:text-emerald-300" : th.status === "running" ? "text-blue-600 dark:text-blue-300" : th.status === "error" ? "text-red-600 dark:text-red-300" : "text-slate-400")}>
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

                <Separator className="mt-2 mb-[15px] shrink-0" />

                {/* 2. 统计数据 */}
                <section className="shrink-0">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Package className="h-4 w-4 text-slate-400" />统计数据</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <MiniStat label="分盘数量" value={formatCount(selected.packageCount)} />
                    <MiniStat label="已刻录" value={formatCount(selected.successCount)} />
                    <MiniStat label="异常数" value={formatCount(selected.errorCount)} />
                    <MiniStat label="运行耗时" value={formatRuntime(selected.runtime)} />
                    {/* 未实现实时字段，暂不展示 */}
                    {/* <MiniStat label="当前速度" value={isApiMode() ? NO_REALTIME_DATA : (selected.speed ?? "—")} /> */}
                    {/* <MiniStat label="剩余时间" value={isApiMode() ? NO_REALTIME_DATA : (selected.remainingTime ?? "—")} /> */}
                    <MiniStat label="扫描文件数" value={selected.fileCount?.toLocaleString() ?? "—"} />
                    <MiniStat label="总文件大小" value={formatTotalSize(selected.totalSize)} />
                    <MiniStat label="任务进度" value={formatProgress(selected.progress, selected.phase)} />
                    {/* SM3 非任务级状态，站点无对口同步字段，暂不展示 */}
                    {/* <MiniStat
                      label="SM3 状态"
                      value={
                        selected.sm3Status === "completed" ? "通过"
                        : selected.sm3Status === "failed" ? "失败"
                        : selected.sm3Status === "in_progress" ? "进行中"
                        : selected.sm3Status === "pending" ? "待校验"
                        : "—"
                      }
                    /> */}
                    {/* <MiniStat label="运行模式" value={selected.taskMode != null ? `模式 ${selected.taskMode}` : "—"} /> */}
                    {/* 当前阶段改用任务「进度流程」步骤（开始/准备/分盘/刻录/已完成），不再用盘 stage */}
                    <MiniStat label="当前阶段" value={flowPhaseLabel(selected, selected.phase)} />
                  </div>
                </section>

                <Separator className="mt-2 mb-[15px] shrink-0" />

                {/* 3. 路径信息：超过约 2 组高度时在区块内滚动 */}
                <section className="min-h-0 flex flex-col shrink">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2 shrink-0"><HardDrive className="h-4 w-4 text-slate-400" />路径信息</h4>
                  {/* 约 2 组单行路径高度；略大于 8rem，避免两组刚好顶满时出现滚动抖动 */}
                  <div className="text-sm max-h-[140px] overflow-y-auto pr-1">
                    {(() => {
                      const physical =
                        selected.pathSource === "restore_file" ||
                        isPhysicalRestoreTask("restore", selected.taskMode ?? null)
                      const fromLabel = physical
                        ? "回迁文件路径"
                        : selected.type === "restore"
                          ? "回迁路径"
                          : "源数据路径"
                      const toLabel = physical
                        ? "回迁目标路径"
                        : selected.type === "restore"
                          ? "介质源路径"
                          : "备份路径"
                      return (selected.pathPairs && selected.pathPairs.length > 0) ? (
                        selected.pathPairs.map((pair, idx) => (
                          <div
                            key={`${pair.fromPath}|${pair.backupPath}|${idx}`}
                            className={cn(
                              idx > 0 && "pt-2 border-t border-slate-100 dark:border-slate-800"
                            )}
                          >
                            <DetailRow
                              label={fromLabel}
                              value={
                                pair.fromPath
                                  ? <span className="font-mono text-xs break-all">{pair.fromPath}</span>
                                  : "—"
                              }
                            />
                            <DetailRow
                              label={toLabel}
                              value={
                                pair.backupPath
                                  ? <span className="font-mono text-xs break-all">{pair.backupPath}</span>
                                  : "—"
                              }
                            />
                            {physical && (
                              <>
                                <DetailRow
                                  label="回迁状态"
                                  value={formatRestoreFileStatus(pair.restoreStatus)}
                                />
                                {pair.restoreComment ? (
                                  <DetailRow
                                    label="回迁说明"
                                    value={
                                      <span className="text-xs break-all text-red-600 dark:text-red-400">
                                        {pair.restoreComment}
                                      </span>
                                    }
                                  />
                                ) : null}
                              </>
                            )}
                          </div>
                        ))
                      ) : (
                        <div>
                          <DetailRow
                            label={fromLabel}
                            value={
                              isApiMode() && (!selected.sourcePath || selected.sourcePath === "")
                                ? "—"
                                : <span className="font-mono text-xs break-all">{selected.sourcePath || "—"}</span>
                            }
                          />
                          <DetailRow
                            label={toLabel}
                            value={
                              isApiMode() && (!selected.packagePath || selected.packagePath === "")
                                ? "—"
                                : <span className="font-mono text-xs break-all">{selected.packagePath || "—"}</span>
                            }
                          />
                          {physical && selected.errorMessage ? (
                            <DetailRow
                              label="回迁说明"
                              value={
                                <span className="text-xs break-all text-red-600 dark:text-red-400">
                                  {selected.errorMessage}
                                </span>
                              }
                            />
                          ) : null}
                        </div>
                      )
                    })()}
                  </div>
                </section>

                <Separator className="mt-2 mb-[15px] shrink-0" />

                {/* 4. 基本信息（含时间，三列） */}
                <section className="shrink-0">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Info className="h-4 w-4 text-slate-400" />基本信息</h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    <DetailField label="任务编号" value={selected.taskNo} />
                    <DetailField label="任务类型" value={<Badge variant="outline" className={cn("text-[10px]", typeColors[selected.type])}>{taskTypeDisplay(selected)}</Badge>} />
                    <DetailField label="备份范围" value={selected.backupScope === "full" ? "全量" : selected.backupScope === "incremental" ? "增量" : "—"} />
                    <DetailField label="封包流程" value={selected.packagingMode === "scan_while_package" ? "边扫描边封包" : "先扫描后封包"} />
                    <DetailField label="关联设备" value={
                      selected.deviceName ? (
                        <button
                          className="text-blue-600 hover:text-blue-700 underline"
                          onClick={() => { setDrawerOpen(false); router.push(`/racks?device=${selected.deviceId}`) }}
                        >
                          {selected.deviceName}
                        </button>
                      ) : "—"
                    } />
                    <DetailField label="目标存储卷" value={selected.volumeId ?? "—"} />
                    <DetailField label="创建时间" value={formatTaskTime(selected.startedAt)} />
                    <DetailField label="结束时间" value={formatTaskTime(selected.completedAt)} />
                  </div>
                </section>

                {/* 暂时隐藏：文件索引、执行日志
                <Separator className="mt-2 mb-[15px]" />
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Package className="h-4 w-4 text-slate-400" />文件索引</h4>
                  <TaskFileIndexPanel taskId={selected.id} />
                </section>
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Timer className="h-4 w-4 text-slate-400" />执行日志</h4>
                  <div className="space-y-1.5">
                    {selected.recentLogs.slice(0, 8).map(l => (
                      <div key={l.id} className={cn("p-2 rounded text-xs font-mono", logLevelColor[l.level])}>
                        <span className="text-slate-400">[{l.timestamp}]</span> {l.message}
                      </div>
                    ))}
                    {selected.recentLogs.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">
                        {isApiMode() ? LOG_NOT_CONNECTED : "暂无日志"}
                      </p>
                    )}
                  </div>
                </section>
                */}

                {/* 5. 任务操作（物理回迁 task_type=1+task_mode=2 暂不开放暂停/重置） */}
                {isApiMode() && selected && !isPhysicalRestoreTask(selected.type, selected.taskMode ?? null) && (
                  <>
                    <Separator className="mt-2 mb-[15px] shrink-0" />
                    <section className="shrink-0">
                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-slate-400" />任务操作</h4>
                      <div className="flex flex-wrap gap-2">
                        {RUNNING_PHASES.includes(selected.phase) && (
                          <Button size="sm" variant="outline" className="text-amber-600 hover:text-amber-700" data-testid="task-detail-pause" title="暂停任务" onClick={() => handleControlCommand(selected, "task_pause")}>
                            <Pause className="h-3.5 w-3.5 mr-1" />暂停任务
                          </Button>
                        )}
                        {(selected.phase === "failed" || selected.phase === "paused" || selected.statusLabel === "中止" || selected.statusLabel === "警告") && (
                          <Button size="sm" variant="outline" className="text-slate-600" data-testid="task-detail-reset" title="重置任务状态并继续任务" onClick={() => handleControlCommand(selected, "task_reset")}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />重置任务状态并继续任务
                          </Button>
                        )}
                      </div>
                    </section>
                  </>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={createJumpOpen} onOpenChange={setCreateJumpOpen}>
        <DialogContent data-testid="task-create-jump-dialog">
          <DialogHeader>
            <DialogTitle>新建任务</DialogTitle>
            <DialogDescription>
              将进入站点磁光电系统，请在站点侧完成新建任务操作。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-300">
              目标站点: <code className="font-mono font-semibold">{siteCode}</code>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateJumpOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmJumpToSite} data-testid="task-create-jump-confirm">
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppShell>
  )
}
