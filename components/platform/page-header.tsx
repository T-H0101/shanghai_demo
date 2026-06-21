import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  badge?: string
  badgeTone?: "default" | "outline" | "warning" | "success"
  actions?: ReactNode
  extra?: ReactNode
  source?: string
  requirement?: string
  className?: string
}

const badgeToneClass: Record<NonNullable<PageHeaderProps["badgeTone"]>, string> = {
  default: "bg-blue-600 text-white hover:bg-blue-600",
  outline: "border border-slate-300 bg-white text-slate-600 hover:bg-white",
  warning: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100",
  success: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
}

export function PageHeader({
  title,
  description,
  badge,
  badgeTone = "default",
  actions,
  extra,
  source,
  requirement,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3", className)}>
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {badge && (
            <Badge
              className={cn("text-xs", badgeToneClass[badgeTone])}
              data-testid="page-header-badge"
              data-source={source}
              data-requirement={requirement}
            >
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        )}
        {(source || requirement) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            {source && (
              <span data-testid="page-header-source">
                数据源: <span className="font-mono text-slate-500">{source}</span>
              </span>
            )}
            {requirement && (
              <span data-testid="page-header-requirement">
                对应需求: <span className="font-mono text-slate-500">{requirement}</span>
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap" data-testid="page-header-actions">
        {extra && <div>{extra}</div>}
        {actions && <div>{actions}</div>}
      </div>
    </div>
  )
}