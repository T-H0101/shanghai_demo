"use client"

/**
 * Sprint UI-2026-06-B — 全局 Tooltip 封装
 *
 * 基于 Radix Tooltip (项目已有 components/ui/tooltip.tsx),
 * 提供统一 API:
 *
 *   <AppTooltip content="提交暂停命令, 等待站点执行">
 *     <Button>暂停</Button>
 *   </AppTooltip>
 *
 * 默认行为:
 * - delayDuration: 200ms (避免误触)
 * - 暗色背景 + 白字 + 圆角 + 阴影
 * - 位置自动避让
 * - 键盘可达 (Tab + Enter)
 *
 * 不用 Tooltip 的场景:
 * - 按钮文案已自解释 (例: "查看任务" 不需要)
 * - 用户主动点击后弹 toast 时 (避免重复提示)
 */

import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface AppTooltipProps {
  /** 气泡文案; 必填 */
  content: React.ReactNode
  /** 被包裹的触发元素 (button/span/Link 均可) */
  children: React.ReactElement
  /** 强制指定方位 */
  side?: "top" | "right" | "bottom" | "left"
  /** 自定义对齐 */
  align?: "start" | "center" | "end"
  /** 自定义 className */
  className?: string
  /** 自定义延迟 (毫秒). 默认 200 */
  delayDuration?: number
  /** 禁用 (调试时或禁用状态下用) */
  disabled?: boolean
}

export function AppTooltip({
  content,
  children,
  side = "top",
  align = "center",
  className,
  delayDuration = 200,
  disabled = false,
}: AppTooltipProps) {
  if (disabled || !content) {
    return <>{children}</>
  }

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            "max-w-xs text-xs leading-relaxed",
            "bg-slate-900 text-white border border-slate-700",
            "shadow-lg",
            className,
          )}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
