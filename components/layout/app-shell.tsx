"use client"

import { useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { RouteGuard } from "@/components/auth/route-guard"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { FirstRunCoach } from "@/components/shared/first-run-coach"

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const guideSteps = getGuideSteps(pathname)

  return (
    <RouteGuard>
      <div className="app-ambient-shell">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-60">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-4 lg:p-6 space-y-4 lg:space-y-6">{children}</main>
        </div>
        {guideSteps.length > 0 && (
          <FirstRunCoach pageKey={`route-${pathname || "/"}`} steps={guideSteps} />
        )}
      </div>
    </RouteGuard>
  )
}

function getGuideSteps(pathname: string) {
  const common = [
    { selector: '[data-testid="command-palette-trigger"]', message: "这里可以用快捷命令跳转页面、切换站点或进入常用操作。" },
  ]

  if (pathname === "/") {
    return [
      ...common,
      { selector: '[data-testid="command-center-panel"]', message: "这里是总控首页，集中展示同步、任务、告警和控制队列的运行状态。" },
      { selector: '[data-testid="dashboard-stat-tasks"]', message: "KPI 卡片可跳转到对应业务页面，用于快速定位问题。" },
      { selector: '[data-testid="dashboard-recent-syncs"]', message: "这里查看最近同步结果，失败记录会明确标红。" },
      { selector: '[data-testid="dashboard-task-table"]', message: "这里展示任务状态；控制类操作只提交队列，等待站点 Agent 执行。" },
    ]
  }

  if (pathname.startsWith("/sync")) {
    return [
      ...common,
      { selector: '[data-testid="sync-config-card"]', message: "这里展示同步策略和安全配置引用，只显示键名，不展示敏感值。" },
      { selector: '[data-testid="sync-alert-summary-card"]', message: "同步告警来自日志聚合，失败与阻塞会明确展示。" },
      { selector: '[data-testid="sync-export"]', message: "这里可以导出同步日志，导出内容带记录数和摘要校验。" },
    ]
  }

  if (pathname.startsWith("/tasks")) {
    return [
      ...common,
      { selector: '[data-testid="tasks-search-input"]', message: "按任务编号、名称或站点快速筛选任务。" },
      { selector: '[data-testid="tasks-phase-filter"]', message: "按运行、失败、暂停等阶段查看任务。" },
      { selector: '[data-testid="task-row-pause"]', message: "暂停/恢复会提交到控制队列，最终结果以站点 Agent 回写为准。" },
      { selector: '[data-testid="tasks-reset-filters"]', message: "这里可以清除筛选条件，回到全量任务视图。" },
    ]
  }

  if (pathname.startsWith("/racks")) {
    return [
      ...common,
      { selector: '[data-testid="racks-export"]', message: "这里导出设备数据；暂无数据时不生成导出。" },
      { selector: '[data-testid="racks-storage-tabs"]', message: "这里切换设备总览、存储浏览和数据恢复；未接入能力会说明原因。" },
      { selector: '[data-testid="racks-storage-overview-content"]', message: "设备总览展示当前站点设备、盘位和数据同步状态。" },
    ]
  }

  if (pathname.startsWith("/search")) {
    return [
      ...common,
      { selector: '[data-testid="search-keyword"]', message: "这里做跨维度检索；当前只展示已接入维度，不宣称千万级能力。" },
      { selector: '[data-testid="search-submit"]', message: "点击后执行检索；检索服务未接入时会显示限制说明。" },
      { selector: '[data-testid="search-export"]', message: "检索结果可导出，导出遵循当前查询结果。" },
    ]
  }

  if (pathname.startsWith("/logs")) {
    return [
      ...common,
      { selector: '[data-testid="logs-filter-error-code"]', message: "日志支持错误码、设备和任务类型筛选，用于排查站点任务问题。" },
      { selector: '[data-testid="logs-export-xlsx"]', message: "导出能力按已配置依赖展示；未接入格式会明确提示。" },
    ]
  }

  if (pathname.startsWith("/sites")) {
    return [
      ...common,
      { selector: '[data-testid="sites-refresh"]', message: "刷新站点列表和 Agent 在线状态。" },
      { selector: '[data-testid="sites-consistency"]', message: "这里触发中心库与站点库一致性检查。" },
      { selector: '[data-testid="sites-register"]', message: "站点写操作受认证和配置约束；未解锁时保持禁用并说明原因。" },
    ]
  }

  if (pathname.startsWith("/settings")) {
    return [
      ...common,
      { selector: '[data-testid="settings-site-registry"]', message: "这里展示站点注册和配置来源。" },
      { selector: '[data-testid="settings-site-runtime"]', message: "这里展示 Agent 运行状态和同步运行时信息。" },
      { selector: '[data-testid="settings-auth-config"]', message: "这里展示认证配置边界，只显示安全引用，不展示敏感值。" },
    ]
  }

  if (pathname.startsWith("/users")) {
    return [
      ...common,
      { selector: '[data-testid="users-export"]', message: "这里导出中心库用户视图，导出结果来自同步数据。" },
      { selector: '[data-testid="users-export-format"]', message: "可选择导出格式；不支持的格式必须明确提示。" },
    ]
  }

  // R.92: /volumes 已合并至 /racks?view=volumes, 引导步骤随 /racks 路径
  // 此处不再单独处理 /volumes

  return common
}
