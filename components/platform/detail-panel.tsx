"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface DetailPanelProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  actions?: ReactNode
  empty?: boolean
  emptyText?: string
}

export function DetailPanel({
  title,
  subtitle,
  children,
  className,
  actions,
  empty,
  emptyText = "请选择列表项查看详情",
}: DetailPanelProps) {
  return (
    <Card className={cn("gap-0 h-full flex flex-col", className)}>
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">{title}</CardTitle>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 min-h-0">
        <ScrollArea className="h-[calc(100vh-280px)] min-h-[320px]">
          {empty ? (
            <p className="text-sm text-slate-400 text-center py-12">{emptyText}</p>
          ) : (
            children
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-50 last:border-0 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-900 text-right font-medium">{value}</span>
    </div>
  )
}
