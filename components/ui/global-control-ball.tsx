"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { formatBeijingTimeOnly } from "@/components/shared/time-format"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Settings,
  Server,
  ListTodo,
  Users,
  FileText,
  Search,
  Settings2,
  X,
  ChevronRight,
  Zap,
  RotateCcw,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Route,
  Layers,
  Gauge,
  Clock,
  CheckCircle,
  Info,
  Home,
  RefreshCw,
  Globe,
  Activity,
  Database,
  Shield,
  Bell,
  ChevronDown,
  Command,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { useTheme } from "next-themes"

const NAV_ITEMS = [
  { label: "平台概览", path: "/", icon: Home, category: "首页" },
  { label: "站点管理", path: "/sites", icon: Globe, category: "管理" },
  { label: "盘架管理", path: "/racks", icon: Server, category: "管理" },
  { label: "任务管理", path: "/tasks", icon: ListTodo, category: "管理" },
  { label: "用户权限", path: "/users", icon: Users, category: "系统" },
  { label: "审计日志", path: "/logs", icon: FileText, category: "系统" },
  { label: "统一检索", path: "/search", icon: Search, category: "功能" },
  { label: "系统设置", path: "/settings", icon: Settings2, category: "系统" },
]

const QUICK_ACTIONS = [
  { label: "切换主题", icon: Moon, darkIcon: Sun, action: "toggleTheme", color: "purple" },
  { label: "刷新页面", icon: RefreshCw, action: "refresh", color: "blue" },
  { label: "全屏模式", icon: Maximize2, action: "fullscreen", color: "green" },
  { label: "通知中心", icon: Bell, action: "notifications", color: "amber" },
]

interface RouteHistory {
  path: string
  timestamp: Date
}

interface AlertItem {
  id: string
  title: string
  type: "sync" | "table" | "control"
  severity: "critical" | "warning"
  status: "active" | "resolved" | "acknowledged"
  message: string
  time: string
  siteCode?: string
}

interface HealthPayload {
  status?: string
  uptime?: number
  checks?: {
    api?: string
    memory?: string
  }
}

interface DbHealthPayload {
  database?: {
    status?: string
    connected?: boolean
    latencyMs?: number
  }
}

interface CommandPayload {
  rows?: Array<{
    id: string
    commandType: string
    status: string
    sourceSiteId: string
  }>
  total?: number
}

interface SiteStatusPayload {
  items?: Array<{
    siteCode: string
    siteName: string
    agentStatus: string
    packageStatus: string
    consistencyStatus: string
  }>
}

const BLOCKERS = [
  { key: "auth", label: "统一认证与权限未开放", blocker: "待认证接入" },
  { key: "search", label: "统一检索服务未接入", blocker: "待外部服务" },
  { key: "manual-sync", label: "网页手动同步触发未开放", blocker: "待站点配合" },
] as const

export function GlobalControlBall() {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const [showPanel, setShowPanel] = useState(false)
  const [routeHistory, setRouteHistory] = useState<RouteHistory[]>([])
  const [pageLoadTime, setPageLoadTime] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [alertsData, setAlertsData] = useState<AlertItem[]>([])
  const [healthData, setHealthData] = useState<HealthPayload | null>(null)
  const [dbHealthData, setDbHealthData] = useState<DbHealthPayload | null>(null)
  const [commandData, setCommandData] = useState<CommandPayload | null>(null)
  const [siteStatusData, setSiteStatusData] = useState<SiteStatusPayload | null>(null)

  const ballRef = useRef<HTMLDivElement>(null)
  const loadStartTime = useRef(Date.now())

  // Fixed position for ball - bottom right corner
  const BALL_OFFSET_X = 35 // distance from right edge
  const BALL_OFFSET_Y = 100 // distance from bottom edge
  const BALL_SIZE = 56 // w-14 h-14 = 56px

  useEffect(() => {
    loadStartTime.current = Date.now()
    setRouteHistory(prev => [
      { path: pathname, timestamp: new Date() },
      ...prev.slice(0, 14)
    ])
  }, [pathname])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoadTime(Date.now() - loadStartTime.current)
    }, 100)
    return () => clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    let cancelled = false

    async function loadAssistantData() {
      try {
        const [healthRes, dbHealthRes, alertsRes, commandRes, siteStatusRes] = await Promise.all([
          fetch("/api/system/health", { cache: "no-store" }),
          fetch("/api/system/db-health", { cache: "no-store" }),
          fetch("/api/alerts?pageSize=10", { cache: "no-store" }),
          fetch("/api/control/commands?limit=10", { cache: "no-store" }),
          fetch("/api/sync/sites/status", { cache: "no-store" }),
        ])

        const [healthJson, dbHealthJson, alertsJson, commandJson, siteStatusJson] = await Promise.all([
          healthRes.json().catch(() => null),
          dbHealthRes.json().catch(() => null),
          alertsRes.json().catch(() => null),
          commandRes.json().catch(() => null),
          siteStatusRes.json().catch(() => null),
        ])

        if (cancelled) return

        setHealthData(healthJson)
        setDbHealthData(dbHealthJson)
        setAlertsData(Array.isArray(alertsJson?.data?.items) ? alertsJson.data.items : [])
        setCommandData({
          rows: Array.isArray(commandJson?.rows) ? commandJson.rows : [],
          total: typeof commandJson?.total === "number" ? commandJson.total : 0,
        })
        setSiteStatusData({
          items: Array.isArray(siteStatusJson?.data?.items) ? siteStatusJson.data.items : [],
        })
      } catch {
        if (!cancelled) {
          setHealthData(null)
          setDbHealthData(null)
          setAlertsData([])
          setCommandData({ rows: [], total: 0 })
          setSiteStatusData({ items: [] })
        }
      }
    }

    void loadAssistantData()
    const timer = setInterval(() => {
      void loadAssistantData()
    }, 15000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const handleBallClick = () => {
    setShowPanel(!showPanel)
  }

  const handleNavigate = (path: string) => {
    router.push(path)
  }

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "toggleTheme":
        setTheme(theme === "dark" ? "light" : "dark")
        break
      case "refresh":
        window.location.reload()
        break
      case "fullscreen":
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen()
        } else {
          document.exitFullscreen()
        }
        break
      case "notifications":
        setShowNotifications(!showNotifications)
        break
    }
  }

  const handleNotificationClick = (notification: AlertItem) => {
    if (notification.type === "control") {
      router.push("/tasks?view=commands")
    } else if (notification.type === "sync" || notification.type === "table") {
      router.push("/sync")
    } else {
      router.push("/logs")
    }
    setShowPanel(false)
    setShowNotifications(false)
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "sync": return RefreshCw
      case "table": return Database
      case "control": return AlertTriangle
      default: return Info
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "sync": return "text-blue-500 bg-blue-50 dark:bg-blue-900/20"
      case "table": return "text-amber-500 bg-amber-50 dark:bg-amber-900/20"
      case "control": return "text-red-500 bg-red-50 dark:bg-red-900/20"
      default: return "text-slate-500 bg-slate-50 dark:bg-slate-800"
    }
  }

  const unreadCount = alertsData.filter((item) => item.status === "active").length

  const latestSiteItems = siteStatusData?.items ?? []
  const onlineAgents = latestSiteItems.filter((item) => item.agentStatus === "online").length
  const pendingCommands = (commandData?.rows ?? []).filter((row) => row.status === "pending").length
  const activeAlerts = alertsData.filter((item) => item.status === "active").length
  const dbHealthy = dbHealthData?.database?.status === "healthy"
  const apiHealthy = healthData?.status === "ok"
  const assistantStatus = apiHealthy ? (dbHealthy ? "运行正常" : "数据库告警") : "接口异常"

  const getCurrentPageName = () => {
    const item = NAV_ITEMS.find((i) => i.path === pathname)
    return item?.label || "未知页面"
  }

  const formatTime = (date: Date) => {
    return formatBeijingTimeOnly(date)
  }

  const groupedNavItems = NAV_ITEMS.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, typeof NAV_ITEMS>)

  const colorClasses = {
    purple: "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200",
    blue: "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200",
    green: "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200",
    amber: "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200",
  }

  // 通知中心面板
  const NotificationPanel = () => (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" />
          通知中心
        </h4>
        {unreadCount > 0 && (
          <Badge className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {unreadCount} 条未读
          </Badge>
        )}
      </div>
      <ScrollArea className="h-[320px] pr-1">
        <div className="space-y-2">
          {alertsData.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-10 w-10 text-slate-300 dark:text-slate-400 mx-auto mb-2" />
              <p className="text-[12px] text-slate-500">暂无告警</p>
            </div>
          ) : (
            alertsData.map((notification) => {
              const Icon = getNotificationIcon(notification.type)
              const colorClass = getNotificationColor(notification.type)
              return (
                <button
                  key={notification.id}
                  className={cn(
                    "w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left",
                    "text-[13px] transition-colors",
                    notification.status === "active"
                      ? "bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                    colorClass
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className={cn(
                        "text-[13px] font-medium truncate",
                        notification.status === "active" ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"
                      )}>
                        {notification.title}
                      </p>
                      {notification.status === "active" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {notification.time} {notification.siteCode ? `· ${notification.siteCode}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-400 shrink-0 mt-1" />
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )

  return (
    <>
      <div
        ref={ballRef}
        className={cn(
          "fixed z-[9999] cursor-pointer select-none",
          "w-14 h-14 rounded-full",
          "bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800",
          "shadow-lg hover:shadow-2xl",
          "flex items-center justify-center",
          "transition-all duration-300 ease-out",
          "border border-slate-500/30",
          "backdrop-blur-sm",
          isHovered && !showPanel && "scale-105",
          showPanel && "ring-2 ring-slate-400/50"
        )}
        style={{
          position: 'fixed',
          right: `${BALL_OFFSET_X}px`,
          bottom: `${BALL_OFFSET_Y}px`,
        }}
        onClick={handleBallClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Command className={cn(
            "h-6 w-6 text-white/90 transition-transform duration-300",
            isHovered && !showPanel && "animate-[spin_4s_linear_infinite]",
            showPanel && "rotate-90"
          )} />
      </div>

      {showPanel && (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[2px] animate-in fade-in-50"
            onClick={() => setShowPanel(false)}
          />

          <div
            className={cn(
              "fixed z-[9999] w-[340px] max-h-[75vh]",
              "bg-white dark:bg-slate-900",
              "rounded-xl shadow-lg border border-slate-200 dark:border-slate-700",
              "overflow-hidden",
              "animate-in slide-in-from-right-4 duration-300 ease-out"
            )}
            style={{
              right: `${BALL_OFFSET_X + BALL_SIZE + 8}px`,
              bottom: `${BALL_OFFSET_Y}px`,
              left: 'auto',
              top: 'auto',
            }}
          >
            {showNotifications ? (
              <>
                {/* Header */}
                <div className="relative px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                        <Bell className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">通知中心</h3>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="text-slate-700 dark:text-slate-300">{unreadCount} 条未读</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                      onClick={() => setShowNotifications(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <NotificationPanel />
              </>
            ) : (
              <>
            {/* Header */}
            <div className="relative px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    <Cpu className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">全局控制台</h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="text-slate-700 dark:text-slate-300">{getCurrentPageName()}</span>
                      <span className="text-slate-400 dark:text-slate-500">|</span>
                      <span>{assistantStatus}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                  onClick={() => setShowPanel(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Quick Actions - 2x2 Grid */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((action) => {
                const ActionIcon = action.action === "toggleTheme" && theme === "dark"
                  ? (action as any).darkIcon || action.icon
                  : action.icon
                return (
                  <Button
                    key={action.action}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "justify-start text-xs h-8 rounded-lg",
                      colorClasses[action.color as keyof typeof colorClasses]
                    )}
                    onClick={() => handleQuickAction(action.action)}
                  >
                    <ActionIcon className="h-3.5 w-3.5 mr-1.5" />
                    {action.label}
                  </Button>
                )
              })}
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="nav" className="max-h-[calc(65vh-140px)]">
              <TabsList className="w-full grid grid-cols-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 h-10">
                <TabsTrigger
                  value="nav"
                  className="text-[11px] font-medium text-slate-600 dark:text-slate-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white rounded-none gap-1"
                >
                  <Layers className="h-3 w-3" />
                  导航
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="text-[11px] font-medium text-slate-600 dark:text-slate-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white rounded-none gap-1"
                >
                  <Clock className="h-3 w-3" />
                  历史
                </TabsTrigger>
                <TabsTrigger
                  value="system"
                  className="text-[11px] font-medium text-slate-600 dark:text-slate-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white rounded-none gap-1"
                >
                  <Activity className="h-3 w-3" />
                  系统
                </TabsTrigger>
                <TabsTrigger
                  value="about"
                  className="text-[11px] font-medium text-slate-600 dark:text-slate-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white rounded-none gap-1"
                >
                  <AlertCircle className="h-3 w-3" />
                  阻塞
                </TabsTrigger>
              </TabsList>

              <TabsContent value="nav" className="p-0 mt-0">
                <ScrollArea className="h-[380px]">
                  <div className="p-2.5 space-y-3">
                    {Object.entries(groupedNavItems).map(([category, items]) => (
                      <div key={category}>
                        <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          {category}
                        </div>
                        <div className="space-y-0.5">
                          {items.map((item) => {
                            const isActive = pathname === item.path
                            return (
                              <button
                                key={item.path}
                                className={cn(
                                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                                  "text-[13px] transition-all duration-150",
                                  isActive
                                    ? "bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                                )}
                                onClick={() => { handleNavigate(item.path); setShowPanel(false) }}
                              >
                                <div className={cn(
                                  "w-7 h-7 rounded-md flex items-center justify-center",
                                  isActive
                                    ? "bg-slate-200 dark:bg-slate-700"
                                    : "bg-slate-100 dark:bg-slate-700/50"
                                )}>
                                  <item.icon className={cn(
                                    "h-3.5 w-3.5",
                                    isActive ? "text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"
                                  )} />
                                </div>
                                <span className="flex-1 text-left font-medium">{item.label}</span>
                                {isActive && (
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                )}
                                <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="history" className="p-0 mt-0">
                <ScrollArea className="h-[380px]">
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[13px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        浏览历史
                      </h4>
                      {routeHistory.length > 0 && (
                        <button
                          className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          onClick={() => setRouteHistory([])}
                        >
                          清空
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {routeHistory.length === 0 ? (
                        <div className="text-center py-8">
                          <Route className="h-10 w-10 text-slate-300 dark:text-slate-400 mx-auto mb-2" />
                          <p className="text-[12px] text-slate-500">暂无浏览记录</p>
                        </div>
                      ) : (
                        routeHistory.map((route, index) => {
                          const item = NAV_ITEMS.find(i => i.path === route.path)
                          return (
                            <button
                              key={index}
                              className={cn(
                                "w-full flex items-center gap-2.5 p-2.5 rounded-lg",
                                "text-[13px] transition-colors",
                                route.path === pathname
                                  ? "bg-slate-100 dark:bg-slate-800/80"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              )}
                              onClick={() => { handleNavigate(route.path); setShowPanel(false) }}
                            >
                              <div className={cn(
                                "w-7 h-7 rounded-md flex items-center justify-center",
                                route.path === pathname
                                  ? "bg-slate-200 dark:bg-slate-700"
                                  : "bg-slate-100 dark:bg-slate-700/50"
                              )}>
                                {item ? (
                                  <item.icon className={cn(
                                    "h-3.5 w-3.5",
                                    route.path === pathname ? "text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"
                                  )} />
                                ) : (
                                  <Info className="h-3.5 w-3.5 text-slate-400" />
                                )}
                              </div>
                              <div className="flex-1 text-left">
                                <p className={cn(
                                  route.path === pathname ? "text-slate-900 dark:text-white font-medium" : "text-slate-700 dark:text-slate-300"
                                )}>
                                  {item?.label || route.path}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {formatTime(route.timestamp)}
                                </p>
                              </div>
                              {route.path === pathname && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  当前
                                </Badge>
                              )}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="system" className="p-0 mt-0">
                <ScrollArea className="h-[380px]">
                  <div className="p-3 space-y-3">
                    <h4 className="text-[13px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      系统状态
                    </h4>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            apiHealthy ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                          )} />
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">系统状态</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{assistantStatus}</p>
                      </div>

                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Database className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">数据库</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {dbHealthData?.database?.status ?? "unknown"}
                        </p>
                      </div>

                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Gauge className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">响应时间</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{pageLoadTime}ms</p>
                      </div>

                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Shield className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">认证边界</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">企业认证未启用</p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                      <h5 className="text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2.5">运行摘要</h5>
                      <div className="space-y-2.5">
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-600 dark:text-slate-400">页面加载</span>
                            <span className={cn(
                              pageLoadTime < 500 ? "text-emerald-600" : pageLoadTime < 1000 ? "text-amber-600" : "text-red-600"
                            )}>
                              {pageLoadTime}ms
                            </span>
                          </div>
                          <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                pageLoadTime < 500 ? "bg-emerald-500" : pageLoadTime < 1000 ? "bg-amber-500" : "bg-red-500"
                              )}
                              style={{ width: `${Math.min(pageLoadTime / 20, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-600 dark:text-slate-400">活跃告警</span>
                            <span className="text-slate-600 dark:text-slate-400">{activeAlerts}</span>
                          </div>
                          <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(activeAlerts * 10, 100)}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-600 dark:text-slate-400">待执行命令</span>
                            <span className="text-slate-600 dark:text-slate-400">{pendingCommands}</span>
                          </div>
                          <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-400 rounded-full" style={{ width: `${Math.min(pendingCommands * 10, 100)}%` }} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                          <div className="rounded-md bg-white/80 dark:bg-slate-900/70 px-2 py-1.5 border border-slate-200/70 dark:border-slate-700/70">
                            在线代理: <span className="font-medium text-slate-800 dark:text-slate-200">{onlineAgents}</span>
                          </div>
                          <div className="rounded-md bg-white/80 dark:bg-slate-900/70 px-2 py-1.5 border border-slate-200/70 dark:border-slate-700/70">
                            API uptime: <span className="font-medium text-slate-800 dark:text-slate-200">{Math.round(healthData?.uptime ?? 0)}s</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="about" className="p-0 mt-0">
                <ScrollArea className="h-[380px]">
                  <div className="p-3 space-y-3">
                    <h4 className="text-[13px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      当前阻塞
                    </h4>
                    <div className="space-y-2">
                      {BLOCKERS.map((item) => (
                        <div
                          key={item.key}
                          className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/20"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] font-medium text-amber-900 dark:text-amber-200">{item.label}</p>
                            <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-700 dark:border-amber-700 dark:text-amber-300">
                              {item.blocker}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-[11px] text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-300">
                        主机 CPU / 内存 / 磁盘趋势接入实时采集后展示。
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>全局控制台</span>
                <div className="flex items-center gap-1">
                  <Command className="h-2.5 w-2.5" />
                  <span>控制台</span>
                </div>
              </div>
            </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
