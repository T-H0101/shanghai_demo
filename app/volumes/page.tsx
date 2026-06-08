"use client"

/**
 * /volumes 页面
 * Sprint 2H.3 (autonomous) - Volumes 真实数据展示
 *
 * 数据来源:
 *  - API mode: GET /api/volumes?siteCode=XXX
 *  - 数据源: unified_volumes (来自 tbl_logical_volume + 2H.3 聚合的 tbl_volume_slot 数据)
 *  - 跟随全局 siteCode (Header 站点选择器)
 *
 * 展示:
 *  - 顶部 4 个统计 tile (总数 / 总容量 / 盘位总数 / 在线盘位)
 *  - 列表: 容量条 + 盘位占用条 + 状态徽章 + 聚合数据
 *  - drawer 详情: 包含 _aggregate 真实数据
 */

import { useEffect, useMemo, useState, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { StatCard } from "@/components/platform/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Database, HardDrive, Layers, Server, Activity, Search, RefreshCw,
  ChevronRight, Info, Disc, CircleDashed, CheckCircle2, AlertTriangle,
  Wrench, Clock, Cpu, XCircle, Box, Eye, Filter, Sparkles,
} from "lucide-react"
import { useSite } from "@/lib/site/site-context"
import { isApiMode } from "@/lib/api"
import { fetchVolumes } from "@/lib/api/api-providers"
import type { VolumeDTO } from "@/lib/api/dto"
import { cn } from "@/lib/utils"

const typeBadge: Record<string, { label: string; color: string; icon: typeof Disc }> = {
  optical: { label: "光盘卷", color: "bg-violet-100 text-violet-700", icon: Disc },
  magnetic: { label: "磁卷", color: "bg-blue-100 text-blue-700", icon: HardDrive },
  composite: { label: "复合卷", color: "bg-amber-100 text-amber-700", icon: Layers },
}

const statusBadge: Record<string, { label: string; color: string }> = {
  online: { label: "在线", color: "bg-emerald-100 text-emerald-700" },
  offline: { label: "离线", color: "bg-slate-100 text-slate-600" },
  archiving: { label: "归档中", color: "bg-cyan-100 text-cyan-700" },
  error: { label: "异常", color: "bg-red-100 text-red-700" },
  warning: { label: "告警", color: "bg-amber-100 text-amber-700" },
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
  return `${n.toFixed(1)} ${units[i]}`
}

export default function VolumesPage() {
  return (
    <Suspense fallback={null}>
      <VolumesContent />
    </Suspense>
  )
}

function VolumesContent() {
  const { siteCode, isReady: siteReady } = useSite()
  const searchParams = useSearchParams()
  const [volumes, setVolumes] = useState<VolumeDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [selected, setSelected] = useState<VolumeDTO | null>(null)
  const [source, setSource] = useState<"database" | "fallback" | "unknown">("unknown")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchVolumes(siteCode ?? undefined)
      // fetchVolumes 返回 ApiResponse 解包后的 { code, message, data, source, traceId } 或 mock array
      // 容错处理
      if (Array.isArray(result)) {
        setVolumes(result)
        setSource("fallback")
      } else if (result && typeof result === "object" && "data" in result) {
        setVolumes(((result as any).data ?? []) as VolumeDTO[])
        setSource(((result as any).source as any) ?? "database")
      } else {
        setVolumes([])
        setSource("unknown")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown")
    } finally {
      setLoading(false)
    }
  }, [siteCode])

  useEffect(() => {
    if (siteReady) load()
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
        if (
          !(v.name || "").toLowerCase().includes(s) &&
          !(v.id || "").toLowerCase().includes(s) &&
          !(v.info || "").toLowerCase().includes(s)
        ) {
          return false
        }
      }
      return true
    })
  }, [volumes, search, typeFilter])

  return (
    <AppShell>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <PageHeader
          title="存储卷管理"
          description={`Sprint 2H.3: unified_volumes 真实数据 (${stats.total} 卷${stats.withAggregate > 0 ? `, ${stats.withAggregate} 个有盘位聚合` : ""}) · ${siteCode ?? "All Sites"}`}
          actions={
            <Button onClick={load} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              刷新
            </Button>
          }
        />

        {/* 数据源徽章 */}
        {isApiMode && (
          <div className="flex items-center gap-2">
            <Badge variant={source === "database" ? "default" : "secondary"}>
              <Database className="mr-1 h-3 w-3" />
              {source === "database" ? "DB" : source === "fallback" ? "FALLBACK" : "..."}
            </Badge>
            {error && (
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3" />
                加载失败: {error}
              </Badge>
            )}
          </div>
        )}

        {/* 顶部统计 tile */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="卷总数"
            value={String(stats.total)}
            icon={Database}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            footer={`${stats.totalSlots} 盘位 (来自 tbl_volume_slot 聚合)`}
          />
          <StatCard
            title="总容量 / 已用"
            value={`${stats.usedPct}%`}
            icon={HardDrive}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            footer={`${stats.usedCap} / ${stats.totalCap}`}
          />
          <StatCard
            title="盘位 (聚合)"
            value={String(stats.totalSlots)}
            icon={Layers}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            footer={`${stats.onlineSlots} 在线 / ${stats.totalSlots - stats.onlineSlots} 离线`}
          />
          <StatCard
            title="聚合覆盖"
            value={`${stats.withAggregate}/${stats.total}`}
            icon={Sparkles}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            footer="来自 unified_volumes.raw_data._aggregate"
          />
        </div>

        {/* 列表 + 筛选 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">卷列表</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜索卷..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 w-44"
                />
              </div>
              <Tabs value={typeFilter} onValueChange={setTypeFilter}>
                <TabsList>
                  <TabsTrigger value="all">全部</TabsTrigger>
                  <TabsTrigger value="optical">光盘</TabsTrigger>
                  <TabsTrigger value="magnetic">磁卷</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> 加载中...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Database className="h-8 w-8 mb-2" />
                <p className="text-sm">无数据</p>
                {volumes.length === 0 && !loading && (
                  <p className="text-xs mt-1">{siteCode ? `站点 ${siteCode} 没有统一表数据` : "未选择站点"}</p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>容量</TableHead>
                    <TableHead>盘位 (聚合)</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>同步时间</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => {
                    const tb = typeBadge[v.type] ?? typeBadge.composite
                    const TbIcon = tb.icon
                    const totalBytes = parseBytes(v.totalCapacity)
                    const usedBytes = totalBytes != null && parseBytes(v.remainingCapacity) != null
                      ? totalBytes - parseBytes(v.remainingCapacity)!
                      : null
                    const usedPct = totalBytes && totalBytes > 0 && usedBytes != null
                      ? Math.round((usedBytes / totalBytes) * 100)
                      : null
                    return (
                      <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(v)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div>{v.name}</div>
                              <div className="text-xs text-muted-foreground">{v.id}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("font-normal", tb.color)}>
                            <TbIcon className="mr-1 h-3 w-3" />
                            {tb.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 min-w-32">
                            <div className="text-xs">
                              {v.totalCapacity || "—"} {usedBytes != null ? `/ ${formatBytesAuto(usedBytes)} 用` : ""}
                            </div>
                            {usedPct != null && (
                              <Progress value={usedPct} className="h-1.5" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {v.aggregate?.slot_count != null ? (
                            <div className="text-xs space-y-0.5">
                              <div className="font-medium">
                                {v.aggregate.slot_count} 盘位
                              </div>
                              <div className="text-muted-foreground">
                                {v.aggregate.online_slot_count ?? 0} 在线 · {v.aggregate.offline_slot_count ?? 0} 离线
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {v.info.split("·").pop()?.trim() || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {v.info.includes("同步") ? v.info.split("同步")[1]?.trim().split("·")[0] : "—"}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 详情 drawer */}
        <Drawer open={!!selected} onOpenChange={(open) => !open && setSelected(null)} direction="right">
          <DrawerContent className="h-full w-full sm:max-w-xl">
            {selected && (
              <>
                <DrawerHeader>
                  <DrawerTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    {selected.name}
                  </DrawerTitle>
                  <DrawerDescription>
                    {selected.id} · {typeBadge[selected.type]?.label ?? selected.type}
                  </DrawerDescription>
                </DrawerHeader>
                <ScrollArea className="flex-1 px-6 pb-6">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">容量</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3 text-sm">
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

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                          盘位聚合 (Sprint 2H.3)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selected.aggregate ? (
                          <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <div className="text-muted-foreground text-xs">盘位总数</div>
                                <div className="font-mono font-medium">
                                  {selected.aggregate.slot_count ?? "—"}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground text-xs">在线</div>
                                <div className="font-mono font-medium text-emerald-600">
                                  {selected.aggregate.online_slot_count ?? "—"}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground text-xs">离线</div>
                                <div className="font-mono font-medium text-slate-500">
                                  {selected.aggregate.offline_slot_count ?? "—"}
                                </div>
                              </div>
                            </div>
                            <Separator />
                            <div className="text-xs text-muted-foreground">
                              <div>来源: <span className="font-mono">{selected.aggregate.source_table}</span></div>
                              {selected.aggregate.aggregated_at && (
                                <div>聚合时间: <span className="font-mono">{selected.aggregate.aggregated_at}</span></div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            该卷未参与 tbl_volume_slot 聚合 (源端无数据或未推送)
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">元信息</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs text-muted-foreground space-y-1">
                          {selected.info.split("·").map((part, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <CircleDashed className="h-3 w-3" />
                              <span className="font-mono">{part.trim()}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </>
            )}
          </DrawerContent>
        </Drawer>
      </div>
    </AppShell>
  )
}
