"use client"

import { AppShell } from "@/components/layout/app-shell"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { SyncTrendChart } from "@/components/dashboard/sync-trend-chart"
import { SiteHealthHeatmap } from "@/components/dashboard/site-health-heatmap"
import { TaskTable } from "@/components/dashboard/task-table"
import { AlertCenter } from "@/components/dashboard/alert-center"
import { DashboardSummaryBar } from "@/components/dashboard/dashboard-summary-bar"
import { DashboardRecentSyncs } from "@/components/dashboard/dashboard-recent-syncs"

export default function Page() {
  return (
    <AppShell>
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
