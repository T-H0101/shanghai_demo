"use client"
/**
 * /logs 页面 — Sprint R.12 真实日志检索与导出
 *
 * 对应 REQ-5.1 (日志管理): 采集 / 检索 / 导出
 *
 * 历史背景 (R.10C → R.12):
 *   - 早期版本直接 import 内置测试数据数组到 useState
 *   - R.12 重构: 移除所有静态测试数据, 改走 fetch /api/logs 真实数据库读取
 *   - 6 类日志 Tab (sync_package / sync_table / sync_scheduler / sync_consistency / control / audit)
 *   - login 审计: 中心库无表, 显示 blocked (blocked_by_auth, 等待 ADFS)
 *   - 7 个筛选: siteCode / status / keyword / errorCode / deviceId / taskType / dateFrom/dateTo
 *   - 导出走 /api/logs/export 真实 API, 含 SHA-256 摘要
 *   - dataSource 显式 (database | empty | error)
 *   - 数字签名按钮删除 (R.1 §7 不允许假证书)
 *
 * 范围严格限定 (R.12 约束):
 *   - 不接 ClickHouse (CLAUDE.md 五同步策略 §五)
 *   - 不伪造系统日志
 *   - 不新增无关页面
 *   - 导出必须来自真实 API 查询结果
 */

import { useState, useEffect, useMemo, useRef } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { StatCard } from "@/components/platform/stat-card"
import { DetailPanel, DetailRow } from "@/components/platform/detail-panel"
import { TimeDisplay } from "@/components/shared/time-format"
import { LOG_STATUS_OPTIONS_BY_TAB, LOG_TASK_TYPE_OPTIONS, type LogTabKey } from "@/lib/types/logs"
import { siteProvider } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Download, ShieldCheck, AlertTriangle, RefreshCw, Loader2, ExternalLink, Database, Layers } from "lucide-react"
import { toast } from "@/hooks/use-toast"

type LogType = "sync_package" | "sync_table" | "sync_scheduler" | "sync_consistency" | "control" | "audit" | "login_audit"
type DataSource = "database" | "empty" | "error" | "loading"

const LOG_TABS: { value: LogType; label: string; description: string }[] = [
  { value: "sync_package", label: "同步包日志", description: "sync_package_log (按站点包传输审计)" },
  { value: "sync_table", label: "同步表日志", description: "sync_table_log (按表写入审计)" },
  { value: "sync_scheduler", label: "调度日志", description: "sync_scheduler_log (定时调度执行审计)" },
  { value: "sync_consistency", label: "一致性日志", description: "sync_consistency_log (跨站点对账结果)" },
  { value: "control", label: "控制命令", description: "总控命令队列" },
  { value: "audit", label: "审计日志", description: "audit_log (权限/凭证变更)" },
  { value: "login_audit", label: "登录审计", description: "auth_login_audit (登录失败/锁定, blocked 等待 ADFS)" },
]

interface LogRow {
  log_type: LogType
  log_id: string
  site_code: string | null
  status: string | null
  summary: string
  detail: unknown
  occurred_at: string
  operator: string | null
  ref_batch_id: string | null
  ref_table_name: string | null
  error_code: string | null
}

interface ApiEnvelope {
  code: number
  message: string
  data: { items: LogRow[]; total: number; limit: number; offset: number; types: LogType[] }
  dataSource: DataSource
  sources?: string[]
  meta?: { requirement?: { id: string; text: string; status: string } }
  traceId?: string
}

function statusBadgeColor(status: string | null): string {
  if (!status) return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
  const s = status.toLowerCase()
  if (s === "success" || s === "matched" || s === "completed" || s === "synced" || s === "pulled") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
  }
  if (s === "failed" || s === "mismatched" || s === "failure") {
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
  }
  if (s === "pending" || s === "running" || s === "syncing" || s === "warning") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
  }
  if (s === "locked") {
    return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
  }
  if (s === "logout") {
    return "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
  }
  if (s === "dry_run_success" || s === "unsupported") {
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
  }
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
}

function logTypeLabel(t: LogType): string {
  return LOG_TABS.find((tab) => tab.value === t)?.label ?? t
}

export default function Page() {
  // Tab: 默认 sync_package
  const [activeType, setActiveType] = useState<LogType | "all">("sync_package")
  // 筛选
  const [siteCode, setSiteCode] = useState("")
  const [status, setStatus] = useState("")
  const [keyword, setKeyword] = useState("")
  const [errorCode, setErrorCode] = useState("")
  const [deviceId, setDeviceId] = useState("")
  const [taskType, setTaskType] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  // 数据
  const [items, setItems] = useState<LogRow[]>([])
  const [total, setTotal] = useState(0)
  const [dataSource, setDataSource] = useState<DataSource>("loading")
  const [sources, setSources] = useState<string[]>([])
  const [meta, setMeta] = useState<ApiEnvelope["meta"]>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  // 选中详情
  const [selected, setSelected] = useState<LogRow | null>(null)
  // 加载态
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  // 去抖 timer
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Round UI-Tweaks: 站点列表 (siteCode datalist), 当前 Tab 的 status 候选
  const [siteCodeOptions, setSiteCodeOptions] = useState<string[]>([])
  const statusOptions = useMemo(
    () => (activeType === "all" ? [] : (LOG_STATUS_OPTIONS_BY_TAB[activeType as LogTabKey] ?? [])),
    [activeType],
  )

  useEffect(() => {
    siteProvider.getAll().then((sites) => {
      setSiteCodeOptions(sites.map((s) => s.code).filter(Boolean))
    }).catch(() => {
      setSiteCodeOptions([])
    })
  }, [])

  const queryString = useMemo(() => {
    const sp = new URLSearchParams()
    sp.set("type", activeType)
    sp.set("limit", "200")
    if (siteCode) sp.set("siteCode", siteCode)
    if (status) sp.set("status", status)
    if (keyword) sp.set("keyword", keyword)
    if (errorCode) sp.set("errorCode", errorCode)
    if (deviceId) sp.set("deviceId", deviceId)
    if (taskType) sp.set("taskType", taskType)
    if (dateFrom) sp.set("dateFrom", dateFrom)
    if (dateTo) sp.set("dateTo", dateTo)
    return sp.toString()
  }, [activeType, siteCode, status, keyword, errorCode, deviceId, taskType, dateFrom, dateTo])

  const loadLogs = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      // Sprint R.27: 登录审计走独立 API
      if (activeType === "login_audit") {
        const sp = new URLSearchParams()
        sp.set("limit", "200")
        if (keyword) sp.set("username", keyword)
        if (status) sp.set("result", status)
        if (siteCode) sp.set("siteCode", siteCode)
        if (dateFrom) sp.set("from", dateFrom)
        if (dateTo) sp.set("to", dateTo)
        const res = await fetch(`/api/auth/audit?${sp.toString()}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setDataSource(json.dataSource ?? "database")
        setSources(["auth_login_audit"])
        setMeta(undefined)
        // Normalize login audit rows to LogRow shape
        const auditItems: LogRow[] = (json.data?.items ?? []).map((r: any) => ({
          log_type: "login_audit" as LogType,
          log_id: r.id,
          site_code: r.site_code,
          status: r.result,
          summary: `${r.username} - ${r.result}${r.failure_reason ? ` (${r.failure_reason})` : ""}`,
          detail: { ip_address: r.ip_address, user_agent: r.user_agent, provider: r.provider, failure_reason: r.failure_reason },
          occurred_at: r.created_at,
          operator: r.username,
          ref_batch_id: null,
          ref_table_name: null,
          error_code: r.failure_reason,
        }))
        setItems(auditItems)
        setTotal(json.data?.total ?? 0)
        setSelected(auditItems[0] ?? null)
        return
      }

      const res = await fetch(`/api/logs?${queryString}`, { cache: "no-store" })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`HTTP ${res.status}${txt ? `: ${txt.slice(0, 100)}` : ""}`)
      }
      const json = (await res.json()) as ApiEnvelope
      setDataSource(json.dataSource)
      setSources(json.sources ?? [])
      setMeta(json.meta)
      const list = json.data?.items ?? []
      setItems(list)
      setTotal(json.data?.total ?? 0)
      setSelected(list[0] ?? null)
    } catch (e) {
      setDataSource("error")
      setLoadError(e instanceof Error ? e.message : String(e))
      setItems([])
      setTotal(0)
      setSelected(null)
    } finally {
      setLoading(false)
    }
  }

  // 初次加载 + tab 切换立即加载
  useEffect(() => {
    loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType])

  // 筛选条件变更 (debounce 500ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadLogs()
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode, status, keyword, errorCode, deviceId, taskType, dateFrom, dateTo])

  const handleExport = async (format: "csv" | "json" | "xlsx") => {
    if (items.length === 0) {
      toast({ title: "无数据可导出", description: "请先调整检索条件获取日志", variant: "destructive" })
      return
    }
    setExporting(true)
    try {
      // Sprint R.27: 登录审计走独立导出 API
      if (activeType === "login_audit") {
        const sp = new URLSearchParams()
        sp.set("format", format)
        if (keyword) sp.set("username", keyword)
        if (status) sp.set("result", status)
        if (siteCode) sp.set("siteCode", siteCode)
        if (dateFrom) sp.set("from", dateFrom)
        if (dateTo) sp.set("to", dateTo)
        const res = await fetch(`/api/auth/audit/export?${sp.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const recordCount = res.headers.get("x-record-count") ?? "?"
        const sha256 = res.headers.get("x-sha256") ?? ""
        const cd = res.headers.get("content-disposition") ?? ""
        const m = /filename="([^"]+)"/.exec(cd)
        const filename = m?.[1] ?? `login-audit.${format}`
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        toast({
          title: "导出请求已提交",
          description: `${recordCount} 条登录审计记录 SHA-256=${sha256.slice(0, 12)}...`,
        })
        return
      }

      const sp = new URLSearchParams()
      sp.set("type", activeType)
      sp.set("format", format)
      sp.set("max", "5000")
      if (siteCode) sp.set("siteCode", siteCode)
      if (status) sp.set("status", status)
      if (keyword) sp.set("keyword", keyword)
      if (errorCode) sp.set("errorCode", errorCode)
      if (deviceId) sp.set("deviceId", deviceId)
      if (taskType) sp.set("taskType", taskType)
      if (dateFrom) sp.set("dateFrom", dateFrom)
      if (dateTo) sp.set("dateTo", dateTo)
      const res = await fetch(`/api/logs/export?${sp.toString()}`)
      if (res.status === 501) {
        const body = await res.json().catch(() => null)
        const msg = body?.message ?? "Excel 暂未接入, 请选择 CSV 或 JSON"
        toast({ title: "导出格式暂未接入", description: msg, variant: "destructive" })
        return
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`HTTP ${res.status}${txt ? `: ${txt.slice(0, 100)}` : ""}`)
      }
      const blob = await res.blob()
      const recordCount = res.headers.get("x-record-count") ?? "?"
      const sha256 = res.headers.get("x-sha256") ?? ""
      const ds = res.headers.get("x-data-source") ?? "unknown"
      // 从 Content-Disposition 拿文件名
      const cd = res.headers.get("content-disposition") ?? ""
      const m = /filename="([^"]+)"/.exec(cd)
      const filename = m?.[1] ?? `logs.${format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast({
        title: "导出请求已提交",
        description: `${recordCount} 条 (${format.toUpperCase()}, ${ds}) SHA-256=${sha256.slice(0, 12)}...`,
      })
    } catch (e) {
      toast({
        title: "导出失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  // 数字签名按钮已删除 (R.1 §7 禁止假证书)
  const handleUnsupported = (feature: string) => {
    toast({
      title: "功能未接入",
      description: `${feature}：当前中心库日志未提供数字签名，证书签名需站点 app 配合`,
      variant: "destructive",
    })
  }

  // 统计派生
  const stats = useMemo(() => {
    const success = items.filter((i) => {
      const s = (i.status ?? "").toLowerCase()
      return s === "success" || s === "matched" || s === "completed" || s === "synced"
    }).length
    const failed = items.filter((i) => {
      const s = (i.status ?? "").toLowerCase()
      return s === "failed" || s === "mismatched" || s === "failure"
    }).length
    const running = items.filter((i) => {
      const s = (i.status ?? "").toLowerCase()
      return s === "running" || s === "pending" || s === "syncing"
    }).length
    return { total: items.length, success, failed, running }
  }, [items])

  // dataSource Badge
  const dataSourceBadge = (() => {
    if (dataSource === "database") {
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"><Database className="h-3 w-3 mr-1" />正常</Badge>
    }
    if (dataSource === "empty") {
      return <Badge className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">暂无数据</Badge>
    }
    if (dataSource === "error") {
      return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">读取失败</Badge>
    }
    return <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">loading…</Badge>
  })()

  return (
    <AppShell>
      <PageHeader
        title="日志检索"
        description="同步包/表/调度/一致性/控制/审计/登录审计 7 类日志统一查询与导出"
        badge="LOGS"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={loadLogs} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              刷新
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => handleExport("csv")}
              disabled={exporting || items.length === 0}
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => handleExport("xlsx")}
              disabled={exporting || items.length === 0}
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              XLSX
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => handleExport("json")}
              disabled={exporting || items.length === 0}
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              JSON
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-1">
        {dataSourceBadge}
        {sources.length > 0 && (
          <span className="text-xs text-slate-500">已接入 {sources.length} 类日志来源</span>
        )}
        {meta?.requirement && (
          <span className="text-xs text-slate-400">
            {meta.requirement.text}
          </span>
        )}
      </div>

      {/* 登录审计已接入, 仅数字签名仍 blocked (等待 ADFS) */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 dark:text-amber-300">
          <p className="font-medium">数字签名暂未接入</p>
          <p className="mt-1">
            数字签名需接入证书/私钥托管后启用。
            当前可检索 7 类日志: sync_package / sync_table / sync_scheduler / sync_consistency / control / audit / <strong>登录审计</strong>。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="当前检索总数" value={total} unit="条" icon={FileText} badge={<Badge className="bg-emerald-500 text-white">REAL</Badge>} />
        <StatCard title="本次成功" value={stats.success} unit="条" icon={ShieldCheck} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard title="本次失败" value={stats.failed} unit="条" icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-600" />
        <StatCard title="运行中" value={stats.running} unit="条" icon={RefreshCw} iconBg="bg-amber-50" iconColor="text-amber-600" />
      </div>

      <Card className="gap-0">
        <CardHeader className="pb-0">
          <Tabs value={activeType} onValueChange={(v) => setActiveType(v as LogType)}>
            <TabsList className="h-9 flex-wrap">
              <TabsTrigger value="sync_package" className="text-xs">同步包</TabsTrigger>
              <TabsTrigger value="sync_table" className="text-xs">同步表</TabsTrigger>
              <TabsTrigger value="sync_scheduler" className="text-xs">调度</TabsTrigger>
              <TabsTrigger value="sync_consistency" className="text-xs">一致性</TabsTrigger>
              <TabsTrigger value="control" className="text-xs">控制命令</TabsTrigger>
              <TabsTrigger value="audit" className="text-xs">审计</TabsTrigger>
              <TabsTrigger value="login_audit" className="text-xs">登录审计</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          {/* 筛选条 (REQ-5.1.3: siteCode/status/taskType 改 Select, 其余 Input + datalist 模糊搜索)
              Round UI-Tweaks: 审计日志筛选下拉化 */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">站点</span>
              <Input
                list="logs-sitecode-list"
                placeholder="siteCode (如 SH01)"
                className="h-9"
                value={siteCode}
                onChange={(e) => setSiteCode(e.target.value)}
                aria-label="按站点编码筛选"
              />
              <datalist id="logs-sitecode-list">
                {siteCodeOptions.map((sc) => (
                  <option key={sc} value={sc} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">状态</span>
              <Select
                value={status || "all"}
                onValueChange={(v) => setStatus(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-9" aria-label="按状态筛选">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">关键字</span>
              <Input
                placeholder="batchId / commandNo"
                className="h-9"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                aria-label="按关键字模糊搜索"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">错误码</span>
              <Input
                list="logs-errorcode-list"
                placeholder="错误码 / 错误文本"
                className="h-9"
                value={errorCode}
                onChange={(e) => setErrorCode(e.target.value)}
                data-testid="logs-filter-error-code"
                aria-label="按错误码筛选"
              />
              <datalist id="logs-errorcode-list">
                {Array.from(
                  new Set(
                    items.map((it) => it.error_code).filter((c): c is string => Boolean(c))
                  )
                )
                  .slice(0, 50)
                  .map((c) => (
                    <option key={c} value={c} />
                  ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">设备</span>
              <Input
                placeholder="设备ID / targetId"
                className="h-9"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                data-testid="logs-filter-device-id"
                aria-label="按设备 ID 筛选"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">任务类型</span>
              <Select
                value={taskType || "all"}
                onValueChange={(v) => setTaskType(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-9" data-testid="logs-filter-task-type" aria-label="按任务类型筛选">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {LOG_TASK_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">起始时间</span>
              <Input
                type="datetime-local"
                className="h-9"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value ? new Date(e.target.value).toISOString() : "")}
                title="起始时间"
                aria-label="起始时间"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">结束时间</span>
              <Input
                type="datetime-local"
                className="h-9"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value ? new Date(e.target.value).toISOString() : "")}
                title="结束时间"
                aria-label="结束时间"
              />
            </div>
            <div className="flex items-end gap-2 col-span-2 md:col-span-3 xl:col-span-2 text-xs text-slate-500">
              <span>共 {total} 条</span>
              {dataSource === "loading" && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 overflow-x-auto">
              {loadError && dataSource === "error" ? (
                <div className="text-center py-8 text-red-600">
                  <AlertTriangle className="h-10 w-10 mx-auto mb-2" />
                  <p className="font-medium">加载日志失败</p>
                  <p className="text-sm text-slate-500 mt-1">{loadError}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={loadLogs}>重试</Button>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {dataSource === "empty" ? (
                    <>
                      <Layers className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                      <p>无匹配日志</p>
                      <p className="text-xs mt-1">当前筛选条件下 7 类日志源均无数据</p>
                    </>
                  ) : (
                    <p>未找到匹配的日志记录</p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs text-slate-500">类型</TableHead>
                      <TableHead className="text-xs text-slate-500">siteCode</TableHead>
                      <TableHead className="text-xs text-slate-500">状态</TableHead>
                      <TableHead className="text-xs text-slate-500">时间</TableHead>
                      <TableHead className="text-xs text-slate-500">摘要</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => (
                      <TableRow
                        key={`${row.log_type}-${row.log_id}`}
                        className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selected?.log_id === row.log_id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                        onClick={() => setSelected(row)}
                      >
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{logTypeLabel(row.log_type)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm font-mono">{row.site_code || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${statusBadgeColor(row.status)}`}>{row.status || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          <TimeDisplay value={row.occurred_at} mode="datetime" />
                        </TableCell>
                        <TableCell className="text-xs max-w-[280px] truncate" title={row.summary}>{row.summary}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <DetailPanel title="日志详情" subtitle={selected ? logTypeLabel(selected.log_type) : ""} empty={!selected}>
              {selected && (
                <div className="space-y-3">
                  <DetailRow label="类型" value={logTypeLabel(selected.log_type)} />
                  <DetailRow label="siteCode" value={selected.site_code || "—"} />
                  <DetailRow label="状态" value={
                    <Badge className={`text-xs ${statusBadgeColor(selected.status)}`}>{selected.status || "—"}</Badge>
                  } />
                  <DetailRow label="时间" value={<TimeDisplay value={selected.occurred_at} mode="datetime" />} />
                  {selected.operator && <DetailRow label="操作人" value={selected.operator} />}
                  {selected.ref_batch_id && <DetailRow label="batchId" value={<code className="text-[10px]">{selected.ref_batch_id}</code>} />}
                  {selected.ref_table_name && <DetailRow label="表名" value={selected.ref_table_name} />}
                  <div>
                    <p className="text-xs font-medium text-slate-700 mb-1">摘要</p>
                    <p className="text-xs bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">{selected.summary}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-700 mb-1">详细 (JSON)</p>
                    <pre className="text-[10px] bg-slate-900 text-slate-100 p-2 rounded-lg overflow-x-auto max-h-48">
                      {JSON.stringify(selected.detail, null, 2)}
                    </pre>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8"
                    onClick={() => handleUnsupported("数字签名校验")}
                    title="REQ-5.1.2 数字签名需证书/私钥托管"
                  >
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    数字签名校验 (未接入)
                  </Button>
                </div>
              )}
            </DetailPanel>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
