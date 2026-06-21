"use client"

/**
 * Sprint UI-2026-06-B — 表格空/错状态统一组件 (R.UI-CmdCenter 升级)
 *
 * 用法:
 *   <EmptyState
 *     icon={Inbox}
 *     title="暂无任务"
 *     description="等待站点上报任务数据"
 *     action={{ label: "查看站点", href: "/sites" }}
 *     severity="blocked"
 *   />
 *
 * 三档 severity:
 *   - empty   : 中性, 默认, 表示真的无数据
 *   - blocked : 受限, 因 source schema / 站点配合 / 外部系统阻塞
 *   - error   : 错误, 数据读取失败
 *
 * 设计:
 * - 居中布局, 弱化视觉 (用户不会一直盯着空状态)
 * - 一个 SVG 图标 + 标题 + 描述 + (可选) 跳转按钮
 * - 保持现有 border/padding 风格
 */

import Link from "next/link"
import { Inbox, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type EmptyStateSeverity = "empty" | "blocked" | "error"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  className?: string
  testid?: string
  severity?: EmptyStateSeverity
}

const severityClass: Record<EmptyStateSeverity, string> = {
  empty: "border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300",
  blocked: "border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300",
  error: "border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-900/20 text-red-800 dark:text-red-300",
}

const severityIconClass: Record<EmptyStateSeverity, string> = {
  empty: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
  blocked: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
  error: "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-300",
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  testid,
  severity = "empty",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-10 px-6 text-center",
        "border-2 border-dashed rounded-lg",
        severityClass[severity],
        className,
      )}
      data-testid={testid ?? `empty-state-${severity}`}
    >
      <div className={cn("mb-3 flex h-12 w-12 items-center justify-center rounded-full", severityIconClass[severity])}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="mt-1 text-xs opacity-80 max-w-md">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Button asChild variant="outline" size="sm" className="h-8 text-xs">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
  testid?: string
}

export function ErrorState({
  title = "加载失败",
  description = "中心库读取失败, 请刷新页面或联系运维",
  onRetry,
  className,
  testid,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-10 px-6 text-center",
        "border border-red-200 dark:border-red-800 rounded-lg bg-red-50/40 dark:bg-red-900/20",
        className,
      )}
      data-testid={testid ?? "error-state"}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
        <Inbox className="h-6 w-6 text-red-500 dark:text-red-300" />
      </div>
      <p className="text-sm font-medium text-red-800 dark:text-red-300">{title}</p>
      <p className="mt-1 text-xs text-red-600 dark:text-red-400 max-w-md">{description}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-4 h-8 text-xs"
          data-testid={`${testid ?? "error-state"}-retry`}
        >
          重试
        </Button>
      )}
    </div>
  )
}