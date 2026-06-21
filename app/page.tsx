"use client"

import { AppShell } from "@/components/layout/app-shell"
import { CommandCenterPanel } from "@/components/dashboard/command-center-panel"
import { SyncTrendChart } from "@/components/dashboard/sync-trend-chart"
import { TaskTable } from "@/components/dashboard/task-table"
import { AlertCenter } from "@/components/dashboard/alert-center"
import { DashboardRecentSyncs } from "@/components/dashboard/dashboard-recent-syncs"
import { Database } from "lucide-react"

export default function Page() {
  return (
    <AppShell>
      <div className="flex items-center gap-2 px-1 text-[10px] text-slate-500" data-testid="dashboard-datasource">
        <Database className="h-3 w-3" />
        <span>平台数据实时读取，异常时会直接提示。</span>
        <span className="text-amber-600 ml-2">不使用演示数据替代真实状态</span>
      </div>
      <CommandCenterPanel />
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
