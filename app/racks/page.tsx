"use client"
import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { EmptyState } from "@/components/shared/empty-state"
import { GlassPanel } from "@/components/platform/glass-panel"
import { rackProvider, taskProvider, fetchRackSlots, getRacksDataSource, isApiMode } from "@/lib/api"
import { MOCK_STORE_EVENT, getStorageKey } from "@/lib/api/mock-store"
import { loadRacksBrowseMock, loadRacksRestoreTargetsMock } from "@/lib/mock-mode/racks-browse"
import { useSite } from "@/lib/site/site-context"
import { InspectionView } from "@/components/racks/inspection-view"
import { VolumesView } from "@/components/racks/volumes-view"
import { CageMoveView } from "@/components/racks/cage-move-view"
import type { Rack, RackSlot, RackSlotGroup, RackStats, BackupFile, RestoreItem, RestoreTarget } from "@/lib/types/rack"
// DEVICE_MODE_LABELS / DeviceMode：模式控制 UI 暂隐藏，恢复时取消下行注释
// import { DEVICE_MODE_LABELS, type DeviceMode } from "@/lib/types/rack"
import {
  isHddDeviceTypeLabel,
  isNasDeviceTypeLabel,
  isOpticalDeviceTypeLabel,
} from "@/lib/devices/device-display"
import {
  OPTICAL_DISC_TYPE_COLORS,
  OPTICAL_DISC_TYPE_LABELS,
  normalizeOpticalDiscType,
  type OpticalDiscType,
} from "@/lib/devices/disc-slot-display"
import type { TaskItem } from "@/lib/types/task"
import type { AddMediaInput, MountInput, CreateTaskInput } from "@/lib/api/providers"
import {
  Server, HardDrive, Database, Wifi, WifiOff, AlertTriangle, Layers,
  Search, RefreshCw, Download, ListChecks, ChevronRight,
  Info, Grid3X3, Link2, CheckCircle2, XCircle, Clock,
  Activity, Plug, Eye as ScanIcon,
  Box, Timer, RotateCcw, FolderOpen, FileText, ArrowRight, ArrowLeftRight,
  FolderTree, ChevronDown, ChevronRight as ChevronRightIcon, Loader2,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatBeijingTime } from "@/components/shared/time-format"
import { LOG_LEVEL_COLORS } from "@/lib/types/colors"

type DeviceCategory = "all" | "hdd" | "optical" | "offline" | "nas" | "abnormal"
type ApiRacksDataSource = "database" | "empty" | "error"

const deviceStatusMap: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  online: { label: "在线", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  offline: { label: "离线", color: "bg-slate-100 text-slate-600", icon: XCircle },
  warning: { label: "警告", color: "bg-amber-100 text-amber-700", icon: AlertTriangle },
  error: { label: "错误", color: "bg-red-100 text-red-700", icon: AlertTriangle },
}

const slotStatusColor: Record<string, { bg: string; text: string; border: string }> = {
  used:   { bg: "bg-blue-600",   text: "text-white", border: "border-blue-600" },
  free:   { bg: "bg-slate-100",  text: "text-slate-400", border: "border-slate-200" },
  error:  { bg: "bg-red-500",    text: "text-white", border: "border-red-500" },
  empty:  { bg: "bg-slate-50",   text: "text-slate-300", border: "border-dashed border-slate-300" },
}

function resolveSlotDisplay(slot: RackSlot | undefined) {
  const discType = normalizeOpticalDiscType(slot?.discType)
  if (discType !== null) {
    return {
      discType,
      label: slot?.discTypeLabel ?? OPTICAL_DISC_TYPE_LABELS[discType],
      colors: OPTICAL_DISC_TYPE_COLORS[discType],
    }
  }
  const isError = slot?.status === "error"
  const isOccupied = slot?.occupied
  const legacy = isError ? "error" : isOccupied ? "used" : slot ? "free" : "empty"
  return {
    discType: null as OpticalDiscType | null,
    label: isError ? "坏盘" : isOccupied ? "已使用" : slot ? "无盘" : "空位",
    colors: slotStatusColor[legacy],
  }
}

/** 悬浮展示：把纯数字字节串格式化为可读容量 */
function formatSlotCapacityLabel(value: string | undefined): string {
  if (!value || value === "—") return "—"
  const trimmed = value.trim()
  if (/^\d+(\.\d+)?\s*[KMGTP]?B$/i.test(trimmed)) return trimmed
  const bytes = Number(trimmed)
  if (!Number.isFinite(bytes) || bytes < 0) return trimmed
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index++
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

// P1-1: logLevelColor 收敛到 lib/types/colors
const logLevelColor = LOG_LEVEL_COLORS

interface TreeNode {
  id: DeviceCategory
  label: string
  icon: typeof HardDrive
}

/** 短字段两列网格：上标签下值，减少单列右侧留白 */
function DetailField({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40",
        className
      )}
    >
      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 min-w-0 break-words">{value}</div>
    </div>
  )
}

/** 把 "203.6 TB" 拆成数字与单位，便于卡片两行展示时单位不加粗 */
function splitCapacityLabel(raw: string): { value: string; unit?: string } {
  const m = String(raw).trim().match(/^([\d.,]+)\s*(.*)$/)
  if (!m) return { value: raw }
  const unit = m[2]?.trim()
  return unit ? { value: m[1], unit } : { value: m[1] }
}

export default function Page() {
  const router = useRouter()
  const [rackList, setRackList] = useState<Rack[]>([])
  const [stats, setStats] = useState<RackStats & { online: number; offline: number; maintenance: number }>({
    total: 0, normal: 0, warning: 0, fault: 0, maintenance: 0,
    online: 0, offline: 0, totalCapacity: "0 TB", remainingCapacity: "0 TB",
    usedSlots: 0, totalSlotsAll: 0, avgUsage: 0,
  })
  const [selected, setSelected] = useState<Rack | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [slotGroups, setSlotGroups] = useState<RackSlotGroup[]>([])
  const [slotDetailStatus, setSlotDetailStatus] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle")
  const [racksDataSource, setRacksDataSource] = useState<ApiRacksDataSource>(
    isApiMode() ? "empty" : "empty"
  )
  const [category, setCategory] = useState<DeviceCategory>("all")
  const [keyword, setKeyword] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv")

  // Sprint 2F.4: 全局 siteCode
  const { siteCode, isAllSites, isReady: siteReady } = useSite()

  // R.91.1: URL view parameter for sub-views (inspection, volumes)
  const searchParams = useSearchParams()
  const view = searchParams?.get("view") ?? null

  // 弹窗状态
  const [showAddMedia, setShowAddMedia] = useState(false)
  const [addMediaSlot, setAddMediaSlot] = useState<number | null>(null)
  const [addMediaForm, setAddMediaForm] = useState<Partial<AddMediaInput>>({ mediaType: "hdd" })

  // 挂载网盘未接真控制：状态保留供下方 false && 弹窗源码编译，入口按钮已注释
  const [showMount, setShowMount] = useState(false)
  const [mountForm, setMountForm] = useState<Partial<MountInput>>({ protocol: "CIFS", encoding: "UTF-8", permission: "readonly" })

  const [showCreateTask, setShowCreateTask] = useState(false)
  const [createTaskType, setCreateTaskType] = useState<string>("device_scan")
  const [createTaskName, setCreateTaskName] = useState("")

  // ============================================================
  // 存储浏览 / 数据恢复状态
  // ============================================================
  const [storageTab, setStorageTab] = useState<"overview" | "browse" | "restore" | "cage-move">("overview")
  const [restoreMode, setRestoreMode] = useState<"server" | "local">("server")
  // 目录树状态
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["/backup", "/backup/hdd", "/backup/optical"]))
  const [currentVolumeId, setCurrentVolumeId] = useState<string>("v1")
  // 文件浏览
  const [browsedFiles, setBrowsedFiles] = useState<BackupFile[]>([])
  const [selectedPath, setSelectedPath] = useState<string>("")
  // 待恢复列表
  const [restoreList, setRestoreList] = useState<RestoreItem[]>([])
  const [targetPath, setTargetPath] = useState<string>("")
  // 恢复目标
  const [targetOptions, setTargetOptions] = useState<RestoreTarget[]>([])
  // 恢复提交中
  const [restoreSubmitting, setRestoreSubmitting] = useState(false)

  // R.15: mountForm.siteName 改用真实 /api/sites（弹窗暂隐藏，仍加载以便恢复）
  const [siteOptions, setSiteOptions] = useState<{ code: string; name: string }[]>([])

  const showApiWriteUnavailable = (action: string) => {
    toast({
      title: "操作未接入",
      description: `当前仅支持数据展示，暂不能${action}`,
    })
  }

  useEffect(() => {
    if (!isApiMode()) return
    let cancelled = false
    fetch("/api/sites", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (cancelled) return
        const rows = Array.isArray(json?.data) ? json.data : []
        setSiteOptions(rows.map((s: any) => ({ code: s.code ?? s.id, name: s.name ?? s.code ?? s.id })))
      })
      .catch(() => { /* ignore, 走 empty 兜底 */ })
    return () => { cancelled = true }
  }, [])

  // 初始化浏览文件
  useEffect(() => {
    if (storageTab !== "browse" && storageTab !== "restore") return
    let cancelled = false
    loadRacksBrowseMock(storageTab).then((res) => {
      if (cancelled) return
      if (res.source === "mock" && res.root) {
        setBrowsedFiles((res.root.children ?? []) as any)
      } else {
        setBrowsedFiles([])
      }
    })
    return () => { cancelled = true }
  }, [storageTab])

  // 切换恢复模式时更新目标选项
  useEffect(() => {
    let cancelled = false
    loadRacksRestoreTargetsMock(restoreMode).then((res) => {
      if (cancelled) return
      setTargetOptions(((res.targetOptions ?? []) as any).map((p: any) => ({ path: String(p) })))
    })
    setTargetPath("")
    return () => { cancelled = true }
  }, [restoreMode])

  // 获取当前卷的名称
  const getVolumeName = (volumeId: string): string => {
    const names: Record<string, string> = {
      v1: "硬盘卷", v2: "光盘卷", v3: "硬盘卷", v4: "光盘卷242",
      v5: "光盘卷242-iso", v6: "NAS-主存储",
    }
    return names[volumeId] ?? volumeId
  }

  // 切换目录展开/折叠
  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // 计算目录树中文件大小汇总
  const calcFolderSize = (files: BackupFile[]): string => {
    let total = 0
    const traverse = (items: BackupFile[]) => {
      items.forEach(f => {
        if (f.type === "file" && f.size) {
          const sizeStr = f.size.replace(/[^\d.]/g, "")
          total += parseFloat(sizeStr) || 0
        }
        if (f.children) traverse(f.children)
      })
    }
    traverse(files)
    if (total >= 1000) return `${(total / 1000).toFixed(1)} TB`
    return `${total.toFixed(1)} GB`
  }

  // 将文件/文件夹添加到待恢复列表
  const addToRestoreList = (file: BackupFile) => {
    const item: RestoreItem = {
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      sourcePath: file.path,
      volumeId: currentVolumeId,
      volumeName: getVolumeName(currentVolumeId),
    }
    setRestoreList(prev => {
      if (prev.some(i => i.id === file.id)) return prev
      return [...prev, item]
    })
  }

  // 从待恢复列表移除
  const removeFromRestoreList = (id: string) => {
    setRestoreList(prev => prev.filter(i => i.id !== id))
  }

  // 计算已选数据总大小
  const calcTotalSize = (items: RestoreItem[]): { display: string; bytes: number } => {
    let totalBytes = 0
    items.forEach(item => {
      if (item.size) {
        const sizeStr = item.size.replace(/[^\d.]/g, "")
        const num = parseFloat(sizeStr) || 0
        if (item.size.includes("TB")) totalBytes += num * 1024 * 1024 * 1024 * 1024
        else if (item.size.includes("GB")) totalBytes += num * 1024 * 1024 * 1024
        else if (item.size.includes("MB")) totalBytes += num * 1024 * 1024
        else totalBytes += num * 1024
      }
    })
    const gb = totalBytes / (1024 * 1024 * 1024)
    if (gb >= 1024) return { display: `${(gb / 1024).toFixed(2)} TB`, bytes: totalBytes }
    return { display: `${gb.toFixed(2)} GB`, bytes: totalBytes }
  }

  // 获取目标剩余容量
  const getTargetRemaining = (): string => {
    if (!targetPath) return "—"
    const target = targetOptions.find(t => t.path === targetPath)
    return target?.remainingCapacity ?? "—"
  }

  // 检查是否容量不足
  const isCapacityInsufficient = (): boolean => {
    if (!targetPath) return false
    const target = targetOptions.find(t => t.path === targetPath)
    if (!target || target.remainingBytes < 0) return false
    const { bytes: needed } = calcTotalSize(restoreList)
    return needed > target.remainingBytes
  }

  // 提交恢复任务
  const handleRestoreSubmit = async () => {
    if (isApiMode()) {
      showApiWriteUnavailable("创建恢复任务")
      return
    }
    if (!targetPath || restoreList.length === 0) {
      toast({ title: "请选择目标和文件", variant: "destructive" })
      return
    }
    if (isCapacityInsufficient()) {
      toast({ title: "目标容量不足", description: "请选择其他目标路径或减少恢复文件", variant: "destructive" })
      return
    }
    setRestoreSubmitting(true)
    try {
      const { display: totalSize, bytes: totalSizeBytes } = calcTotalSize(restoreList)
      const target = targetOptions.find(t => t.path === targetPath)
      const input: CreateTaskInput = {
        name: `数据恢复-${new Date().toISOString().slice(0, 10)}`,
        type: "restore",
        archiveName: "数据恢复",
        dataClassification: "数据恢复",
        siteCode: "数据恢复",
        sourcePath: restoreList.map(i => i.sourcePath).join(";"),
        packagePath: targetPath,
        priority: "normal",
        operator: "当前用户",
        restoreMode,
        sourceVolumeId: currentVolumeId,
        sourceVolumeName: getVolumeName(currentVolumeId),
        selectedFiles: restoreList,
        sourcePaths: restoreList.map(i => i.sourcePath),
        targetPath,
      }
      await taskProvider.createTask(input)
      toast({ title: "恢复任务已创建", description: `已将 ${restoreList.length} 个文件/文件夹加入恢复队列` })
      setRestoreList([])
      setStorageTab("overview")
    } catch {
      toast({ title: "创建失败", variant: "destructive" })
    } finally {
      setRestoreSubmitting(false)
    }
  }

  // 渲染目录树项
  const renderTreeItem = (file: BackupFile, depth: number = 0) => {
    const isFolder = file.type === "folder"
    const isExpanded = expandedPaths.has(file.path)
    const isSelected = selectedPath === file.path
    const isInRestoreList = restoreList.some(i => i.id === file.id)

    return (
      <div key={file.id}>
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm transition-colors",
            isSelected ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "hover:bg-slate-50 dark:hover:bg-slate-800",
            isInRestoreList && "opacity-60",
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (isFolder) {
              togglePath(file.path)
              setSelectedPath(file.path)
            } else {
              setSelectedPath(file.path)
            }
          }}
        >
          {isFolder ? (
            isExpanded ? <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" /> : <ChevronRightIcon className="h-3 w-3 text-slate-400 shrink-0" />
          ) : (
            <FileText className="h-3 w-3 text-slate-400 shrink-0 ml-4" />
          )}
          {isFolder ? (
            <FolderOpen className={cn("h-4 w-4 shrink-0", isSelected ? "text-blue-600" : "text-amber-500")} />
          ) : (
            <FileText className={cn("h-4 w-4 shrink-0", isSelected ? "text-blue-600" : "text-slate-400")} />
          )}
          <span className="flex-1 truncate">{file.name}</span>
          {file.size && !isFolder && <span className="text-xs text-slate-400 shrink-0">{file.size}</span>}
          {!isFolder && (
            <button
              className={cn(
                "h-5 px-1.5 rounded text-[10px] shrink-0",
                isInRestoreList ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300" : "bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-800/50"
              )}
              onClick={(e) => {
                e.stopPropagation()
                if (isInRestoreList) removeFromRestoreList(file.id)
                else addToRestoreList(file)
              }}
            >
              {isInRestoreList ? "移除" : "添加"}
            </button>
          )}
        </div>
        {isFolder && isExpanded && file.children && (
          <div>
            {file.children.map(child => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // 加载数据
  const loadRacks = useCallback(async () => {
    try {
      const [racksData, statsData] = await Promise.all([
        rackProvider.getAll(isAllSites ? undefined : siteCode ?? undefined),
        rackProvider.getStats(isAllSites ? undefined : siteCode ?? undefined)
      ])
      setRackList(racksData)
      setStats(statsData as any)
      setSelected(current =>
        racksData.find(rack => rack.id === current?.id) ?? racksData[0] ?? null
      )
      // 数据源追踪 (R.92: mock 模式已移除, API 模式恒为 source of truth)
      if (isApiMode()) {
        setRacksDataSource(getRacksDataSource())
      } else {
        setRacksDataSource("empty")
      }
    } catch {
      setRackList([])
      setSelected(null)
      setRacksDataSource(isApiMode() ? "error" : "empty")
    }
  }, [isAllSites, siteCode])

  useEffect(() => { if (siteReady) loadRacks() }, [loadRacks, siteReady])

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ key: string }>
      if (ce.detail?.key === getStorageKey("racks")) loadRacks()
    }
    window.addEventListener(MOCK_STORE_EVENT, handler)
    return () => window.removeEventListener(MOCK_STORE_EVENT, handler)
  }, [loadRacks])

  // 设备分类树
  const treeNodes: TreeNode[] = [
    { id: "all", label: "全部设备", icon: Server },
    { id: "hdd", label: "硬盘库", icon: HardDrive },
    { id: "optical", label: "光盘库", icon: Database },
    { id: "offline", label: "离线库", icon: WifiOff },
    { id: "nas", label: "网盘/网络存储", icon: Layers },
    { id: "abnormal", label: "异常设备", icon: AlertTriangle },
  ]

  // 筛选
  const filtered = useMemo(() => {
    return rackList.filter(r => {
      const matchCat = category === "all" ? true :
        category === "hdd" ? isHddDeviceTypeLabel(r.deviceType) :
        category === "optical" ? isOpticalDeviceTypeLabel(r.deviceType) :
        category === "offline" ? (r.deviceType?.includes("离线库") || r.deviceStatus === "offline") :
        category === "nas" ? isNasDeviceTypeLabel(r.deviceType) :
        category === "abnormal" ? (r.deviceStatus === "error" || r.deviceStatus === "warning" || r.status === "warning" || r.status === "fault" || r.status === "maintenance") : true
      const matchKw = !keyword
        || r.rackId.includes(keyword)
        || (r.rackName ?? "").includes(keyword)
        || r.siteName.includes(keyword)
        || (r.ip ?? "").includes(keyword)
        || (r.deviceType ?? "").includes(keyword)
      return matchCat && matchKw
    })
  }, [rackList, category, keyword])

  // 树节点计数
  const treeCounts = useMemo(() => {
    const map: Record<string, number> = {}
    treeNodes.forEach(n => {
      map[n.id] = rackList.filter(r => {
        if (n.id === "all") return true
        if (n.id === "hdd") return isHddDeviceTypeLabel(r.deviceType)
        if (n.id === "optical") return isOpticalDeviceTypeLabel(r.deviceType)
        if (n.id === "offline") return r.deviceType?.includes("离线库") || r.deviceStatus === "offline"
        if (n.id === "nas") return isNasDeviceTypeLabel(r.deviceType)
        if (n.id === "abnormal") return r.deviceStatus === "error" || r.deviceStatus === "warning" || r.status === "warning" || r.status === "fault" || r.status === "maintenance"
        return false
      }).length
    })
    return map
  }, [rackList])

  const loadSlotDetails = async (rack: Rack) => {
    if (isNasDeviceTypeLabel(rack.deviceType)) {
      setSlotGroups([])
      setSlotDetailStatus("idle")
      return
    }
    if (!isApiMode()) {
      setSlotGroups([])
      setSlotDetailStatus(rack.slots?.length > 0 ? "ready" : "empty")
      return
    }

    setSlotGroups([])
    setSlotDetailStatus("loading")
    setSelected(current => current?.siteCode === rack.siteCode && current?.rackId === rack.rackId
      ? { ...current, slots: [] }
      : current)

    try {
      const detail = await fetchRackSlots(rack.rackId, rack.siteCode)
      setSlotGroups(detail.cages as RackSlotGroup[])
      setSelected(current => current?.siteCode === rack.siteCode && current?.rackId === rack.rackId
        ? { ...current, slots: detail.slots as RackSlot[], cages: detail.cages.map(cage => cage.cageName) }
        : current)
      setSlotDetailStatus(detail.slots.length > 0 ? "ready" : "empty")
    } catch {
      setSlotDetailStatus("error")
    }
  }

  const loadNasMountDetail = async (rack: Rack) => {
    if (!isApiMode() || !isNasDeviceTypeLabel(rack.deviceType)) return
    try {
      const detail = await rackProvider.getById(rack.rackId, rack.siteCode)
      if (!detail) return
      setSelected(current => current?.siteCode === rack.siteCode && current?.rackId === rack.rackId
        ? {
            ...current,
            ...detail,
            // 列表侧已有站点名时优先保留
            siteName: current.siteName || detail.siteName,
            mountInfo: detail.mountInfo,
            totalCapacity: undefined,
            remainingCapacity: undefined,
            usagePercent: undefined,
            totalSlots: 0,
            usedSlots: 0,
            slots: [],
          }
        : current)
    } catch {
      // 挂载信息缺失时仍展示基础字段
    }
  }

  const openDetail = (rack: Rack) => {
    setSelected(rack)
    setDrawerOpen(true)
    if (isNasDeviceTypeLabel(rack.deviceType)) {
      setSlotGroups([])
      setSlotDetailStatus("idle")
      void loadNasMountDetail(rack)
      return
    }
    void loadSlotDetails(rack)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      if (isApiMode()) {
        await loadRacks()
        toast({ title: "数据已刷新", description: "已重新读取中心库设备数据" })
        return
      }
      await rackProvider.syncRacks()
      await loadRacks()
      toast({ title: "设备列表已刷新", description: "所有设备同步时间已更新" })
    } catch { toast({ title: "同步失败", variant: "destructive" }) }
    finally { setSyncing(false) }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ format: exportFormat })
      if (!isAllSites && siteCode) params.set("siteCode", siteCode)
      const response = await fetch(`/api/racks/export?${params.toString()}`)
      if (response.status === 501) {
        const body = await response.json().catch(() => null)
        const msg = body?.message ?? "Excel 暂未接入, 请选择 CSV 或 JSON"
        toast({ title: "导出格式暂未接入", description: msg, variant: "destructive" })
        return
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const sha256 = response.headers.get("x-sha256") ?? ""
      const recordCount = response.headers.get("x-record-count") ?? "0"
      const blob = await response.blob()
      const disposition = response.headers.get("content-disposition") ?? ""
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `devices.${exportFormat}`
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      toast({
        title: "导出请求已提交",
        description: `${recordCount} 条真实设备记录, SHA-256 摘要已生成 (${sha256.slice(0, 12)}…)`,
      })
    } catch {
      toast({
        title: "设备导出失败",
        description: "未生成本地替代数据，请检查中心库连接后重试。",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const handleViewTasks = (rack: Rack) => {
    router.push(`/tasks?device=${rack.rackId}`)
  }

  const handleScan = async (rack: Rack, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (isApiMode()) {
      showApiWriteUnavailable("创建设备扫描任务")
      return
    }
    try {
      await taskProvider.createTaskFromDevice(rack.id, "device_scan", { name: `${rack.rackId}-设备扫描` })
      await loadRacks() // 刷新设备列表，更新关联任务
      toast({ title: "设备扫描任务已生成", description: `「${rack.rackId}-设备扫描」已创建，可在任务管理页查看` })
    } catch { toast({ title: "操作失败", variant: "destructive" }) }
  }

  const handleRaidCheck = async (rack: Rack, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (isApiMode()) {
      showApiWriteUnavailable("创建 RAID 校验任务")
      return
    }
    try {
      await taskProvider.createTaskFromDevice(rack.id, "raid_check", { name: `${rack.rackId}-RAID校验` })
      await loadRacks() // 刷新设备列表，更新关联任务
      toast({ title: "RAID 校验任务已生成", description: `「${rack.rackId}-RAID校验」已创建，可在任务管理页查看` })
    } catch { toast({ title: "操作失败", variant: "destructive" }) }
  }

  const handleCreateTaskFromDevice = async () => {
    if (!selected) return
    if (isApiMode()) {
      showApiWriteUnavailable("生成设备任务")
      return
    }
    try {
      await taskProvider.createTaskFromDevice(selected.id, createTaskType as any, { name: createTaskName ?? '' })
      await loadRacks() // 刷新设备列表
      toast({ title: "任务已生成", description: `「${createTaskName || "设备任务"}」已创建，可在任务管理页查看` })
      setShowCreateTask(false); setCreateTaskName("")
    } catch { toast({ title: "生成失败", variant: "destructive" }) }
  }

  // 挂载网盘未接真控制，暂隐藏（入口按钮已注释）
  const handleMount = async () => {
    if (isApiMode()) {
      showApiWriteUnavailable("挂载网络存储")
      return
    }
    if (!mountForm.deviceName || !mountForm.deviceGroup || !mountForm.mountPath || !mountForm.managePath || !mountForm.dataSource) {
      toast({ title: "请填写必填项", description: "设备名称、设备组、挂载目录、管理目录、数据源为必填项", variant: "destructive" })
      return
    }
    try {
      const newRack = await rackProvider.mountNetworkDrive(mountForm as MountInput)
      await loadRacks()
      setSelected(newRack)
      setShowMount(false)
      setMountForm({ protocol: "CIFS", encoding: "UTF-8", permission: "readonly" })
      toast({ title: "挂载成功", description: `网盘 ${mountForm.deviceName} 已挂载并添加到设备列表` })
    } catch { toast({ title: "挂载失败", variant: "destructive" }) }
  }

  const openAddMedia = (slotIndex: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setAddMediaSlot(slotIndex)
    setAddMediaForm({ mediaType: "hdd" })
    setShowAddMedia(true)
  }

  const handleAddMedia = async () => {
    if (!selected || addMediaSlot === null) return
    if (isApiMode()) {
      showApiWriteUnavailable("添加介质")
      return
    }
    if (!addMediaForm.discNo) {
      toast({ title: "请填写介质编号", variant: "destructive" })
      return
    }
    try {
      await rackProvider.addMedia(selected.id, addMediaSlot, addMediaForm as AddMediaInput)
      await loadRacks()
      const updated = rackList.find(r => r.id === selected.id)
      if (updated) setSelected(updated)
      setShowAddMedia(false)
      toast({ title: "介质添加成功", description: `介质 ${addMediaForm.discNo} 已添加到槽位 ${addMediaSlot}` })
    } catch { toast({ title: "添加失败", variant: "destructive" }) }
  }

  // 模式控制未接真控制，UI 已隐藏；保留 handler 便于恢复
  // const handleModeChange = async (rack: Rack, mode: string) => {
  //   if (isApiMode()) {
  //     showApiWriteUnavailable("切换设备模式")
  //     return
  //   }
  //   setRackList(prev => prev.map(r => r.id === rack.id ? { ...r, mode: mode as DeviceMode } : r))
  //   setSelected(prev => prev ? { ...prev, mode: mode as DeviceMode } : prev)
  //   try {
  //     await rackProvider.updateDeviceMode(rack.id, mode)
  //     toast({ title: "模式切换成功", description: `设备已切换为 ${DEVICE_MODE_LABELS[mode as DeviceMode] ?? mode}` })
  //   } catch {
  //     setRackList(prev => prev.map(r => r.id === rack.id ? { ...r, mode: rack.mode as DeviceMode } : r))
  //     setSelected(prev => prev ? { ...prev, mode: rack.mode as DeviceMode } : prev)
  //     toast({ title: "切换失败", variant: "destructive" })
  //   }
  // }

  const openDrawerDetail = openDetail

  const renderSlotCell = (slot: RackSlot | undefined, index: number, key: string) => {
    const displayIndex = slot?.index && slot.index > 0 ? slot.index : index
    const { discType, label, colors: sc } = resolveSlotDisplay(slot)
    const isEmptyOptical = discType === 0 || (!slot?.occupied && discType === null && slot?.status !== "error")
    const showPlus = !slot || (isEmptyOptical && !isApiMode())

    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 w-full rounded text-[11px] font-medium flex items-center justify-center cursor-pointer transition-colors tabular-nums leading-none",
              sc.bg,
              sc.text,
              discType === null && showPlus && sc.border && `border ${sc.border}`,
              discType === 4 && "ring-1 ring-red-400"
            )}
            onClick={() => {
              if (showPlus && !isApiMode()) {
                openAddMedia(displayIndex)
                return
              }
              toast({
                title: `盘位 ${displayIndex}`,
                description: `状态: ${label} | 总容量: ${formatSlotCapacityLabel(slot?.capacity)} | 已使用: ${formatSlotCapacityLabel(slot?.usedCapacity)}`,
              })
            }}
          >
            <span>{displayIndex}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-0.5 text-xs">
            <p>盘位 {displayIndex}{label ? ` · ${label}` : ""}</p>
            <p>总容量：{formatSlotCapacityLabel(slot?.capacity)}</p>
            <p>已使用：{formatSlotCapacityLabel(slot?.usedCapacity)}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }

  // R.91.1: Conditional rendering for sub-views (inspection, volumes)
  if (view === "inspection") {
    return (
      <AppShell>
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" className="h-8 text-slate-500 hover:text-slate-700" onClick={() => router.push("/racks")}>
              <span className="mr-1">&larr;</span> 返回设备管理
            </Button>
          </div>
          <InspectionView />
        </div>
      </AppShell>
    )
  }

  if (view === "volumes") {
    return (
      <AppShell>
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" className="h-8 text-slate-500 hover:text-slate-700" onClick={() => router.push("/racks")}>
              <span className="mr-1">&larr;</span> 返回设备管理
            </Button>
          </div>
          <VolumesView />
        </div>
      </AppShell>
    )
  }

  const totalCapacityParts = splitCapacityLabel(stats.totalCapacity)
  const remainingCapacityParts = splitCapacityLabel(stats.remainingCapacity)

  return (
    <AppShell>
      <PageHeader
        title="设备管理"
        description="存储设备总览、盘位监控与任务关联"
        badge="DEVICE MGMT"
        actions={
          <div className="flex items-center gap-2">
            {/* 挂载网盘未接真控制，暂隐藏
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowMount(true)}>
              <Plug className="h-4 w-4 mr-1" />挂载网盘
            </Button>
            */}
            <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as typeof exportFormat)}>
              <SelectTrigger className="h-8 w-[100px]" data-testid="racks-export-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                {/* XLSX 导出未接入，暂隐藏
                <SelectItem value="xlsx">XLSX</SelectItem>
                */}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => void handleExport()}
              disabled={exporting || racksDataSource === "error"}
              data-testid="racks-export"
            >
              <Download className="h-4 w-4 mr-1" />{exporting ? "导出中" : `导出 ${exportFormat.toUpperCase()}`}
            </Button>
            <Button size="sm" className="h-8" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={cn("h-4 w-4 mr-1", syncing && "animate-spin")} />同步
            </Button>
          </div>
        }
      />

      {isApiMode() && racksDataSource === "error" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>中心库设备数据读取失败，请检查数据库连接与同步状态。</span>
        </div>
      )}
      {isApiMode() && racksDataSource === "empty" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300">
          <Info className="h-4 w-4 shrink-0" />
          <span>暂无中心库设备记录，请先完成站点同步。</span>
        </div>
      )}

      {/* ── 统计卡片 ─────────────────────────────────────────── */}
      <GlassPanel
        testId="racks-hero-glass-panel"
        title="设备总览"
        description="存储设备数量、容量、盘位使用率及健康状态实时汇总"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <StatCard horizontal horizontalText="stack" title="设备总数" value={stats.total} unit="台" icon={Server} />
          <StatCard horizontal horizontalText="stack" title="在线" value={stats.online} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard horizontal horizontalText="stack" title="离线" value={stats.offline} icon={WifiOff} iconBg="bg-slate-50" iconColor="text-slate-600" />
          <StatCard horizontal horizontalText="stack" title="异常" value={stats.fault + stats.warning + stats.maintenance} icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-600" />
          <StatCard horizontal horizontalText="stack" title="总容量" value={totalCapacityParts.value} unit={totalCapacityParts.unit} icon={Database} iconBg="bg-blue-50" iconColor="text-blue-600" />
          <StatCard horizontal horizontalText="stack" title="剩余容量" value={remainingCapacityParts.value} unit={remainingCapacityParts.unit} icon={Activity} iconBg="bg-cyan-50" iconColor="text-cyan-600" />
          <StatCard horizontal horizontalText="stack" title="已用盘位" value={stats.usedSlots} unit="个" icon={Grid3X3} iconBg="bg-violet-50" iconColor="text-violet-600" />
          <StatCard horizontal horizontalText="stack" title="平均使用率" value={stats.avgUsage} unit="%" icon={Box} iconBg="bg-amber-50" iconColor="text-amber-600" />
        </div>
      </GlassPanel>

      {/* ── 主体：左侧树 + 右侧表格 ─────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr] gap-4 lg:gap-6">
        {/* 左侧设备分类树 */}
        <Card className="gap-0 h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">设备分类</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-0.5">
              {treeNodes.map(node => {
                const Icon = node.icon
                const isActive = category === node.id
                const count = treeCounts[node.id] ?? 0
                return (
                  <button
                    key={node.id}
                    onClick={() => setCategory(node.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                      isActive ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-blue-600" : "text-slate-400")} />
                    <span className="flex-1">{node.label}</span>
                    <span className={cn("text-xs tabular-nums", isActive ? "text-blue-600" : "text-slate-400")}>{count}</span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* 右侧设备表格 */}
        <div className="space-y-4">
          {/* 搜索 */}
          <Card className="gap-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder="搜索设备名称 / IP / 类型..." className="pl-9 h-9" value={keyword} onChange={e => setKeyword(e.target.value)} aria-label="搜索设备" />
                </div>
                <span className="text-xs text-slate-400 shrink-0">{filtered.length} 台设备</span>
              </div>
            </CardContent>
          </Card>

          {/* 设备表格 */}
          <Card className="gap-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">设备列表</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs text-slate-500 whitespace-nowrap">设备名称</TableHead>
                    <TableHead className="text-xs text-slate-500 whitespace-nowrap">IP 地址</TableHead>
                    <TableHead className="text-xs text-slate-500 whitespace-nowrap">设备类型</TableHead>
                    <TableHead className="text-xs text-slate-500 whitespace-nowrap">所属站点</TableHead>
                    <TableHead className="text-xs text-slate-500 whitespace-nowrap">总容量</TableHead>
                    <TableHead className="text-xs text-slate-500 whitespace-nowrap">剩余容量</TableHead>
                    <TableHead className="text-xs text-slate-500 whitespace-nowrap min-w-[100px]">使用率</TableHead>
                    <TableHead className="text-xs text-slate-500 whitespace-nowrap">盘位</TableHead>
                    <TableHead className="text-xs text-slate-500 whitespace-nowrap">任务数</TableHead>
                    <TableHead className="text-xs text-slate-500 whitespace-nowrap">最近同步</TableHead>
                    <TableHead className="text-xs text-slate-500 whitespace-nowrap">状态</TableHead>
                    <TableHead className="text-xs text-slate-500 whitespace-nowrap text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-10 text-slate-400">
                        {racksDataSource === "error"
                          ? "中心库设备数据读取失败"
                          : racksDataSource === "empty"
                            ? "中心库暂无设备数据"
                            : "未找到匹配设备"}
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(r => {
                    const ds = deviceStatusMap[r.deviceStatus ?? "online"] ?? deviceStatusMap.online
                    const DsIcon = ds.icon
                    return (
                      <TableRow key={`${r.siteCode}-${r.rackId}-${r.id}`} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => openDrawerDetail(r)}>
                        <TableCell>
                          <p className="font-medium text-sm">{r.rackName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">ID {r.rackId}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.ip ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.deviceType ?? "—"}</TableCell>
                        <TableCell><p className="text-sm">{r.siteName}</p></TableCell>
                        <TableCell className="text-xs">{r.totalCapacity ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.remainingCapacity ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {r.usagePercent != null ? (
                              <>
                                <Progress value={r.usagePercent} className="h-1.5 flex-1" />
                                <span className="text-xs tabular-nums min-w-[32px] text-right">{r.usagePercent}%</span>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{r.totalSlots > 0 ? `${r.usedSlots ?? "—"}/${r.totalSlots}` : "—"}</TableCell>
                        <TableCell className="text-xs tabular-nums">{r.currentTaskCount ?? 0}</TableCell>
                        <TableCell className="text-[10px] text-slate-400 whitespace-nowrap">{formatBeijingTime(r.lastSyncAt) || "—"}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-[10px]", ds.color)}>
                            <DsIcon className="h-3 w-3 mr-1" />{ds.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-0.5 justify-end" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="查看任务" aria-label="查看机架相关任务" onClick={() => handleViewTasks(r)}><ListChecks className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="扫描" aria-label="扫描机架" onClick={e => handleScan(r, e)}><ScanIcon className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── 设备详情抽屉 ─────────────────────────────────────── */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className="!w-[720px] !max-w-[90vw]">
          <DrawerHeader className="border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-start justify-between">
              <DrawerTitle className="text-base">{selected?.rackName}</DrawerTitle>
              {selected && (() => {
                const ds = deviceStatusMap[selected.deviceStatus ?? "online"]
                return <Badge className={cn("text-xs", ds.color)}>{ds.label}</Badge>
              })()}
            </div>
          </DrawerHeader>
          <ScrollArea className="flex-1 min-h-0">
            {selected && (() => {
              const isNasSelected = isNasDeviceTypeLabel(selected.deviceType)
              const mount = selected.mountInfo
              const isS3 = mount?.protocol === 5
              return (
              <div className="pt-[13px] px-5 pb-5">
                {/* 1. NAS：挂载信息优先 */}
                {isNasSelected && (
                  <section>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <Plug className="h-4 w-4 text-slate-400" />挂载信息
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      <DetailField label="协议类型" value={mount?.protocolLabel ?? "—"} />
                      {isS3 ? (
                        <>
                          <DetailField label="传输协议" value={mount?.transportProtocol ?? "—"} />
                          <DetailField label="S3服务" value={mount?.srcPath ?? "—"} className="col-span-2" />
                          <DetailField label="密钥ID" value={mount?.userName ?? "—"} />
                          <DetailField label="密钥" value={mount?.passwordMasked ?? (mount?.hasPassword ? "****" : "—")} />
                          <DetailField label="挂载目录" value={mount?.mountPoint ?? "—"} className="col-span-2" />
                          <DetailField label="管理端目录" value={mount?.managerPath ?? "—"} className="col-span-2" />
                          <DetailField label="权限" value={mount?.permissionLabel ?? "—"} />
                          <DetailField label="限速" value={mount?.maxSpeedLabel ?? "—"} />
                          <DetailField label="附加参数" value={mount?.extraParam ?? "—"} className="col-span-2" />
                        </>
                      ) : (
                        <>
                          <DetailField label="挂载目录" value={mount?.mountPoint ?? "—"} className="col-span-2" />
                          <DetailField label="管理端目录" value={mount?.managerPath ?? "—"} className="col-span-2" />
                          <DetailField label="编码类型" value={mount?.encodingLabel ?? "—"} />
                          <DetailField label="用户" value={mount?.userName ?? "—"} />
                          <DetailField label="数据源" value={mount?.srcPath ?? "—"} className="col-span-2" />
                          <DetailField label="密码" value={mount?.passwordMasked ?? (mount?.hasPassword ? "****" : "—")} />
                          <DetailField label="配额" value={mount?.quotaLabel ?? "—"} />
                          <DetailField label="权限" value={mount?.permissionLabel ?? "—"} />
                          <DetailField label="限速" value={mount?.maxSpeedLabel ?? "—"} />
                          <DetailField label="附加参数" value={mount?.extraParam ?? "—"} className="col-span-2" />
                        </>
                      )}
                    </div>
                    {!mount && (
                      <p className="mt-2 text-xs text-slate-400">挂载明细未同步或未能按序列号关联到 tbl_mount_dir</p>
                    )}
                  </section>
                )}

                {/* 1. 非 NAS：托盘摘要（有则紧挨盘位前） */}
                {!isNasSelected && selected.trays && selected.trays.length > 0 && (
                  <section>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Layers className="h-4 w-4 text-slate-400" />托盘信息</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {selected.trays.map(tray => (
                        <div key={tray.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-center">
                          <p className="text-xs text-slate-400">{tray.label}</p>
                          <p className="text-lg font-bold text-slate-900 mt-1">{tray.usedCount}/{tray.slotCount}</p>
                          <p className="text-[10px] text-slate-400">块/位</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 盘位信息：网盘不展示 */}
                {!isNasSelected && (selected.totalSlots > 0 || slotDetailStatus !== "idle") && (
                  <>
                    {selected.trays && selected.trays.length > 0 ? <Separator className="mt-2 mb-[15px]" /> : null}
                    <section>
                      {/* 标题 + 图例置顶 sticky，滚动盘位时仍可见 */}
                      <div className="sticky top-0 z-10 -mx-1 mb-3 flex items-center justify-between gap-3 bg-background/95 px-1 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2 shrink-0 min-w-0">
                          <Grid3X3 className="h-4 w-4 text-slate-400" />盘位信息
                          <span className="text-xs font-normal text-slate-400">（{selected.usedSlots}/{selected.totalSlots} 已占用）</span>
                        </h4>
                        {(!isApiMode() || slotDetailStatus === "ready") && (
                          <div className="flex flex-wrap justify-end gap-3 text-xs text-slate-500">
                            {([0, 1, 2, 3, 4] as OpticalDiscType[]).map((key) => (
                              <span key={key} className="flex items-center gap-1">
                                <span className={cn("h-2.5 w-2.5 rounded", OPTICAL_DISC_TYPE_COLORS[key].swatch)} />
                                {OPTICAL_DISC_TYPE_LABELS[key]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {isApiMode() && slotDetailStatus === "loading" && (
                        <div className="py-6 text-center text-xs text-slate-400">正在加载盘位明细...</div>
                      )}
                      {isApiMode() && slotDetailStatus === "empty" && (
                        <div className="py-6 text-center text-xs text-slate-400">
                          盘位明细未同步，当前仅展示汇总
                        </div>
                      )}
                      {isApiMode() && slotDetailStatus === "error" && (
                        <div className="py-6 text-center text-xs text-red-500">
                          盘位明细加载失败，当前仅展示汇总
                        </div>
                      )}
                      <TooltipProvider>
                        {isApiMode() && slotDetailStatus === "ready" && (
                          <div className="space-y-3">
                            {slotGroups.map(group => (
                              <div key={`${selected.siteCode}-${selected.rackId}-${group.cageId}`}>
                                {group.cageName ? (
                                  <p className="mb-1.5 text-xs font-medium text-slate-600">{group.cageName}</p>
                                ) : null}
                                <div
                                  className="grid gap-1"
                                  style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}
                                >
                                  {group.slots.map(slot => renderSlotCell(
                                    slot,
                                    slot.index,
                                    `${slot.sourceSiteId}-${slot.sourceTable}-${slot.sourceId}-${slot.id}`
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {!isApiMode() && (
                          <div
                            className="grid gap-1"
                            style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}
                          >
                            {Array.from({ length: selected.totalSlots }, (_, i) => {
                              const slot = selected.slots?.find(s => s.index === i + 1)
                              return renderSlotCell(slot, i + 1, `${selected.siteCode}-${selected.rackId}-${i + 1}`)
                            })}
                          </div>
                        )}
                      </TooltipProvider>
                    </section>
                  </>
                )}

                {/* 模式控制 + 设备操作：未接真控制，UI 已移除（查看任务用列表入口）。恢复时从 git 历史取回该区块。 */}

                <Separator className="mt-2 mb-[15px]" />

                {/* 2. 基础信息：三列网格（与任务详情基本信息一致） */}
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Info className="h-4 w-4 text-slate-400" />基础信息</h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    <DetailField label="设备名称" value={selected.rackName} />
                    <DetailField label="设备类型" value={selected.deviceType ?? "—"} />
                    <DetailField label="序列号" value={<span className="font-mono text-xs">{selected.serialNo ?? "—"}</span>} />
                    {/* <DetailField label="设备 ID" value={<span className="font-mono">{selected.rackId}</span>} /> */}
                    {!isNasSelected && (
                      <>
                        <DetailField label="总容量" value={selected.totalCapacity ?? "—"} />
                        <DetailField label="剩余容量" value={selected.remainingCapacity ?? "—"} />
                        <DetailField label="使用率" value={
                          selected.usagePercent != null
                            ? <div className="flex items-center gap-2"><Progress value={selected.usagePercent} className="h-1.5 w-20" /><span>{selected.usagePercent}%</span></div>
                            : "—"
                        } />
                      </>
                    )}
                    <DetailField label="所属站点" value={selected.siteName} />
                    <DetailField label="IP 地址" value={<span className="font-mono">{selected.ip ?? "—"}</span>} />
                    <DetailField label="最近同步" value={formatBeijingTime(selected.lastSyncAt) || "—"} />
                    {/* <DetailField label="当前任务数" value={(selected.currentTaskCount ?? 0).toString()} /> */}
                  </div>
                </section>

                {/* 关联任务 */}
                {selected.recentTasks && selected.recentTasks.length > 0 && (
                  <>
                    <Separator className="mt-2 mb-[15px]" />
                    <section>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-slate-400" />关联任务
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs ml-auto" onClick={() => handleViewTasks(selected)}>
                          查看全部 <ChevronRight className="h-3 w-3" />
                        </Button>
                      </h4>
                      <div className="space-y-2">
                        {selected.recentTasks.map(task => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                            onClick={() => { setDrawerOpen(false); router.push(`/tasks?device=${selected.rackId}`) }}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{task.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">{task.type}</Badge>
                                <span className="text-[10px] text-slate-400">{formatBeijingTime(task.startedAt) || "—"}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 ml-3 shrink-0">
                              <div className="text-right">
                                <Progress value={task.progress} className="h-1.5 w-16 mb-0.5" />
                                <span className="text-[10px] text-slate-400">{task.progress}%</span>
                              </div>
                              <Badge className={cn("text-[10px]",
                                task.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                                task.status === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                task.status === "running" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              )}>
                                {task.status === "completed" ? "已完成" : task.status === "failed" ? "已失败" : task.status === "running" ? "运行中" : task.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                {/* 设备日志 */}
                {selected.deviceLogs && selected.deviceLogs.length > 0 && (
                  <>
                    <Separator className="mt-2 mb-[15px]" />
                    <section>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Timer className="h-4 w-4 text-slate-400" />设备日志</h4>
                      <div className="space-y-1.5">
                        {selected.deviceLogs.slice(0, 6).map(log => (
                          <div key={log.id} className={cn("p-2 rounded text-xs font-mono", logLevelColor[log.level])}>
                            <span className="text-slate-400">[{log.timestamp}]</span> {log.message}
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </div>
              )
            })()}
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* ── 添加介质弹窗 ─────────────────────────────────────── */}
      <Dialog open={showAddMedia} onOpenChange={setShowAddMedia}>
        <DialogContent className="!max-w-md">
          <DialogHeader><DialogTitle>添加介质</DialogTitle><DialogDescription>为盘位 {addMediaSlot} 添加新介质</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>介质编号 *</Label>
              <Input value={addMediaForm.discNo ?? ""} onChange={e => setAddMediaForm(f => ({ ...f, discNo: e.target.value }))} placeholder="如：DISC-2026-0801" />
            </div>
            <div className="space-y-2">
              <Label>介质类型</Label>
              <Select value={addMediaForm.mediaType ?? "hdd"} onValueChange={v => setAddMediaForm(f => ({ ...f, mediaType: v as AddMediaInput["mediaType"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hdd">硬盘</SelectItem>
                  <SelectItem value="bd">蓝光光盘</SelectItem>
                  <SelectItem value="offline">离线盘</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>容量</Label>
              <Input value={addMediaForm.capacity ?? ""} onChange={e => setAddMediaForm(f => ({ ...f, capacity: e.target.value }))} placeholder="如：4 TB" />
            </div>
            <div className="space-y-2">
              <Label>所属卷</Label>
              <Input value={addMediaForm.volumeId ?? ""} onChange={e => setAddMediaForm(f => ({ ...f, volumeId: e.target.value }))} placeholder="如：VOL-2026-001" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMedia(false)}>取消</Button>
            <Button onClick={handleAddMedia}>确认添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 挂载网盘弹窗：未接真控制，暂不渲染（false && 保留源码便于恢复） */}
      {false && (
      <Dialog open={showMount} onOpenChange={setShowMount}>
        <DialogContent className="!max-w-2xl">
          <DialogHeader><DialogTitle><Plug className="h-5 w-5 inline mr-1" />挂载网盘 / 网络存储</DialogTitle><DialogDescription>配置 CIFS/NFS 网络存储挂载参数</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>设备名称 / IP *</Label>
              <Input value={mountForm.deviceName ?? ""} onChange={e => setMountForm(f => ({ ...f, deviceName: e.target.value }))} placeholder="如：172.168.6.15" />
            </div>
            <div className="space-y-2">
              <Label>设备组 *</Label>
              <Select value={mountForm.deviceGroup ?? ""} onValueChange={v => setMountForm(f => ({ ...f, deviceGroup: v }))}>
                <SelectTrigger><SelectValue placeholder="选择设备组" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="网盘">网盘</SelectItem>
                  <SelectItem value="备份存储">备份存储</SelectItem>
                  <SelectItem value="共享存储">共享存储</SelectItem>
                  <SelectItem value="归档存储">归档存储</SelectItem>
                  <SelectItem value="临时存储">临时存储</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>所属站点</Label>
              <Select value={mountForm.siteName ?? ""} onValueChange={v => setMountForm(f => ({ ...f, siteName: v }))}>
                <SelectTrigger><SelectValue placeholder="选择站点" /></SelectTrigger>
                <SelectContent>
                  {(isApiMode() ? siteOptions : []).map(site => (
                    <SelectItem key={site.code} value={site.name}>{site.name} ({site.code})</SelectItem>
                  ))}
                  {!isApiMode() && (
                    <SelectItem value="disabled" disabled>请先在站点管理完成站点配置</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>协议类型</Label>
              <Select value={mountForm.protocol ?? "CIFS"} onValueChange={v => setMountForm(f => ({ ...f, protocol: v as MountInput["protocol"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CIFS">CIFS / SMB</SelectItem>
                  <SelectItem value="NFS">NFS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>编码类型</Label>
              <Select value={mountForm.encoding ?? "UTF-8"} onValueChange={v => setMountForm(f => ({ ...f, encoding: v as MountInput["encoding"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTF-8">UTF-8</SelectItem>
                  <SelectItem value="GBK">GBK</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>管理目录 *</Label>
              <Input value={mountForm.managePath ?? ""} onChange={e => setMountForm(f => ({ ...f, managePath: e.target.value }))} placeholder="如：/netshare/172.168.6.15/manage" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>挂载目录 *</Label>
              <Input value={mountForm.mountPath ?? ""} onChange={e => setMountForm(f => ({ ...f, mountPath: e.target.value }))} placeholder="如：/netshare/172.168.6.15/" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>共享路径 *</Label>
              <Input value={mountForm.dataSource ?? ""} onChange={e => setMountForm(f => ({ ...f, dataSource: e.target.value }))} placeholder="如：\\172.168.6.15\public" />
            </div>
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input value={mountForm.username ?? ""} onChange={e => setMountForm(f => ({ ...f, username: e.target.value }))} placeholder="CIFS 认证用户（可选）" />
            </div>
            <div className="space-y-2">
              <Label>密码</Label>
              <Input type="password" value={mountForm.password ?? ""} onChange={e => setMountForm(f => ({ ...f, password: e.target.value }))} placeholder="CIFS 认证密码（可选）" />
            </div>
            <div className="space-y-2">
              <Label>权限</Label>
              <Select value={mountForm.permission ?? "readonly"} onValueChange={v => setMountForm(f => ({ ...f, permission: v as MountInput["permission"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="readonly">只读</SelectItem>
                  <SelectItem value="readwrite">读写</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>限速 (MB/s)</Label>
              <Input type="number" value={mountForm.speedLimit?.toString() ?? ""} onChange={e => setMountForm(f => ({ ...f, speedLimit: e.target.value ? Number(e.target.value) : undefined }))} placeholder="不限速" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>附加参数</Label>
              <Input value={mountForm.extraParams ?? ""} onChange={e => setMountForm(f => ({ ...f, extraParams: e.target.value }))} placeholder="如：vers=2.0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMount(false)}>取消</Button>
            <Button onClick={handleMount}><Plug className="h-4 w-4 mr-1" />挂载</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* ── 从设备生成任务弹窗 ───────────────────────────────── */}
      <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
        <DialogContent className="!max-w-md">
          <DialogHeader><DialogTitle>从设备生成任务</DialogTitle><DialogDescription>在设备 {selected?.rackId} 上创建新任务</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>任务类型</Label>
              <Select value={createTaskType} onValueChange={setCreateTaskType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="device_scan">设备扫描任务</SelectItem>
                  <SelectItem value="raid_check">RAID 校验任务</SelectItem>
                  <SelectItem value="full_package">封包任务</SelectItem>
                  <SelectItem value="full_scan">全量扫描任务</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>任务名称（可选）</Label>
              <Input value={createTaskName} onChange={e => setCreateTaskName(e.target.value)} placeholder="留空则自动生成" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTask(false)}>取消</Button>
            <Button onClick={handleCreateTaskFromDevice}>生成任务</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── 存储浏览 / 数据恢复 / 设备总览 Tab ───────────────────── */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
        <Tabs
          value={storageTab}
          onValueChange={(v) => setStorageTab(v as typeof storageTab)}
          className="w-full"
        >
          {/* Tab 切换区 */}
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
            <TabsList className="h-8 bg-slate-100 dark:bg-slate-800" data-testid="racks-storage-tabs">
              <TabsTrigger
                value="overview"
                className="h-7 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700"
                data-testid="racks-storage-tab-overview"
              >
                <HardDrive className="h-3.5 w-3.5 mr-1" />设备总览
              </TabsTrigger>
              <TabsTrigger
                value="browse"
                className="h-7 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700"
                data-testid="racks-storage-tab-browse"
              >
                <FolderTree className="h-3.5 w-3.5 mr-1" />存储浏览
              </TabsTrigger>
              <TabsTrigger
                value="restore"
                className="h-7 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700"
                data-testid="racks-storage-tab-restore"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />数据恢复
              </TabsTrigger>
              <TabsTrigger
                value="cage-move"
                className="h-7 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700"
                data-testid="racks-storage-tab-cage-move"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />盘笼移位
              </TabsTrigger>
            </TabsList>
            {storageTab === "restore" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">恢复模式：</span>
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                  <button
                    className={cn("px-3 py-1 text-xs rounded-md transition-colors", restoreMode === "server" ? "bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-300" : "text-slate-500 dark:text-slate-400")}
                    onClick={() => setRestoreMode("server")}
                  >
                    恢复到服务器路径
                  </button>
                  <button
                    className={cn("px-3 py-1 text-xs rounded-md transition-colors", restoreMode === "local" ? "bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-300" : "text-slate-500 dark:text-slate-400")}
                    onClick={() => setRestoreMode("local")}
                  >
                    下载到本地目录
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 内容区 — 使用 TabsContent 保证切换时内容 mount/unmount */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 min-h-[260px]">
            {/* 存储浏览 */}
            <TabsContent value="browse" forceMount={undefined} className="m-0">
              {isApiMode() ? (
                <EmptyState
                  severity="blocked"
                  icon={FolderTree}
                  title="存储浏览暂不可用"
                  description="当前总控已展示设备、盘位和光盘索引查询；完整目录浏览需要接入站点文件索引服务。"
                  testid="racks-storage-browse-blocked"
                  action={{ label: "查看站点代理接入文档", href: "/sites" }}
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="racks-storage-browse-content">
                  {/* 左侧目录树 */}
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium">备份数据目录树</h4>
                      <Select value={currentVolumeId} onValueChange={setCurrentVolumeId}>
                        <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="v1">硬盘卷</SelectItem>
                          <SelectItem value="v2">光盘卷</SelectItem>
                          <SelectItem value="v6">NAS存储</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <ScrollArea className="h-[400px]">
                      <div className="text-xs">
                        {browsedFiles.map(file => renderTreeItem(file, 0))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* 右侧选中详情 */}
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-3">文件详情</h4>
                    {selectedPath ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                          <p className="text-sm font-medium">{selectedPath.split("/").pop()}</p>
                          <p className="text-xs text-slate-500 mt-1">{selectedPath}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded">
                            <p className="text-slate-400">所属卷</p>
                            <p className="font-medium">{getVolumeName(currentVolumeId)}</p>
                          </div>
                          <div className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded">
                            <p className="text-slate-400">路径</p>
                            <p className="font-medium truncate">{selectedPath}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-400 text-sm">
                        <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>请在左侧选择文件或文件夹</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* 数据恢复 */}
            <TabsContent value="restore" className="m-0">
              {isApiMode() ? (
                <EmptyState
                  severity="blocked"
                  icon={RotateCcw}
                  title="数据恢复任务等待站点代理结果"
                  description="总控保留完整控制能力；文件索引与站点代理恢复协议接入后可执行恢复任务。"
                  testid="racks-storage-restore-blocked"
                  action={{ label: "查看任务中心控制队列", href: "/tasks?view=commands" }}
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="racks-storage-restore-content">
                  {/* 左侧目录树 */}
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-3">选择恢复数据</h4>
                    <ScrollArea className="h-[320px]">
                      <div className="text-xs">
                        {browsedFiles.map(file => renderTreeItem(file, 0))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* 中间待恢复列表 */}
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-3">
                      待恢复列表
                      {restoreList.length > 0 && (
                        <Badge variant="outline" className="ml-2 text-xs">{restoreList.length} 项</Badge>
                      )}
                    </h4>
                    {restoreList.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-sm">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>点击左侧"添加"加入恢复列表</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[280px]">
                        <div className="space-y-1">
                          {restoreList.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded text-xs">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{item.name}</p>
                                <p className="text-slate-400 truncate">{item.sourcePath}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {item.size && <span className="text-slate-500">{item.size}</span>}
                                <button
                                  className="h-5 w-5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center"
                                  onClick={() => removeFromRestoreList(item.id)}
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>

                  {/* 右侧目标选择 + 容量看板 */}
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-3">恢复目标</h4>
                    <div className="space-y-3">
                      <Select value={targetPath} onValueChange={setTargetPath}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="选择目标路径" /></SelectTrigger>
                        <SelectContent>
                          {targetOptions.map(t => (
                            <SelectItem key={t.id} value={t.path}>{t.name} ({t.path})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* 容量看板 */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">容量看板</p>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">已选文件数</span>
                            <span className="font-medium">{restoreList.length} 个</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">计划使用</span>
                            <span className="font-medium">{calcTotalSize(restoreList).display}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">目标剩余</span>
                            <span className="font-medium">{getTargetRemaining()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">恢复模式</span>
                            <span className="font-medium">{restoreMode === "server" ? "恢复到服务器" : "下载到本地"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">源存储卷</span>
                            <span className="font-medium">{getVolumeName(currentVolumeId)}</span>
                          </div>
                        </div>
                        {isCapacityInsufficient() && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-300 text-xs">
                            目标容量不足，请选择其他路径或减少文件
                          </div>
                        )}
                      </div>

                      <Button
                        className="w-full"
                        disabled={restoreList.length === 0 || !targetPath || isCapacityInsufficient() || restoreSubmitting}
                        onClick={handleRestoreSubmit}
                      >
                        {restoreSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                        开始恢复
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* 设备总览（默认） */}
            <TabsContent value="overview" className="m-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="racks-storage-overview-content">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <HardDrive className="h-4 w-4 text-blue-600" />
                    设备在线概况
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3">
                      <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{filtered.filter(r => r.deviceStatus === "online").length}</p>
                      <p className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-400">在线</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3">
                      <p className="text-2xl font-semibold text-slate-700 dark:text-slate-300">{filtered.filter(r => r.deviceStatus === "offline").length}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">离线</p>
                    </div>
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
                      <p className="text-2xl font-semibold text-red-700 dark:text-red-300">{filtered.filter(r => r.deviceStatus === "error" || r.deviceStatus === "warning" || r.status === "fault" || r.status === "warning").length}</p>
                      <p className="mt-1 text-xs text-red-700/70 dark:text-red-400">异常</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Grid3X3 className="h-4 w-4 text-violet-600" />
                    盘位汇总
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">已用盘位</span>
                      <span className="font-semibold text-slate-900">{stats.usedSlots} / {stats.totalSlotsAll || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">平均使用率</span>
                      <span className="font-semibold text-slate-900">{stats.avgUsage}%</span>
                    </div>
                    <Progress value={stats.avgUsage} className="h-2" />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Database className="h-4 w-4 text-blue-600" />
                    当前概况
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <p>设备数量: {filtered.length} 台</p>
                    <p>当前站点: {isAllSites ? "全部站点" : siteCode ?? "未选择"}</p>
                    <p>总容量 / 剩余: {stats.totalCapacity} / {stats.remainingCapacity}</p>
                    <p className="text-amber-700 dark:text-amber-300">存储浏览/数据恢复按接入状态展示，未配置时保持不可操作。</p>
                  </div>
                </div>

                {/* 设备列表预览 — 让 Tab 内容更"实" */}
                {filtered.length > 0 && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 lg:col-span-3" data-testid="racks-storage-overview-list">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                        <Server className="h-4 w-4 text-blue-600" />
                        设备列表预览
                      </div>
                      <span className="text-xs text-slate-400">最多展示前 5 台 · 完整列表见上方设备表格</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2 text-xs">
                      {filtered.slice(0, 5).map(r => {
                        const ds = deviceStatusMap[r.deviceStatus ?? "online"] ?? deviceStatusMap.online
                        return (
                          <div key={`overview-${r.siteCode}-${r.rackId}-${r.id}`} className="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 p-2">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-medium truncate text-slate-900">{r.rackName}</span>
                              <Badge className={cn("text-[10px] shrink-0", ds.color)}>{ds.label}</Badge>
                            </div>
                            <p className="mt-1 text-[10px] text-slate-400 truncate">{r.siteName} · {r.deviceType ?? "—"}</p>
                            <p className="mt-1 text-[10px] text-slate-500">使用率: {r.usagePercent != null ? `${r.usagePercent}%` : "—"}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="cage-move" className="m-0">
              <CageMoveView />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppShell>
  )
}
