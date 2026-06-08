"use client"

/**
 * /control - 控制命令列表 (Sprint 4.5)
 *
 * 展示:
 *  - control_command 表全部记录
 *  - 状态徽章: pending / pulled / running / success / failed / cancelled
 *  - 命令类型: task_pause / task_resume / task_reset / task_priority_restore / inspect_start / recovery_start
 *
 * 用途: 让用户看到自己提交的控制命令 + 站点回写结果
 */

import { useEffect, useState, useCallback, Suspense } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RefreshCw, Search, Send, Filter, Terminal } from "lucide-react"
import { useSite } from "@/lib/site/site-context"
import { cn } from "@/lib/utils"

interface ControlCommand {
  id: string
  commandNo: string
  sourceSiteId: string
  commandType: string
  targetType: string
  targetId: string
  payload: Record<string, unknown>
  status: string
  requestedBy: string | null
  requestedIp: string | null
  requestedAt: string
  pulledAt: string | null
  completedAt: string | null
  result: Record<string, unknown> | null
  errorMessage: string | null
}

const statusBadge: Record<string, { label: string; color: string }> = {
  pending: { label: "待站点拉取", color: "bg-slate-100 text-slate-600" },
  pulled: { label: "已拉取", color: "bg-cyan-100 text-cyan-700" },
  running: { label: "执行中", color: "bg-amber-100 text-amber-700" },
  success: { label: "成功", color: "bg-emerald-100 text-emerald-700" },
  failed: { label: "失败", color: "bg-red-100 text-red-700" },
  cancelled: { label: "已取消", color: "bg-slate-200 text-slate-500" },
}

const commandTypeLabel: Record<string, string> = {
  task_pause: "暂停任务",
  task_resume: "恢复任务",
  task_reset: "重置任务",
  task_priority_restore: "优先恢复",
  inspect_start: "启动巡检",
  recovery_start: "启动恢复",
}

export default function ControlPage() {
  return (
    <Suspense fallback={null}>
      <ControlContent />
    </Suspense>
  )
}

function ControlContent() {
  const { siteCode, isReady: siteReady } = useSite()
  const [commands, setCommands] = useState<ControlCommand[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (siteCode) params.set("siteCode", siteCode)
      params.set("limit", "200")
      const res = await fetch(`/api/control/commands?${params}`)
      const data = await res.json()
      if (data.ok) {
        setCommands(data.rows)
      } else {
        throw new Error(data.error || "unknown")
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

  const filtered = commands.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false
    if (search) {
      const s = search.toLowerCase()
      if (
        !c.commandNo.toLowerCase().includes(s) &&
        !c.targetId.toLowerCase().includes(s) &&
        !c.sourceSiteId.toLowerCase().includes(s)
      ) {
        return false
      }
    }
    return true
  })

  const stats = {
    total: commands.length,
    pending: commands.filter((c) => c.status === "pending").length,
    running: commands.filter((c) => c.status === "running" || c.status === "pulled").length,
    success: commands.filter((c) => c.status === "success").length,
    failed: commands.filter((c) => c.status === "failed").length,
  }

  return (
    <AppShell>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <PageHeader
          title="控制命令"
          description={`Sprint 4.5: control_command 队列 · ${siteCode ?? "All Sites"}`}
          actions={
            <Button onClick={load} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              刷新
            </Button>
          }
        />

        {/* 顶部统计 */}
        <div className="grid gap-4 md:grid-cols-5">
          <StatTile label="总数" value={stats.total} icon={Terminal} />
          <StatTile label="待拉取" value={stats.pending} icon={Send} tone="muted" />
          <StatTile label="执行中" value={stats.running} icon={Filter} tone="amber" />
          <StatTile label="成功" value={stats.success} icon={RefreshCw} tone="emerald" />
          <StatTile label="失败" value={stats.failed} icon={Filter} tone="red" />
        </div>

        {/* 列表 + 筛选 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">命令列表</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜索 command_no / target_id..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 w-56"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="all">全部状态</option>
                <option value="pending">pending</option>
                <option value="pulled">pulled</option>
                <option value="running">running</option>
                <option value="success">success</option>
                <option value="failed">failed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> 加载中...
              </div>
            ) : error ? (
              <div className="text-sm text-red-600 py-4">加载失败: {error}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Terminal className="h-8 w-8 mb-2" />
                <p className="text-sm">无控制命令</p>
                {commands.length === 0 && (
                  <p className="text-xs mt-1">
                    提示: 在 Tasks 页面点击暂停/恢复/重置按钮可创建命令
                  </p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>命令编号</TableHead>
                    <TableHead>站点</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>目标</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead>完成时间</TableHead>
                    <TableHead>错误</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const sb = statusBadge[c.status] ?? statusBadge.pending
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.commandNo}</TableCell>
                        <TableCell className="text-xs">{c.sourceSiteId}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {commandTypeLabel[c.commandType] ?? c.commandType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="text-muted-foreground">{c.targetType}:</span>{" "}
                          <span className="font-mono">{c.targetId}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("font-normal", sb.color)}>{sb.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.requestedAt ? new Date(c.requestedAt).toLocaleString("zh-CN") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.completedAt ? new Date(c.completedAt).toLocaleString("zh-CN") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-red-600 max-w-xs truncate" title={c.errorMessage ?? ""}>
                          {c.errorMessage ?? "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  tone?: "default" | "muted" | "amber" | "emerald" | "red"
}) {
  const toneClass = {
    default: "bg-blue-50 text-blue-600",
    muted: "bg-slate-50 text-slate-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
  }[tone]
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("rounded-md p-2", toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}
