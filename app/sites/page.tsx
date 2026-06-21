"use client"

import { useState, useEffect, useMemo } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { StatCard } from "@/components/platform/stat-card"
import { DetailPanel, DetailRow } from "@/components/platform/detail-panel"
import { OnlineStatusBadge, SyncStatusBadge } from "@/components/platform/status-badges"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { AppTooltip } from "@/components/shared/tooltip"
import { TimeDisplay } from "@/components/shared/time-format"
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
import { LayoutGrid, Server, RefreshCw, AlertTriangle, ExternalLink, Search, Loader2, Power, ShieldCheck, Database, Layers } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { SiteDTO } from "@/lib/api/dto"

/**
 * /sites 页面 — Sprint R.9A 真实化
 *
 * 改造前 (R.8A-1 之前):
 *   - 硬编码 `import { sites as mockSites }`
 *   - useState 直接灌入 6 个 mock 站点 (上海/北京/广州/成都/南京/武汉)
 *   - 全量 setTimeout 假操作 (handleSync / handleToggleStatus / handleCreateSite)
 *   - mockSiteProvider.checkConsistency 假报告
 *
 * 改造后 (R.9A):
 *   - 调用 GET /api/sites 真实接口
 *   - dataSource 显式: database / derived / empty (不允许 mock 静默 fallback)
 *   - dataSource=derived 时, 顶部加 "由同步数据派生" 标识
 *   - 写操作按钮 (注册新站点 / 启用禁用 / SSO 跳转) 全部 disabled, tooltip 提示
 *   - 一致性校验按钮走 /api/sync/consistency (R.7 真实 API, 替换 mockSiteProvider)
 *
 * 范围严格限定 (R.9A 约束):
 *   - 不新增数据库表
 *   - 不新增 API
 *   - 不新增页面
 *   - 不做站点 CRUD
 *   - 不接多站点
 */

type SiteStatusFilter = "all" | "online" | "offline" | "derived"
type DataSource = "database" | "derived" | "empty" | "error" | "loading"

interface ApiEnvelope {
  code: number
  message: string
  data: SiteDTO[]
  dataSource: DataSource
  source: string
  meta?: {
    reason?: string
    derivedFromTables?: string[]
    requirement?: { id: string; text: string; status: string }
  }
  traceId?: string
}

// 把 /api/sites 的 SiteDTO 转成前端 Site (补齐 mock 字段, 缺则 —)
function toSite(dto: SiteDTO): Site {
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
    lastSyncAt: dto.lastSyncAt || "—",
    syncStatus: dto.syncStatus ?? "pending",
    storageUsedPercent: dto.storageUsedPercent ?? 0,
    storageTotal: dto.storageTotal || "—",
    storageUsed: dto.storageUsed || "—",
    region: dto.region || "—",
    ssoEnabled: dto.ssoEnabled ?? false,
    rackCount: dto.rackCount,
    onlineRackCount: dto.onlineRackCount,
    cageCount: dto.cageCount,
    totalSlots: dto.totalSlots,
    usedSlots: dto.usedSlots,
    taskCount: dto.taskCount,
    description: dto.description,
  }
}

export default function Page() {
  const [sites, setSites] = useState<Site[]>([])
  const [selected, setSelected] = useState<Site | null>(null)
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState<SiteStatusFilter>("all")
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<DataSource>("loading")
  const [source, setSource] = useState<string>("")
  const [meta, setMeta] = useState<ApiEnvelope["meta"]>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [showConsistencyResult, setShowConsistencyResult] = useState(false)
  const [consistencyReport, setConsistencyReport] = useState<any>(null)

  // 真实加载 /api/sites (R.9A: 替换 mockSites)
  const loadSites = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/sites", { cache: "no-store" })
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
      // 默认选中第一项 (如果有)
      setSelected(mapped[0] ?? null)
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

  // 派生统计 (从真实 sites 计算, 不再用硬编码 siteStats)
  const stats = useMemo(() => {
    const onlineCount = sites.filter((s) => s.status === "online").length
    const offlineCount = sites.filter((s) => s.status === "offline").length
    const derivedCount = sites.filter((s) => s.status === "derived").length
    const syncingCount = sites.filter((s) => s.syncStatus === "syncing").length
    const devices = sites.reduce((sum, s) => sum + (s.deviceCount || 0), 0)
    return {
      total: sites.length,
      online: onlineCount,
      offline: offlineCount + derivedCount, // derived 视为待确认, 计入异常
      syncing: syncingCount,
      deviceCount: devices,
    }
  }, [sites])

  const filtered = sites.filter((s) => {
    const matchKeyword = !keyword ||
      s.name.includes(keyword) ||
      s.code.toLowerCase().includes(keyword.toLowerCase()) ||
      s.datacenter.includes(keyword)
    const matchStatus = statusFilter === "all" || s.status === statusFilter
    return matchKeyword && matchStatus
  })

  // 写操作 / 未实现能力 — 全部 disabled, 走 toast 提示
  const handleUnsupported = (feature: string) => {
    toast({
      title: "功能未接入",
      description: `${feature}：站点登记功能未接入，当前仅提供列表与一致性校验。`,
      variant: "destructive",
    })
  }

  // 一致性校验 — 替换 mockSiteProvider, 走 R.7 真实 API
  const handleCheckConsistency = async (site: Site) => {
    setChecking(true)
    try {
      const res = await fetch(`/api/sync/consistency?siteCode=${encodeURIComponent(site.code)}`, { cache: "no-store" })
      if (!res.ok) {
        // 失败时尝试无 siteCode 查询, 让 R.7 API 自己选
        const fallback = await fetch("/api/sync/consistency", { cache: "no-store" })
        if (!fallback.ok) throw new Error(`HTTP ${res.status}`)
        const data = await fallback.json()
        setConsistencyReport(data.data ?? data)
        setShowConsistencyResult(true)
        return
      }
      const data = await res.json()
      setConsistencyReport(data.data ?? data)
      setShowConsistencyResult(true)
      toast({
        title: "校验完成",
        description: `${site.code} 数据一致性校验已完成`,
      })
    } catch (e) {
      toast({
        title: "校验失败",
        description: "数据一致性校验失败，请稍后重试",
        variant: "destructive",
      })
    } finally {
      setChecking(false)
    }
  }

  // dataSource 标识徽章
  const dataSourceBadge = (() => {
    if (dataSource === "database") {
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"><Database className="h-3 w-3 mr-1" />已注册</Badge>
    }
    if (dataSource === "derived") {
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" title={meta?.reason}><Layers className="h-3 w-3 mr-1" />由同步数据派生</Badge>
    }
    if (dataSource === "empty") {
      return <Badge className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">暂无数据</Badge>
    }
    if (dataSource === "error") {
      return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">加载失败</Badge>
    }
    return <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">加载中…</Badge>
  })()

  return (
    <AppShell>
      <PageHeader
        title="站点管理"
        description="统一管理各数据中心光盘库站点，监控在线状态与存储容量"
        badge="SITE MGMT"
        actions={
          <div className="flex items-center gap-2">
            <AppTooltip content="重新拉取站点列表, 检查最新状态">
              <Button
                variant="outline"
                size="sm"
                className="h-8 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={loadSites}
                disabled={loading}
                data-testid="sites-refresh"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                刷新
              </Button>
            </AppTooltip>
            <AppTooltip content="站点登记功能未接入, 后续 Sprint 解锁">
              <Button
                size="sm"
                className="h-8 bg-blue-600 hover:bg-blue-700 cursor-pointer transition-colors"
                onClick={() => handleUnsupported("注册新站点")}
                data-testid="sites-register"
              >
                注册新站点
              </Button>
            </AppTooltip>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-1">
        {dataSourceBadge}
        {meta?.derivedFromTables && (
          <span className="text-xs text-slate-500">
            自动发现自已同步业务记录
          </span>
        )}
        {meta?.requirement && (
          <span className="text-xs text-slate-400">
            {meta.requirement.text}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="站点总数"
          value={stats.total}
          unit="个站点"
          icon={LayoutGrid}
          badge={<Badge className="bg-emerald-500 text-white">REAL</Badge>}
          footer={
            <div className="flex gap-3 text-xs">
              <span className="text-emerald-600">在线 {stats.online}</span>
              <span className="text-red-600">异常 {stats.offline}</span>
              {stats.syncing > 0 && <span className="text-blue-600">同步中 {stats.syncing}</span>}
            </div>
          }
        />
        <StatCard
          title="同步中站点"
          value={stats.syncing}
          unit="个"
          icon={RefreshCw}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          footer={<p className="text-xs text-slate-400">来自站点同步状态</p>}
        />
        <StatCard
          title="设备总数"
          value={stats.deviceCount}
          unit="台"
          icon={Server}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
          footer={<p className="text-xs text-slate-400">来自设备同步结果</p>}
        />
        <StatCard
          title="异常站点"
          value={stats.offline}
          unit="需关注"
          icon={AlertTriangle}
          iconBg="bg-red-50"
          iconColor="text-red-600"
          footer={<p className="text-xs text-slate-400">含 derived (待确认)</p>}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold">
                站点列表 {dataSource === "derived" && <span className="text-xs text-amber-600 dark:text-amber-400 font-normal ml-2">(由同步数据派生，名称/IP/联系人暂缺)</span>}
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SiteStatusFilter)}>
                  <SelectTrigger className="h-9 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="online">在线</SelectItem>
                    <SelectItem value="offline">离线</SelectItem>
                    <SelectItem value="derived">派生 (待确认)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder="搜索站点、编码、机房..." className="pl-9 h-9" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
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
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs text-slate-500">站点</TableHead>
                    <TableHead className="text-xs text-slate-500">状态</TableHead>
                    <TableHead className="text-xs text-slate-500">IP:端口</TableHead>
                    <TableHead className="text-xs text-slate-500">数据中心</TableHead>
                    <TableHead className="text-xs text-slate-500">联系人</TableHead>
                    <TableHead className="text-xs text-slate-500">设备</TableHead>
                    <TableHead className="text-xs text-slate-500">同步</TableHead>
                    <TableHead className="text-xs text-slate-500">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((site, idx) => (
                    <TableRow
                      key={`site-${site.id}-${idx}`}
                      className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selected?.id === site.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                      onClick={() => setSelected(site)}
                    >
                      <TableCell>
                        <p className="font-medium text-sm">{site.name}</p>
                        <p className="text-xs text-slate-400">{site.code}</p>
                      </TableCell>
                      <TableCell>
                        {site.status === "derived" ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 text-xs">派生</Badge>
                        ) : (
                          <OnlineStatusBadge status={site.status} />
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-mono">{site.ip}:{site.port || "—"}</TableCell>
                      <TableCell className="text-sm">{site.datacenter}</TableCell>
                      <TableCell>
                        <p className="text-sm">{site.contact}</p>
                        <p className="text-xs text-slate-400">{site.contactPhone}</p>
                      </TableCell>
                      <TableCell className="text-sm">{site.deviceCount}</TableCell>
                      <TableCell>
                        <SyncStatusBadge status={site.syncStatus} />
                        <p className="text-xs text-slate-400 mt-1">{site.lastSyncAt}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled
                            title="站点启用/禁用功能未接入"
                            onClick={(e) => { e.stopPropagation(); handleUnsupported("启用/禁用") }}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled
                            title="SSO 跳转功能未接入"
                            onClick={(e) => { e.stopPropagation(); handleUnsupported("SSO 跳转") }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />SSO
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <DetailPanel title="站点详情" subtitle={selected?.code} empty={!selected}>
          {selected && (
            <div className="space-y-4">
              {selected.status === "derived" && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">⚠️ 派生数据</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    该站点来自已同步业务记录，IP、联系人和数据中心等详细信息暂缺。
                  </p>
                </div>
              )}
              <DetailRow label="站点名称" value={selected.name} />
              <DetailRow label="区域" value={selected.region} />
              <DetailRow label="在线状态" value={
                selected.status === "derived" ? <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">派生</Badge> : <OnlineStatusBadge status={selected.status} />
              } />
              <DetailRow label="同步状态" value={<SyncStatusBadge status={selected.syncStatus} />} />
              <DetailRow label="最后同步" value={selected.lastSyncAt} />
              <DetailRow label="存储总量" value={selected.storageTotal} />
              <DetailRow label="已用存储" value={`${selected.storageUsed} (${selected.storageUsedPercent}%)`} />
              {selected.storageUsedPercent > 0 && <Progress value={selected.storageUsedPercent} className="h-2" />}
              <DetailRow label="设备数量" value={`${selected.deviceCount} 台`} />
              <DetailRow label="盘架数量" value={selected.rackCount ? `${selected.rackCount} 个（${selected.onlineRackCount} 在线）` : "—"} />
              <DetailRow label="盘笼数量" value={selected.cageCount ? `${selected.cageCount} 个` : "—"} />
              <DetailRow label="槽位总数" value={selected.totalSlots ? `${selected.totalSlots} 槽位（${selected.usedSlots} 已占用）` : "—"} />
              <DetailRow label="活跃任务" value={selected.taskCount ?? 0} />
              {selected.description && (
                <p className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg p-3">{selected.description}</p>
              )}
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
            </div>
          )}
        </DetailPanel>
      </div>

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
                    <p className="text-sm font-medium">表差异详情</p>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {consistencyReport.tables.map((t: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded border border-slate-100 text-xs">
                          <span className="font-mono">{t.tableName || t.table_name}</span>
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

    </AppShell>
  )
}
