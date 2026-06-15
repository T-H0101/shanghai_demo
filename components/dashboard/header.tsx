"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Bell, Menu, LogOut } from "lucide-react"
import { clearMockSession, getSession } from "@/lib/auth/session"
import type { MockSession } from "@/lib/types/auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useNotificationStore } from "@/store/notification"
import { toast } from "@/hooks/use-toast"
import { SiteSelector } from "@/components/site/site-selector"
import { isApiMode } from "@/lib/api"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore()
  const [panelOpen, setPanelOpen] = useState(false)
  const [session, setSession] = useState<MockSession | null>(null)
  const [systemStatus, setSystemStatus] = useState<"loading" | "healthy" | "degraded">("loading")
  const [healthCheckedAt, setHealthCheckedAt] = useState<string | null>(null)

  useEffect(() => {
    setSession(getSession())
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

  const handleLogout = () => {
    clearMockSession()
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
    info: "bg-blue-100 text-blue-700",
    warning: "bg-amber-100 text-amber-700",
    error: "bg-red-100 text-red-700",
    success: "bg-emerald-100 text-emerald-700",
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Button
        type="button"
        variant="outline"
        className="hidden h-9 justify-start gap-2 border-slate-200 bg-slate-50 text-slate-600 sm:flex sm:w-56 lg:w-72"
        onClick={() => router.push("/search")}
        data-testid="global-search-entry"
        title="统一检索依赖 ES/ClickHouse，当前页面会展示阻塞状态"
      >
        <Search className="h-4 w-4 text-slate-400" />
        <span className="truncate">统一检索</span>
        <Badge variant="outline" className="ml-auto border-amber-200 bg-amber-50 text-[10px] text-amber-700">
          待 ES
        </Badge>
      </Button>

      {/* Status Info */}
      <div className="flex items-center gap-3 lg:gap-6">
        {/* Sprint 2F.4: 全局站点选择器 */}
        <Suspense fallback={null}>
          <SiteSelector />
        </Suspense>

        {/* Core Service Status - Hidden on mobile */}
        <div className="hidden xl:flex items-center gap-2 text-sm">
          <span className="text-slate-500">核心服务:</span>
          <span className={systemStatus === "healthy" ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
            {systemStatus === "loading" ? "检查中" : systemStatus === "healthy" ? "正常运行" : "状态异常"}
          </span>
          <span className={`h-2 w-2 rounded-full ${systemStatus === "healthy" ? "bg-emerald-500" : "bg-amber-500"}`}></span>
        </div>

        {/* Last Update - Hidden on mobile */}
        <div className="hidden lg:block text-sm text-slate-500">
          <span>状态检查于:</span>
          <span className="ml-2">
            {healthCheckedAt ? new Date(healthCheckedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}
          </span>
        </div>

        {/* System Health */}
        <div className="flex items-center gap-1 lg:gap-2">
          <span className="hidden md:inline text-xs text-slate-500">SYSTEM 健康度</span>
          <span className={`text-sm font-semibold ${systemStatus === "healthy" ? "text-emerald-600" : "text-amber-600"}`}>
            {systemStatus === "loading" ? "检查中" : systemStatus === "healthy" ? "正常" : "异常"}
          </span>
        </div>

        {/* Notifications */}
        {isApiMode ? (
          <button
            className="relative p-2 rounded-lg text-slate-400 cursor-not-allowed"
            title="通知接口未接入"
            disabled
          >
            <Bell className="h-5 w-5" />
          </button>
        ) : <DropdownMenu open={panelOpen} onOpenChange={setPanelOpen}>
          <DropdownMenuTrigger asChild>
            <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Bell className="h-5 w-5 text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 p-0">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">通知中心</h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 hover:text-blue-700"
                onClick={handleMarkAllRead}
              >
                全部已读
              </Button>
            </div>
            <ScrollArea className="h-80">
              <div className="p-2">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">暂无通知</div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      className={`w-full text-left p-3 rounded-lg hover:bg-slate-50 transition-colors ${
                        !notif.read ? 'bg-blue-50/50' : ''
                      }`}
                      onClick={() => handleNotificationClick(notif.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-full ${typeColors[notif.type]}`}>
                          <span className="text-xs">{notif.type === 'error' ? '!' : notif.type === 'warning' ? '⚠' : notif.type === 'success' ? '✓' : 'i'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{notif.title}</p>
                            {!notif.read && (
                              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                          <p className="text-xs text-slate-400 mt-1">{notif.time}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>}

        {/* User — Mock Enterprise Authentication Demo */}
        <div className="flex items-center gap-2 lg:gap-3 border-l border-slate-200 pl-3 lg:pl-4">
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium text-slate-900">
              {session?.displayName ?? "—"}
            </p>
            <p className="text-xs text-slate-600">
              <span className="text-blue-600 font-medium">{session?.site ?? "—"}</span>
              <span className="text-slate-400 mx-1">·</span>
              {session?.role ?? "—"}
              <span className="text-slate-400 mx-1">·</span>
              {session?.department ?? "—"}
            </p>
          </div>
          <Avatar className="h-9 w-9 lg:h-10 lg:w-10 bg-amber-500">
            <AvatarFallback className="bg-amber-500 text-white font-semibold">
              {session?.displayName?.charAt(0) ?? "?"}
            </AvatarFallback>
          </Avatar>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs hidden sm:inline-flex"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5 mr-1" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}
