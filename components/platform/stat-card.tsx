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
}: StatCardProps) {
  return (
    <Card className="p-5 gap-0">
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
}
