"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  MapPin,
  Search,
  ClipboardList,
  HardDrive,
  RefreshCw,
  Users,
  FileText,
  // Settings, // 系统设置菜单已隐藏
  Disc,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PRODUCT_NAME_LINE1, PRODUCT_NAME_LINE2 } from "@/lib/branding"
import { ALL_SITES, useSite } from "@/lib/site/site-context"

const menuItems = [
  { icon: LayoutDashboard, label: "控制台", href: "/" },
  { icon: MapPin, label: "站点管理", href: "/sites" },
  { icon: Search, label: "统一检索", href: "/search" },
  { icon: RefreshCw, label: "同步中心", href: "/sync" },
  { icon: ClipboardList, label: "任务管理", href: "/tasks" },
  { icon: HardDrive, label: "设备管理", href: "/racks" },
  { icon: Users, label: "用户与权限", href: "/users" },
  { icon: FileText, label: "审计日志", href: "/logs" },
  // 当前设置页无可用配置入口，暂隐藏菜单（路由 /settings 仍保留）
  // { icon: Settings, label: "系统设置", href: "/settings" },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname() ?? "/"
  const { siteCode, isAllSites, isReady } = useSite()

  const hrefWithSite = (href: string) => {
    if (!isReady) return href
    const code = isAllSites || !siteCode ? ALL_SITES : siteCode
    const params = new URLSearchParams()
    params.set("siteCode", code)
    return `${href}?${params.toString()}`
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-60 bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.34),transparent_18rem),linear-gradient(180deg,#0f172a_0%,#111827_52%,#020617_100%)] text-white flex flex-col transition-transform duration-300 shadow-2xl shadow-slate-950/25",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 text-white hover:bg-slate-800 lg:hidden"
          onClick={onClose}
          aria-label="关闭侧边栏"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 shadow-lg shadow-blue-950/30 backdrop-blur">
            <Disc className="h-6 w-6 text-white" />
          </div>
          <h1 className="min-w-0 flex-1 text-center text-sm font-semibold leading-snug">
            <span className="block">{PRODUCT_NAME_LINE1}</span>
            <span className="block">{PRODUCT_NAME_LINE2}</span>
          </h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={hrefWithSite(item.href)}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-white/14 text-white shadow-sm ring-1 ring-white/12"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
              <Disc className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">集团管理中心</p>
              <p className="text-xs text-slate-400">管理员</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
