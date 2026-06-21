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
}: StatCardProps) {
  const isClickable = Boolean(href) || Boolean(onClick)
  const cardBody = (
    <Card
      className={cn(
        "p-5 gap-0 transition-colors duration-200",
        isClickable && "cursor-pointer hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-3 rounded-lg", iconBg)}>
          <Icon className={cn("h-6 w-6", iconColor)} />
        </div>
        {badge}
      </div>
      <p className="text-sm text-slate-500 mb-1">{title}</p>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold text-slate-900">{value}</span>
        {unit && <span className="text-sm text-slate-500">{unit}</span>}
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