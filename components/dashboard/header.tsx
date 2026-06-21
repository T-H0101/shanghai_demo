"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Bell,
  Menu,
  LogOut,
  Command,
  Activity,
  Settings,
  ChevronDown,
} from "lucide-react"
import { clearSession, getSession } from "@/lib/auth/session"
import type { AuthSession } from "@/lib/types/auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useNotificationStore } from "@/store/notification"
import { toast } from "@/hooks/use-toast"
import { SiteSelector } from "@/components/site/site-selector"
import { isApiMode } from "@/lib/api"
import { AppTooltip } from "@/components/shared/tooltip"
import { TimeDisplay } from "@/components/shared/time-format"
import { cn } from "@/lib/utils"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore()
  const [panelOpen, setPanelOpen] = useState(false)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [systemStatus, setSystemStatus] = useState<"loading" | "healthy" | "degraded">("loading")
  const [healthCheckedAt, setHealthCheckedAt] = useState<string | null>(null)

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

  const handleLogout = async () => {
    await clearSession()
    router.replace("/login")
  }

  const handleNotificationClick = (id: string) => {
    markAsRead(id)
    const notif = notifications.find(n => n.id === id)
    if (notif) {
      toast({
        title: notif.title,
        description: notif.message,
        variant: notif.type === 'error' ? 'destructive' : 'default',
      })
    }
  }

  const handleMarkAllRead = () => {
    markAllAsRead()
    toast({ title: "已全部已读", description: "所有通知已标记为已读状态" })
  }

  const typeColors = {
    info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  }

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
            <kbd className="ml-auto hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded border bg-white text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700">
              ⌘K
            </kbd>
          </Button>
        </AppTooltip>

        {/* 兼容 e2e: 原 global-search-entry (R.10 保留) */}
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
        {/* 站点选择器 */}
        <Suspense fallback={null}>
          <AppTooltip content="切换当前查看的站点, 或汇总全部站点">
            <span className="inline-block">
              <SiteSelector />
            </span>
          </AppTooltip>
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

        {/* 通知 */}
        {isApiMode ? (
          <AppTooltip content="通知接口未接入, 后续 Sprint 解锁">
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
              <DropdownMenuTrigger asChild>
                <button
                  className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="通知"
                >
                  <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-96 p-0">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-50">通知中心</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                    onClick={handleMarkAllRead}
                  >
                    全部已读
                  </Button>
                </div>
                <ScrollArea className="h-80">
                  <div className="p-2">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">暂无通知</div>
                    ) : (
                      notifications.map((notif) => (
                        <button
                          key={notif.id}
                          className={`w-full text-left p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                            !notif.read ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                          }`}
                          onClick={() => handleNotificationClick(notif.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 p-1.5 rounded-full ${typeColors[notif.type]}`}>
                              <span className="text-xs">{notif.type === 'error' ? '!' : notif.type === 'warning' ? '⚠' : notif.type === 'success' ? '✓' : 'i'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{notif.title}</p>
                                {!notif.read && (
                                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{notif.message}</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{notif.time}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </AppTooltip>
        )}

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
                onClick={() => router.push("/settings")}
                className="cursor-pointer"
                data-testid="header-menu-settings"
              >
                <Settings className="h-3.5 w-3.5 mr-2" />
                系统设置
              </DropdownMenuItem>
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
      </div>
    </header>
  )
}
