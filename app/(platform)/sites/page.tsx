"use client"

import { useState, useEffect, useMemo } from "react"
import { PageHeader } from "@/components/platform/page-header"
import { StatCard } from "@/components/platform/stat-card"
import { DetailPanel, DetailRow } from "@/components/platform/detail-panel"
import { OnlineStatusBadge, SyncStatusBadge } from "@/components/platform/status-badges"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { AppTooltip } from "@/components/shared/tooltip"
import { formatBeijingTime } from "@/components/shared/time-format"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import type { Site } from "@/lib/types/site"
import { LayoutGrid, Server, RefreshCw, AlertTriangle, ExternalLink, Search, Loader2, ShieldCheck, MapPinned } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { SiteDTO } from "@/lib/api/dto"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SiteRegionsPanel } from "@/components/sites/site-regions-panel"

/**
 * /sites 页面 — Sprint R.82 中心库治理
 *
 * 改造前 (R.8A-1 之前):
 *   - 硬编码 `import { sites as mockSites }`
 *   - useState 直接灌入 6 个 mock 站点 (上海/北京/广州/成都/南京/武汉)
 *   - 全量 setTimeout 假操作 (handleSync / handleToggleStatus / handleCreateSite)
 *   - mockSiteProvider.checkConsistency 假报告
 *
 * 当前口径:
 *   - 调用 GET /api/sites 真实接口
 *   - dataSource 显式: database / empty / error (不允许 mock 静默 fallback)
 *   - 站点列表只统计 sync_sites 注册站点
 *   - Tab「站点区域」：总控维护区域主数据并挂靠业务站点（sprint-r103）
 *   - 业务表里未注册 siteCode 仅作为 meta.orphanSiteCodes 数据质量证据
 *   - 不提供站点业务系统启停 (Power)
 *   - SSO：有真实 db_host:db_port 时可跳转（近期 ticket，见 docs/source/site-sso-jump-v1.md）
 *   - 一致性校验入口已隐藏（只读易误导）；结果见 /sync 与日志检索「一致性」
 */

type SiteStatusFilter = "all" | "online" | "offline"
type DataSource = "database" | "empty" | "error" | "loading"

interface ApiEnvelope {
  code: number
  message: string
  data: SiteDTO[]
  dataSource: DataSource
  source: string
  meta?: {
    reason?: string
    orphanSiteCodes?: Array<{ site_code: string; task_count: number; device_count: number; volume_count: number; package_count: number }>
    requirement?: { id: string; text: string; status: string }
  }
  traceId?: string
}

// 把 /api/sites 的 SiteDTO 转成前端 Site (缺失展示字段统一显示 —)
function toSite(dto: SiteDTO): Site & {
  reachabilityNote?: string
  reachabilitySource?: string
  ssoEnabled?: boolean
  regionCode?: string | null
} {
  return {
    id: dto.id,
    name: dto.name,
    code: dto.code,
    status: (dto.status as Site["status"]) ?? "offline",
    ip: dto.ip || "—",
    port: dto.port || 0,
    datacenter: dto.datacenter || "—",
    contact: dto.contact || "—",
    contactPhone: dto.contactPhone || "—",
    deviceCount: dto.deviceCount ?? 0,
    lastSyncAt: (() => {
      if (!dto.lastSyncAt) return "—"
      const formatted = formatBeijingTime(dto.lastSyncAt)
      return formatted || "—"
    })(),
    syncStatus: dto.syncStatus ?? "pending",
    storageUsedPercent: dto.storageUsedPercent ?? 0,
    storageTotal: dto.storageTotal || "—",
    storageUsed: dto.storageUsed || "—",
    region: dto.region || "—",
    regionCode: dto.regionCode ?? null,
    ssoEnabled: dto.ssoEnabled ?? false,
    rackCount: dto.rackCount,
    onlineRackCount: dto.onlineRackCount,
    cageCount: dto.cageCount,
    totalSlots: dto.totalSlots,
    usedSlots: dto.usedSlots,
    taskCount: dto.taskCount,
    description: dto.description,
    reachabilityNote: dto.reachabilityNote,
    reachabilitySource: dto.reachabilitySource,
  }
}

type SiteRow = ReturnType<typeof toSite>

export default function Page() {
  const [sites, setSites] = useState<SiteRow[]>([])
  const [selected, setSelected] = useState<SiteRow | null>(null)
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState<SiteStatusFilter>("all")
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<DataSource>("loading")
  const [source, setSource] = useState<string>("")
  const [meta, setMeta] = useState<ApiEnvelope["meta"]>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  // 一致性入口已隐藏（只读易误导）；保留逻辑便于恢复
  // const [checking, setChecking] = useState(false)
  // const [showConsistencyResult, setShowConsistencyResult] = useState(false)
  // const [consistencyReport, setConsistencyReport] = useState<any>(null)
  const [showOrphanDetail, setShowOrphanDetail] = useState(false)
  const [orphanDetail, setOrphanDetail] = useState<Array<{ site_code: string; sources: { tasks: number; devices: number; volumes: number; packages: number } }>>([])
  const [orphanLoading, setOrphanLoading] = useState(false)
  const [mainTab, setMainTab] = useState<"sites" | "regions">("sites")
  const [regionsRefreshKey, setRegionsRefreshKey] = useState(0)

  const loadOrphanDetail = async () => {
    setOrphanLoading(true)
    try {
      const res = await fetch("/api/sites/orphans", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setOrphanDetail(Array.isArray(json.data) ? json.data : [])
    } catch (e) {
      setOrphanDetail([])
    } finally {
      setOrphanLoading(false)
    }
  }

  useEffect(() => {
    if (showOrphanDetail) loadOrphanDetail()
  }, [showOrphanDetail])

  // 真实加载 /api/sites
  const loadSites = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/sites", { cache: "no-store", credentials: "include" })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`HTTP ${res.status}${txt ? `: ${txt.slice(0, 100)}` : ""}`)
      }
      const json = (await res.json()) as ApiEnvelope
      setDataSource(json.dataSource)
      setSource(json.source || "")
      setMeta(json.meta)
      const list = Array.isArray(json.data) ? json.data : []
      const mapped = list.map(toSite)
      setSites(mapped)
    } catch (e) {
      setDataSource("error")
      setLoadError(e instanceof Error ? e.message : String(e))
      setSites([])
      setSelected(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSites()
  }, [])

  const stats = useMemo(() => {
    const onlineCount = sites.filter((s) => s.status === "online").length
    const offlineCount = sites.filter((s) => s.status === "offline").length
    const syncingCount = sites.filter((s) => s.syncStatus === "syncing").length
    const devices = sites.reduce((sum, s) => sum + (s.deviceCount || 0), 0)
    return {
      total: sites.length,
      online: onlineCount,
      offline: offlineCount,
      syncing: syncingCount,
      deviceCount: devices,
    }
  }, [sites])

  const filtered = useMemo(() => sites.filter((s) => {
    const matchKeyword = !keyword ||
      s.name.includes(keyword) ||
      s.code.toLowerCase().includes(keyword.toLowerCase()) ||
      (s.ip !== "—" && s.ip.includes(keyword))
    const matchStatus = statusFilter === "all" || s.status === statusFilter
    return matchKeyword && matchStatus
  }), [sites, keyword, statusFilter])

  useEffect(() => {
    if (filtered.length === 0) {
      setSelected(null)
      return
    }
    if (!selected || !filtered.some((s) => s.id === selected.id)) {
      setSelected(filtered[0])
    }
  }, [filtered, selected])

  // 写操作 — 注册入口已隐藏
  // const handleUnsupported = (feature: string) => {
  //   toast({
  //     title: "功能未接入",
  //     description: `${feature}：站点登记功能未接入，当前仅提供列表与一致性校验。`,
  //     variant: "destructive",
  //   })
  // }

  const [ssoJumping, setSsoJumping] = useState<string | null>(null)

  const handleSsoJump = async (site: SiteRow) => {
    if (!site.ssoEnabled && (site.ip === "—" || !site.port)) {
      toast({
        title: "无法 SSO 跳转",
        description: `${site.code} 未登记真实管理 IP:端口，请先由站点推送 db_host/db_port`,
        variant: "destructive",
      })
      return
    }
    setSsoJumping(site.code)
    try {
      const res = await fetch(`/api/sites/${encodeURIComponent(site.code)}/sso`, {
        cache: "no-store",
        credentials: "include",
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 401) {
        toast({
          title: "请先登录总控",
          description: "SSO 跳转需要总控登录会话",
          variant: "destructive",
        })
        return
      }
      if (!res.ok) {
        toast({
          title: "SSO 跳转失败",
          description: json.message || `HTTP ${res.status}`,
          variant: "destructive",
        })
        return
      }
      if (json.status !== "ready" || !json.jumpUrl) {
        toast({
          title: "SSO 跳转未就绪",
          description: json.message || json.blocker || "站点侧或密钥未配置",
          variant: "destructive",
        })
        return
      }
      toast({
        title: "正在打开站点",
        description: `已签发跳转票据 → ${site.name}（${site.code}）`,
      })
      window.open(json.jumpUrl, "_blank", "noopener,noreferrer")
    } catch (e) {
      toast({
        title: "SSO 跳转失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setSsoJumping(null)
    }
  }

  // 一致性校验入口已隐藏 — 仅只读最近一次 log，不写操作日志；请用 /sync 与日志检索「一致性」
  // const handleCheckConsistency = async (site: SiteRow) => {
  //   setChecking(true)
  //   try {
  //     const res = await fetch(`/api/sync/consistency?siteCode=${encodeURIComponent(site.code)}`, { cache: "no-store" })
  //     if (!res.ok) {
  //       const fallback = await fetch("/api/sync/consistency", { cache: "no-store" })
  //       if (!fallback.ok) throw new Error(`HTTP ${res.status}`)
  //       const data = await fallback.json()
  //       setConsistencyReport(data.data ?? data)
  //       setShowConsistencyResult(true)
  //       return
  //     }
  //     const data = await res.json()
  //     setConsistencyReport(data.data ?? data)
  //     setShowConsistencyResult(true)
  //     toast({
  //       title: "校验完成",
  //       description: `${site.code} 数据一致性校验已完成`,
  //     })
  //   } catch (e) {
  //     toast({
  //       title: "校验失败",
  //       description: "数据一致性校验失败，请稍后重试",
  //       variant: "destructive",
  //     })
  //   } finally {
  //     setChecking(false)
  //   }
  // }

  // dataSource 标识徽章（状态行暂不展示，保留逻辑便于恢复）
  // const dataSourceBadge = (() => {
  //   if (dataSource === "database") {
  //     return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"><Database className="h-3 w-3 mr-1" />已注册</Badge>
  //   }
  //   if (dataSource === "empty") {
  //     return <Badge className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">暂无数据</Badge>
  //   }
  //   if (dataSource === "error") {
  //     return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">加载失败</Badge>
  //   }
  //   return <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">加载中…</Badge>
  // })()

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden p-4 lg:p-6">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:gap-4">
        <div className="shrink-0">
          <PageHeader
            title="站点管理"
            description="统一管理各数据中心业务站点与站点区域；在线状态依据管理 IP:端口 TCP 探测"
            badge="SITE MGMT"
            actions={
              <div className="flex items-center gap-2">
                <AppTooltip content="重新拉取站点列表, 检查最新状态">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => {
                      void loadSites()
                      setRegionsRefreshKey((k) => k + 1)
                    }}
                    disabled={loading}
                    data-testid="sites-refresh"
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    刷新
                  </Button>
                </AppTooltip>
              </div>
            }
          />
        </div>

      <Tabs
        value={mainTab}
        onValueChange={(v) => setMainTab(v as "sites" | "regions")}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
      >
        <TabsList className="h-9 w-fit shrink-0">
          <TabsTrigger value="sites" className="text-xs" data-testid="sites-tab-list">
            <Server className="mr-1 h-3.5 w-3.5" />
            站点列表
          </TabsTrigger>
          <TabsTrigger value="regions" className="text-xs" data-testid="sites-tab-regions">
            <MapPinned className="mr-1 h-3.5 w-3.5" />
            站点区域
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regions" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <SiteRegionsPanel
            key={regionsRefreshKey}
            availableSites={sites.map((s) => ({ code: s.code, name: s.name }))}
            className="min-h-0 flex-1"
            onChanged={() => void loadSites()}
          />
        </TabsContent>

        <TabsContent value="sites" className="mt-0 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden data-[state=inactive]:hidden">
      {meta?.orphanSiteCodes && meta.orphanSiteCodes.length > 0 && (
        <div className="flex shrink-0 flex-col sm:flex-row sm:items-center gap-2 px-1">
          <span className="text-xs text-slate-500">
            检测到 {meta.orphanSiteCodes.length} 个未注册历史 siteCode，未计入站点总数
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            data-testid="orphan-detail-trigger"
            onClick={() => setShowOrphanDetail(true)}
          >
            查看明细
          </Button>
        </div>
      )}

      <div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          horizontal
          title="站点总数"
          value={stats.total}
          unit="个站点"
          icon={LayoutGrid}
        />
        <StatCard
          horizontal
          title="同步中站点"
          value={stats.syncing}
          unit="个"
          icon={RefreshCw}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          horizontal
          title="设备总数"
          value={stats.deviceCount}
          unit="台"
          icon={Server}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        />
        <StatCard
          horizontal
          title="离线站点"
          value={stats.offline}
          unit="需关注"
          icon={AlertTriangle}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-3">
        <Card className="flex min-h-0 flex-col gap-0 overflow-hidden xl:col-span-2">
          <CardHeader className="shrink-0 border-b border-slate-100 pb-3 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Server className="h-4 w-4 text-slate-500" />
                站点列表
                <span className="text-sm font-normal text-muted-foreground">
                  共 {filtered.length} 个
                  {dataSource === "empty" ? " · 暂无数据" : ""}
                  {dataSource === "error" ? " · 加载失败" : ""}
                </span>
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SiteStatusFilter)}>
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="online">在线</SelectItem>
                    <SelectItem value="offline">离线</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder="搜索站点、编码、IP..." className="pl-9 h-8" value={keyword} onChange={(e) => setKeyword(e.target.value)} aria-label="搜索站点" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-auto p-0">
            {loadError && dataSource === "error" ? (
              <div className="text-center py-8 text-red-600">
                <AlertTriangle className="h-10 w-10 mx-auto mb-2" />
                <p className="font-medium">加载站点列表失败</p>
                <p className="text-sm text-slate-500 mt-1">{loadError}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={loadSites}>重试</Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {dataSource === "empty" ? (
                  <>
                    <Server className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                    <p>暂无站点数据</p>
                    <p className="text-xs mt-1">暂无注册站点，也没有可自动发现的业务记录。</p>
                  </>
                ) : (
                  <p>未找到匹配的站点</p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white dark:bg-slate-800">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-sm text-slate-500">所属区域</TableHead>
                    <TableHead className="text-sm text-slate-500">站点</TableHead>
                    <TableHead className="text-sm text-slate-500">状态</TableHead>
                    <TableHead className="text-sm text-slate-500">IP:端口</TableHead>
                    <TableHead className="text-sm text-slate-500">设备</TableHead>
                    <TableHead className="text-sm text-slate-500">同步</TableHead>
                    <TableHead className="text-sm text-slate-500">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((site, idx) => (
                    <TableRow
                      key={`site-${site.id}-${idx}`}
                      className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selected?.id === site.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                      onClick={() => setSelected(site)}
                    >
                      <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                        {site.region && site.region !== "—" ? site.region : (
                          <span className="text-slate-400">未归属</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{site.name}</p>
                        <p className="text-xs text-slate-400">{site.code}</p>
                      </TableCell>
                      <TableCell>
                        <AppTooltip content={site.reachabilityNote || "在线状态依据管理 IP:端口 TCP 探测"}>
                          <span>
                            <OnlineStatusBadge status={site.status} />
                          </span>
                        </AppTooltip>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{site.ip}:{site.port || "—"}</TableCell>
                      <TableCell className="text-sm">{site.deviceCount}</TableCell>
                      <TableCell>
                        <SyncStatusBadge status={site.syncStatus} />
                        <p className="text-xs text-slate-400 mt-1">{site.lastSyncAt}</p>
                      </TableCell>
                      <TableCell>
                        <AppTooltip
                          content={
                            site.ssoEnabled
                              ? "免登打开站点业务系统（近期 ticket）；站点退出后应返回本页"
                              : "需站点推送真实 db_host:db_port 后才可 SSO"
                          }
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={!site.ssoEnabled || ssoJumping === site.code}
                            title={site.ssoEnabled ? "SSO 跳转" : "未登记管理地址"}
                            data-testid="sites-sso"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleSsoJump(site)
                            }}
                          >
                            {ssoJumping === site.code ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <ExternalLink className="h-3 w-3 mr-1" />
                            )}
                            SSO
                          </Button>
                        </AppTooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <DetailPanel
          className="min-h-0 overflow-hidden xl:col-span-1"
          title="站点详情"
          subtitle={selected?.code}
          empty={!selected}
          emptyText="点击左侧站点查看详情"
        >
          {selected && (
            <div className="space-y-4">
              <DetailRow label="站点名称" value={selected.name} />
              <DetailRow
                label="所属区域"
                value={
                  selected.region && selected.region !== "—"
                    ? `${selected.region}${selected.regionCode ? ` (${selected.regionCode})` : ""}`
                    : "未归属"
                }
              />
              <DetailRow label="IP:端口" value={
                selected.ip && selected.ip !== "—"
                  ? `${selected.ip}:${selected.port || "—"}`
                  : "—"
              } />
              <DetailRow label="在线状态" value={
                <AppTooltip content={selected.reachabilityNote || "在线状态依据管理 IP:端口 TCP 探测"}>
                  <span>
                    <OnlineStatusBadge status={selected.status} />
                  </span>
                </AppTooltip>
              } />
              {selected.reachabilitySource && (
                <p className="text-xs text-slate-500">
                  判定来源：
                  {selected.reachabilitySource === "tcp_probe" && "管理端口 TCP 探测"}
                  {selected.reachabilitySource === "no_address" && "未登记管理地址"}
                  {selected.reachabilitySource === "disabled" && "总控已禁用"}
                  {selected.reachabilitySource === "probe_error" && "探测未执行"}
                </p>
              )}
              {selected.reachabilityNote && (
                <p className="text-xs text-slate-400">{selected.reachabilityNote}</p>
              )}
              <DetailRow label="同步状态" value={<SyncStatusBadge status={selected.syncStatus} />} />
              <DetailRow label="最后同步" value={selected.lastSyncAt} />
              <DetailRow label="存储总量" value={selected.storageTotal} />
              <DetailRow label="已用存储" value={`${selected.storageUsed} (${selected.storageUsedPercent}%)`} />
              {selected.storageUsedPercent > 0 && <Progress value={selected.storageUsedPercent} className="h-2" />}
              <DetailRow label="设备数量" value={`${selected.deviceCount} 台`} />
              <DetailRow
                label="盘架数量"
                value={
                  selected.rackCount != null
                    ? `${selected.rackCount} 个（${selected.onlineRackCount ?? 0} 在线）`
                    : "—"
                }
              />
              <DetailRow
                label="盘笼数量"
                value={selected.cageCount != null ? `${selected.cageCount} 个` : "—"}
              />
              <DetailRow
                label="槽位总数"
                value={
                  selected.totalSlots != null
                    ? `${selected.totalSlots} 槽位（${selected.usedSlots ?? 0} 已占用）`
                    : "—"
                }
              />
              <DetailRow label="活跃任务" value={selected.taskCount ?? 0} />
              {selected.description && (
                <p className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg p-3">{selected.description}</p>
              )}
              {/* 站点页仅只读最近一次校验结果，易与「点即校验」混淆；一致性请看 /sync 与日志检索「一致性」
              <AppTooltip content="校验中心库与源站点的数据一致性, 找出差异行">
                <Button
                  variant="outline"
                  className="w-full h-8 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  size="sm"
                  onClick={() => handleCheckConsistency(selected)}
                  disabled={checking}
                  data-testid="sites-consistency"
                >
                  {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                  数据一致性校验
                </Button>
              </AppTooltip>
              */}
            </div>
          )}
        </DetailPanel>
      </div>
        </TabsContent>
      </Tabs>
      </div>

      {/*
      <Dialog open={showConsistencyResult} onOpenChange={setShowConsistencyResult}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>数据一致性校验报告</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {consistencyReport && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">校验时间</span>
                  <span className="text-sm text-slate-600">
                    <TimeDisplay value={consistencyReport.checkedAt} mode="datetime" />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">校验结果</span>
                  <Badge
                    className={
                      consistencyReport.status === "matched"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : consistencyReport.status === "mismatched"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }
                  >
                    {consistencyReport.status === "matched"
                      ? "数据一致"
                      : consistencyReport.status === "mismatched"
                      ? "发现差异"
                      : consistencyReport.status || "未知"}
                  </Badge>
                </div>
                {consistencyReport.tables && Array.isArray(consistencyReport.tables) && consistencyReport.tables.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">同步差异详情</p>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {consistencyReport.tables.map((t: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded border border-slate-100 text-xs">
                          <span>检查项 {idx + 1}</span>
                          <span className="text-slate-500">
                            站点 {t.sourceCount ?? t.source_count ?? "—"} / 总控 {t.unifiedCount ?? t.unified_count ?? "—"} / 差异 {t.countDiff ?? t.count_diff ?? "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : consistencyReport.issues && consistencyReport.issues.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">差异详情</p>
                    {consistencyReport.issues.map((issue: any, idx: number) => (
                      <div key={idx} className={`p-3 rounded-lg border ${issue.severity === "error" ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-xs">{issue.type}</Badge>
                          <Badge variant="outline" className={`text-xs ${issue.severity === "error" ? "text-red-600 dark:text-red-300 border-red-300 dark:border-red-700" : "text-amber-600 dark:text-amber-300 border-amber-300 dark:border-amber-700"}`}>
                            {issue.severity === "error" ? "错误" : "警告"}
                          </Badge>
                        </div>
                        <p className="text-sm">{issue.message}</p>
                        <p className="text-xs text-slate-500 mt-1">影响数量：{issue.affectedCount} 条</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-emerald-600 dark:text-emerald-300">
                    <ShieldCheck className="h-12 w-12 mx-auto mb-2" />
                    <p className="font-medium">数据完全一致</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">该站点数据与统一平台无差异</p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowConsistencyResult(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      */}

      <Dialog open={showOrphanDetail} onOpenChange={setShowOrphanDetail}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>未注册 siteCode 明细</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {orphanLoading ? (
              <p className="text-sm text-slate-500">加载中…</p>
            ) : orphanDetail.length === 0 ? (
              <div className="text-center py-6 text-emerald-600 dark:text-emerald-300">
                <ShieldCheck className="h-12 w-12 mx-auto mb-2" />
                <p className="font-medium">无未注册 siteCode</p>
                <p className="text-xs text-slate-500 mt-1">中心库业务表与 sync_sites 注册表完全一致</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-1">
                {orphanDetail.map((o) => (
                  <div key={o.site_code} className="flex items-center justify-between p-2 rounded border border-slate-100 dark:border-slate-800 text-xs">
                    <span className="font-mono font-medium">{o.site_code}</span>
                    <span className="text-slate-500">
                      tasks={o.sources.tasks} / devices={o.sources.devices} / volumes={o.sources.volumes} / packages={o.sources.packages}
                    </span>
                    <span className="text-red-600 dark:text-red-400 text-[10px]">未计入站点总数</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500">
                清理需执行: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">pnpm cleanup:test-pollution -- --apply</code>
              </span>
              <Button onClick={() => setShowOrphanDetail(false)}>关闭</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
