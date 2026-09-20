"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
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
  Loader2,
  type LucideIcon,
} from "lucide-react"
import { useSite } from "@/lib/site/site-context"
import { formatBeijingTime } from "@/components/shared/time-format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getSession } from "@/lib/auth/session"
import { canAccessPath } from "@/lib/auth/menu-permissions"
import { toast } from "@/hooks/use-toast"

interface SummaryData {
  taskCount: number
  taskCompletedCount: number
  taskRunningCount: number
  taskFailedCount: number
  deviceCount: number
  deviceOnlineCount: number
  deviceOfflineCount: number
  deviceAbnormalCount: number
  volumeCount: number
  volumeTotalCapacityBytes: number
  volumeUsedCapacityBytes: number
  volumeUsagePercent: number | null
  userCount: number
  packageCount: number
  failedPackageCount: number
  lastSyncAt: string | null
  successRate: number | null
  siteCount: number | null
}

interface RegistrySite {
  code: string
  name: string
  status: string
  reachabilityNote?: string
  reachabilitySource?: string
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

interface CommandCenterState {
  summary: SummaryData | null
  /** 与站点管理一致：列表先出，TCP 由 /api/sites/reachability 异步探测 */
  sites: RegistrySite[]
  packages: PackageItem[]
  commands: ControlItem[]
  /** 站点预警 open 总数（与 EarlyWarningPreview 同源 API） */
  earlyWarningOpenTotal: number
  loading: boolean
  error: string | null
  updatedAt: string | null
}

const emptySummary: SummaryData = {
  taskCount: 0,
  taskCompletedCount: 0,
  taskRunningCount: 0,
  taskFailedCount: 0,
  deviceCount: 0,
  deviceOnlineCount: 0,
  deviceOfflineCount: 0,
  deviceAbnormalCount: 0,
  volumeCount: 0,
  volumeTotalCapacityBytes: 0,
  volumeUsedCapacityBytes: 0,
  volumeUsagePercent: null,
  userCount: 0,
  packageCount: 0,
  failedPackageCount: 0,
  lastSyncAt: null,
  successRate: null,
  siteCount: null,
}

function formatCapacityBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(size >= 100 || index === 0 ? 0 : 1)} ${units[index]}`
}

function normalizeSummary(raw: Partial<SummaryData> | null | undefined): SummaryData {
  if (!raw) return emptySummary
  return {
    ...emptySummary,
    ...raw,
    taskCompletedCount: raw.taskCompletedCount ?? 0,
    taskRunningCount: raw.taskRunningCount ?? 0,
    taskFailedCount: raw.taskFailedCount ?? 0,
    deviceOnlineCount: raw.deviceOnlineCount ?? 0,
    deviceOfflineCount: raw.deviceOfflineCount ?? 0,
    deviceAbnormalCount: raw.deviceAbnormalCount ?? 0,
    volumeTotalCapacityBytes: raw.volumeTotalCapacityBytes ?? 0,
    volumeUsedCapacityBytes: raw.volumeUsedCapacityBytes ?? 0,
    volumeUsagePercent: raw.volumeUsagePercent ?? null,
  }
}

function statusTone(status: string): "good" | "warn" | "bad" | "idle" {
  const s = status.toLowerCase()
  if (["success", "matched", "online", "healthy", "completed", "synced", "ok"].includes(s)) return "good"
  if (["running", "pending", "stale", "partial", "not_run", "not_registered", "checking"].includes(s)) return "warn"
  if (["failed", "mismatched", "offline", "degraded", "error", "cancelled"].includes(s)) return "bad"
  return "idle"
}

function toneClasses(tone: ReturnType<typeof statusTone>) {
  if (tone === "good") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
  }
  if (tone === "warn") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
  }
  if (tone === "bad") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
  }
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
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

const PACKAGE_STATUS_LABELS: Record<string, string> = {
  success: "成功",
  failed: "失败",
  partial: "部分成功",
  running: "运行中",
  pending: "等待中",
}

const COMMAND_STATUS_LABELS: Record<string, string> = {
  pending: "待拉取",
  pulled: "已拉取",
  running: "执行中",
  success: "成功",
  failed: "失败",
  cancelled: "已取消",
  unsupported: "不支持",
  dry_run_success: "模拟",
  completed: "已完成",
}

const COMMAND_TYPE_LABELS: Record<string, string> = {
  task_pause: "暂停任务",
  task_resume: "继续任务",
  task_reset: "重置任务",
  inspect_start: "启动巡检",
  recovery_start: "启动恢复",
  task_priority_restore: "优先恢复",
  sync_full: "全量同步",
  sync_incremental: "增量同步",
  task_create: "创建任务",
  cage_move_register: "笼位移动",
  permission_sync: "权限同步",
}

function packageStatusLabel(status: string | null | undefined): string {
  if (!status) return "暂无"
  return PACKAGE_STATUS_LABELS[status] ?? status
}

function commandStatusLabel(status: string | null | undefined): string {
  if (!status) return "未知"
  return COMMAND_STATUS_LABELS[status] ?? status
}

function commandTypeLabel(type: string | null | undefined): string {
  if (!type) return "未知命令"
  return COMMAND_TYPE_LABELS[type] ?? type
}

function hrefPath(href: string): string {
  return href.split("?")[0] || "/"
}

function denyNavigateToast(label?: string) {
  toast({
    title: "无权限访问该模块",
    description: label
      ? `当前角色无法打开「${label}」，仅可在控制台查看汇总。`
      : "当前角色无对应菜单权限，仅可在控制台查看汇总。",
  })
}

export function CommandCenterPanel() {
  const { siteCode, regionCode, isAllSites, isReady } = useSite()
  const [permissions, setPermissions] = useState<string[]>([])
  const [state, setState] = useState<CommandCenterState>({
    summary: null,
    sites: [],
    packages: [],
    commands: [],
    earlyWarningOpenTotal: 0,
    loading: true,
    error: null,
    updatedAt: null,
  })

  const activeSite = isReady && !isAllSites ? siteCode : null
  const activeRegion = isReady && !activeSite ? regionCode : null

  const canGo = useCallback(
    (href: string) => canAccessPath(permissions, hrefPath(href)),
    [permissions],
  )

  useEffect(() => {
    let cancelled = false
    getSession().then((session) => {
      if (cancelled) return
      setPermissions(session?.permissions ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const scopeQs = new URLSearchParams()
        if (activeSite) scopeQs.set("siteCode", activeSite)
        else if (activeRegion) scopeQs.set("regionCode", activeRegion)
        const scopeSuffix = scopeQs.toString() ? `?${scopeQs.toString()}` : ""
        const summaryUrl = `/api/dashboard/summary${scopeSuffix}`
        const packagesUrl = `/api/sync/packages?pageSize=6${
          activeSite
            ? `&siteCode=${encodeURIComponent(activeSite)}`
            : activeRegion
              ? `&regionCode=${encodeURIComponent(activeRegion)}`
              : ""
        }`
        const commandsUrl = `/api/control/commands?limit=6${
          activeSite
            ? `&siteCode=${encodeURIComponent(activeSite)}`
            : activeRegion
              ? `&regionCode=${encodeURIComponent(activeRegion)}`
              : ""
        }`
        const earlyWarningUrl = `/api/early-warning?statusGroup=open&limit=1&offset=0${
          activeSite
            ? `&siteCode=${encodeURIComponent(activeSite)}`
            : activeRegion
              ? `&regionCode=${encodeURIComponent(activeRegion)}`
              : ""
        }`

        const [summaryRes, sitesRes, packagesRes, commandsRes, earlyWarningRes] = await Promise.all([
          fetch(summaryUrl, { cache: "no-store", credentials: "include" }),
          fetch("/api/sites", { cache: "no-store", credentials: "include" }),
          fetch(packagesUrl, { cache: "no-store", credentials: "include" }),
          fetch(commandsUrl, { cache: "no-store", credentials: "include" }),
          fetch(earlyWarningUrl, { cache: "no-store", credentials: "include" }),
        ])

        // 汇总主接口失败才算整页失败；其它源接口降级为空
        if (!summaryRes.ok) {
          throw new Error("控制台汇总接口不可用")
        }

        const summaryJson = await summaryRes.json()
        const sitesJson = sitesRes.ok ? await sitesRes.json() : { data: [] }
        const packagesJson = packagesRes.ok ? await packagesRes.json() : { data: { items: [] } }
        const commandsJson = commandsRes.ok ? await commandsRes.json() : { rows: [] }
        const earlyWarningJson = earlyWarningRes.ok
          ? await earlyWarningRes.json()
          : { data: { total: 0 } }

        if (cancelled) return

        const softFails: string[] = []
        if (!sitesRes.ok) softFails.push("站点")
        if (!packagesRes.ok) softFails.push("同步")
        if (!commandsRes.ok) softFails.push("控制队列")
        if (!earlyWarningRes.ok) softFails.push("预警")

        const registrySites: RegistrySite[] = Array.isArray(sitesJson.data)
          ? sitesJson.data.map((s: {
              code?: string
              name?: string
              status?: string
              reachabilityNote?: string
              reachabilitySource?: string
            }) => ({
              code: s.code ?? "",
              name: s.name ?? s.code ?? "",
              status: s.status ?? "checking",
              reachabilityNote: s.reachabilityNote,
              reachabilitySource: s.reachabilitySource,
            }))
          : []
        const filteredSites = registrySites.filter((s) => s.code)
        // 首屏：API 的 checking 正常展示；定时刷新：保留上次 online/offline，避免拓扑反复转圈
        setState((prev) => {
          const prevByCode = new Map(prev.sites.map((s) => [s.code, s]))
          const sites = filteredSites.map((s) => {
            const old = prevByCode.get(s.code)
            if (
              old &&
              s.status === "checking" &&
              (old.status === "online" || old.status === "offline")
            ) {
              return {
                ...s,
                status: old.status,
                reachabilityNote: old.reachabilityNote,
                reachabilitySource: old.reachabilitySource,
              }
            }
            return s
          })
          return {
            summary: normalizeSummary(summaryJson.data),
            sites,
            packages: packagesJson.data?.items ?? [],
            commands: commandsJson.rows ?? commandsJson.items ?? commandsJson.data?.items ?? [],
            earlyWarningOpenTotal: Number(earlyWarningJson.data?.total ?? 0),
            loading: false,
            error: softFails.length > 0 ? `部分模块暂不可用: ${softFails.join("、")}` : null,
            updatedAt: new Date().toISOString(),
          }
        })

        // 列表不阻塞：异步刷在线状态
        void (async () => {
          try {
            const reachRes = await fetch("/api/sites/reachability", {
              cache: "no-store",
              credentials: "include",
            })
            if (!reachRes.ok || cancelled) return
            const reachJson = await reachRes.json()
            const items = Array.isArray(reachJson.data) ? reachJson.data : []
            if (items.length === 0 || cancelled) return
            const byCode = new Map(
              items.map((i: { code?: string; status?: string; reachabilityNote?: string; reachabilitySource?: string }) => [
                i.code,
                i,
              ]),
            )
            setState((prev) => ({
              ...prev,
              sites: prev.sites.map((s) => {
                const hit = byCode.get(s.code) as
                  | { status?: string; reachabilityNote?: string; reachabilitySource?: string }
                  | undefined
                if (!hit) return s
                return {
                  ...s,
                  status: hit.status ?? s.status,
                  reachabilityNote: hit.reachabilityNote ?? s.reachabilityNote,
                  reachabilitySource: hit.reachabilitySource ?? s.reachabilitySource,
                }
              }),
              updatedAt: new Date().toISOString(),
            }))
          } catch {
            /* 探测失败时保留 checking/列表态 */
          }
        })()
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
  }, [activeSite, activeRegion])

  const summary = state.summary ?? emptySummary

  const scopedSites = useMemo(() => {
    if (activeSite) return state.sites.filter((s) => s.code === activeSite)
    return state.sites
  }, [state.sites, activeSite])

  const siteStats = useMemo(() => {
    const total = scopedSites.length
    const online = scopedSites.filter((s) => s.status === "online").length
    const offline = scopedSites.filter((s) => s.status === "offline").length
    return { total, online, offline }
  }, [scopedSites])

  const siteNameByCode = useMemo(
    () => new Map(state.sites.map((s) => [s.code, s.name?.trim() || s.code])),
    [state.sites],
  )

  const taskAlertCount = summary.taskFailedCount

  const syncRisk = summary.packageCount > 0
    ? Math.max(0, Math.round(((summary.packageCount - summary.failedPackageCount) / summary.packageCount) * 100))
    : summary.successRate ?? 0

  return (
    <section
      className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
      data-testid="command-center-panel"
    >
      <div className="relative p-5 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                <TerminalSquare className="mr-1 h-3 w-3" />
                COMMAND CENTER
              </Badge>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                <Database className="mr-1 h-3 w-3" />
                实时数据
              </Badge>
              <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                {isReady
                  ? activeSite
                    ? activeSite
                    : activeRegion
                      ? `区域 ${activeRegion}`
                      : "全部站点"
                  : "站点加载中"}
              </Badge>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 lg:text-3xl">
              统一管控台
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              同步、控制队列、站点可达与预警集中呈现；KPI 与下方卡片同源，计数均限定在当前权限内可访问站点（随顶部站点筛选变化）。
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:min-w-[480px] sm:grid-cols-4 dark:border-slate-700 dark:bg-slate-900/40">
            <StatusTile label="站点在线" value={`${siteStats.online}/${siteStats.total || 0}`} tone={siteStats.offline > 0 ? "warn" : "good"} />
            <StatusTile label="同步成功率" value={summary.packageCount > 0 ? `${syncRisk}%` : "暂无"} tone={summary.failedPackageCount > 0 ? "warn" : "good"} />
            <StatusTile label="站点预警" value={state.earlyWarningOpenTotal} tone={state.earlyWarningOpenTotal > 0 ? "bad" : "good"} />
            <StatusTile label="任务异常" value={taskAlertCount} tone={taskAlertCount > 0 ? "bad" : "good"} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Layers3}
            label="任务"
            value={summary.taskCount}
            href="/tasks"
            navigable={canGo("/tasks")}
            testid="command-center-metric-tasks"
            stats={[
              { label: "成功", value: summary.taskCompletedCount, tone: "good" },
              { label: "进行中", value: summary.taskRunningCount, tone: "info" },
              { label: "异常", value: summary.taskFailedCount, tone: "bad" },
            ]}
          />
          <MetricCard
            icon={HardDrive}
            label="设备"
            value={summary.deviceCount}
            href="/racks"
            navigable={canGo("/racks")}
            testid="command-center-metric-devices"
            stats={[
              { label: "在线", value: summary.deviceOnlineCount, tone: "good" },
              { label: "离线", value: summary.deviceOfflineCount, tone: "idle" },
              { label: "异常", value: summary.deviceAbnormalCount, tone: "bad" },
            ]}
          />
          <MetricCard
            icon={Database}
            label="存储卷"
            value={summary.volumeCount}
            href="/volumes"
            navigable={canGo("/volumes")}
            testid="command-center-metric-volumes"
            stats={[
              { label: "总容量", value: formatCapacityBytes(summary.volumeTotalCapacityBytes), tone: "idle" },
              { label: "已用", value: formatCapacityBytes(summary.volumeUsedCapacityBytes), tone: "info" },
              {
                label: "使用率",
                value: summary.volumeUsagePercent == null ? "—" : `${summary.volumeUsagePercent}%`,
                tone: summary.volumeUsagePercent != null && summary.volumeUsagePercent >= 85 ? "warn" : "good",
              },
            ]}
          />
          <MetricCard
            icon={RadioTower}
            label="站点"
            value={siteStats.total}
            href="/sites"
            navigable={canGo("/sites")}
            testid="command-center-metric-sites"
            stats={[
              { label: "在线", value: siteStats.online, tone: "good" },
              { label: "离线", value: siteStats.offline, tone: siteStats.offline > 0 ? "warn" : "idle" },
            ]}
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <OperationalCard
            title="站点拓扑"
            icon={Network}
            description={`${siteStats.online} 在线 / ${siteStats.offline} 离线（全站 · 管理端口 TCP）`}
            testid="command-center-site-topology"
          >
            <div
              className={cn(
                "max-h-[17.5rem] overflow-y-auto pr-1",
                "[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.45)_transparent]",
                "[&::-webkit-scrollbar]:w-1.5",
                "[&::-webkit-scrollbar-track]:bg-transparent",
                "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300",
                "dark:[&::-webkit-scrollbar-thumb]:bg-slate-600",
                "[&::-webkit-scrollbar-thumb]:hover:bg-slate-400",
              )}
            >
              <div className="grid grid-cols-2 gap-2">
                {state.sites.map((site) => {
                  const tone = statusTone(site.status)
                  return (
                    <div key={site.code} className={cn("rounded-xl border px-3 py-2", toneClasses(tone))}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold">{site.code}</span>
                        <span className={cn("h-2 w-2 rounded-full", tone === "good" ? "bg-emerald-500" : tone === "bad" ? "bg-red-500" : "bg-amber-500")} />
                      </div>
                      <p className="mt-1 truncate text-[11px] opacity-80">{site.name}</p>
                      {site.status === "checking" ? (
                        <Loader2 className="mt-1 h-3 w-3 animate-spin opacity-70" aria-label="状态检测中" />
                      ) : (
                        <p className="mt-1 text-[10px] opacity-70">
                          {site.status === "online" ? "在线" : "离线"}
                        </p>
                      )}
                    </div>
                  )
                })}
                {state.sites.length === 0 && <EmptyLine text="暂无站点配置" />}
              </div>
            </div>
          </OperationalCard>

          <OperationalCard
            title="同步健康"
            icon={RefreshCw}
            description="最近 4 条"
            testid="command-center-sync-health"
          >
            <div className="space-y-2">
              {state.packages.slice(0, 4).map((pkg) => {
                const siteLabel = siteNameByCode.get(pkg.siteCode) ?? pkg.siteCode
                return (
                  <StreamRow
                    key={pkg.id}
                    left={siteLabel}
                    leftTitle={siteLabel}
                    leftVariant="name"
                    title={pkg.batchId}
                    detail={`${pkg.tableCount} 张表 · ${pkg.totalRecordCount.toLocaleString("zh-CN")} 行 · ${packageStatusLabel(pkg.status)}`}
                    status={pkg.status}
                    time={pkg.finishedAt ?? pkg.createdAt}
                  />
                )
              })}
              {state.packages.length === 0 && <EmptyLine text="暂无同步包记录" />}
            </div>
          </OperationalCard>

          <OperationalCard
            title="控制队列"
            icon={Command}
            description="最近 4 条"
            testid="command-center-control-queue"
          >
            <div className="space-y-2">
              {state.commands.slice(0, 4).map((command) => (
                <StreamRow
                  key={command.id}
                  left={commandStatusLabel(command.status)}
                  title={commandTypeLabel(commandType(command))}
                  detail={commandNo(command)}
                  status={command.status}
                  time={command.requestedAt ?? command.requested_at}
                />
              ))}
              {state.commands.length === 0 && <EmptyLine text="暂无控制命令" />}
            </div>
          </OperationalCard>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Evidence icon={ShieldCheck} text="中心库状态实时呈现" />
            <Evidence icon={Gauge} text="同步 / 控制 / 告警统一汇总" />
            <Evidence icon={Clock3} text={`刷新 ${state.updatedAt ? compactTime(state.updatedAt) : "加载中"}`} />
            {state.error && <Evidence icon={AlertTriangle} text={`error: ${state.error}`} danger />}
          </div>
          <div className="flex gap-2">
            {canGo("/sync") ? (
              <Button asChild size="sm" className="h-8">
                <Link href="/sync">
                  同步中心
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-8"
                onClick={() => denyNavigateToast("同步中心")}
              >
                同步中心
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
            {canGo("/logs") ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href="/logs">查看日志</Link>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => denyNavigateToast("审计日志")}
              >
                查看日志
              </Button>
            )}
          </div>
        </div>

        {/* R.UI-CmdCenter: 4 大通道 + strict/candidate 状态 */}
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="command-center-lanes">
          <LaneCard
            icon={RefreshCw}
            title="同步"
            href="/sync"
            navigable={canGo("/sync")}
            evidence="站点推送入库"
            testid="command-center-lane-sync"
          />
          <LaneCard
            icon={Command}
            title="控制"
            href="/tasks?view=commands"
            navigable={canGo("/tasks")}
            evidence="命令队列"
            testid="command-center-lane-control"
          />
          <LaneCard
            icon={Search}
            title="检索"
            href="/search"
            navigable={canGo("/search")}
            evidence="全文索引"
            testid="command-center-lane-search"
          />
          <LaneCard
            icon={ShieldCheck}
            title="安全"
            href="/logs"
            navigable={canGo("/logs")}
            evidence="本地登录 / 审计校验"
            testid="command-center-lane-security"
          />
        </div>

        {state.loading && (
          <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-slate-100 dark:bg-slate-700">
            <div className="h-full w-1/3 animate-pulse bg-blue-500" />
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

type MetricStatTone = "good" | "bad" | "warn" | "info" | "idle"

function metricStatCardClass(tone: MetricStatTone): string {
  switch (tone) {
    case "good":
      return "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
    case "bad":
      return "border-red-200/80 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
    case "warn":
      return "border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    case "info":
      return "border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
    default:
      return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
  }
}

function MetricCard({
  icon: Icon,
  label,
  value,
  href,
  navigable,
  testid,
  stats,
}: {
  icon: LucideIcon
  label: string
  value: number
  href: string
  navigable: boolean
  testid: string
  stats: Array<{ label: string; value: string | number; tone: MetricStatTone }>
}) {
  const body = (
    <>
      {/* 上行：图标 · 标题 · 数量（数量紧跟标题，不两端对齐） */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
          <Icon className="h-6 w-6" />
        </div>
        <span className="text-base font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
          {value.toLocaleString("zh-CN")}
        </span>
        {navigable ? (
          <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-blue-600 dark:group-hover:text-blue-300" />
        ) : (
          <span className="ml-auto shrink-0 text-[10px] font-medium text-slate-400">仅可查看</span>
        )}
      </div>

      {/* 下行：带底色的分项卡片，无分割线 */}
      <div
        className={cn(
          "mt-3 grid gap-2",
          stats.length <= 2 ? "grid-cols-2" : "grid-cols-3",
        )}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "rounded-lg border px-2.5 py-2 text-center",
              metricStatCardClass(stat.tone),
            )}
          >
            <p className="text-xs font-medium opacity-80">{stat.label}</p>
            <p className="mt-1 truncate text-sm font-semibold tabular-nums">
              {typeof stat.value === "number" ? stat.value.toLocaleString("zh-CN") : stat.value}
            </p>
          </div>
        ))}
      </div>
    </>
  )

  const className =
    "group rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-blue-500"

  if (navigable) {
    return (
      <Link href={href} className={className} data-testid={testid}>
        {body}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={cn(className, "w-full cursor-default text-left")}
      data-testid={testid}
      onClick={() => denyNavigateToast(label)}
    >
      {body}
    </button>
  )
}

function OperationalCard({ title, icon: Icon, description, testid, children }: { title: string; icon: LucideIcon; description: string; testid: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40" data-testid={testid}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function StreamRow({
  left,
  leftTitle,
  leftVariant = "code",
  title,
  detail,
  status,
  time,
}: {
  left: string
  leftTitle?: string
  /** code = 站点编号（窄列）；name = 站点名称（宽 70px，约 7 个汉字） */
  leftVariant?: "code" | "name"
  title: string
  detail: string
  status: string
  time?: string | null
}) {
  const tone = statusTone(status)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800/80">
      <div
        className={cn(
          "shrink-0 rounded-lg border px-2 py-1 text-center text-[10px]",
          leftVariant === "name"
            ? "min-w-[70px] max-w-[70px] truncate font-medium"
            : "min-w-14 font-mono",
          toneClasses(tone),
        )}
        title={leftTitle ?? left}
      >
        {left}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {tone === "good" ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Activity className="h-3 w-3 text-blue-500" />}
          <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">{title}</p>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
      <div className="hidden text-right text-[10px] text-slate-400 sm:block dark:text-slate-500">{compactTime(time)}</div>
    </div>
  )
}

function Evidence({ icon: Icon, text, danger = false }: { icon: LucideIcon; text: string; danger?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1",
        danger
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
          : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
      )}
    >
      <Icon className="h-3 w-3" />
      {text}
    </span>
  )
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
      {text}
    </div>
  )
}

function LaneCard({
  icon: Icon,
  title,
  href,
  navigable,
  evidence,
  testid,
}: {
  icon: LucideIcon
  title: string
  href: string
  navigable: boolean
  evidence: string
  testid: string
}) {
  const body = (
    <>
      <div className="rounded-xl bg-blue-50 p-2 text-blue-600 transition group-hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:group-hover:bg-blue-900/60">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</span>
          {navigable ? (
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:text-blue-600 dark:group-hover:text-blue-300" />
          ) : (
            <span className="text-[10px] font-medium text-slate-400">仅可查看</span>
          )}
        </div>
        <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">{evidence}</p>
      </div>
    </>
  )

  const className =
    "group flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"

  if (navigable) {
    return (
      <Link href={href} data-testid={testid} className={className}>
        {body}
      </Link>
    )
  }

  return (
    <button
      type="button"
      data-testid={testid}
      className={cn(className, "w-full cursor-default text-left")}
      onClick={() => denyNavigateToast(title)}
    >
      {body}
    </button>
  )
}
