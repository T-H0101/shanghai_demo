"use client"

import { useEffect, useMemo, useState, useCallback, useRef, type MutableRefObject } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatCard } from "@/components/platform/stat-card"
import { DetailPanel } from "@/components/platform/detail-panel"
import {
  Database, HardDrive, Layers, Server, Search, RefreshCw,
  Disc, AlertTriangle, Sparkles, Box, CassetteTape,
  ExternalLink, Loader2,
} from "lucide-react"
import { useSite } from "@/lib/site/site-context"
import { fetchVolumes } from "@/lib/api/api-providers"
import type { VolumeDTO, VolumeMediaGroupDTO } from "@/lib/api/dto"
import { VOLUME_TYPE_DTO_LABELS } from "@/lib/devices/volume-type"
import {
  OPTICAL_DISC_TYPE_COLORS,
  OPTICAL_DISC_TYPE_LABELS,
  normalizeOpticalDiscType,
  type OpticalDiscType,
} from "@/lib/devices/disc-slot-display"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

/** 站点业务系统存储卷管理页（SSO redirect，hash 路由由服务端规范化） */
const SITE_VOLUME_MANAGEMENT_PATH = "/volume-management"

const typeBadge: Record<string, { label: string; color: string; icon: typeof Disc }> = {
  optical: {
    label: VOLUME_TYPE_DTO_LABELS.optical,
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    icon: Disc,
  },
  magnetic: {
    label: VOLUME_TYPE_DTO_LABELS.magnetic,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    icon: HardDrive,
  },
  tape: {
    label: VOLUME_TYPE_DTO_LABELS.tape,
    color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    icon: CassetteTape,
  },
  composite: {
    label: VOLUME_TYPE_DTO_LABELS.composite,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    icon: Layers,
  },
}

function parseBytes(s: string | undefined): number | null {
  if (!s) return null
  const m = /^([0-9.]+)\s*(B|KB|MB|GB|TB|PB)$/i.exec(s.trim())
  if (!m) {
    const n = Number(s)
    return isFinite(n) ? n : null
  }
  const v = parseFloat(m[1])
  const mults: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4, PB: 1024 ** 5 }
  return v * (mults[m[2].toUpperCase()] ?? 1)
}

function formatBytesAuto(bytes: number | null | undefined): string {
  if (bytes == null) return "—"
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(2)} ${units[i]}`
}

/** 展示：站点名称（编号）；无名称时仅编号 */
function formatVolumeSiteDisplay(siteCode?: string, siteName?: string): string {
  const code = (siteCode ?? "").trim()
  if (!code) return "—"
  const name = (siteName ?? "").trim()
  if (!name || name === code) return code
  // 注册表 label 可能是「SH01 上海站」，去掉前缀编号再展示
  const bare = name.startsWith(`${code} `) ? name.slice(code.length + 1).trim() : name
  if (!bare || bare === code) return code
  return `${bare}（${code}）`
}

function volumeKey(v: Pick<VolumeDTO, "id" | "siteCode">): string {
  return `${v.siteCode ?? ""}::${v.id}`
}

async function jumpToSiteVolumeManagement(siteCode: string): Promise<string> {
  const qs = new URLSearchParams({ redirect: SITE_VOLUME_MANAGEMENT_PATH })
  const res = await fetch(
    `/api/sites/${encodeURIComponent(siteCode)}/sso?${qs.toString()}`,
    { cache: "no-store", credentials: "include" },
  )
  const json = await res.json().catch(() => ({}))
  if (res.status === 401) {
    throw new Error("请先登录后再跳转站点")
  }
  if (!res.ok) {
    throw new Error(json.message || `HTTP ${res.status}`)
  }
  if (json.status !== "ready" || !json.jumpUrl) {
    throw new Error(json.message || json.blocker || "无法签发站点跳转")
  }
  return String(json.jumpUrl)
}

export interface VolumesViewProps {
  className?: string
  refreshRef?: MutableRefObject<(() => Promise<void>) | null>
  onLoadingChange?: (loading: boolean) => void
}

export function VolumesView({ className, refreshRef, onLoadingChange }: VolumesViewProps) {
  const { siteCode, isReady: siteReady } = useSite()
  const [volumes, setVolumes] = useState<VolumeDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [selected, setSelected] = useState<VolumeDTO | null>(null)
  const [mediaGroups, setMediaGroups] = useState<VolumeMediaGroupDTO[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [ssoJumping, setSsoJumping] = useState(false)
  const selectedRef = useRef<VolumeDTO | null>(null)
  selectedRef.current = selected

  const openVolume = useCallback(async (v: VolumeDTO) => {
    setSelected(v)
    setMediaGroups(v.mediaGroups ?? [])
    setDetailLoading(true)
    try {
      const qs = new URLSearchParams()
      if (v.siteCode) qs.set("siteCode", v.siteCode)
      const res = await fetch(
        `/api/volumes/${encodeURIComponent(v.id)}${qs.toString() ? `?${qs}` : ""}`,
        { cache: "no-store", credentials: "include" },
      )
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.code === 0 && json.data) {
        const detail = json.data as VolumeDTO
        const sameSite = !v.siteCode || !detail.siteCode || v.siteCode === detail.siteCode
        if (sameSite && detail.id === v.id) {
          setSelected((prev) =>
            prev && prev.id === v.id
              ? {
                  ...prev,
                  ...detail,
                  id: v.id,
                  siteCode: detail.siteCode ?? prev.siteCode,
                  siteName: detail.siteName ?? prev.siteName,
                }
              : prev,
          )
          setMediaGroups(detail.mediaGroups ?? [])
        }
      }
    } catch {
      /* 列表数据仍可展示；明细分组保持空 */
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    onLoadingChange?.(true)
    setError(null)
    try {
      const result = await fetchVolumes(siteCode ?? undefined)
      if (Array.isArray(result)) {
        setVolumes(result)
      } else if (result && typeof result === "object" && "data" in result) {
        setVolumes(((result as any).data ?? []) as VolumeDTO[])
      } else {
        setVolumes([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown")
    } finally {
      setLoading(false)
      onLoadingChange?.(false)
    }
  }, [siteCode, onLoadingChange])

  useEffect(() => {
    if (refreshRef) refreshRef.current = load
    return () => {
      if (refreshRef) refreshRef.current = null
    }
  }, [load, refreshRef])

  useEffect(() => {
    if (siteReady) void load()
  }, [load, siteReady])

  const stats = useMemo(() => {
    const total = volumes.length
    let totalSlots = 0
    let onlineSlots = 0
    let totalCapBytes = 0
    let usedCapBytes = 0
    let withAggregate = 0
    for (const v of volumes) {
      if (v.aggregate) {
        withAggregate++
        if (typeof v.aggregate.slot_count === "number") totalSlots += v.aggregate.slot_count
        if (typeof v.aggregate.online_slot_count === "number") onlineSlots += v.aggregate.online_slot_count
      }
      const totalBytes = parseBytes(v.totalCapacity)
      const usedBytes = parseBytes(v.totalCapacity) != null && parseBytes(v.remainingCapacity) != null
        ? (parseBytes(v.totalCapacity)! - parseBytes(v.remainingCapacity)!)
        : null
      if (totalBytes != null) totalCapBytes += totalBytes
      if (usedBytes != null) usedCapBytes += usedBytes
    }
    return {
      total,
      totalSlots,
      onlineSlots,
      withAggregate,
      totalCap: formatBytesAuto(totalCapBytes),
      usedCap: formatBytesAuto(usedCapBytes),
      usedPct: totalCapBytes > 0 ? Math.round((usedCapBytes / totalCapBytes) * 100) : 0,
    }
  }, [volumes])

  const filtered = useMemo(() => {
    return volumes.filter((v) => {
      if (typeFilter !== "all" && v.type !== typeFilter) return false
      if (search) {
        const s = search.toLowerCase()
        const siteDisplay = formatVolumeSiteDisplay(v.siteCode, v.siteName).toLowerCase()
        if (
          !(v.name || "").toLowerCase().includes(s) &&
          !(v.siteCode || "").toLowerCase().includes(s) &&
          !(v.siteName || "").toLowerCase().includes(s) &&
          !siteDisplay.includes(s)
        ) {
          return false
        }
      }
      return true
    })
  }, [volumes, search, typeFilter])

  // 有数据时默认选中第一条；筛选后若当前项不在结果中则改选第一条
  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedRef.current) {
        setSelected(null)
        setMediaGroups([])
        setDetailLoading(false)
      }
      return
    }
    const prev = selectedRef.current
    const stillValid = prev && filtered.some((v) => volumeKey(v) === volumeKey(prev))
    if (!stillValid) {
      void openVolume(filtered[0])
    }
  }, [filtered, openVolume])

  const handleGoSiteEdit = async () => {
    const targetSite = selected?.siteCode?.trim()
    if (!targetSite) {
      toast({
        title: "无法跳转",
        description: "当前卷缺少所属站点信息",
        variant: "destructive",
      })
      return
    }
    setSsoJumping(true)
    try {
      const jumpUrl = await jumpToSiteVolumeManagement(targetSite)
      toast({
        title: "正在打开站点",
        description: `前往 ${formatVolumeSiteDisplay(selected?.siteCode, selected?.siteName)} 存储卷管理`,
      })
      window.open(jumpUrl, "_blank", "noopener,noreferrer")
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

  return (
    <div
      className={cn("flex min-h-0 flex-col gap-3 overflow-hidden lg:gap-4", className)}
      data-testid="volumes-view"
    >
      <div className="grid shrink-0 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          horizontal
          horizontalText="stack"
          title="卷总数"
          value={stats.total}
          unit="个"
          secondary={`${stats.totalSlots}盘位`}
          icon={Database}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          horizontal
          horizontalText="stack"
          title="总容量 / 已用"
          value={stats.usedPct}
          unit="%"
          secondary={`${stats.usedCap} / ${stats.totalCap}`}
          icon={HardDrive}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />
        <StatCard
          horizontal
          horizontalText="stack"
          title="已分配盘位"
          value={stats.totalSlots}
          unit="个"
          secondary={`${stats.onlineSlots}在线 / ${stats.totalSlots - stats.onlineSlots}离线`}
          icon={Layers}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          horizontal
          horizontalText="stack"
          title="盘位分配"
          value={`${stats.withAggregate}/${stats.total}`}
          secondary="已完成盘位分配的卷"
          icon={Sparkles}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-3">
        <Card className="flex min-h-0 flex-col gap-0 overflow-hidden py-0 xl:col-span-2">
          <CardHeader className="flex shrink-0 flex-row flex-wrap items-center gap-2 space-y-0 border-b border-slate-100 px-5 !py-3 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索卷 / 站点..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-44"
              />
            </div>
            <Tabs value={typeFilter} onValueChange={setTypeFilter}>
              <TabsList>
                <TabsTrigger value="all">全部</TabsTrigger>
                <TabsTrigger value="optical">光存储</TabsTrigger>
                <TabsTrigger value="magnetic">磁存储</TabsTrigger>
                <TabsTrigger value="tape">磁带</TabsTrigger>
                <TabsTrigger value="composite">组合卷</TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="ml-auto text-xs text-muted-foreground">
              共 {filtered.length} 条
              {loading ? " · 加载中" : ""}
              {error ? " · 加载失败" : ""}
            </span>
          </CardHeader>

          <CardContent className="min-h-0 flex-1 overflow-auto p-0">
            {loading && volumes.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> 加载中...
              </div>
            ) : error && volumes.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-center px-4">
                <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                <p className="text-sm text-slate-600 dark:text-slate-300">存储卷数据加载失败</p>
                <p className="text-xs text-slate-400 mt-1">{error}</p>
                <button
                  onClick={() => void load()}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700 underline underline-offset-2"
                >
                  重试
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-muted-foreground">
                <Box className="h-8 w-8 mb-2" />
                <p className="text-sm">暂无存储卷数据</p>
                {volumes.length === 0 && (
                  <p className="text-xs mt-1">
                    {siteCode ? `站点 ${siteCode} 没有存储卷记录` : "当前权限范围内暂无卷记录"}
                  </p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="w-[28%] text-sm text-slate-500">名称</TableHead>
                    <TableHead className="w-[22%] text-sm text-slate-500">站点</TableHead>
                    <TableHead className="w-[18%] text-sm text-slate-500">类型</TableHead>
                    <TableHead className="text-sm text-slate-500">容量</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v, idx) => {
                    const tb = typeBadge[v.type] ?? typeBadge.composite
                    const TbIcon = tb.icon
                    const totalBytes = parseBytes(v.totalCapacity)
                    const usedBytes = totalBytes != null && parseBytes(v.remainingCapacity) != null
                      ? totalBytes - parseBytes(v.remainingCapacity)!
                      : null
                    const usedPct = totalBytes && totalBytes > 0 && usedBytes != null
                      ? Math.round((usedBytes / totalBytes) * 100)
                      : null
                    const isActive = selected != null && volumeKey(v) === volumeKey(selected)
                    const siteLabel = formatVolumeSiteDisplay(v.siteCode, v.siteName)
                    return (
                      <TableRow
                        key={`volume-${v.siteCode ?? ""}-${v.id ?? "unknown"}-${idx}`}
                        className={cn(
                          "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50",
                          isActive && "bg-blue-50 dark:bg-blue-900/20",
                        )}
                        onClick={() => void openVolume(v)}
                      >
                        <TableCell className="max-w-0 font-medium">
                          <div className="flex min-w-0 items-center gap-2">
                            <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate" title={v.name}>{v.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-0 text-sm text-slate-600 dark:text-slate-300">
                          <span className="block truncate" title={siteLabel}>{siteLabel}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("font-normal", tb.color)}>
                            <TbIcon className="mr-1 h-3 w-3" />
                            {v.typeLabel ?? tb.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0 space-y-1">
                            <div className="truncate text-xs" title={
                              usedBytes != null
                                ? `${v.totalCapacity || "—"} / ${formatBytesAuto(usedBytes)} 用`
                                : (v.totalCapacity || "—")
                            }>
                              {v.totalCapacity || "—"}
                              {usedBytes != null ? ` / ${formatBytesAuto(usedBytes)} 用` : ""}
                            </div>
                            {usedPct != null && (
                              <Progress value={usedPct} className="h-1.5" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <DetailPanel
          className="min-h-0 overflow-hidden xl:col-span-1"
          title={selected ? selected.name : "卷详情"}
          empty={!selected}
          emptyText="点击左侧存储卷查看详情"
          actions={
            selected ? (
              <Button
                size="sm"
                className="h-8 shrink-0 gap-1 text-xs"
                disabled={ssoJumping || !selected.siteCode}
                onClick={() => void handleGoSiteEdit()}
                data-testid="volumes-go-site-edit"
              >
                {ssoJumping ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" />
                )}
                去站点管理
              </Button>
            ) : undefined
          }
        >
          {selected && (
            <div className="space-y-3">
              <Card className="gap-2 py-4 shadow-sm">
                <CardHeader className="px-4 pb-0">
                  <CardTitle className="text-sm">基本信息</CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">站点</div>
                      <div className="font-medium">
                        {formatVolumeSiteDisplay(selected.siteCode, selected.siteName)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">类型</div>
                      <div className="font-medium">
                        {selected.typeLabel ?? typeBadge[selected.type]?.label ?? selected.type}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">总容量</div>
                      <div className="font-medium">{selected.totalCapacity || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">剩余容量</div>
                      <div className="font-medium">{selected.remainingCapacity || "—"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-2 py-4 shadow-sm">
                <CardHeader className="px-4 pb-0">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    盘位分配
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">总数</div>
                      <div className="font-mono font-medium">
                        {selected.aggregate?.slot_count ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">在线</div>
                      <div className="font-mono font-medium text-emerald-600 dark:text-emerald-300">
                        {selected.aggregate?.online_slot_count ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">离线</div>
                      <div className="font-mono font-medium text-slate-500 dark:text-slate-400">
                        {selected.aggregate?.offline_slot_count ?? "—"}
                      </div>
                    </div>
                  </div>

                  {detailLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      加载分配明细…
                    </div>
                  ) : mediaGroups.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      {selected.aggregate
                        ? "暂无各设备盘位明细（需站点已同步卷-盘位关系）"
                        : "该卷暂无盘位分配信息"}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {(Object.keys(OPTICAL_DISC_TYPE_LABELS) as unknown as OpticalDiscType[]).map((k) => {
                          const t = Number(k) as OpticalDiscType
                          const c = OPTICAL_DISC_TYPE_COLORS[t]
                          return (
                            <span key={t} className="inline-flex items-center gap-1">
                              <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", c.swatch)} />
                              {OPTICAL_DISC_TYPE_LABELS[t]}
                            </span>
                          )
                        })}
                      </div>
                      {mediaGroups.map((g) => (
                        <details key={g.key} open className="rounded-md border border-border/60 bg-muted/20">
                          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                            <span className="text-muted-foreground mr-1">▾</span>
                            {g.title}
                          </summary>
                          <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                            {g.cells.map((cell) => {
                              const dt = normalizeOpticalDiscType(cell.discType)
                              const colors = dt != null
                                ? OPTICAL_DISC_TYPE_COLORS[dt]
                                : OPTICAL_DISC_TYPE_COLORS[0]
                              return (
                                <div
                                  key={`${g.key}-${cell.slotId}`}
                                  title={dt != null ? OPTICAL_DISC_TYPE_LABELS[dt] : undefined}
                                  className={cn(
                                    "flex h-9 min-w-10 items-center justify-center rounded-md border px-1.5 text-xs font-medium tabular-nums",
                                    colors.bg,
                                    colors.text,
                                    colors.border,
                                  )}
                                >
                                  {cell.displayNo}
                                </div>
                              )
                            })}
                          </div>
                        </details>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground">
                编辑请到对应站点完成；点击「去站点管理」将打开该站存储卷管理页。
              </p>
            </div>
          )}
        </DetailPanel>
      </div>
    </div>
  )
}
