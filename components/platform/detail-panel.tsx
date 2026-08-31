"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface DetailPanelProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  /** 覆盖标题区样式（如与左侧列表筛选栏对齐） */
  headerClassName?: string
  actions?: ReactNode
  empty?: boolean
  emptyText?: string
}

export function DetailPanel({
  title,
  subtitle,
  children,
  className,
  headerClassName,
  actions,
  empty,
  emptyText = "请选择列表项查看详情",
}: DetailPanelProps) {
  return (
    <Card
      className={cn(
        "gap-0 h-full flex flex-col overflow-hidden py-0",
        "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
        className,
      )}
    >
      <CardHeader
        className={cn(
          "shrink-0 space-y-0 border-b border-slate-100 px-5 !py-3 dark:border-slate-700",
          headerClassName,
        )}
      >
        <div className="flex min-h-9 items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base font-semibold leading-9 text-slate-900 dark:text-slate-50">
              {title}
            </CardTitle>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {empty ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-12">
            {emptyText}
          </p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0 text-sm">
      <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-900 dark:text-slate-100 text-right font-medium min-w-0 break-words">
        {value}
      </span>
    </div>
  )
}
