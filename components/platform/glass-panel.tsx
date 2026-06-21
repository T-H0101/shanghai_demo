import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

interface GlassPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /**
   * 标题 (可选, 顶部加粗 + 副标题样式)
   */
  title?: ReactNode
  /**
   * 副标题 / 描述
   */
  description?: ReactNode
  /**
   * 右上角操作 (按钮、徽章、状态条)
   */
  actions?: ReactNode
  /**
   * 视觉强度: 高级别有更明显的背景 / 边框 / 阴影
   */
  intensity?: "soft" | "default" | "strong"
  /**
   * 是否启用对角线 shine hover 反馈 (默认 true)
   * 已被 prefers-reduced-motion 媒体查询覆盖
   */
  shine?: boolean
  /**
   * data-testid 透传
   */
  testId?: string
}

const intensityClass: Record<NonNullable<GlassPanelProps["intensity"]>, string> = {
  soft: "bg-white/70 border-slate-200/70 shadow-sm dark:bg-slate-900/80 dark:border-slate-700/70",
  default:
    "bg-white/85 border-slate-200 shadow-md dark:bg-slate-900/90 dark:border-slate-700",
  strong:
    "bg-white/95 border-slate-300 shadow-lg dark:bg-slate-800 dark:border-slate-700",
}

/**
 * 统一玻璃质感面板 (R.77 Enterprise UI 产品化)
 *
 * 视觉特征:
 * - 半透明白底 + 细边框 + 阴影分层
 * - 顶部 title/description/actions 槽位
 * - 可选对角线 shine hover (默认开, 自动尊重 prefers-reduced-motion)
 *
 * 不接受 onClick, 避免把卡片当按钮; 真正的可点击行为请用 Button 或外层 <button> 包裹.
 */
export function GlassPanel({
  title,
  description,
  actions,
  intensity = "default",
  shine = true,
  testId,
  className,
  children,
  ...rest
}: GlassPanelProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "relative overflow-hidden rounded-2xl backdrop-blur-sm",
        "transition-[box-shadow,border-color,transform] duration-200 ease-out",
        intensityClass[intensity],
        shine && "app-shine-hover",
        className,
      )}
      {...rest}
    >
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 px-5 py-4 dark:border-slate-700/60">
          <div className="min-w-0">
            {title && (
              <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {title}
              </p>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}
