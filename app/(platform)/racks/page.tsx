"use client"
import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GlassPanel } from "@/components/platform/glass-panel"
import { rackProvider, taskProvider, fetchRackSlots, getRacksDataSource, isApiMode } from "@/lib/api"
import { MOCK_STORE_EVENT, getStorageKey } from "@/lib/api/mock-store"
import { ALL_SITES, useSite } from "@/lib/site/site-context"
import { openSiteSsoJump } from "@/lib/site/open-site-sso"
import { buildTaskDeviceFilterHref } from "@/lib/tasks/task-device-filter"
import { InspectionView } from "@/components/racks/inspection-view"
import type { Rack, RackSlot, RackSlotGroup, RackStats } from "@/lib/types/rack"
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
import type { AddMediaInput, MountInput } from "@/lib/api/providers"
import {
  Server, HardDrive, Database, Wifi, WifiOff, AlertTriangle, Layers,
  Search, Download, ListChecks, ChevronRight,
  Info, Grid3X3, Link2, CheckCircle2, XCircle, Clock,
  Activity, Plug, Eye as ScanIcon,
  Box, Timer,
  Loader2, ExternalLink,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatBeijingTime } from "@/components/shared/time-format"
import { LOG_LEVEL_COLORS } from "@/lib/types/colors"

type DeviceCategory = "all" | "hdd" | "optical" | "offline" | "nas" | "abnormal"
type ApiRacksDataSource = "database" | "empty" | "error"

/** 站点业务系统设备管理页（SSO redirect，hash 路由由服务端规范化） */
const SITE_DEVICE_MANAGEMENT_PATH = "/device-management"

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
  const [ssoJumping, setSsoJumping] = useState(false)
  const [slotGroups, setSlotGroups] = useState<RackSlotGroup[]>([])
  const [slotDetailStatus, setSlotDetailStatus] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle")
  const [racksDataSource, setRacksDataSource] = useState<ApiRacksDataSource>(
    isApiMode() ? "empty" : "empty"
  )
  const [category, setCategory] = useState<DeviceCategory>("all")
  const [keyword, setKeyword] = useState("")
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv")

  // Sprint 2F.4: 全局 siteCode
  const { siteCode, isAllSites, isReady: siteReady } = useSite()

  // R.91.1: URL view parameter for sub-view (inspection)
  const searchParams = useSearchParams()
  const view = searchParams?.get("view") ?? null

  const goRacksMain = useCallback(() => {
    const params = new URLSearchParams()
    params.set("siteCode", isAllSites || !siteCode ? ALL_SITES : siteCode)
    router.push(`/racks?${params.toString()}`)
  }, [isAllSites, siteCode, router])

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
  // R.15: mountForm.siteName 改用真实 /api/sites（弹窗暂隐藏，仍加载以便恢复）
  // ============================================================
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
    router.push(
      buildTaskDeviceFilterHref({
        siteCode: rack.siteCode,
        deviceId: rack.rackId,
        deviceName: rack.rackName,
      }),
    )
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
    const displayLabel = slot?.indexLabel?.trim() || String(displayIndex)
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
                title: `盘位 ${displayLabel}`,
                description: `状态: ${label} | 总容量: ${formatSlotCapacityLabel(slot?.capacity)} | 已使用: ${formatSlotCapacityLabel(slot?.usedCapacity)}`,
              })
            }}
          >
            <span>{displayLabel}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-0.5 text-xs">
            <p>盘位 {displayLabel}{label ? ` · ${label}` : ""}</p>
            <p>总容量：{formatSlotCapacityLabel(slot?.capacity)}</p>
            <p>已使用：{formatSlotCapacityLabel(slot?.usedCapacity)}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }

  const handleGoSiteManage = async () => {
    const targetSite = selected?.siteCode?.trim()
    if (!targetSite) {
      toast({
        title: "无法跳转",
        description: "当前设备缺少所属站点信息",
        variant: "destructive",
      })
      return
    }
    setSsoJumping(true)
    try {
      await openSiteSsoJump(targetSite, { redirect: SITE_DEVICE_MANAGEMENT_PATH })
      toast({
        title: "正在打开站点",
        description: `前往 ${selected?.siteName || targetSite} 设备管理`,
      })
    } catch (e) {
      toast({
        title: "跳转失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setSsoJumping(false)
    }
  }

  // R.91.1: Conditional rendering for sub-view (inspection)
  if (view === "inspection") {
    return (
      <div className="page-pad space-y-4 lg:space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" className="h-8 text-slate-500 hover:text-slate-700" onClick={goRacksMain}>
              <span className="mr-1">&larr;</span> 返回设备管理
            </Button>
          </div>
          <InspectionView />
        </div>
      </div>
    )
  }

  const totalCapacityParts = splitCapacityLabel(stats.totalCapacity)
  const remainingCapacityParts = splitCapacityLabel(stats.remainingCapacity)

  return (
    <div className="flex h-full flex-col overflow-hidden page-pad">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:gap-4">
        <div className="shrink-0">
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
              </div>
            }
          />
        </div>

        {isApiMode() && racksDataSource === "error" && (
          <div className="flex shrink-0 items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>中心库设备数据读取失败，请检查数据库连接与同步状态。</span>
          </div>
        )}
        {isApiMode() && racksDataSource === "empty" && (
          <div className="flex shrink-0 items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300">
            <Info className="h-4 w-4 shrink-0" />
            <span>暂无中心库设备记录，请先完成站点同步。</span>
          </div>
        )}

        {/* ── KPI（无标题文案） ─────────────────────────────────── */}
        <GlassPanel testId="racks-hero-glass-panel" className="shrink-0">
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

        {/* ── 主体：左侧树 + 右侧表格（定高内滚动） ─────────────── */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[200px_1fr] lg:gap-6">
          <Card className="flex min-h-0 flex-col gap-0 overflow-hidden py-0 xl:h-full">
            <CardHeader className="shrink-0 border-b border-slate-100 px-4 !py-3 dark:border-slate-700">
              <CardTitle className="text-sm font-semibold">设备分类</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-auto px-2 py-2">
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

          <Card className="flex min-h-0 flex-col gap-0 overflow-hidden py-0" data-testid="racks-device-list">
            <CardHeader className="flex shrink-0 flex-row flex-wrap items-center gap-2 space-y-0 border-b border-slate-100 px-4 !py-3 dark:border-slate-700">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="搜索设备名称 / IP / 类型..."
                  className="h-8 pl-9"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  aria-label="搜索设备"
                />
              </div>
              <span className="text-xs text-slate-400 shrink-0">{filtered.length} 台设备</span>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-auto p-0">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white dark:bg-slate-800">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-sm text-slate-500 whitespace-nowrap">设备名称</TableHead>
                    <TableHead className="text-sm text-slate-500 whitespace-nowrap">IP 地址</TableHead>
                    <TableHead className="text-sm text-slate-500 whitespace-nowrap">设备类型</TableHead>
                    <TableHead className="text-sm text-slate-500 whitespace-nowrap">所属站点</TableHead>
                    <TableHead className="text-sm text-slate-500 whitespace-nowrap">总容量</TableHead>
                    <TableHead className="text-sm text-slate-500 whitespace-nowrap">剩余容量</TableHead>
                    <TableHead className="text-sm text-slate-500 whitespace-nowrap min-w-[100px]">使用率</TableHead>
                    <TableHead className="text-sm text-slate-500 whitespace-nowrap">盘位</TableHead>
                    <TableHead className="text-sm text-slate-500 whitespace-nowrap">任务数</TableHead>
                    <TableHead className="text-sm text-slate-500 whitespace-nowrap">最近同步</TableHead>
                    <TableHead className="text-sm text-slate-500 whitespace-nowrap">状态</TableHead>
                    <TableHead className="text-sm text-slate-500 whitespace-nowrap text-right">操作</TableHead>
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
                        </TableCell>
                        <TableCell className="font-mono text-sm">{r.ip ?? "—"}</TableCell>
                        <TableCell className="text-sm">{r.deviceType ?? "—"}</TableCell>
                        <TableCell><p className="text-sm">{r.siteName}</p></TableCell>
                        <TableCell className="text-sm">{r.totalCapacity ?? "—"}</TableCell>
                        <TableCell className="text-sm">{r.remainingCapacity ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {r.usagePercent != null ? (
                              <>
                                <Progress value={r.usagePercent} className="h-1.5 flex-1" />
                                <span className="text-sm tabular-nums min-w-[32px] text-right">{r.usagePercent}%</span>
                              </>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{r.totalSlots > 0 ? `${r.usedSlots ?? "—"}/${r.totalSlots}` : "—"}</TableCell>
                        <TableCell className="text-sm tabular-nums">{r.currentTaskCount ?? 0}</TableCell>
                        <TableCell className="text-sm text-slate-500 whitespace-nowrap">{formatBeijingTime(r.lastSyncAt) || "—"}</TableCell>
                        <TableCell>
                          <Badge className={cn("font-normal", ds.color)}>
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
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <DrawerTitle className="truncate text-base">{selected?.rackName}</DrawerTitle>
                {selected && (() => {
                  const ds = deviceStatusMap[selected.deviceStatus ?? "online"]
                  return <Badge className={cn("shrink-0 text-xs", ds.color)}>{ds.label}</Badge>
                })()}
              </div>
              {selected && (
                <Button
                  size="sm"
                  className="h-8 shrink-0 gap-1"
                  disabled={ssoJumping || !selected.siteCode}
                  onClick={() => void handleGoSiteManage()}
                  data-testid="racks-go-site-manage"
                >
                  {ssoJumping ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  去站点管理
                </Button>
              )}
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
                            onClick={() => { setDrawerOpen(false); handleViewTasks(selected) }}
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
    </div>
  )
}
