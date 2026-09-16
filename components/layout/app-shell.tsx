"use client"

import { useState, type ReactNode } from "react"
import { RouteGuard } from "@/components/auth/route-guard"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { cn } from "@/lib/utils"

interface AppShellProps {
  children: ReactNode
  /** 覆盖 main 默认 class（如检索页定高、禁止页面级滚动） */
  mainClassName?: string
}

/**
 * 布局：视口定高 = 顶栏 + 可滚动主区 + 固定页脚。
 * 整页不滚动；内容只在 main 内滚动。
 */
export function AppShell({ children, mainClassName }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <RouteGuard>
      <div className="app-ambient-shell">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-60 flex h-dvh flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main
            className={cn(
              "min-h-0 flex-1",
              mainClassName ?? "overflow-y-auto page-pad space-y-4 lg:space-y-6",
            )}
          >
            {children}
          </main>
          <footer
            className="shrink-0 border-t border-slate-200/80 bg-white/80 px-4 py-2.5 text-center dark:border-slate-800 dark:bg-slate-950/80"
            data-testid="app-tech-support-footer"
          >
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              © 2026 北京星震同源数字系统股份有限公司
              <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
              技术支持
            </p>
          </footer>
        </div>
      </div>
    </RouteGuard>
  )
}
