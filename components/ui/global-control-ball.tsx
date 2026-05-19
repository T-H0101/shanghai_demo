"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Settings,
  LayoutDashboard,
  Server,
  HardDrive,
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
  Monitor,
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
  { label: "切换主题", icon: Moon, action: "toggleTheme", color: "purple" },
  { label: "刷新页面", icon: RefreshCw, action: "refresh", color: "blue" },
  { label: "全屏模式", icon: Maximize2, action: "fullscreen", color: "green" },
  { label: "通知中心", icon: Bell, action: "notifications", color: "amber" },
]

interface RouteHistory {
  path: string
  timestamp: Date
}

export function GlobalControlBall() {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const [showPanel, setShowPanel] = useState(false)
  const [routeHistory, setRouteHistory] = useState<RouteHistory[]>([])
  const [pageLoadTime, setPageLoadTime] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

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
        router.push("/")
        setShowPanel(false)
        break
    }
  }

  const getCurrentPageName = () => {
    const item = NAV_ITEMS.find((i) => i.path === pathname)
    return item?.label || "未知页面"
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour12: false })
  }

  const groupedNavItems = NAV_ITEMS.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, typeof NAV_ITEMS>)

  const colorClasses = {
    purple: "bg-purple-500 hover:bg-purple-600 text-white",
    blue: "bg-blue-500 hover:bg-blue-600 text-white",
    green: "bg-green-500 hover:bg-green-600 text-white",
    amber: "bg-amber-500 hover:bg-amber-600 text-white",
  }

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
              "fixed z-[9999] w-[340px] max-h-[65vh]",
              "bg-white dark:bg-slate-900",
              "rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80",
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
            {/* Header */}
            <div className="relative px-4 py-3 bg-gradient-to-r from-slate-800 via-slate-800 to-slate-800/90 border-b border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-700/80 border border-slate-600/40 flex items-center justify-center shadow-inner">
                    <Cpu className="h-4 w-4 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-tight">全局控制台</h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="text-slate-300">{getCurrentPageName()}</span>
                      <span className="text-slate-600">|</span>
                      <span>加载</span>
                      <span className={cn(
                        "font-medium",
                        pageLoadTime < 500 ? "text-emerald-400" : pageLoadTime < 1000 ? "text-amber-400" : "text-red-400"
                      )}>
                        {pageLoadTime}ms
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-md"
                  onClick={() => setShowPanel(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Quick Actions - 2x2 Grid */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.action}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "justify-start text-xs h-8 rounded-lg",
                      colorClasses[action.color as keyof typeof colorClasses],
                      "opacity-90 hover:opacity-100 shadow-sm"
                    )}
                    onClick={() => handleQuickAction(action.action)}
                  >
                    <action.icon className="h-3.5 w-3.5 mr-1.5" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="nav" className="max-h-[calc(65vh-140px)]">
              <TabsList className="w-full grid grid-cols-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-700/60 h-10">
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
                  <Info className="h-3 w-3" />
                  关于
                </TabsTrigger>
              </TabsList>

              <TabsContent value="nav" className="p-0 mt-0">
                <ScrollArea className="h-[280px]">
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
                <ScrollArea className="h-[280px]">
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
                          <Route className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
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
                <ScrollArea className="h-[280px]">
                  <div className="p-3 space-y-3">
                    <h4 className="text-[13px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      系统状态
                    </h4>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">系统状态</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">正常运行</p>
                      </div>

                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Database className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">数据同步</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">已同步</p>
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
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">安全状态</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">已保护</p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                      <h5 className="text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2.5">性能指标</h5>
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
                            <span className="text-slate-600 dark:text-slate-400">内存使用</span>
                            <span className="text-slate-600 dark:text-slate-400">45%</span>
                          </div>
                          <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-400 rounded-full" style={{ width: "45%" }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-600 dark:text-slate-400">CPU 占用</span>
                            <span className="text-slate-600 dark:text-slate-400">23%</span>
                          </div>
                          <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-400 rounded-full" style={{ width: "23%" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="about" className="p-0 mt-0">
                <ScrollArea className="h-[280px]">
                  <div className="p-3 space-y-3">
                    <div className="text-center py-3">
                      <div className="w-14 h-14 mx-auto mb-2.5 bg-slate-800 dark:bg-slate-700 rounded-xl flex items-center justify-center border border-slate-700 dark:border-slate-600 shadow-lg">
                        <Globe className="h-7 w-7 text-slate-300" />
                      </div>
                      <h4 className="text-[15px] font-semibold text-slate-800 dark:text-slate-200 tracking-tight">光盘库管理平台</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Enterprise Optical Disc Library Platform</p>
                    </div>

                    <div className="space-y-0.5 border border-slate-200/80 dark:border-slate-700/60 rounded-lg overflow-hidden">
                      <div className="flex justify-between items-center px-3 py-2 bg-slate-50/80 dark:bg-slate-800/40">
                        <span className="text-[12px] text-slate-600 dark:text-slate-400">版本号</span>
                        <span className="text-[12px] font-medium text-slate-800 dark:text-slate-200">v1.0.0</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2 bg-white/80 dark:bg-slate-900/80">
                        <span className="text-[12px] text-slate-600 dark:text-slate-400">框架版本</span>
                        <span className="text-[12px] font-medium text-slate-800 dark:text-slate-200">Next.js 16.2.6</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2 bg-slate-50/80 dark:bg-slate-800/40">
                        <span className="text-[12px] text-slate-600 dark:text-slate-400">React 版本</span>
                        <span className="text-[12px] font-medium text-slate-800 dark:text-slate-200">19.x</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2 bg-white/80 dark:bg-slate-900/80">
                        <span className="text-[12px] text-slate-600 dark:text-slate-400">主题模式</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          {theme === 'dark' ? '深色模式' : '浅色模式'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2 bg-slate-50/80 dark:bg-slate-800/40">
                        <span className="text-[12px] text-slate-600 dark:text-slate-400">运行环境</span>
                        <Badge variant={process.env.NODE_ENV === 'production' ? 'default' : 'outline'} className="text-[10px] px-1.5">
                          {process.env.NODE_ENV === 'production' ? '生产环境' : '开发环境'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className="px-3 py-2 bg-slate-50/80 dark:bg-slate-800/60 border-t border-slate-200/80 dark:border-slate-700/60">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>全局控制台</span>
                <div className="flex items-center gap-1">
                  <Command className="h-2.5 w-2.5" />
                  <span>控制台</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
