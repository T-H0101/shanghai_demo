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
  Database,
  RefreshCw,
  Users,
  FileText,
  Settings,
  Disc,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const menuItems = [
  { icon: LayoutDashboard, label: "控制台", href: "/" },
  { icon: MapPin, label: "站点管理", href: "/sites" },
  { icon: Search, label: "统一检索", href: "/search" },
  { icon: RefreshCw, label: "同步中心", href: "/sync" },
  { icon: ClipboardList, label: "任务管理", href: "/tasks" },
  { icon: HardDrive, label: "盘架管理", href: "/racks" },
  { icon: Database, label: "存储卷", href: "/volumes" },
  { icon: Users, label: "用户与权限", href: "/users" },
  { icon: FileText, label: "审计日志", href: "/logs" },
  { icon: Settings, label: "系统设置", href: "/settings" },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

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
          "fixed left-0 top-0 z-50 h-screen w-60 bg-slate-900 text-white flex flex-col transition-transform duration-300",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 text-white hover:bg-slate-800 lg:hidden"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-3 px-5 py-6 border-b border-slate-700">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
            <Disc className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold">光盘库管理平台</h1>
            <p className="text-xs text-slate-400">UNIFIED MANAGEMENT SYSTEM</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-700 p-4">
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
