"use client"

import { AppShell } from "@/components/layout/app-shell"
import { WelcomeBanner } from "@/components/dashboard/welcome-banner"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { SyncTrendChart } from "@/components/dashboard/sync-trend-chart"
import { SiteHealthHeatmap } from "@/components/dashboard/site-health-heatmap"
import { TaskTable } from "@/components/dashboard/task-table"
import { AlertCenter } from "@/components/dashboard/alert-center"
import { DashboardSummaryBar } from "@/components/dashboard/dashboard-summary-bar"
import { DashboardRecentSyncs } from "@/components/dashboard/dashboard-recent-syncs"
import { Database } from "lucide-react"

export default function Page() {
  return (
    <AppShell>
      {/* R.15: dataSource 显式 (R.10D 统一规范), 子组件各自声明 (database/empty/error) */}
      <div className="flex items-center gap-2 px-1 text-[10px] text-slate-500" data-testid="dashboard-datasource">
        <Database className="h-3 w-3" />
        <span>dataSource: 子组件 API 实时拉取 (taskProvider / rackProvider / /api/sites 等)</span>
        <span className="text-amber-600 ml-2">无 mock fallback · 实时失败时显示 error</span>
      </div>
      <WelcomeBanner />
      <DashboardSummaryBar />
      <StatsCards />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6 items-stretch">
        <div className="xl:col-span-2">
          <SyncTrendChart className="h-full" />
        </div>
        <div>
          <DashboardRecentSyncs />
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        <div className="xl:col-span-2">
          <TaskTable />
        </div>
        <div className="relative">
          <AlertCenter />
        </div>
      </div>
    </AppShell>
  )
}
