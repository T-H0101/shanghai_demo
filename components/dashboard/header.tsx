"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  // Bell, // 通知铃铛暂隐藏（接口未接入，避免误导）
  Menu,
  LogOut,
  Command,
  Activity,
  ChevronDown,
  // AlertCircle,
  // AlertTriangle,
  // CheckCircle2,
  // Info,
  KeyRound,
} from "lucide-react"
import { clearSession, getCachedSession, getSession } from "@/lib/auth/session"
import type { AuthSession } from "@/lib/types/auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
// import { ScrollArea } from "@/components/ui/scroll-area"
// import { useNotificationStore } from "@/store/notification"
// import { toast } from "@/hooks/use-toast"
import { SiteSelector } from "@/components/site/site-selector"
// import { isApiMode } from "@/lib/api"
import { AppTooltip } from "@/components/shared/tooltip"
import { TimeDisplay } from "@/components/shared/time-format"
import { cn } from "@/lib/utils"
import { ChangePasswordDialog } from "@/components/auth/change-password-dialog"
import { VersionDrawer } from "@/components/dashboard/version-drawer"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter()
  // 通知铃铛暂隐藏
  // const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore()
  // const [panelOpen, setPanelOpen] = useState(false)
  const [session, setSession] = useState<AuthSession | null>(() => {
    const cached = getCachedSession()
    return cached === undefined ? null : cached
  })
  const [systemStatus, setSystemStatus] = useState<"loading" | "healthy" | "degraded">("loading")
  const [healthCheckedAt, setHealthCheckedAt] = useState<string | null>(null)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false)
  const [appVersion, setAppVersion] = useState("1.0.0")

  useEffect(() => {
    getSession().then(setSession).catch(() => setSession(null))
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch("/api/system/health", { cache: "no-store" }),
      fetch("/api/system/db-health", { cache: "no-store" }),
    ])
      .then(async ([serviceResponse, dbResponse]) => {
        const service = await serviceResponse.json()
        if (cancelled) return
        setSystemStatus(serviceResponse.ok && service.status === "ok" && dbResponse.ok ? "healthy" : "degraded")
        setHealthCheckedAt(service.timestamp ?? new Date().toISOString())
      })
      .catch(() => {
        if (cancelled) return
        setSystemStatus("degraded")
        setHealthCheckedAt(new Date().toISOString())
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/system/version", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return
        const json = await res.json()
        const current = json?.data?.current
        if (!cancelled && typeof current === "string" && current.trim()) {
          setAppVersion(current.trim())
        }
      })
      .catch(() => {
        /* 保留默认 1.0.0 */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogout = async () => {
    const adfsLogoutUrl = await clearSession()
    if (adfsLogoutUrl) {
      window.location.assign(adfsLogoutUrl)
      return
    }
    router.replace("/login")
  }

  // 通知铃铛暂隐藏
  // const handleNotificationClick = (id: string) => { ... }
  // const handleMarkAllRead = () => { ... }
  // const typeColors = { ... }

  // 三合一健康徽章文案
  const healthBadgeLabel =
    systemStatus === "loading"
      ? "检查中"
      : systemStatus === "healthy"
        ? "服务正常"
        : "服务异常"
  const healthTooltipContent = (
    <div className="space-y-1">
      <div className="font-medium">
        {systemStatus === "healthy" ? "核心服务 + 中心库 正常" : "健康状态异常"}
      </div>
      <div className="text-[10px] text-slate-300">
        检查于: <TimeDisplay value={healthCheckedAt} mode="datetime" testid="header-health-checked-at" />
      </div>
    </div>
  )

  return (
    <header className="app-header-glass sticky top-0 z-30 flex h-16 items-center justify-between px-4 lg:px-6">
      {/* 左侧: 移动菜单 + 整合的搜索/命令面板入口 */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <AppTooltip content="打开侧边栏" side="bottom">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
            aria-label="打开侧边栏"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </AppTooltip>

        {/* 整合的 ⌘K 触发器 (替代原搜索框 + 独立 ⌘K 按钮) */}
        <AppTooltip
          content={
            <div className="space-y-1">
              <div>按 ⌘K (Mac) 或 Ctrl+K (Win/Linux) 打开命令面板</div>
              <div className="text-[10px] text-slate-300">
                支持: 页面跳转 / 站点切换 / 快捷任务操作
              </div>
            </div>
          }
          side="bottom"
        >
          <Button
            type="button"
            variant="outline"
            className="h-9 justify-start gap-2 border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:border-slate-600 transition-colors cursor-pointer w-full max-w-sm"
            onClick={() => {
              const event = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true })
              window.dispatchEvent(event)
            }}
            data-testid="command-palette-trigger"
            aria-label="打开命令面板"
          >
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span className="truncate text-sm">搜索页面、站点、操作…</span>
            <kbd className="ml-auto hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded border bg-white text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
              ⌘K
            </kbd>
          </Button>
        </AppTooltip>

        {/* 兼容 e2e: 原 global-search-entry (搜索入口) */}
        <button
          type="button"
          className="hidden"
          onClick={() => router.push("/search")}
          data-testid="global-search-entry"
          aria-hidden
          tabIndex={-1}
        >
          统一检索
        </button>
      </div>

      {/* 右侧: 站点选择器 + 健康徽章 + 通知 + 头像菜单 */}
      <div className="flex items-center gap-2 lg:gap-3">
        {/* 站点选择器：不包 Tooltip，避免下拉打开后悬停提示挡住选项点击 */}
        <Suspense fallback={null}>
          <SiteSelector />
        </Suspense>

        {/* 三合一健康徽章 */}
        <AppTooltip content={healthTooltipContent} side="bottom">
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs font-medium transition-colors cursor-pointer",
              systemStatus === "healthy"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                : systemStatus === "degraded"
                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
                  : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
            )}
            data-testid="header-health-badge"
            aria-label="系统健康状态"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                systemStatus === "healthy"
                  ? "bg-emerald-500 animate-pulse"
                  : systemStatus === "degraded"
                    ? "bg-amber-500"
                    : "bg-slate-400",
              )}
            />
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{healthBadgeLabel}</span>
          </button>
        </AppTooltip>

        <AppTooltip content="查看系统版本与更新说明" side="bottom">
          <button
            type="button"
            onClick={() => setVersionDrawerOpen(true)}
            className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
            data-testid="header-version-badge"
            aria-label={`系统版本 v${appVersion}`}
          >
            v{appVersion}
          </button>
        </AppTooltip>

        {/* 通知铃铛暂隐藏：接口未接入，避免「未启用」空按钮误导；恢复时取消注释并接真实聚合 */}
        {/*
        {isApiMode() ? (
          <AppTooltip content="通知接口未启用">
            <button
              className="relative p-2 rounded-lg text-slate-400 cursor-not-allowed"
              disabled
              aria-label="通知"
            >
              <Bell className="h-5 w-5" />
            </button>
          </AppTooltip>
        ) : (
          <AppTooltip content="查看系统通知">
            <DropdownMenu open={panelOpen} onOpenChange={setPanelOpen}>
              ...
            </DropdownMenu>
          </AppTooltip>
        )}
        */}

        {/* 用户菜单 (头像 → 下拉) */}
        <AppTooltip content={session?.displayName ?? session?.username ?? "账号"}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors p-1 cursor-pointer"
                data-testid="header-user-avatar"
                aria-label="账号菜单"
              >
                <Avatar className="h-8 w-8 bg-amber-500">
                  <AvatarFallback className="bg-amber-500 text-white font-semibold">
                    {(session?.displayName ?? session?.username)?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-slate-900">
                    {session?.displayName ?? session?.username ?? "未登录"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {session?.siteCode ?? "—"}
                    <span className="mx-1 text-slate-300">·</span>
                    {session?.role ?? "—"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {session?.department ?? "—"}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setChangePasswordOpen(true)}
                className="cursor-pointer"
                data-testid="header-menu-change-password"
              >
                <KeyRound className="h-3.5 w-3.5 mr-2" />
                修改密码
              </DropdownMenuItem>
              {/* 当前设置页无可用配置入口，暂隐藏菜单（路由 /settings 仍保留）
              <DropdownMenuItem
                onClick={() => router.push("/settings")}
                className="cursor-pointer"
                data-testid="header-menu-settings"
              >
                <Settings className="h-3.5 w-3.5 mr-2" />
                系统设置
              </DropdownMenuItem>
              */}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-red-600 focus:text-red-600"
                data-testid="header-menu-logout"
              >
                <LogOut className="h-3.5 w-3.5 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </AppTooltip>

        <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
        <VersionDrawer open={versionDrawerOpen} onOpenChange={setVersionDrawerOpen} />
      </div>
    </header>
  )
}
