"use client"
import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { rackProvider, taskProvider } from "@/lib/api/mock-providers"
import { MOCK_STORE_EVENT, getStorageKey } from "@/lib/api/mock-store"
import { racks as mockRacks } from "@/lib/mock/racks"
import { sites as mockSites } from "@/lib/mock/sites"
import type { Rack, RackSlot, RackStats } from "@/lib/types/rack"
import { DEVICE_MODE_LABELS, type DeviceMode } from "@/lib/types/rack"
import type { TaskItem } from "@/lib/types/task"
import type { AddMediaInput, MountInput } from "@/lib/api/providers"
import {
  Server, HardDrive, Database, Wifi, WifiOff, AlertTriangle, Layers,
  Search, RefreshCw, Download, Eye, ListChecks, ChevronRight,
  Info, Grid3X3, Link2, CheckCircle2, XCircle, Clock, Wrench,
  Activity, Plus, Plug, Eye as ScanIcon, Shield, Settings,
  Box, Timer, Power, RotateCcw,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type DeviceCategory = "all" | "hdd" | "optical" | "offline" | "nas" | "abnormal"

const deviceStatusMap: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  online: { label: "在线", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  offline: { label: "离线", color: "bg-slate-100 text-slate-600", icon: XCircle },
  error: { label: "异常", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  maintenance: { label: "维护中", color: "bg-amber-100 text-amber-700", icon: Wrench },
}

const slotStatusColor: Record<string, { bg: string; text: string; border: string }> = {
  used:   { bg: "bg-blue-600",   text: "text-white", border: "border-blue-600" },
  free:   { bg: "bg-slate-100",  text: "text-slate-400", border: "border-slate-200" },
  error:  { bg: "bg-red-500",    text: "text-white", border: "border-red-500" },
  empty:  { bg: "bg-slate-50",   text: "text-slate-300", border: "border-dashed border-slate-300" },
}

const logLevelColor: Record<string, string> = {
  info: "bg-slate-50 text-slate-700", warn: "bg-amber-50 text-amber-800", error: "bg-red-50 text-red-800",
}

interface TreeNode {
  id: DeviceCategory
  label: string
  icon: typeof HardDrive
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-slate-50 last:border-0 text-sm">
      <span className="text-slate-400 shrink-0 w-24 text-right">{label}</span>
      <span className="text-slate-900 min-w-0 break-words">{value}</span>
    </div>
  )
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
  const [category, setCategory] = useState<DeviceCategory>("all")
  const [keyword, setKeyword] = useState("")
  const [syncing, setSyncing] = useState(false)

  // 弹窗状态
  const [showAddMedia, setShowAddMedia] = useState(false)
  const [addMediaSlot, setAddMediaSlot] = useState<number | null>(null)
  const [addMediaForm, setAddMediaForm] = useState<Partial<AddMediaInput>>({ mediaType: "hdd" })

  const [showMount, setShowMount] = useState(false)
  const [mountForm, setMountForm] = useState<Partial<MountInput>>({ protocol: "CIFS", encoding: "UTF-8", permission: "readonly" })

  const [showCreateTask, setShowCreateTask] = useState(false)
  const [createTaskType, setCreateTaskType] = useState<string>("device_scan")
  const [createTaskName, setCreateTaskName] = useState("")

  // 加载数据
  const loadRacks = useCallback(async () => {
    try {
      const [racksData, statsData] = await Promise.all([rackProvider.getAll(), rackProvider.getStats()])
      setRackList(racksData.length > 0 ? racksData : mockRacks)
      setStats(statsData as any)
      if (!selected) setSelected((racksData.length > 0 ? racksData : mockRacks)[0] ?? null)
    } catch {
      setRackList(mockRacks)
    }
  }, [selected])

  useEffect(() => { loadRacks() }, [loadRacks])

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
        category === "hdd" ? r.deviceType === "智能硬盘库" :
        category === "optical" ? r.deviceType === "光盘库" :
        category === "offline" ? r.deviceStatus === "offline" :
        category === "nas" ? (r.deviceType?.includes("网盘") || r.deviceType?.includes("NAS") || r.deviceType?.includes("CIFS")) :
        category === "abnormal" ? (r.deviceStatus === "error" || r.status === "maintenance" || r.status === "fault") : true
      const matchKw = !keyword || r.rackId.includes(keyword) || r.siteName.includes(keyword) || (r.ip ?? "").includes(keyword) || (r.deviceType ?? "").includes(keyword)
      return matchCat && matchKw
    })
  }, [rackList, category, keyword])

  // 树节点计数
  const treeCounts = useMemo(() => {
    const map: Record<string, number> = {}
    treeNodes.forEach(n => {
      map[n.id] = rackList.filter(r => {
        if (n.id === "all") return true
        if (n.id === "hdd") return r.deviceType === "智能硬盘库"
        if (n.id === "optical") return r.deviceType === "光盘库"
        if (n.id === "offline") return r.deviceStatus === "offline"
        if (n.id === "nas") return r.deviceType?.includes("网盘") || r.deviceType?.includes("NAS") || r.deviceType?.includes("CIFS")
        if (n.id === "abnormal") return r.deviceStatus === "error" || r.status === "maintenance" || r.status === "fault"
        return false
      }).length
    })
    return map
  }, [rackList])

  const openDetail = (rack: Rack) => { setSelected(rack); setDrawerOpen(true) }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await rackProvider.syncRacks()
      await loadRacks()
      toast({ title: "同步完成", description: "所有设备同步时间已更新" })
    } catch { toast({ title: "同步失败", variant: "destructive" }) }
    finally { setSyncing(false) }
  }

  const handleViewTasks = (rack: Rack) => {
    router.push(`/tasks?device=${rack.rackId}`)
  }

  const handleScan = async (rack: Rack, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await taskProvider.createTaskFromDevice(rack.id, "device_scan", { name: `${rack.rackId}-设备扫描` })
      await loadRacks() // 刷新设备列表，更新关联任务
      toast({ title: "设备扫描任务已生成", description: `「${rack.rackId}-设备扫描」已创建，可在任务管理页查看` })
    } catch { toast({ title: "操作失败", variant: "destructive" }) }
  }

  const handleRaidCheck = async (rack: Rack, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await taskProvider.createTaskFromDevice(rack.id, "raid_check", { name: `${rack.rackId}-RAID校验` })
      await loadRacks() // 刷新设备列表，更新关联任务
      toast({ title: "RAID 校验任务已生成", description: `「${rack.rackId}-RAID校验」已创建，可在任务管理页查看` })
    } catch { toast({ title: "操作失败", variant: "destructive" }) }
  }

  const handleCreateTaskFromDevice = async () => {
    if (!selected) return
    try {
      await taskProvider.createTaskFromDevice(selected.id, createTaskType as any, { name: createTaskName || undefined })
      await loadRacks() // 刷新设备列表
      toast({ title: "任务已生成", description: `「${createTaskName || "设备任务"}」已创建，可在任务管理页查看` })
      setShowCreateTask(false); setCreateTaskName("")
    } catch { toast({ title: "生成失败", variant: "destructive" }) }
  }

  const handleMount = async () => {
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

  const handleModeChange = async (rack: Rack, mode: string) => {
    // 立即更新 UI
    setRackList(prev => prev.map(r => r.id === rack.id ? { ...r, mode: mode as DeviceMode } : r))
    setSelected(prev => prev ? { ...prev, mode: mode as DeviceMode } : prev)
    try {
      await rackProvider.updateDeviceMode(rack.id, mode)
      toast({ title: "模式切换成功", description: `设备已切换为 ${DEVICE_MODE_LABELS[mode as DeviceMode] ?? mode}` })
    } catch {
      // 回滚
      setRackList(prev => prev.map(r => r.id === rack.id ? { ...r, mode: rack.mode as DeviceMode } : r))
      setSelected(prev => prev ? { ...prev, mode: rack.mode as DeviceMode } : prev)
      toast({ title: "切换失败", variant: "destructive" })
    }
  }

  const openDrawerDetail = (rack: Rack) => { setSelected(rack); setDrawerOpen(true) }

  return (
    <AppShell>
      <PageHeader
        title="盘架管理"
        description="存储设备总览、盘位监控与任务关联"
        badge="DEVICE MGMT"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowMount(true)}>
              <Plug className="h-4 w-4 mr-1" />挂载网盘
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => {
              toast({ title: "导出功能", description: "设备数据导出功能开发中" })
            }}>
              <Download className="h-4 w-4 mr-1" />导出
            </Button>
            <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={cn("h-4 w-4 mr-1", syncing && "animate-spin")} />同步
            </Button>
          </div>
        }
      />

      {/* ── 统计卡片 ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard title="设备总数" value={stats.total} unit="台" icon={Server} />
        <StatCard title="在线" value={stats.online} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard title="离线" value={stats.offline} icon={WifiOff} iconBg="bg-slate-50" iconColor="text-slate-600" />
        <StatCard title="异常" value={stats.fault + stats.maintenance} icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-600" />
        <StatCard title="总容量" value={stats.totalCapacity} icon={Database} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard title="剩余容量" value={stats.remainingCapacity} icon={Activity} iconBg="bg-cyan-50" iconColor="text-cyan-600" />
        <StatCard title="已用盘位" value={stats.usedSlots} unit="个" icon={Grid3X3} iconBg="bg-violet-50" iconColor="text-violet-600" />
        <StatCard title="平均使用率" value={`${stats.avgUsage}%`} icon={Box} iconBg="bg-amber-50" iconColor="text-amber-600" />
      </div>

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
                      isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-50"
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
                  <Input placeholder="搜索设备名称 / IP / 类型..." className="pl-9 h-9" value={keyword} onChange={e => setKeyword(e.target.value)} />
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
                    <TableRow><TableCell colSpan={12} className="text-center py-10 text-slate-400">未找到匹配设备</TableCell></TableRow>
                  ) : filtered.map(r => {
                    const ds = deviceStatusMap[r.deviceStatus ?? "online"] ?? deviceStatusMap.online
                    const DsIcon = ds.icon
                    return (
                      <TableRow key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openDrawerDetail(r)}>
                        <TableCell>
                          <p className="font-medium text-sm font-mono">{r.rackId}</p>
                          <p className="text-[10px] text-slate-400">{r.room ?? r.datacenter}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.ip ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.deviceType ?? "—"}</TableCell>
                        <TableCell><p className="text-sm">{r.siteName}</p><p className="text-[10px] text-slate-400">{r.siteCode}</p></TableCell>
                        <TableCell className="text-xs">{r.totalCapacity ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.remainingCapacity ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={r.usagePercent} className="h-1.5 flex-1" />
                            <span className="text-xs tabular-nums min-w-[32px] text-right">{r.usagePercent}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{r.totalSlots > 0 ? `${r.usedSlots}/${r.totalSlots}` : "—"}</TableCell>
                        <TableCell className="text-xs tabular-nums">{r.currentTaskCount ?? 0}</TableCell>
                        <TableCell className="text-[10px] text-slate-400 whitespace-nowrap">{r.lastSyncAt}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-[10px]", ds.color)}>
                            <DsIcon className="h-3 w-3 mr-1" />{ds.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-0.5 justify-end" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="详情" onClick={() => openDetail(r)}><Eye className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="查看任务" onClick={() => handleViewTasks(r)}><ListChecks className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="扫描" onClick={e => handleScan(r, e)}><ScanIcon className="h-3.5 w-3.5" /></Button>
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
          <DrawerHeader className="border-b border-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <DrawerTitle className="text-base font-mono">{selected?.rackId}</DrawerTitle>
                <DrawerDescription className="text-xs mt-1">{selected?.deviceType} · {selected?.siteName}</DrawerDescription>
              </div>
              {selected && (() => {
                const ds = deviceStatusMap[selected.deviceStatus ?? "online"]
                return <Badge className={cn("text-xs", ds.color)}>{ds.label}</Badge>
              })()}
            </div>
          </DrawerHeader>
          <ScrollArea className="flex-1 h-[calc(100vh-100px)]">
            {selected && (
              <div className="p-5 space-y-5">
                {/* 基础信息 */}
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Info className="h-4 w-4 text-slate-400" />基础信息</h4>
                  <div className="text-sm">
                    <DetailRow label="设备名称" value={selected.rackId} />
                    <DetailRow label="IP 地址" value={<span className="font-mono">{selected.ip ?? "—"}</span>} />
                    <DetailRow label="设备类型" value={selected.deviceType ?? "—"} />
                    <DetailRow label="所属站点" value={selected.siteName} />
                    <DetailRow label="总容量" value={selected.totalCapacity ?? "—"} />
                    <DetailRow label="剩余容量" value={selected.remainingCapacity ?? "—"} />
                    <DetailRow label="使用率" value={<div className="flex items-center gap-2"><Progress value={selected.usagePercent} className="h-1.5 w-20" /><span>{selected.usagePercent}%</span></div>} />
                    <DetailRow label="最近同步" value={selected.lastSyncAt} />
                    <DetailRow label="当前任务数" value={(selected.currentTaskCount ?? 0).toString()} />
                  </div>
                </section>

                <Separator />

                {/* 模式控制 */}
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Power className="h-4 w-4 text-slate-400" />模式控制</h4>
                  <div className="bg-slate-100 p-1 rounded-full flex relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]">
                    {/* 滑动指示器 */}
                    <div
                      className="absolute top-1 bottom-1 bg-white rounded-full shadow-md transition-[left] duration-200 ease-out"
                      style={{
                        width: "calc(33.333% - 2px)",
                        left: selected ? `calc(2px + ${["off", "standard", "high_speed"].indexOf(selected.mode) * (100 / 3)}%)` : "2px",
                      }}
                    />
                    {(["off", "standard", "high_speed"] as DeviceMode[]).map(mode => (
                      <button
                        key={mode}
                        className={cn(
                          "flex-1 relative z-10 h-8 text-xs font-medium rounded-full transition-colors duration-200",
                          selected.mode === mode ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
                        )}
                        onClick={() => handleModeChange(selected, mode)}
                      >
                        {DEVICE_MODE_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">模式切换需在设备本地控制台操作，此处仅做演示</p>
                </section>

                {/* 控制按钮 */}
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Settings className="h-4 w-4 text-slate-400" />设备操作</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleScan(selected)}>
                      <ScanIcon className="h-3.5 w-3.5 mr-1" />扫描设备
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleRaidCheck(selected)}>
                      <Shield className="h-3.5 w-3.5 mr-1" />RAID 校验
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setShowCreateTask(true) }}>
                      <Plus className="h-3.5 w-3.5 mr-1" />生成任务
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleViewTasks(selected)}>
                      <ListChecks className="h-3.5 w-3.5 mr-1" />查看任务
                    </Button>
                  </div>
                </section>

                {/* 托盘信息 */}
                {selected.trays && selected.trays.length > 0 && (
                  <>
                    <Separator />
                    <section>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Layers className="h-4 w-4 text-slate-400" />托盘信息</h4>
                      <div className="grid grid-cols-4 gap-2">
                        {selected.trays.map(tray => (
                          <div key={tray.id} className="p-3 rounded-lg border border-slate-100 bg-white text-center">
                            <p className="text-xs text-slate-400">{tray.label}</p>
                            <p className="text-lg font-bold text-slate-900 mt-1">{tray.usedCount}/{tray.slotCount}</p>
                            <p className="text-[10px] text-slate-400">块/位</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                {/* 盘位信息 */}
                {selected.totalSlots > 0 && (
                  <>
                    <Separator />
                    <section>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Grid3X3 className="h-4 w-4 text-slate-400" />盘位信息
                        <span className="text-xs font-normal text-slate-400">（{selected.usedSlots}/{selected.totalSlots} 已占用）</span>
                      </h4>
                      <TooltipProvider>
                        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(8, selected.totalSlots)}, minmax(0, 1fr))` }}>
                          {Array.from({ length: selected.totalSlots }, (_, i) => {
                            const slot = selected.slots?.find(s => s.index === i + 1)
                            const isOccupied = slot?.occupied
                            const isError = slot?.status === "error"
                            const status = isOccupied ? "used" : slot ? "free" : "empty"
                            const sc = slotStatusColor[status]
                            return (
                              <Tooltip key={i}>
                                <TooltipTrigger asChild>
                                  {isOccupied ? (
                                    <button
                                      className={cn("aspect-square rounded text-xs font-medium flex flex-col items-center justify-center cursor-pointer transition-colors", sc.bg, sc.text, isError && "ring-2 ring-red-400")}
                                      onClick={() => {
                                        toast({
                                          title: `盘位 ${i + 1} 信息`,
                                          description: `编号: ${slot.discNo ?? "—"} | 类型: ${slot.mediaType === "hdd" ? "硬盘" : slot.mediaType === "bd" ? "蓝光" : "离线"} | 容量: ${slot.capacity ?? "—"}`
                                        })
                                      }}
                                    >
                                      <span>{i + 1}</span>
                                      <span className="text-[8px] opacity-75">{isError ? "异常" : "已用"}</span>
                                    </button>
                                  ) : (
                                    <button
                                      className={cn("aspect-square rounded text-xs font-medium flex flex-col items-center justify-center cursor-pointer border transition-colors", sc.bg, sc.text, sc.border)}
                                      onClick={() => openAddMedia(i + 1)}
                                    >
                                      <span>{i + 1}</span>
                                      <Plus className="h-2.5 w-2.5" />
                                    </button>
                                  )}
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    盘位 {i + 1}: {slot?.occupied ? `${slot.discNo ?? "已占用"} (${slot.mediaType === "hdd" ? "硬盘" : slot.mediaType === "bd" ? "蓝光" : "离线"})` : "空闲 — 点击上方 + 添加"}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            )
                          })}
                        </div>
                      </TooltipProvider>
                      <div className="flex gap-4 text-xs text-slate-500 mt-3">
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-blue-600" />已使用</span>
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-slate-100 border border-slate-200" />空闲</span>
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-red-500" />异常</span>
                      </div>
                    </section>
                  </>
                )}

                {/* 关联任务 */}
                {selected.recentTasks && selected.recentTasks.length > 0 && (
                  <>
                    <Separator />
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
                            className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-100/50 cursor-pointer transition-colors"
                            onClick={() => { setDrawerOpen(false); router.push(`/tasks?device=${selected.rackId}`) }}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{task.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">{task.type}</Badge>
                                <span className="text-[10px] text-slate-400">{task.startedAt}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 ml-3 shrink-0">
                              <div className="text-right">
                                <Progress value={task.progress} className="h-1.5 w-16 mb-0.5" />
                                <span className="text-[10px] text-slate-400">{task.progress}%</span>
                              </div>
                              <Badge className={cn("text-[10px]",
                                task.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                                task.status === "failed" ? "bg-red-100 text-red-700" :
                                task.status === "running" ? "bg-blue-100 text-blue-700" :
                                "bg-slate-100 text-slate-600"
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
                    <Separator />
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
            )}
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
            <Button onClick={handleAddMedia} className="bg-blue-600 hover:bg-blue-700">确认添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 挂载网盘弹窗 ─────────────────────────────────────── */}
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
                  {mockSites.map(site => (
                    <SelectItem key={site.id} value={site.name}>{site.name}</SelectItem>
                  ))}
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
              <Label>数据源 *</Label>
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
            <Button onClick={handleMount} className="bg-blue-600 hover:bg-blue-700"><Plug className="h-4 w-4 mr-1" />挂载</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button onClick={handleCreateTaskFromDevice} className="bg-blue-600 hover:bg-blue-700">生成任务</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
