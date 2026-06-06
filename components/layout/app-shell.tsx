"use client"

import { useState, type ReactNode, Suspense } from "react"
import { RouteGuard } from "@/components/auth/route-guard"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { SiteProvider } from "@/lib/site/site-context"

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <RouteGuard>
      <Suspense fallback={null}>
        <SiteProvider>
          <div className="min-h-screen bg-slate-100">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="lg:ml-60">
              <Header onMenuClick={() => setSidebarOpen(true)} />
              <main className="p-4 lg:p-6 space-y-4 lg:space-y-6">{children}</main>
            </div>
          </div>
        </SiteProvider>
      </Suspense>
    </RouteGuard>
  )
}
