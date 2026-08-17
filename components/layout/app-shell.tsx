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
        <div className="lg:ml-60">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main
            className={
              mainClassName ?? "space-y-4 p-4 lg:space-y-6 lg:p-6"
            }
          >
            {children}
          </main>
        </div>
      </div>
    </RouteGuard>
  )
}
