"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface CapsuleTabItem {
  /**
   * 唯一键 (用作 data-testid 后缀)
   */
  key: string
  /**
   * 显示文本
   */
  label: ReactNode
  /**
   * 可选图标 (Lucide Icon)
   */
  icon?: ReactNode
  /**
   * 可选徽章 / 计数 (右上角小药丸)
   */
  badge?: ReactNode
  /**
   * 是否禁用 (灰显 + 不响应)
   */
  disabled?: boolean
  /**
   * 段内容
   */
  content: ReactNode
}

interface CapsuleTabsProps {
  /**
   * 当前激活的 key (受控)
   */
  value: string
  /**
   * 切换回调
   */
  onValueChange: (next: string) => void
  /**
   * 分段列表
   */
  items: CapsuleTabItem[]
  /**
   * 容器 className
   */
  className?: string
  /**
   * 列表 className
   */
  listClassName?: string
  /**
   * 列表对齐方式
   */
  align?: "start" | "center" | "end"
  /**
   * 容器级 data-testid (默认 settings-tabs)
   */
  testId?: string
}

const alignClass: Record<NonNullable<CapsuleTabsProps["align"]>, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
}

/**
 * 统一胶囊型分段 (R.77 Enterprise UI 产品化)
 *
 * 视觉: 一行圆角胶囊 (类似 iOS segmented control), 当前项下沉 + 阴影, 非当前项透明
 * 行为: 纯受控, 状态由父组件管理, 不接管路由
 * 禁用: 灰显 + cursor-not-allowed
 *
 * 与 Radix Tabs 区别: 这是视觉/交互一致的纯展示控件, 不依赖键盘焦点环
 * (父级可以用自身 a11y 包裹).
 */
export function CapsuleTabs({
  value,
  onValueChange,
  items,
  className,
  listClassName,
  align = "start",
  testId = "settings-tabs",
}: CapsuleTabsProps) {
  return (
    <div className={cn("space-y-4", className)} data-testid={testId}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={cn(
          "flex w-full overflow-x-auto rounded-full border border-slate-200 bg-slate-100/70 p-1",
          alignClass[align],
          listClassName,
        )}
      >
        {items.map((item) => {
          const active = item.key === value
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`${testId}-panel-${item.key}`}
              id={`${testId}-tab-${item.key}`}
              data-testid={`${testId}-${item.key}`}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                if (!active) onValueChange(item.key)
              }}
              className={cn(
                "group relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                active
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                  : "text-slate-600 hover:text-slate-900",
                item.disabled && "cursor-not-allowed opacity-50 hover:text-slate-600",
              )}
            >
              {item.icon && (
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
              {item.badge && (
                <span
                  className={cn(
                    "ml-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4",
                    active
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-200 text-slate-600",
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {items.map((item) => {
        const active = item.key === value
        return (
          <div
            key={item.key}
            role="tabpanel"
            id={`${testId}-panel-${item.key}`}
            aria-labelledby={`${testId}-tab-${item.key}`}
            hidden={!active}
            className={cn(!active && "hidden")}
            data-testid={`${testId}-panel-${item.key}-content`}
          >
            {active ? item.content : null}
          </div>
        )
      })}
    </div>
  )
}
