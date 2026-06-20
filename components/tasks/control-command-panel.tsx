"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Search, Terminal, XCircle } from "lucide-react"
import { useSite } from "@/lib/site/site-context"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "待 Agent 拉取", className: "bg-slate-100 text-slate-700" },
  pulled: { label: "已拉取", className: "bg-cyan-100 text-cyan-700" },
  running: { label: "执行中", className: "bg-amber-100 text-amber-700" },
  success: { label: "执行成功", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "执行失败", className: "bg-red-100 text-red-700" },
  cancelled: { label: "已取消", className: "bg-slate-200 text-slate-600" },
  unsupported: { label: "站点不支持", className: "bg-orange-100 text-orange-700" },
  dry_run_success: { label: "历史 DRY_RUN", className: "bg-amber-50 text-amber-700" },
}

const COMMAND_LABELS: Record<string, string> = {
  task_pause: "暂停任务",
  task_resume: "继续任务",
  task_reset: "重置任务",
  inspect_start: "启动巡检",
  recovery_start: "启动恢复",
  task_priority_restore: "优先恢复",
}

export function ControlCommandPanel() {
  const { siteCode, isReady: siteReady } = useSite()
  const [commands, setCommands] = useState<ControlCommand[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState("")
  const [status, setStatus] = useState("all")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: "200" })
      if (siteCode) params.set("siteCode", siteCode)
      const response = await fetch(`/api/control/commands?${params}`, {
        cache: "no-store",
      })
      const body = await response.json()
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "控制命令读取失败")
      }
      setCommands(body.rows ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [siteCode])

  useEffect(() => {
    if (!siteReady) return
    void load()
    const timer = window.setInterval(() => void load(), 5_000)
    return () => window.clearInterval(timer)
  }, [load, siteReady])

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return commands.filter((command) => {
      if (status !== "all" && command.status !== status) return false
      if (!normalized) return true
      return [command.commandNo, command.targetId, command.sourceSiteId]
        .some((value) => value.toLowerCase().includes(normalized))
    })
  }, [commands, keyword, status])

  const stats = useMemo(() => ({
    total: commands.length,
    waiting: commands.filter((item) => item.status === "pending").length,
    active: commands.filter((item) => ["pulled", "running"].includes(item.status)).length,
    success: commands.filter((item) => item.status === "success").length,
    failed: commands.filter((item) => ["failed", "unsupported"].includes(item.status)).length,
  }), [commands])

  return (
    <div className="space-y-4" data-testid="control-command-panel">
      <Card className="gap-0 border-blue-200 bg-blue-50/60">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <div>
            <p className="font-medium text-blue-950">控制结果来自中心 control_command</p>
            <p className="mt-1 text-blue-800">
              pause/resume 已有 Site Agent 恢复库闭环；其他动作仍按 unsupported 或实际结果展示。
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Summary label="全部命令" value={stats.total} icon={Terminal} />
        <Summary label="待拉取" value={stats.waiting} icon={Clock3} tone="slate" />
        <Summary label="执行中" value={stats.active} icon={RefreshCw} tone="amber" />
        <Summary label="成功" value={stats.success} icon={CheckCircle2} tone="emerald" />
        <Summary label="失败/不支持" value={stats.failed} icon={XCircle} tone="red" />
      </div>

      <Card className="gap-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b py-4">
          <CardTitle className="text-base">控制命令记录</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} data-testid="control-refresh">
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            刷新
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="命令编号 / 任务源 ID / 站点"
                className="pl-9"
                data-testid="control-search"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-44" data-testid="control-status-filter">
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
          </div>

          {loading && commands.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              读取控制命令
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-red-600">加载失败：{error}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Terminal className="mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm">当前筛选条件下没有控制命令</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>命令编号</TableHead>
                    <TableHead>站点</TableHead>
                    <TableHead>动作</TableHead>
                    <TableHead>任务源 ID</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead>完成时间</TableHead>
                    <TableHead>错误</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((command) => {
                    const statusMeta = STATUS_META[command.status] ?? {
                      label: command.status,
                      className: "bg-slate-100 text-slate-700",
                    }
                    return (
                      <TableRow key={command.id}>
                        <TableCell className="font-mono text-xs">{command.commandNo}</TableCell>
                        <TableCell>{command.sourceSiteId}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {COMMAND_LABELS[command.commandType] ?? command.commandType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{command.targetId}</TableCell>
                        <TableCell>
                          <Badge className={cn("font-normal", statusMeta.className)}>
                            {statusMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">
                          {formatBeijingTime(command.requestedAt) || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">
                          {formatBeijingTime(command.completedAt) || "—"}
                        </TableCell>
                        <TableCell className="max-w-56 truncate text-xs text-red-600" title={command.errorMessage ?? ""}>
                          {command.errorMessage ?? "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
function Summary({
  label,
  value,
  icon: Icon,
  tone = "blue",
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  tone?: "blue" | "slate" | "amber" | "emerald" | "red"
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
  }
  return (
    <Card className="gap-0">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("rounded-lg p-2", tones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-950">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
