"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Terminal,
  XCircle,
} from "lucide-react"
import { useSite } from "@/lib/site/site-context"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GlassPanel } from "@/components/platform/glass-panel"
import { StatCard } from "@/components/platform/stat-card"
import { formatBeijingTime } from "@/components/shared/time-format"

interface ControlCommand {
  id: string
  commandNo: string
  sourceSiteId: string
  commandType: string
  targetType: string
  targetId: string
  status: string
  requestedAt: string
  completedAt: string | null
  errorMessage: string | null
}

/** 直调站点后的展示文案（不再强调代理拉取队列） */
const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "已提交", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  pulled: { label: "处理中", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  running: { label: "执行中", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  success: { label: "执行成功", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  failed: { label: "执行失败", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  cancelled: { label: "已取消", className: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  unsupported: { label: "站点不支持", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  dry_run_success: { label: "历史模拟", className: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
}

const COMMAND_LABELS: Record<string, string> = {
  task_pause: "暂停任务",
  task_resume: "继续任务",
  task_reset: "重置任务",
  inspect_start: "启动巡检",
  recovery_start: "启动恢复",
  task_priority_restore: "优先恢复",
  sync_full: "全量同步",
  sync_incremental: "增量同步",
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

export function ControlCommandPanel() {
  const { siteCode, isReady: siteReady } = useSite()
  const [commands, setCommands] = useState<ControlCommand[]>([])
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState("")
  const [debouncedKeyword, setDebouncedKeyword] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300)
    return () => window.clearTimeout(t)
  }, [keyword])

  useEffect(() => {
    setPage(1)
  }, [debouncedKeyword, status, siteCode, pageSize])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (siteCode) params.set("siteCode", siteCode)
      if (status !== "all") params.set("status", status)
      if (debouncedKeyword) params.set("keyword", debouncedKeyword)

      const response = await fetch(`/api/control/commands?${params}`, {
        cache: "no-store",
      })
      const body = await response.json()
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "控制命令读取失败")
      }
      setCommands(body.rows ?? [])
      setTotal(Number(body.total) || 0)
      setStatusCounts((body.statusCounts as Record<string, number>) ?? {})
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [siteCode, page, pageSize, status, debouncedKeyword])

  useEffect(() => {
    if (!siteReady) return
    void load()
    const timer = window.setInterval(() => void load(), 5_000)
    return () => window.clearInterval(timer)
  }, [load, siteReady])

  const stats = useMemo(() => {
    const pending = statusCounts.pending ?? 0
    const active = (statusCounts.pulled ?? 0) + (statusCounts.running ?? 0)
    const success = statusCounts.success ?? 0
    const failed = (statusCounts.failed ?? 0) + (statusCounts.unsupported ?? 0)
    const totalAll = Object.values(statusCounts).reduce((sum, n) => sum + n, 0)
    return { total: totalAll, pending, active, success, failed }
  }, [statusCounts])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:gap-4"
      data-testid="control-command-panel"
    >
      <GlassPanel testId="control-hero-glass-panel" className="shrink-0">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 lg:gap-4">
          <StatCard horizontal title="全部命令" value={stats.total} unit="条" icon={Terminal} />
          <StatCard
            horizontal
            title="已提交"
            value={stats.pending}
            icon={Clock3}
            iconBg="bg-slate-50"
            iconColor="text-slate-600"
          />
          <StatCard
            horizontal
            title="执行中"
            value={stats.active}
            icon={RefreshCw}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
          />
          <StatCard
            horizontal
            title="成功"
            value={stats.success}
            icon={CheckCircle2}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />
          <StatCard
            horizontal
            title="失败/不支持"
            value={stats.failed}
            icon={XCircle}
            iconBg="bg-red-50"
            iconColor="text-red-600"
          />
        </div>
      </GlassPanel>

      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0" data-testid="control-list-card">
        <CardHeader className="flex shrink-0 flex-row flex-wrap items-center gap-2 space-y-0 border-b border-slate-100 px-4 !py-3 dark:border-slate-700">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="命令编号 / 任务源 ID / 站点"
              className="h-8 pl-9"
              data-testid="control-search"
              aria-label="搜索控制命令"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-[9.5rem]" data-testid="control-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {Object.keys(STATUS_META).map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_META[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => void load()}
            disabled={loading}
            data-testid="control-refresh"
          >
            <RefreshCw className={cn("mr-1 h-3.5 w-3.5", loading && "animate-spin")} />
            刷新
          </Button>
          <span className="ml-auto text-xs text-slate-400 shrink-0">
            {loading && commands.length === 0
              ? "加载中…"
              : `本页 ${commands.length} 条 · 共 ${total} 条`}
          </span>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-auto p-0">
          {loading && commands.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500 dark:text-slate-400">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              读取控制命令
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-red-600 dark:text-red-400">加载失败：{error}</div>
          ) : commands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400">
              <Terminal className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-400" />
              <p className="text-sm">当前筛选条件下没有控制命令</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white dark:bg-slate-800">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-sm text-slate-500 whitespace-nowrap">命令编号</TableHead>
                  <TableHead className="text-sm text-slate-500 whitespace-nowrap">站点</TableHead>
                  <TableHead className="text-sm text-slate-500 whitespace-nowrap">动作</TableHead>
                  <TableHead className="text-sm text-slate-500 whitespace-nowrap">任务源 ID</TableHead>
                  <TableHead className="text-sm text-slate-500 whitespace-nowrap">状态</TableHead>
                  <TableHead className="text-sm text-slate-500 whitespace-nowrap">提交时间</TableHead>
                  <TableHead className="text-sm text-slate-500 whitespace-nowrap">完成时间</TableHead>
                  <TableHead className="text-sm text-slate-500 whitespace-nowrap">错误</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commands.map((command) => {
                  const statusMeta = STATUS_META[command.status] ?? {
                    label: command.status,
                    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                  }
                  return (
                    <TableRow key={command.id}>
                      <TableCell className="font-mono text-sm">{command.commandNo}</TableCell>
                      <TableCell className="text-sm">{command.sourceSiteId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {COMMAND_LABELS[command.commandType] ?? command.commandType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{command.targetId}</TableCell>
                      <TableCell>
                        <Badge className={cn("font-normal", statusMeta.className)}>
                          {statusMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                        {formatBeijingTime(command.requestedAt) || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                        {formatBeijingTime(command.completedAt) || "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-56 truncate text-sm text-red-600 dark:text-red-400"
                        title={command.errorMessage ?? ""}
                      >
                        {command.errorMessage ?? "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {total > 0 && (
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page <= 1 || loading}
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
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
            </Button>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">每页</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v))
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-[88px]" aria-label="每页条数">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} 条
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
