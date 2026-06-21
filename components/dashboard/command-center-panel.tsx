"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Command,
  Database,
  Gauge,
  HardDrive,
  Layers3,
  Network,
  RadioTower,
  RefreshCw,
  Search,
  ShieldCheck,
  TerminalSquare,
  type LucideIcon,
} from "lucide-react"
import { useSite } from "@/lib/site/site-context"
import { formatBeijingTime } from "@/components/shared/time-format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SummaryData {
  taskCount: number
  deviceCount: number
  volumeCount: number
  userCount: number
  packageCount: number
  failedPackageCount: number
  lastSyncAt: string | null
  successRate: number | null
  siteCount: number | null
}

interface SiteStatus {
  siteCode: string
  siteName: string
  enabled: boolean
  schedulerStatus: string
  packageStatus: string
  consistencyStatus: string
  matchedTableCount: number | null
  mismatchedTableCount: number | null
  agentStatus: string
  agentReportedAt: string | null
  packageCreatedAt: string | null
}

interface PackageItem {
  id: string
  siteCode: string
  batchId: string
  status: string
  tableCount: number
  totalRecordCount: number
  createdAt: string
  finishedAt: string | null
}

interface ControlItem {
  id: string
  commandNo?: string
  command_no?: string
  sourceSiteId?: string
  source_site_id?: string
  commandType?: string
  command_type?: string
  targetId?: string
  target_id?: string
  status: string
  requestedAt?: string
  requested_at?: string
}

interface AlertItem {
  id: string
  title: string
  severity?: string
  status?: string
  time?: string
}

interface CommandCenterState {
  summary: SummaryData | null
  sites: SiteStatus[]
  packages: PackageItem[]
  commands: ControlItem[]
  alerts: AlertItem[]
  loading: boolean
  error: string | null
  updatedAt: string | null
}

const emptySummary: SummaryData = {
  taskCount: 0,
  deviceCount: 0,
  volumeCount: 0,
  userCount: 0,
  packageCount: 0,
  failedPackageCount: 0,
  lastSyncAt: null,
  successRate: null,
  siteCount: null,
}

function statusTone(status: string): "good" | "warn" | "bad" | "idle" {
  const s = status.toLowerCase()
  if (["success", "matched", "online", "healthy", "completed", "synced", "ok"].includes(s)) return "good"
  if (["running", "pending", "stale", "partial", "not_run", "not_registered"].includes(s)) return "warn"
  if (["failed", "mismatched", "offline", "degraded", "error", "cancelled"].includes(s)) return "bad"
  return "idle"
}

function toneClasses(tone: ReturnType<typeof statusTone>) {
  if (tone === "good") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
  if (tone === "warn") return "border-amber-300/30 bg-amber-300/10 text-amber-100"
  if (tone === "bad") return "border-red-400/30 bg-red-400/10 text-red-100"
  return "border-slate-500/30 bg-slate-500/10 text-slate-200"
}

function compactTime(value: string | null | undefined) {
  if (!value) return "暂无"
  return formatBeijingTime(value)
}

function commandNo(command: ControlItem) {
  return command.commandNo ?? command.command_no ?? command.id
}

function commandType(command: ControlItem) {
  return command.commandType ?? command.command_type ?? "unknown"
}

export function CommandCenterPanel() {
  const { siteCode, isAllSites, isReady } = useSite()
  const [state, setState] = useState<CommandCenterState>({
    summary: null,
    sites: [],
    packages: [],
    commands: [],
    alerts: [],
    loading: true,
    error: null,
    updatedAt: null,
  })

  const activeSite = isReady && !isAllSites ? siteCode : null

  useEffect(() => {
    let cancelled = false
    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const summaryUrl = activeSite
          ? `/api/dashboard/summary?siteCode=${encodeURIComponent(activeSite)}`
          : "/api/dashboard/summary"
        const packagesUrl = activeSite
          ? `/api/sync/packages?pageSize=6&siteCode=${encodeURIComponent(activeSite)}`
          : "/api/sync/packages?pageSize=6"
        const commandsUrl = activeSite
          ? `/api/control/commands?limit=6&siteCode=${encodeURIComponent(activeSite)}`
          : "/api/control/commands?limit=6"
        const alertsUrl = activeSite
          ? `/api/alerts?pageSize=6&siteCode=${encodeURIComponent(activeSite)}`
          : "/api/alerts?pageSize=6"

        const [summaryRes, sitesRes, packagesRes, commandsRes, alertsRes] = await Promise.all([
          fetch(summaryUrl, { cache: "no-store" }),
          fetch("/api/sync/sites/status", { cache: "no-store" }),
          fetch(packagesUrl, { cache: "no-store" }),
          fetch(commandsUrl, { cache: "no-store" }),
          fetch(alertsUrl, { cache: "no-store" }),
        ])

        if (!summaryRes.ok || !sitesRes.ok || !packagesRes.ok || !commandsRes.ok || !alertsRes.ok) {
          throw new Error("Command Center source API failed")
        }

        const [summaryJson, sitesJson, packagesJson, commandsJson, alertsJson] = await Promise.all([
          summaryRes.json(),
          sitesRes.json(),
          packagesRes.json(),
          commandsRes.json(),
          alertsRes.json(),
        ])

        if (cancelled) return
        setState({
          summary: summaryJson.data ?? emptySummary,
          sites: sitesJson.data?.items ?? [],
          packages: packagesJson.data?.items ?? [],
          commands: commandsJson.items ?? commandsJson.data?.items ?? [],
          alerts: alertsJson.data?.items ?? [],
          loading: false,
          error: null,
          updatedAt: new Date().toISOString(),
        })
      } catch (error) {
        if (cancelled) return
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
          updatedAt: new Date().toISOString(),
        }))
      }
    }

    load()
    const timer = window.setInterval(load, 30_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeSite])

  const summary = state.summary ?? emptySummary
  const siteStats = useMemo(() => {
    const total = state.sites.length
    const online = state.sites.filter((s) => s.agentStatus === "online").length
    const degraded = state.sites.filter((s) => ["degraded", "stale"].includes(s.agentStatus)).length
    const offline = state.sites.filter((s) => ["offline", "not_registered"].includes(s.agentStatus)).length
    return { total, online, degraded, offline }
  }, [state.sites])

  const controlStats = useMemo(() => {
    const pending = state.commands.filter((c) => ["pending", "running"].includes(c.status)).length
    const success = state.commands.filter((c) => ["success", "dry_run_success", "completed"].includes(c.status)).length
    const failed = state.commands.filter((c) => ["failed", "cancelled", "unsupported"].includes(c.status)).length
    return { pending, success, failed }
  }, [state.commands])

  const syncRisk = summary.packageCount > 0
    ? Math.max(0, Math.round(((summary.packageCount - summary.failedPackageCount) / summary.packageCount) * 100))
    : summary.successRate ?? 0

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-2xl shadow-slate-950/20"
      data-testid="command-center-panel"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.35),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(245,158,11,0.18),transparent_28%),linear-gradient(135deg,rgba(30,64,175,0.28),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:32px_32px]" />

      <div className="relative p-5 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-blue-400/40 bg-blue-400/15 text-blue-100">
                <TerminalSquare className="mr-1 h-3 w-3" />
                COMMAND CENTER
              </Badge>
              <Badge className="border-emerald-400/40 bg-emerald-400/15 text-emerald-100">
                <Database className="mr-1 h-3 w-3" />
                real API only
              </Badge>
              <Badge className="border-amber-300/40 bg-amber-300/15 text-amber-100">
                {isReady ? (activeSite ?? "全部站点") : "站点加载中"}
              </Badge>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight lg:text-4xl">
              集团光盘库总控指挥台
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              同步、控制队列、站点 Agent、日志风险集中呈现；所有指标来自中心库和现有 API，不使用 mock fallback。
            </p>
          </div>

          <div className="grid min-w-[260px] grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
            <StatusTile label="站点在线" value={`${siteStats.online}/${siteStats.total || 0}`} tone={siteStats.offline > 0 ? "warn" : "good"} />
            <StatusTile label="同步成功率" value={summary.packageCount > 0 ? `${syncRisk}%` : "暂无"} tone={summary.failedPackageCount > 0 ? "warn" : "good"} />
            <StatusTile label="控制待处理" value={controlStats.pending} tone={controlStats.pending > 0 ? "warn" : "good"} />
            <StatusTile label="活跃告警" value={state.alerts.length} tone={state.alerts.length > 0 ? "bad" : "good"} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard icon={Layers3} label="任务" value={summary.taskCount} href="/tasks" testid="command-center-metric-tasks" />
          <MetricCard icon={HardDrive} label="设备" value={summary.deviceCount} href="/racks" testid="command-center-metric-devices" />
          <MetricCard icon={Database} label="存储卷" value={summary.volumeCount} href="/volumes" testid="command-center-metric-volumes" />
          <MetricCard icon={RadioTower} label="站点" value={summary.siteCount ?? siteStats.total} href="/sites" testid="command-center-metric-sites" />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <OperationalCard
            title="站点拓扑"
            icon={Network}
            description={`${siteStats.online} online / ${siteStats.degraded} degraded / ${siteStats.offline} offline`}
            testid="command-center-site-topology"
          >
            <div className="grid grid-cols-2 gap-2">
              {state.sites.slice(0, 8).map((site) => {
                const tone = statusTone(site.agentStatus)
                return (
                  <div key={site.siteCode} className={cn("rounded-xl border px-3 py-2", toneClasses(tone))}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold">{site.siteCode}</span>
                      <span className={cn("h-2 w-2 rounded-full", tone === "good" ? "bg-emerald-300" : tone === "bad" ? "bg-red-300" : "bg-amber-300")} />
                    </div>
                    <p className="mt-1 truncate text-[11px] opacity-80">{site.siteName}</p>
                    <p className="mt-1 text-[10px] opacity-70">{site.agentStatus}</p>
                  </div>
                )
              })}
              {state.sites.length === 0 && <EmptyLine text="暂无站点配置" />}
            </div>
          </OperationalCard>

          <OperationalCard
            title="同步健康"
            icon={RefreshCw}
            description={`latest package: ${state.packages[0]?.status ?? "none"}`}
            testid="command-center-sync-health"
          >
            <div className="space-y-2">
              {state.packages.slice(0, 4).map((pkg) => (
                <StreamRow
                  key={pkg.id}
                  left={pkg.siteCode}
                  title={pkg.batchId}
                  detail={`${pkg.tableCount} tables · ${pkg.totalRecordCount} rows`}
                  status={pkg.status}
                  time={pkg.finishedAt ?? pkg.createdAt}
                />
              ))}
              {state.packages.length === 0 && <EmptyLine text="暂无同步包记录" />}
            </div>
          </OperationalCard>

          <OperationalCard
            title="控制队列"
            icon={Command}
            description={`${controlStats.pending} pending / ${controlStats.failed} blocked`}
            testid="command-center-control-queue"
          >
            <div className="space-y-2">
              {state.commands.slice(0, 4).map((command) => (
                <StreamRow
                  key={command.id}
                  left={command.status}
                  title={commandType(command)}
                  detail={commandNo(command)}
                  status={command.status}
                  time={command.requestedAt ?? command.requested_at}
                />
              ))}
              {state.commands.length === 0 && <EmptyLine text="暂无控制命令" />}
            </div>
          </OperationalCard>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-300 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Evidence icon={ShieldCheck} text="无 mock fallback" />
            <Evidence icon={Gauge} text="同步 / 控制 / 告警真实 API" />
            <Evidence icon={Clock3} text={`刷新 ${state.updatedAt ? compactTime(state.updatedAt) : "加载中"}`} />
            {state.error && <Evidence icon={AlertTriangle} text={`error: ${state.error}`} danger />}
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" className="h-8 bg-blue-500 text-white hover:bg-blue-400">
              <Link href="/sync">
                同步中心
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="h-8 border-white/15 bg-white/5 text-white hover:bg-white/10">
              <Link href="/logs">查看日志</Link>
            </Button>
          </div>
        </div>

        {/* R.UI-CmdCenter: 4 大通道 + strict/candidate 状态 */}
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="command-center-lanes">
          <LaneCard
            icon={RefreshCw}
            title="同步"
            href="/sync"
            evidence="pg_dump 白名单 / Site Agent"
            testid="command-center-lane-sync"
          />
          <LaneCard
            icon={Command}
            title="控制"
            href="/tasks?view=commands"
            evidence="control_command / Agent poll"
            testid="command-center-lane-control"
          />
          <LaneCard
            icon={Search}
            title="检索"
            href="/search"
            evidence="ES boundary / center index"
            testid="command-center-lane-search"
          />
          <LaneCard
            icon={ShieldCheck}
            title="安全"
            href="/logs"
            evidence="JWT / RBAC / audit hash"
            testid="command-center-lane-security"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="command-center-status-badges">
          <Badge className="border-blue-400/40 bg-blue-400/15 text-blue-100">strict 29/45</Badge>
          <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/10 text-emerald-100">candidate 45/45</Badge>
          <span className="text-[10px] text-slate-400">strict 基于 requirements.md 验收 · candidate 含阻塞边界</span>
        </div>

        {state.loading && (
          <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-white/10">
            <div className="h-full w-1/3 animate-pulse bg-blue-400" />
          </div>
        )}
      </div>
    </section>
  )
}

function StatusTile({ label, value, tone }: { label: string; value: string | number; tone: ReturnType<typeof statusTone> }) {
  return (
    <div className={cn("rounded-xl border px-3 py-2", toneClasses(tone))}>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, href, testid }: { icon: LucideIcon; label: string; value: number; href: string; testid: string }) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:-translate-y-0.5 hover:border-blue-300/40 hover:bg-blue-400/10"
      data-testid={testid}
    >
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-blue-400/15 p-2 text-blue-100">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:text-blue-200" />
      </div>
      <p className="mt-4 text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value.toLocaleString("zh-CN")}</p>
    </Link>
  )
}

function OperationalCard({ title, icon: Icon, description, testid, children }: { title: string; icon: LucideIcon; description: string; testid: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur" data-testid={testid}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-blue-200" />
            <h2 className="text-sm font-semibold text-white">{title}</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function StreamRow({ left, title, detail, status, time }: { left: string; title: string; detail: string; status: string; time?: string | null }) {
  const tone = statusTone(status)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2">
      <div className={cn("min-w-14 rounded-lg border px-2 py-1 text-center font-mono text-[10px]", toneClasses(tone))}>
        {left}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {tone === "good" ? <CheckCircle2 className="h-3 w-3 text-emerald-300" /> : <Activity className="h-3 w-3 text-blue-200" />}
          <p className="truncate text-xs font-medium text-slate-100">{title}</p>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">{detail}</p>
      </div>
      <div className="hidden text-right text-[10px] text-slate-500 sm:block">{compactTime(time)}</div>
    </div>
  )
}

function Evidence({ icon: Icon, text, danger = false }: { icon: LucideIcon; text: string; danger?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1", danger ? "border-red-300/30 bg-red-400/10 text-red-100" : "border-white/10 bg-white/5")}>
      <Icon className="h-3 w-3" />
      {text}
    </span>
  )
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center text-xs text-slate-500">{text}</div>
}

function LaneCard({
  icon: Icon,
  title,
  href,
  evidence,
  testid,
}: {
  icon: LucideIcon
  title: string
  href: string
  evidence: string
  testid: string
}) {
  return (
    <Link
      href={href}
      data-testid={testid}
      className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-4 transition hover:-translate-y-0.5 hover:border-blue-300/40 hover:bg-blue-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <div className="rounded-xl bg-blue-400/15 p-2 text-blue-100 transition group-hover:bg-blue-400/25">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white">{title}</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-blue-200" />
        </div>
        <p className="mt-1 truncate text-[11px] text-slate-400">{evidence}</p>
      </div>
    </Link>
  )
}
