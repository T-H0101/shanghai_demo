"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
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
  Database,
  Disc,
  X,
  AlertTriangle,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PRODUCT_NAME_LINE1, PRODUCT_NAME_LINE2 } from "@/lib/branding"
import { ALL_SITES, useSite } from "@/lib/site/site-context"
import { getCachedSession, getSession } from "@/lib/auth/session"
import { menusForPermissions, type MenuDef } from "@/lib/auth/menu-permissions"

const MENU_ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/sites": MapPin,
  "/search": Search,
  "/sync": RefreshCw,
  "/tasks": ClipboardList,
  "/racks": HardDrive,
  "/volumes": Database,
  "/cage-moves": ArrowLeftRight,
  "/early-warning": AlertTriangle,
  "/users": Users,
  "/logs": FileText,
}

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname() ?? "/"
  const { siteCode, isAllSites, isReady } = useSite()
  const [permissions, setPermissions] = useState<string[] | null>(() => {
    const cached = getCachedSession()
    return cached === undefined ? null : (cached?.permissions ?? [])
  })

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

  const visibleMenus: MenuDef[] = useMemo(() => {
    if (!permissions) return []
    return menusForPermissions(permissions)
  }, [permissions])

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

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" data-testid="sidebar-nav">
          {permissions === null ? (
            <p className="px-3 py-2 text-xs text-slate-400">加载菜单…</p>
          ) : visibleMenus.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">当前角色无可访问菜单</p>
          ) : (
            visibleMenus.map((item) => {
              const Icon = MENU_ICONS[item.href] ?? LayoutDashboard
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={hrefWithSite(item.href)}
                  onClick={onClose}
                  data-testid={`sidebar-link-${item.href === "/" ? "home" : item.href.slice(1)}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    active
                      ? "bg-white/14 text-white shadow-sm ring-1 ring-white/12"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })
          )}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
              <Disc className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">集团管理中心</p>
              <p className="text-xs text-slate-400">按角色显示菜单</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
