"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Database,
  Activity,
  HardDrive,
  CheckCircle2,
  Clock,
  ChevronRight,
} from "lucide-react"
import { taskProvider, rackProvider } from "@/lib/api"
import { MOCK_STORE_EVENT } from "@/lib/api/mock-store"
import { useSite } from "@/lib/site/site-context"
import { getSession } from "@/lib/auth/session"
import { canAccessPath } from "@/lib/auth/menu-permissions"
import { toast } from "@/hooks/use-toast"

function hrefPath(href: string): string {
  return href.split("?")[0] || "/"
}

function denyNavigateToast(label: string) {
  toast({
    title: "无权限访问该模块",
    description: `当前角色无法打开「${label}」，仅可在控制台查看汇总。`,
  })
}

function StatNav({
  href,
  navigable,
  label,
  testid,
  focusRing,
  children,
}: {
  href: string
  navigable: boolean
  label: string
  testid: string
  focusRing: string
  children: ReactNode
}) {
  const className = `block group focus:outline-none focus-visible:ring-2 ${focusRing} rounded-lg`

  if (navigable) {
    return (
      <Link href={href} className={className} data-testid={testid}>
        {children}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={`${className} w-full cursor-default text-left`}
      data-testid={testid}
      onClick={() => denyNavigateToast(label)}
    >
      {children}
    </button>
  )
}

export function StatsCards() {
  const pathname = usePathname()
  const { siteCode, isAllSites, isReady } = useSite()
  const [permissions, setPermissions] = useState<string[]>([])
  const [taskStats, setTaskStats] = useState({ total: 0, running: 0, completed: 0, failed: 0, pending: 0 })
  const [rackStats, setRackStats] = useState({ total: 0, online: 0, offline: 0, avgUsage: 0, totalCapacity: "0 TB", remainingCapacity: "0 TB", usedSlots: 0, totalSlotsAll: 0 })
  // R.15: dataSource 显式 (database / empty / error), 不允许 mock 静默 fallback
  const [dataSource, setDataSource] = useState<"database" | "empty" | "error" | "loading">("loading")

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

  const loadStats = async () => {
    try {
      const filterSite = isAllSites ? undefined : siteCode ?? undefined
      const [tasks, rStats] = await Promise.all([
        taskProvider.getAll(filterSite ? { siteCode: filterSite } : undefined),
        rackProvider.getStats(filterSite),
      ])
      setTaskStats({
        total: tasks.length,
        running: tasks.filter((task) =>
          ["scanning", "preparing", "splitting", "packaging", "verifying", "writing"].includes(task.phase)
        ).length,
        completed: tasks.filter((task) => task.phase === "completed").length,
        failed: tasks.filter((task) => task.phase === "failed").length,
        pending: tasks.filter((task) => task.phase === "pending").length,
      })
      setRackStats(rStats)
      setDataSource(tasks.length === 0 && rStats.total === 0 ? "empty" : "database")
    } catch {
      setDataSource("error")
    }
  }

  // 首次加载 + 路由变化时重新读取
  useEffect(() => {
    if (isReady) loadStats()
  }, [pathname, isReady, siteCode, isAllSites])

  // 监听 localStorage 变化
  useEffect(() => {
    const handler = () => loadStats()
    window.addEventListener(MOCK_STORE_EVENT, handler)
    return () => window.removeEventListener(MOCK_STORE_EVENT, handler)
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400" data-testid="dashboard-stats-source">
        <Database className="h-3 w-3" />
        <span>
          数据状态：
          {dataSource === "loading"
            ? "加载中"
            : dataSource === "empty"
              ? "暂无数据"
              : dataSource === "error"
                ? "读取异常"
                : "正常"}
        </span>
        {dataSource === "error" && <span className="text-red-600 dark:text-red-400">读取失败，请检查中心库连接。</span>}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1 - 任务总数 (可点击 → /tasks) */}
      <StatNav
        href="/tasks"
        navigable={canGo("/tasks")}
        label="任务管理"
        testid="dashboard-stat-tasks"
        focusRing="focus-visible:ring-blue-500"
      >
        <Card className="p-4 transition-all duration-200 group-hover:shadow-md group-hover:border-blue-300 dark:group-hover:border-blue-700 cursor-pointer bg-white dark:bg-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-900/30">
              <Activity className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">任务总数</span>
            <ChevronRight className="h-3.5 w-3.5 ml-auto text-slate-300 dark:text-slate-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{taskStats.total}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">个</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-blue-600 dark:text-blue-300 flex items-center gap-1"><Clock className="h-3 w-3" />{taskStats.running} 运行中</span>
            <span className="text-emerald-600 dark:text-emerald-300 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{taskStats.completed} 已完成</span>
          </div>
        </Card>
      </StatNav>

      {/* Card 2 - 运行任务 (可点击 → /tasks?status=running) */}
      <StatNav
        href="/tasks?status=running"
        navigable={canGo("/tasks")}
        label="任务管理"
        testid="dashboard-stat-running"
        focusRing="focus-visible:ring-emerald-500"
      >
        <Card className="p-4 transition-all duration-200 group-hover:shadow-md group-hover:border-emerald-300 dark:group-hover:border-emerald-700 cursor-pointer bg-white dark:bg-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-900/30">
              <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">运行任务</span>
            <ChevronRight className="h-3.5 w-3.5 ml-auto text-slate-300 dark:text-slate-400 group-hover:text-emerald-500 transition-colors" />
          </div>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-300">{taskStats.running}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">进行中</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {taskStats.pending} 待处理 · {taskStats.failed} 失败
          </div>
        </Card>
      </StatNav>

      {/* Card 3 - 设备在线 (可点击 → /racks) */}
      <StatNav
        href="/racks"
        navigable={canGo("/racks")}
        label="设备管理"
        testid="dashboard-stat-devices"
        focusRing="focus-visible:ring-indigo-500"
      >
        <Card className="p-4 transition-all duration-200 group-hover:shadow-md group-hover:border-indigo-300 dark:group-hover:border-indigo-700 cursor-pointer bg-white dark:bg-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded bg-indigo-50 dark:bg-indigo-900/30">
              <HardDrive className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">设备在线</span>
            <ChevronRight className="h-3.5 w-3.5 ml-auto text-slate-300 dark:text-slate-400 group-hover:text-indigo-500 transition-colors" />
          </div>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{rackStats.online}/{rackStats.total}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">台</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-600 dark:text-emerald-300">{rackStats.online} 在线</span>
            <span className="text-red-600 dark:text-red-300">{rackStats.offline} 离线</span>
          </div>
        </Card>
      </StatNav>

      {/* Card 4 - 存储使用率 (可点击 → /volumes) */}
      <StatNav
        href="/volumes"
        navigable={canGo("/volumes")}
        label="存储卷管理"
        testid="dashboard-stat-storage"
        focusRing="focus-visible:ring-amber-500"
      >
        <Card className="p-4 transition-all duration-200 group-hover:shadow-md group-hover:border-amber-300 dark:group-hover:border-amber-700 cursor-pointer bg-white dark:bg-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-900/30">
              <Database className="h-4 w-4 text-amber-600 dark:text-amber-300" />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">存储使用率</span>
            <ChevronRight className="h-3.5 w-3.5 ml-auto text-slate-300 dark:text-slate-400 group-hover:text-amber-500 transition-colors" />
          </div>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{rackStats.avgUsage}%</span>
          </div>
          <Progress value={rackStats.avgUsage} className="h-1.5 mb-1" />
          <div className="text-xs text-slate-500 dark:text-slate-400">
            已用 {rackStats.usedSlots}/{rackStats.totalSlotsAll} 盘位
          </div>
        </Card>
      </StatNav>
      </div>
    </div>
  )
}
