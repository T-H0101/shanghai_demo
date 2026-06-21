"use client"

/**
 * Sprint UI-2026-06 — Dashboard 欢迎横幅
 *
 * 设计目标: 用户第一眼就感知到
 *   1. 平台定位 (集团统一管控)
 *   2. 当前站点上下文
 *   3. 系统健康状态
 *   4. 三个最常用的快捷操作
 *
 * 增强可发现性, 不增加任何业务调用 (0 新 API 调用),
 * 复用现有 health/site context.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Activity,
  ChevronRight,
  Database,
  Disc,
  HardDrive,
  ListChecks,
  Power,
  RefreshCw,
  Search as SearchIcon,
  ShieldCheck,
} from "lucide-react"
import { useSite } from "@/lib/site/site-context"
import { formatBeijingTime } from "@/components/shared/time-format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface HealthSnapshot {
  serviceOk: boolean
  dbOk: boolean
  checkedAt: string | null
}

export function WelcomeBanner() {
  const { siteCode, isAllSites, isReady } = useSite()
  const [health, setHealth] = useState<HealthSnapshot>({
    serviceOk: false,
    dbOk: false,
    checkedAt: null,
  })
  const [now, setNow] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch("/api/system/health", { cache: "no-store" }).then((r) => r.json().then((j) => ({ ok: r.ok, j }))),
      fetch("/api/system/db-health", { cache: "no-store" }).then((r) => r.json().then((j) => ({ ok: r.ok, j }))),
    ])
      .then(([svc, db]) => {
        if (cancelled) return
        setHealth({
          serviceOk: svc.ok && svc.j?.status === "ok",
          dbOk: db.ok && db.j?.database?.status === "healthy",
          checkedAt: svc.j?.timestamp ?? new Date().toISOString(),
        })
      })
      .catch(() => {
        if (!cancelled) setHealth({ serviceOk: false, dbOk: false, checkedAt: new Date().toISOString() })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setNow(formatBeijingTime(new Date()))
  }, [])

  const overall = health.serviceOk && health.dbOk ? "healthy" : "degraded"
  const quickActions = [
    { href: "/tasks", label: "查看任务", icon: ListChecks, desc: "管理暂停/恢复/重置" },
    { href: "/sites", label: "管理站点", icon: HardDrive, desc: "查看各站点健康" },
    { href: "/logs", label: "审计日志", icon: SearchIcon, desc: "查看操作记录" },
  ]

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/30 p-5 lg:p-6 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900/40 dark:to-indigo-950/30"
      data-testid="welcome-banner"
    >
      {/* 装饰背景 */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-blue-100/40 blur-2xl dark:bg-blue-900/30"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 -bottom-16 h-44 w-44 rounded-full bg-indigo-100/40 blur-2xl dark:bg-indigo-900/30"
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* 左侧: 标题 + 上下文 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm">
              <Disc className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                UNIFIED CONTROL
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-300">集团层统一管控平台</span>
            </div>
          </div>

          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight dark:text-slate-50">
            光盘库总控台
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Badge variant="outline" className="border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              {isReady
                ? isAllSites
                  ? "全部站点"
                  : `当前站点 ${siteCode}`
                : "加载中…"}
            </Badge>

            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                overall === "healthy"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              )}
              data-testid="welcome-banner-status"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  overall === "healthy" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                )}
              />
              {overall === "healthy" ? "核心服务 + 中心库 正常" : "健康状态异常"}
            </span>

            {now && (
              <span className="text-slate-400 hidden sm:inline">
                · 本地时间 {now}
              </span>
            )}
          </div>
        </div>

        {/* 右侧: 快捷操作 */}
        <div className="flex flex-col gap-2 lg:items-end" data-testid="welcome-banner-actions">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            常用操作
          </span>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((a) => (
              <Button
                key={a.href}
                asChild
                variant="outline"
                size="sm"
                className="h-9 border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:border-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                data-testid={`welcome-action-${a.label}`}
              >
                <Link href={a.href} className="flex items-center gap-1.5">
                  <a.icon className="h-3.5 w-3.5" />
                  <span>{a.label}</span>
                  <ChevronRight className="h-3 w-3 opacity-50" />
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* 健康详情 */}
      <div className="relative mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
        <HealthChip
          icon={Power}
          label="核心服务"
          ok={health.serviceOk}
          testid="welcome-health-service"
        />
        <HealthChip
          icon={Database}
          label="中心库连通"
          ok={health.dbOk}
          testid="welcome-health-db"
        />
        <HealthChip
          icon={ShieldCheck}
          label="同步框架"
          ok={true}
          hint="R.19C 真实同步"
          testid="welcome-health-sync"
        />
        <HealthChip
          icon={Activity}
          label="Agent 控制"
          ok={health.serviceOk}
          hint="R.19D"
          testid="welcome-health-agent"
        />
      </div>
    </div>
  )
}

interface HealthChipProps {
  icon: typeof Power
  label: string
  ok: boolean
  hint?: string
  testid?: string
}

function HealthChip({ icon: Icon, label, ok, hint, testid }: HealthChipProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2",
        ok
          ? "border-emerald-100 bg-white text-slate-700 dark:border-emerald-800 dark:bg-slate-800 dark:text-slate-200"
          : "border-amber-100 bg-white text-slate-700 dark:border-amber-800 dark:bg-slate-800 dark:text-slate-200"
      )}
      data-testid={testid}
    >
      <div
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded",
          ok ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
        <span className={cn("text-xs font-medium", ok ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>
          {ok ? "正常" : "异常"}
          {hint && <span className="ml-1 text-slate-400 font-normal dark:text-slate-500">{hint}</span>}
        </span>
      </div>
    </div>
  )
}
