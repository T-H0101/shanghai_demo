'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/platform/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw, Search, Package, AlertCircle, ShieldCheck, Download } from 'lucide-react'
import { useSite } from '@/lib/site/site-context'
import { toast } from '@/hooks/use-toast'

interface PackageItem {
  id: string
  siteCode: string
  batchId: string
  mode: string
  version: string | null
  status: string
  tableCount: number
  totalRecordCount: number
  successTableCount: number
  failedTableCount: number
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}

interface TableItem {
  id: string
  packageLogId: string | null
  siteCode: string
  batchId: string
  tableName: string
  syncMode: string
  status: string
  expectedRecordCount: number | null
  processedRecordCount: number
  insertedCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}

interface PackageListResponse {
  code: number
  message: string
  source: 'database'
  data: {
    items: PackageItem[]
    total: number
    page: number
    pageSize: number
  }
}

interface TableListResponse {
  code: number
  message: string
  source: 'database'
  data: TableItem[]
}

interface SyncConfigSite {
  siteCode: string
  siteName: string
  enabled: boolean
  intervalSeconds: number
  status: string
  credentialKeyRef: string | null
  lastConnectedAt: string | null
}

interface SiteSyncStatus {
  siteCode: string
  siteName: string
  enabled: boolean
  intervalSeconds: number
  configStatus: string
  schedulerStatus: string
  schedulerStartedAt: string | null
  exportStatus: string
  pushStatus: string
  packageStatus: string
  packageBatchId: string | null
  packageCreatedAt: string | null
  consistencyStatus: string
  consistencyCheckedAt: string | null
  matchedTableCount: number | null
  mismatchedTableCount: number | null
  agentStatus: string
  agentId: string | null
  agentVersion: string | null
  agentReportedAt: string | null
  agentDatabaseReachable: boolean | null
  agentSpoolDepth: number | null
}

interface SyncAlertItem {
  id: string
  title: string
  type: string
  severity: 'critical' | 'warning'
  status: 'active' | 'resolved' | 'acknowledged'
  message: string
  siteCode?: string
  createdAt: string
}

function statusColor(status: string): string {
  switch (status) {
    case 'success':
    case 'online':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'failed':
    case 'offline':
    case 'degraded':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'running':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'duplicated':
    case 'stale':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'skipped':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function alertSeverityColor(severity: string): string {
  return severity === 'critical'
    ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-amber-100 text-amber-700 border-amber-200'
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN')
  } catch {
    return iso
  }
}

export default function SyncCenterPage() {
  const [packages, setPackages] = useState<PackageItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [siteCodeFilter, setSiteCodeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [batchIdFilter, setBatchIdFilter] = useState('')
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null)
  const [tables, setTables] = useState<TableItem[]>([])
  const [tablesLoading, setTablesLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Sprint R.7: 一致性校验结果
  const [consistency, setConsistency] = useState<{
    status: string
    siteCode: string
    checkedAt?: string
    tableCount?: number
    matchedTableCount?: number
    mismatchedTableCount?: number
    dataSource?: string
  } | null>(null)
  // Sprint R.8: 自动同步调度日志
  const [schedulerLogs, setSchedulerLogs] = useState<Array<{
    runId: string
    siteCode: string
    startedAt: string
    status: string
    exportStatus: string
    pushStatus: string
    consistencyStatus: string
    packageBatchId: string | null
    errorMessage: string | null
  }>>([])
  const [syncConfigSites, setSyncConfigSites] = useState<SyncConfigSite[]>([])
  const [syncConfigNote, setSyncConfigNote] = useState("")
  const [siteSyncStatuses, setSiteSyncStatuses] = useState<SiteSyncStatus[]>([])
  const [siteStatusNote, setSiteStatusNote] = useState("")
  const [syncAlerts, setSyncAlerts] = useState<SyncAlertItem[]>([])
  const [syncAlertTotal, setSyncAlertTotal] = useState(0)
  const [syncAlertError, setSyncAlertError] = useState("")
  const [exportKind, setExportKind] = useState<'package' | 'table' | 'scheduler' | 'consistency'>('package')
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'xlsx'>('csv')
  const [exporting, setExporting] = useState(false)

  // Sprint 2F.4: 全局 siteCode
  const { siteCode, isAllSites, isReady: siteReady } = useSite()

  const loadPackages = useCallback(async () => {
    setLoading(true)
    setError(null)
    const sp = new URLSearchParams()
    sp.set('page', String(page))
    sp.set('pageSize', String(pageSize))
    // Sprint 2F.4: 站点代码优先级 = 全局选择 > 页面本地筛选
    const effectiveSiteCode = !isAllSites && siteCode ? siteCode : siteCodeFilter.trim()
    if (effectiveSiteCode) sp.set('siteCode', effectiveSiteCode)
    if (statusFilter !== 'all') sp.set('status', statusFilter)
    if (batchIdFilter.trim()) sp.set('batchId', batchIdFilter.trim())

    try {
      const res = await fetch(`/api/sync/packages?${sp.toString()}`)
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.message ?? `HTTP ${res.status}`)
      }
      const json: PackageListResponse = await res.json()
      if (json.source !== 'database') {
        throw new Error('Unexpected source: ' + json.source)
      }
      setPackages(json.data.items)
      setTotal(json.data.total)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
      setPackages([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, siteCodeFilter, statusFilter, batchIdFilter, isAllSites, siteCode])

  const loadTables = useCallback(async (packageId: string) => {
    setTablesLoading(true)
    try {
      const res = await fetch(`/api/sync/packages/${packageId}/tables`)
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.message ?? `HTTP ${res.status}`)
      }
      const json: TableListResponse = await res.json()
      setTables(json.data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      console.error('Load tables failed:', msg)
      setTables([])
    } finally {
      setTablesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (siteReady) loadPackages()
  }, [loadPackages, siteReady])

  useEffect(() => {
    if (selectedPkg) {
      loadTables(selectedPkg)
    } else {
      setTables([])
    }
  }, [selectedPkg, loadTables])

  // Sprint R.7: 加载数据一致性校验结果
  useEffect(() => {
    let cancelled = false
    const sc = siteCodeFilter || ''
    fetch(`/api/sync/consistency?siteCode=${encodeURIComponent(sc)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setConsistency({
          status: data.status ?? "not_run",
          siteCode: data.siteCode ?? sc,
          checkedAt: data.checkedAt,
          tableCount: data.tableCount,
          matchedTableCount: data.matchedTableCount,
          mismatchedTableCount: data.mismatchedTableCount,
          dataSource: data.dataSource,
        })
      })
      .catch(() => {
        if (cancelled) return
        setConsistency({ status: "not_run", siteCode: sc, dataSource: "error" })
      })
    return () => { cancelled = true }
  }, [siteCodeFilter])

  // Sprint R.8: 加载自动同步调度日志
  useEffect(() => {
    let cancelled = false
    const sc = siteCodeFilter || ''
    fetch(`/api/sync/scheduler/logs?siteCode=${encodeURIComponent(sc)}&limit=5`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setSchedulerLogs((data.data?.items ?? []).map((item: Record<string, unknown>) => ({
          runId: item.run_id as string,
          siteCode: item.site_code as string,
          startedAt: item.started_at as string,
          status: item.status as string,
          exportStatus: item.export_status as string,
          pushStatus: item.push_status as string,
          consistencyStatus: item.consistency_status as string,
          packageBatchId: item.package_batch_id as string | null,
          errorMessage: item.error_message as string | null,
        })))
      })
      .catch(() => {
        if (cancelled) return
        setSchedulerLogs([])
      })
    return () => { cancelled = true }
  }, [siteCodeFilter])

  // Sprint R.10A: 只读加载多站点同步配置，接口不返回连接值或 secret。
  useEffect(() => {
    let cancelled = false
    fetch("/api/sync/config")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return
        setSyncConfigSites(data.data?.sites ?? [])
        setSyncConfigNote(data.data?.reality?.note ?? "")
      })
      .catch(() => {
        if (cancelled) return
        setSyncConfigSites([])
        setSyncConfigNote("同步配置读取失败")
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/sync/sites/status")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((data) => {
        if (cancelled) return
        setSiteSyncStatuses(data.data?.items ?? [])
        setSiteStatusNote(data.reality?.note ?? "")
      })
      .catch(() => {
        if (cancelled) return
        setSiteSyncStatuses([])
        setSiteStatusNote("每站点最新状态读取失败")
      })
    return () => { cancelled = true }
  }, [])

  // Sprint R.21: 同步告警摘要，真实来源为 /api/alerts 聚合的 sync_package_log / sync_table_log。
  useEffect(() => {
    let cancelled = false
    const sp = new URLSearchParams({ pageSize: "300" })
    const effectiveSiteCode = !isAllSites && siteCode ? siteCode : siteCodeFilter.trim()
    if (effectiveSiteCode) sp.set("siteCode", effectiveSiteCode)

    fetch(`/api/alerts?${sp.toString()}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((data) => {
        if (cancelled) return
        const items = (data.data?.items ?? []) as SyncAlertItem[]
        const syncItems = items.filter((item) => item.type === "sync" || item.type === "table")
        setSyncAlerts(syncItems)
        setSyncAlertTotal(data.data?.total ?? syncItems.length)
        setSyncAlertError("")
      })
      .catch((err) => {
        if (cancelled) return
        setSyncAlerts([])
        setSyncAlertTotal(0)
        setSyncAlertError(err instanceof Error ? err.message : "同步告警读取失败")
      })
    return () => { cancelled = true }
  }, [siteCodeFilter, isAllSites, siteCode])

  const handleExport = async () => {
    setExporting(true)
    try {
      const sp = new URLSearchParams({ kind: exportKind, format: exportFormat })
      const effectiveSiteCode = !isAllSites && siteCode ? siteCode : siteCodeFilter.trim()
      if (effectiveSiteCode) sp.set('siteCode', effectiveSiteCode)
      const response = await fetch(`/api/sync/export?${sp.toString()}`)
      if (response.status === 501) {
        const body = await response.json().catch(() => null)
        const msg = body?.message ?? 'Excel 暂未接入, 请选择 CSV 或 JSON'
        toast({ title: '导出格式暂未接入', description: msg, variant: 'destructive' })
        return
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const sha256 = response.headers.get('x-sha256') ?? ''
      const recordCount = response.headers.get('x-record-count') ?? '0'
      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') ?? ''
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `sync-${exportKind}.${exportFormat}`
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      toast({
        title: '导出完成',
        description: `${recordCount} 条真实记录, SHA-256 摘要已生成 (${sha256.slice(0, 12)}…)`,
      })
    } catch {
      toast({
        title: '同步日志导出失败',
        description: '未生成本地替代日志，请检查中心库连接后重试。',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const activeSyncAlerts = syncAlerts.filter((item) => item.status === "active").length
  const criticalSyncAlerts = syncAlerts.filter((item) => item.severity === "critical").length
  const warningSyncAlerts = syncAlerts.filter((item) => item.severity === "warning").length

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="同步中心"
          description="查看站点推送到总控的数据包批次和表级同步状态"
          actions={
            <div className="flex items-center gap-2">
              <Select value={exportKind} onValueChange={(value) => setExportKind(value as typeof exportKind)}>
                <SelectTrigger className="h-8 w-[150px]" data-testid="sync-export-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="package">同步批次</SelectItem>
                  <SelectItem value="table">表级日志</SelectItem>
                  <SelectItem value="scheduler">调度日志</SelectItem>
                  <SelectItem value="consistency">一致性日志</SelectItem>
                </SelectContent>
              </Select>
              <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as typeof exportFormat)}>
                <SelectTrigger className="h-8 w-[100px]" data-testid="sync-export-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="xlsx">XLSX (未接入)</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => void handleExport()}
                disabled={exporting}
                data-testid="sync-export"
              >
                <Download className="mr-1 h-4 w-4" />
                {exporting ? '导出中' : `导出 ${exportFormat.toUpperCase()}`}
              </Button>
            </div>
          }
        />

        <Card className="gap-0" data-testid="sync-alert-summary-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              同步告警摘要
              <Badge className="bg-blue-100 text-blue-700">真实告警源</Badge>
              {activeSyncAlerts > 0 ? (
                <Badge className="bg-red-100 text-red-700">{activeSyncAlerts} active</Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-700">暂无 active</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="mb-3 text-xs text-amber-700">
              来源: sync_package_log / sync_table_log，经 /api/alerts 聚合；不接 ClickHouse，不伪造站点硬件告警。
            </p>
            {syncAlertError ? (
              <div className="text-sm text-red-600">同步告警读取失败: {syncAlertError}</div>
            ) : syncAlerts.length === 0 ? (
              <div className="text-sm text-slate-500">暂无同步失败告警。</div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div>
                    <div className="text-slate-500">同步告警</div>
                    <div className="font-mono text-lg">{syncAlerts.length}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Critical</div>
                    <div className="font-mono text-lg text-red-600">{criticalSyncAlerts}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Warning</div>
                    <div className="font-mono text-lg text-amber-600">{warningSyncAlerts}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">聚合总告警</div>
                    <div className="font-mono text-lg">{syncAlertTotal}</div>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>级别</TableHead>
                      <TableHead>来源</TableHead>
                      <TableHead>站点</TableHead>
                      <TableHead>告警</TableHead>
                      <TableHead>时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncAlerts.slice(0, 5).map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell>
                          <Badge className={alertSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{alert.type}</TableCell>
                        <TableCell className="font-mono text-xs">{alert.siteCode ?? "—"}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{alert.title}</div>
                          <div className="max-w-[420px] truncate text-xs text-slate-500">{alert.message}</div>
                        </TableCell>
                        <TableCell className="text-xs">{formatDateTime(alert.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sprint R.7: 数据一致性校验卡片 */}
        {consistency && (
          <Card className="gap-0" data-testid="consistency-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                数据一致性校验
                {consistency.status === "matched" && (
                  <Badge className="bg-emerald-100 text-emerald-700">匹配</Badge>
                )}
                {consistency.status === "mismatched" && (
                  <Badge className="bg-amber-100 text-amber-700">异常</Badge>
                )}
                {consistency.status === "failed" && (
                  <Badge className="bg-red-100 text-red-700">失败</Badge>
                )}
                {consistency.status === "not_run" && (
                  <Badge className="bg-slate-100 text-slate-600">未运行</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {consistency.status === "not_run" ? (
                <div className="text-sm text-slate-600">
                  尚未运行一致性校验。
                  运行 <code className="text-xs">pnpm check:sync-consistency -- --siteCode={consistency.siteCode}</code> 启动。
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">最近校验</div>
                    <div className="font-mono text-xs">
                      {consistency.checkedAt
                        ? new Date(consistency.checkedAt).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">总表数</div>
                    <div className="font-mono text-lg">{consistency.tableCount ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">匹配</div>
                    <div className="font-mono text-lg text-emerald-600">
                      {consistency.matchedTableCount ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">异常</div>
                    <div className="font-mono text-lg text-amber-600">
                      {consistency.mismatchedTableCount ?? "—"}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="gap-0" data-testid="sync-config-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              多站点同步配置
              <Badge className="bg-blue-100 text-blue-700">只读</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-amber-700 mb-3">
              {syncConfigNote || "中心配置仅用于调度，不作为源端真实站点证据。"}
            </p>
            {syncConfigSites.length === 0 ? (
              <div className="text-sm text-slate-500">暂无中心同步配置。</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>站点</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>同步周期</TableHead>
                    <TableHead>凭据键引用</TableHead>
                    <TableHead>最近连接</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncConfigSites.map((site) => (
                    <TableRow key={site.siteCode}>
                      <TableCell>
                        <div className="font-medium text-sm">{site.siteName}</div>
                        <div className="font-mono text-xs text-slate-500">{site.siteCode}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={site.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                          {site.enabled ? site.status : "disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{site.intervalSeconds} 秒</TableCell>
                      <TableCell className="font-mono text-xs">{site.credentialKeyRef ?? "未配置"}</TableCell>
                      <TableCell className="text-xs">{formatDateTime(site.lastConnectedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0" data-testid="site-sync-status-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              每站点最新状态
              <Badge className="bg-blue-100 text-blue-700">运行日志</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="mb-3 text-xs text-amber-700">
              {siteStatusNote || "无日志时显示 not_run，不推断站点成功。"}
            </p>
            {siteSyncStatuses.length === 0 ? (
              <div className="text-sm text-slate-500">暂无每站点运行状态。</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>站点</TableHead>
                    <TableHead>周期</TableHead>
                    <TableHead>Site Agent</TableHead>
                    <TableHead>调度</TableHead>
                    <TableHead>导出/推送</TableHead>
                    <TableHead>最近数据包</TableHead>
                    <TableHead>一致性</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siteSyncStatuses.map((item) => (
                    <TableRow key={item.siteCode}>
                      <TableCell>
                        <div className="text-sm font-medium">{item.siteName}</div>
                        <div className="font-mono text-xs text-slate-500">{item.siteCode}</div>
                      </TableCell>
                      <TableCell className="text-xs">{item.intervalSeconds} 秒</TableCell>
                      <TableCell data-testid={`site-agent-status-${item.siteCode}`}>
                        <Badge className={statusColor(item.agentStatus)}>
                          {item.agentStatus}
                        </Badge>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.agentVersion ?? "未注册"} · {formatDateTime(item.agentReportedAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor(item.schedulerStatus)}>
                          {item.schedulerStatus}
                        </Badge>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDateTime(item.schedulerStartedAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.exportStatus} / {item.pushStatus}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor(item.packageStatus)}>
                          {item.packageStatus}
                        </Badge>
                        <div className="mt-1 max-w-[180px] truncate font-mono text-xs text-slate-500">
                          {item.packageBatchId ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor(item.consistencyStatus)}>
                          {item.consistencyStatus}
                        </Badge>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.matchedTableCount ?? "—"} / {item.mismatchedTableCount ?? "—"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Sprint R.8: 自动同步调度区域 */}
        <Card className="gap-0" data-testid="scheduler-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              自动同步调度
              {schedulerLogs.length > 0 ? (
                <Badge className="bg-slate-100 text-slate-600">
                  最近 {schedulerLogs.length} 次
                </Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-500">未运行</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {schedulerLogs.length === 0 ? (
              <div className="text-sm text-slate-600">
                尚未运行过自动同步。运行 <code className="text-xs">pnpm scheduler:sync:once -- --siteCode=SH01</code> 启动。
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>运行时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>导出</TableHead>
                    <TableHead>推送</TableHead>
                    <TableHead>一致性</TableHead>
                    <TableHead>Batch ID</TableHead>
                    <TableHead>错误</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedulerLogs.map((log) => (
                    <TableRow key={log.runId}>
                      <TableCell className="font-mono text-xs">
                        {new Date(log.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {log.status === 'success' && <Badge className="bg-emerald-100 text-emerald-700">成功</Badge>}
                        {log.status === 'partial' && <Badge className="bg-amber-100 text-amber-700">部分</Badge>}
                        {log.status === 'failed' && <Badge className="bg-red-100 text-red-700">失败</Badge>}
                        {log.status === 'running' && <Badge className="bg-blue-100 text-blue-700">运行中</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{log.exportStatus}</TableCell>
                      <TableCell className="text-xs">{log.pushStatus}</TableCell>
                      <TableCell className="text-xs">{log.consistencyStatus}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate">
                        {log.packageBatchId ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-red-600 max-w-[200px] truncate">
                        {log.errorMessage ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 筛选器 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Search className="h-4 w-4" />筛选条件
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="siteCode" className="text-xs">站点代码</Label>
                <Input
                  id="siteCode"
                  placeholder="如 SH01"
                  value={siteCodeFilter}
                  onChange={(e) => setSiteCodeFilter(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="status" className="text-xs">状态</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="success">success</SelectItem>
                    <SelectItem value="failed">failed</SelectItem>
                    <SelectItem value="running">running</SelectItem>
                    <SelectItem value="duplicated">duplicated</SelectItem>
                    <SelectItem value="skipped">skipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="batchId" className="text-xs">批次 ID</Label>
                <Input
                  id="batchId"
                  placeholder="模糊匹配"
                  value={batchIdFilter}
                  onChange={(e) => setBatchIdFilter(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={() => {
                    setPage(1)
                    loadPackages()
                  }}
                  className="flex items-center gap-1"
                >
                  <Search className="h-4 w-4" />查询
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSiteCodeFilter('')
                    setStatusFilter('all')
                    setBatchIdFilter('')
                    setPage(1)
                  }}
                >
                  重置
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Package 表格 */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" />
              同步批次 (共 {total} 条)
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadPackages()}
              disabled={loading}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-center py-8 text-red-600 text-sm flex items-center justify-center gap-2">
                <AlertCircle className="h-4 w-4" />同步日志加载失败: {error}
              </div>
            ) : loading && packages.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">加载中...</div>
            ) : packages.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">暂无同步批次</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">站点</TableHead>
                      <TableHead className="text-xs">批次 ID</TableHead>
                      <TableHead className="text-xs">状态</TableHead>
                      <TableHead className="text-xs text-right">表数</TableHead>
                      <TableHead className="text-xs text-right">记录数</TableHead>
                      <TableHead className="text-xs text-right">成功/失败</TableHead>
                      <TableHead className="text-xs">开始</TableHead>
                      <TableHead className="text-xs">结束</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages.map((pkg) => (
                      <TableRow
                        key={pkg.id}
                        onClick={() => setSelectedPkg(pkg.id)}
                        className={`cursor-pointer hover:bg-slate-50 ${selectedPkg === pkg.id ? 'bg-blue-50' : ''}`}
                      >
                        <TableCell className="text-xs font-mono">{pkg.siteCode}</TableCell>
                        <TableCell className="text-xs font-mono max-w-xs truncate" title={pkg.batchId}>
                          {pkg.batchId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${statusColor(pkg.status)}`}>
                            {pkg.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right">{pkg.tableCount}</TableCell>
                        <TableCell className="text-xs text-right">{pkg.totalRecordCount}</TableCell>
                        <TableCell className="text-xs text-right">
                          <span className="text-emerald-600">{pkg.successTableCount}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-red-600">{pkg.failedTableCount}</span>
                        </TableCell>
                        <TableCell className="text-xs">{formatDateTime(pkg.startedAt)}</TableCell>
                        <TableCell className="text-xs">{formatDateTime(pkg.finishedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      上一页
                    </Button>
                    <span className="text-xs">第 {page} / {totalPages} 页</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Table 明细 */}
        {selectedPkg && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">批次明细</CardTitle>
            </CardHeader>
            <CardContent>
              {tablesLoading ? (
                <div className="text-center py-6 text-slate-500 text-sm">加载表明细中...</div>
              ) : tables.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">该批次无表级日志</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">表名</TableHead>
                      <TableHead className="text-xs">状态</TableHead>
                      <TableHead className="text-xs text-right">预期/处理</TableHead>
                      <TableHead className="text-xs text-right">插入/更新</TableHead>
                      <TableHead className="text-xs text-right">跳过/失败</TableHead>
                      <TableHead className="text-xs">错误</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tables.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs font-mono">{t.tableName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${statusColor(t.status)}`}>
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {t.expectedRecordCount ?? '—'} / {t.processedRecordCount}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          <span className="text-emerald-600">{t.insertedCount}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-blue-600">{t.updatedCount}</span>
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          <span className="text-amber-600">{t.skippedCount}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-red-600">{t.failedCount}</span>
                        </TableCell>
                        <TableCell className="text-xs text-red-600 max-w-xs truncate" title={t.errorMessage ?? ''}>
                          {t.errorMessage ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
