"use client"

import { AppShell } from "@/components/layout/app-shell"
import { CommandCenterPanel } from "@/components/dashboard/command-center-panel"
import { SyncTrendChart } from "@/components/dashboard/sync-trend-chart"
import { TaskTable } from "@/components/dashboard/task-table"
import { AlertCenter } from "@/components/dashboard/alert-center"
import { DashboardRecentSyncs } from "@/components/dashboard/dashboard-recent-syncs"
import { FirstRunCoach } from "@/components/shared/first-run-coach"
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
      <FirstRunCoach
        pageKey="dashboard"
        steps={[
          { selector: '[data-testid="command-palette-trigger"]', message: "按 ⌘K 快速跳转到任意页面 / 切换站点" },
          { selector: '[data-testid="dashboard-stat-tasks"]', message: "点击 KPI 卡片跳转到任务详情" },
          { selector: '[data-testid="dashboard-stat-devices"]', message: "查看设备在线状态, 跳转到盘架管理" },
          { selector: '[data-testid="dashboard-recent-syncs"]', message: "查看最近的同步记录, 失败包会红色高亮" },
          { selector: '[data-testid="dashboard-task-table"]', message: "鼠标悬停任务行可暂停/恢复, 不会立即执行" },
        ]}
      />
    </AppShell>
  )
}
