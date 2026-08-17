import Link from "next/link"
import { Card } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StatCardProps {
  title: string
  value: string | number
  unit?: string
  icon: LucideIcon
  iconBg?: string
  iconColor?: string
  footer?: React.ReactNode
  badge?: React.ReactNode
  href?: string
  onClick?: () => void
  /** 紧凑高度，适合需要让出列表空间的页面 */
  compact?: boolean
  /** 左图标、右标题+数值，进一步压低高度 */
  horizontal?: boolean
  /** 横向布局时的数字字号；默认 2xl（站点），任务页可传 3xl 保持原数字大小 */
  valueSize?: "2xl" | "3xl"
  /** 横向布局右侧文案：inline=「标题：值单位」；stack=标题与数值两行（设备页） */
  horizontalText?: "inline" | "stack"
  /** 次级指标（与主值同一行，小字不加粗；适合存储卷等多数值卡） */
  secondary?: React.ReactNode
}

export function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  iconBg = "bg-blue-50",
  iconColor = "text-blue-600",
  footer,
  badge,
  href,
  onClick,
  compact = false,
  horizontal = false,
  valueSize = "2xl",
  horizontalText = "inline",
  secondary,
}: StatCardProps) {
  const isClickable = Boolean(href) || Boolean(onClick)
  const valueClass = cn(
    "font-bold text-slate-900 tabular-nums",
    valueSize === "3xl" ? "text-3xl" : "text-2xl",
  )
  const cardBody = horizontal ? (
    <Card
      className={cn(
        "gap-0 px-4 py-3 transition-colors duration-200",
        isClickable && "cursor-pointer hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={cn("rounded-lg p-3 shrink-0", iconBg)}>
          <Icon className={cn("h-6 w-6", iconColor)} />
        </div>
        {horizontalText === "stack" ? (
          secondary != null && secondary !== "" ? (
            <div className="min-w-0 text-right">
              <div className="flex flex-wrap items-baseline justify-end gap-x-0.5 gap-y-0">
                <span className="text-sm text-slate-500 shrink-0">{title}：</span>
                <span className={valueClass}>{value}</span>
                {unit && <span className="text-sm font-normal text-slate-500">{unit}</span>}
                {badge}
              </div>
              <p className="mt-0.5 text-sm font-normal text-slate-500 whitespace-nowrap">{secondary}</p>
            </div>
          ) : (
            <div className="min-w-0 text-right">
              <div className="flex items-center justify-end gap-2">
                <p className="text-sm text-slate-500 truncate">{title}</p>
                {badge}
              </div>
              <div className="mt-0.5 flex items-baseline justify-end gap-0.5 whitespace-nowrap">
                <span className={valueClass}>{value}</span>
                {unit && <span className="text-sm font-normal text-slate-500">{unit}</span>}
              </div>
            </div>
          )
        ) : (
          <div className="min-w-0 flex flex-wrap items-baseline justify-end gap-x-0.5 gap-y-0 text-right">
            <span className="text-sm text-slate-500 shrink-0">{title}：</span>
            <span className={valueClass}>{value}</span>
            {unit && <span className="text-sm text-slate-500">{unit}</span>}
            {badge}
          </div>
        )}
      </div>
      {footer && !(horizontal && horizontalText === "stack" && secondary != null && secondary !== "") ? (
        <div className="mt-2 text-xs text-slate-500">{footer}</div>
      ) : null}
    </Card>
  ) : (
    <Card
      className={cn(
        "gap-0 transition-colors duration-200",
        compact ? "p-3" : "p-5",
        isClickable && "cursor-pointer hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
      )}
    >
      <div className={cn("flex items-start justify-between", compact ? "mb-1.5" : "mb-4")}>
        <div className={cn("rounded-lg", compact ? "p-1.5" : "p-3", iconBg)}>
          <Icon className={cn(compact ? "h-4 w-4" : "h-6 w-6", iconColor)} />
        </div>
        {badge}
      </div>
      <p className={cn("text-slate-500", compact ? "text-xs mb-0.5" : "text-sm mb-1")}>{title}</p>
      <div className={cn("flex items-baseline gap-2", compact ? "mb-0" : "mb-2")}>
        <span className={cn("font-bold text-slate-900", compact ? "text-xl" : "text-3xl")}>{value}</span>
        {unit && <span className={cn("text-slate-500", compact ? "text-xs" : "text-sm")}>{unit}</span>}
      </div>
      {footer}
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none">
        {cardBody}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block text-left w-full">
        {cardBody}
      </button>
    )
  }
  return cardBody
}
