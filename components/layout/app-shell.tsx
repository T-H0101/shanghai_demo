"use client"

import { useState, type ReactNode } from "react"
import { RouteGuard } from "@/components/auth/route-guard"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"

interface AppShellProps {
  children: ReactNode
  /** 覆盖 main 默认 class（如检索页定高、禁止页面级滚动） */
  mainClassName?: string
}

export function AppShell({ children, mainClassName }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <RouteGuard>
      <div className="app-ambient-shell">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-60 flex min-h-screen flex-col">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main
            className={
              mainClassName ?? "space-y-4 p-4 lg:space-y-6 lg:p-6"
            }
          >
            {children}
          </main>
          <footer
            className="mt-auto border-t border-slate-200/80 bg-white/60 px-4 py-3 text-center dark:border-slate-800 dark:bg-slate-950/40"
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
