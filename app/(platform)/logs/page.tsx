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
 *   - 筛选: siteCode / status / taskType(控制命令) / dateFrom/dateTo
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
import { PageHeader } from "@/components/platform/page-header"
import { StatCard } from "@/components/platform/stat-card"
import { DetailPanel, DetailRow } from "@/components/platform/detail-panel"
import { TimeDisplay } from "@/components/shared/time-format"
import {
  LOG_STATUS_OPTIONS_BY_TAB,
  LOG_TASK_TYPE_OPTIONS,
  logOperationLabel,
  logSiteCodeLabel,
  logStatusLabel,
  logTargetDisplay,
  logTypeLabel,
  type LogTabKey,
} from "@/lib/types/logs"
import { formatSiteLabel } from "@/components/users/site-field"
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
import { FileText, Download, ShieldCheck, AlertTriangle, RefreshCw, Loader2, ExternalLink, Layers } from "lucide-react"
import { toast } from "@/hooks/use-toast"

type LogType = "sync_package" | "sync_table" | "sync_scheduler" | "sync_consistency" | "control" | "audit" | "login_audit"
type DataSource = "database" | "empty" | "error" | "loading"

const LOG_TABS: { value: LogType; label: string; description: string }[] = [
  { value: "sync_package", label: "同步包日志", description: "按站点包传输审计" },
  { value: "sync_table", label: "同步表日志", description: "sync_table_log (按表写入审计)" },
  { value: "sync_scheduler", label: "调度日志", description: "sync_scheduler_log (定时调度执行审计)" },
  // 推送主路径下日常不用，Tab 暂隐藏
  // { value: "sync_consistency", label: "一致性日志", description: "sync_consistency_log (跨站点对账结果)" },
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

/**
 * datetime-local 控件值保持 yyyy-MM-ddTHH:mm；
 * 请求 API 时再转为 ISO（按浏览器本地时区解析）。
 */
function localDateTimeToIso(local: string): string {
  if (!local) return ""
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString()
}

import { formatApiErrorMessage, httpStatusMessage } from "@/lib/api/http-error"

const LOGS_FETCH_INIT: RequestInit = { cache: "no-store", credentials: "include" }

function apiErrorMessage(json: unknown, status: number): string {
  if (json && typeof json === "object" && "message" in json) {
    const message = (json as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) {
      return formatApiErrorMessage(message)
    }
  }
  return httpStatusMessage(status)
}

async function readApiErrorMessage(res: Response): Promise<string> {
  const json = await res.json().catch(() => null)
  return apiErrorMessage(json, res.status)
}

export default function Page() {
  // Tab: 默认 sync_package
  const [activeType, setActiveType] = useState<LogType | "all">("audit")
  // 筛选
  const [siteCode, setSiteCode] = useState("")
  const [status, setStatus] = useState("")
  const [taskType, setTaskType] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  // 数据
  const [items, setItems] = useState<LogRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
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
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  // 站点列表（名称展示）+ 当前 Tab 的 status 候选
  const [siteOptions, setSiteOptions] = useState<Array<{ code: string; name: string }>>([])
  const statusOptions = useMemo(
    () => (activeType === "all" ? [] : (LOG_STATUS_OPTIONS_BY_TAB[activeType as LogTabKey] ?? [])),
    [activeType],
  )
  /** 任务类型仅控制命令有结构化字段，其它 Tab 不展示 */
  const showControlExtraFilters = activeType === "control"

  useEffect(() => {
    if (!showControlExtraFilters) {
      setTaskType("")
    }
  }, [showControlExtraFilters])

  useEffect(() => {
    siteProvider.getAll().then((sites) => {
      setSiteOptions(
        sites
          .filter((s) => s.code)
          .map((s) => ({ code: s.code, name: s.name || s.code })),
      )
    }).catch(() => {
      setSiteOptions([])
    })
  }, [])

  const queryString = useMemo(() => {
    const sp = new URLSearchParams()
    sp.set("type", activeType)
    sp.set("limit", String(pageSize))
    sp.set("offset", String((page - 1) * pageSize))
    if (siteCode) sp.set("siteCode", siteCode)
    if (status) sp.set("status", status)
    if (taskType) sp.set("taskType", taskType)
    if (dateFrom) sp.set("dateFrom", localDateTimeToIso(dateFrom))
    if (dateTo) sp.set("dateTo", localDateTimeToIso(dateTo))
    return sp.toString()
  }, [activeType, page, pageSize, siteCode, status, taskType, dateFrom, dateTo])

  const loadLogs = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      // Sprint R.27: 登录审计走独立 API
      if (activeType === "login_audit") {
        const sp = new URLSearchParams()
        sp.set("limit", String(pageSize))
        sp.set("offset", String((page - 1) * pageSize))
        if (status) sp.set("result", status)
        if (siteCode) sp.set("siteCode", siteCode)
        if (dateFrom) sp.set("from", localDateTimeToIso(dateFrom))
        if (dateTo) sp.set("to", localDateTimeToIso(dateTo))
        const res = await fetch(`/api/auth/audit?${sp.toString()}`, LOGS_FETCH_INIT)
        if (!res.ok) throw new Error(await readApiErrorMessage(res))
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

      const res = await fetch(`/api/logs?${queryString}`, LOGS_FETCH_INIT)
      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res))
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
      setLoadError(formatApiErrorMessage(e))
      setItems([])
      setTotal(0)
      setSelected(null)
    } finally {
      setLoading(false)
    }
  }

  // Tab / 筛选 / 每页条数变更时回到第 1 页
  useEffect(() => {
    setPage(1)
  }, [activeType, siteCode, status, taskType, dateFrom, dateTo, pageSize])

  // 总数变少时校正页码，避免停在空页
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  // 初次加载 + tab / 分页立即加载
  useEffect(() => {
    loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType, page, pageSize])

  // 筛选条件变更 (debounce 500ms)；若刚因筛选重置到第 1 页，由上面 page 效应加载
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (page === 1) loadLogs()
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode, status, taskType, dateFrom, dateTo])

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
        if (status) sp.set("result", status)
        if (siteCode) sp.set("siteCode", siteCode)
        if (dateFrom) sp.set("from", localDateTimeToIso(dateFrom))
        if (dateTo) sp.set("to", localDateTimeToIso(dateTo))
        const res = await fetch(`/api/auth/audit/export?${sp.toString()}`, LOGS_FETCH_INIT)
        if (!res.ok) throw new Error(await readApiErrorMessage(res))
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
      if (taskType) sp.set("taskType", taskType)
      if (dateFrom) sp.set("dateFrom", localDateTimeToIso(dateFrom))
      if (dateTo) sp.set("dateTo", localDateTimeToIso(dateTo))
      const res = await fetch(`/api/logs/export?${sp.toString()}`, LOGS_FETCH_INIT)
      if (res.status === 501) {
        const body = await res.json().catch(() => null)
        const msg = apiErrorMessage(body, res.status)
        toast({
          title: "导出格式暂未接入",
          description: "Excel 暂未接入, 请选择 CSV 或 JSON",
          variant: "destructive",
        })
        return
      }
      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res))
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
        description: formatApiErrorMessage(e),
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  // 数字签名按钮已注释，暂不提示
  // const handleUnsupported = (feature: string) => {
  //   toast({
  //     title: "功能未接入",
  //     description: `${feature}：当前中心库日志未提供数字签名，证书签名需站点 app 配合`,
  //     variant: "destructive",
  //   })
  // }

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

  // dataSource Badge（状态行暂不展示，保留逻辑便于恢复）
  // const dataSourceBadge = (() => {
  //   if (dataSource === "database") {
  //     return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"><Database className="h-3 w-3 mr-1" />正常</Badge>
  //   }
  //   if (dataSource === "empty") {
  //     return <Badge className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">暂无数据</Badge>
  //   }
  //   if (dataSource === "error") {
  //     return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">读取失败</Badge>
  //   }
  //   return <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">loading…</Badge>
  // })()

  return (
    <div className="page-pad space-y-4 lg:space-y-6">
      <PageHeader
        title="日志检索"
        description="同步包/表/调度/控制/审计/登录审计统一查询与导出"
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

      {/* 数据源状态行暂不展示
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
      */}

      {/* 数字签名暂未接入提示：暂不展示
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 dark:text-amber-300">
          <p className="font-medium">数字签名暂未接入</p>
          <p className="mt-1">
            数字签名需接入证书/私钥托管后启用。
            当前可检索日志: 同步包 / 同步表 / 同步调度 / 控制命令 / 操作审计 / <strong>登录审计</strong>。
          </p>
        </div>
      </div>
      */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard horizontal title="当前检索总数" value={total} unit="条" icon={FileText} />
        <StatCard horizontal title="本次成功" value={stats.success} unit="条" icon={ShieldCheck} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard horizontal title="本次失败" value={stats.failed} unit="条" icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-600" />
        <StatCard horizontal title="运行中" value={stats.running} unit="条" icon={RefreshCw} iconBg="bg-amber-50" iconColor="text-amber-600" />
      </div>

      <Card className="gap-0">
        <CardHeader className="pb-0">
          <Tabs value={activeType} onValueChange={(v) => setActiveType(v as LogType)}>
            <TabsList className="h-9 flex-wrap">
              <TabsTrigger value="audit" className="text-xs">审计</TabsTrigger>
              <TabsTrigger value="login_audit" className="text-xs">登录审计</TabsTrigger>
              <TabsTrigger value="control" className="text-xs">控制命令</TabsTrigger>
              <TabsTrigger value="sync_package" className="text-xs">同步包</TabsTrigger>
              <TabsTrigger value="sync_table" className="text-xs">同步表</TabsTrigger>
              <TabsTrigger value="sync_scheduler" className="text-xs">调度</TabsTrigger>
              {/* 推送主路径下日常不用，暂隐藏
              <TabsTrigger value="sync_consistency" className="text-xs">一致性</TabsTrigger>
              */}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          {/* 筛选条：各控件统一宽度 */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="flex w-[180px] flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">站点</span>
              <Select
                value={siteCode || "all"}
                onValueChange={(v) => setSiteCode(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-9 w-full" aria-label="按站点筛选">
                  <SelectValue placeholder="全部站点" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部站点</SelectItem>
                  {siteOptions.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {formatSiteLabel(s.code, s.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-[180px] flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">状态</span>
              <Select
                value={status || "all"}
                onValueChange={(v) => setStatus(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-9 w-full" aria-label="按状态筛选">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {logStatusLabel(s, activeType === "all" ? undefined : activeType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showControlExtraFilters && (
              <div className="flex w-[180px] flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">任务类型</span>
                <Select
                  value={taskType || "all"}
                  onValueChange={(v) => setTaskType(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="h-9 w-full" data-testid="logs-filter-task-type" aria-label="按任务类型筛选">
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
            )}
            <div className="flex w-[180px] flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">起始时间</span>
              <Input
                type="datetime-local"
                className="h-9 w-full"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="起始时间"
                aria-label="起始时间"
              />
            </div>
            <div className="flex w-[180px] flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">结束时间</span>
              <Input
                type="datetime-local"
                className="h-9 w-full"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="结束时间"
                aria-label="结束时间"
              />
            </div>
            <div className="flex h-9 items-center gap-2 text-xs text-slate-500">
              <span>共 {total} 条</span>
              <span>第 {page} / {totalPages} 页</span>
              {dataSource === "loading" && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
            <div className="xl:col-span-2 flex flex-col min-h-0">
              {/* 固定高度 + 内部滚动，避免点选底部行后还要滚回顶部看详情 */}
              <div className="h-[560px] overflow-auto rounded-md border border-slate-100 dark:border-slate-800">
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
                        <p className="text-xs mt-1">当前筛选条件下暂无日志数据</p>
                      </>
                    ) : (
                      <p>未找到匹配的日志记录</p>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-white dark:bg-slate-900 shadow-sm">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs text-slate-500">类型</TableHead>
                        <TableHead className="text-xs text-slate-500">操作</TableHead>
                        <TableHead className="text-xs text-slate-500">站点</TableHead>
                        <TableHead className="text-xs text-slate-500">操作人</TableHead>
                        <TableHead className="text-xs text-slate-500">状态</TableHead>
                        <TableHead className="text-xs text-slate-500">时间</TableHead>
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
                          <TableCell className="text-sm text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {logOperationLabel(row)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {(() => {
                              const opt = siteOptions.find((s) => s.code === row.site_code)
                              return opt
                                ? formatSiteLabel(opt.code, opt.name)
                                : logSiteCodeLabel(row.site_code)
                            })()}
                          </TableCell>
                          <TableCell className="text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap">
                            {row.operator?.trim() || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${statusBadgeColor(row.status)}`}>
                              {logStatusLabel(row.status, row.log_type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            <TimeDisplay value={row.occurred_at} mode="datetime" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              {total > 0 && (
                <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={loading || page <= 1}
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
                    disabled={loading || page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    下一页
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">每页</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => setPageSize(Number(v))}
                    >
                      <SelectTrigger className="h-8 w-[88px]" aria-label="每页条数">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50 条</SelectItem>
                        <SelectItem value="100">100 条</SelectItem>
                        <SelectItem value="200">200 条</SelectItem>
                        <SelectItem value="500">500 条</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <DetailPanel
              className="h-[560px] xl:sticky xl:top-3"
              title="日志详情"
              subtitle={selected ? logTypeLabel(selected.log_type) : ""}
              empty={!selected}
            >
              {selected && (
                <div className="space-y-3">
                  <DetailRow label="类型" value={logTypeLabel(selected.log_type)} />
                  <DetailRow label="操作" value={logOperationLabel(selected)} />
                  <DetailRow label="站点" value={logSiteCodeLabel(selected.site_code)} />
                  <DetailRow label="状态" value={
                    <Badge className={`text-xs ${statusBadgeColor(selected.status)}`}>
                      {logStatusLabel(selected.status)}
                    </Badge>
                  } />
                  <DetailRow label="时间" value={<TimeDisplay value={selected.occurred_at} mode="datetime" />} />
                  {selected.operator && <DetailRow label="操作人" value={selected.operator} />}
                  {selected.ref_batch_id && <DetailRow label="批次号" value={<code className="text-[10px]">{selected.ref_batch_id}</code>} />}
                  {(() => {
                    const target = logTargetDisplay(selected)
                    return target ? <DetailRow label={target.label} value={target.value} /> : null
                  })()}
                  <div>
                    <p className="text-xs font-medium text-slate-700 mb-1">详细 (JSON)</p>
                    <pre className="text-[10px] bg-slate-900 text-slate-100 p-2 rounded-lg overflow-x-auto max-h-64">
                      {JSON.stringify(selected.detail, null, 2)}
                    </pre>
                  </div>
                  {/* 数字签名校验暂未接入，按钮不展示
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
                  */}
                </div>
              )}
            </DetailPanel>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
