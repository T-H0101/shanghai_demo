"use client"

/**
 * Sprint UI-2026-06-B — 首访引导
 *
 * 用法:
 *   <FirstRunCoach
 *     pageKey="dashboard"
 *     steps={[
 *       { selector: '[data-testid="x"]', message: "提示文案" },
 *     ]}
 *   />
 *
 * 行为:
 * - 首次进入页面 1.5s 后开始显示第 1 步
 * - 用户点 ✕ 或 5s 后自动跳下一步
 * - 全部走完后 localStorage 标记, 不再出现
 * - 键盘 ESC 关闭
 *
 * 设计依据: 不引入 driver.js / react-joyride 等大库,
 *           用 Radix Tooltip + 简单定位即可.
 */

import { useEffect, useState, useRef } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CoachStep {
  selector: string
  message: string
}

interface FirstRunCoachProps {
  pageKey: string  // unique key per page, e.g. "dashboard"
  steps: CoachStep[]
}

const STORAGE_PREFIX = "unified.firstRun."
const SHOW_DELAY_MS = 1500
const AUTO_NEXT_MS = 5000

export function FirstRunCoach({ pageKey, steps }: FirstRunCoachProps) {
  const [active, setActive] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; arrow: "top" | "bottom" } | null>(null)
  const targetRef = useRef<HTMLElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const storageKey = STORAGE_PREFIX + pageKey
    try {
      if (window.localStorage.getItem(storageKey)) return
    } catch {
      return
    }
    showTimerRef.current = setTimeout(() => {
      setActive(true)
    }, SHOW_DELAY_MS)
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current)
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    }
  }, [pageKey])

  // 监听目标元素 + 重定位
  useEffect(() => {
    if (!active) return
    const step = steps[stepIdx]
    if (!step) return

    const findAndPosition = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null
      if (!el) {
        // 元素还没渲染, 1s 后重试
        setTimeout(findAndPosition, 1000)
        return
      }
      targetRef.current = el
      const rect = el.getBoundingClientRect()
      // 计算气泡位置: 默认显示在元素下方
      const coachWidth = 280
      const coachHeight = 90
      let top = rect.bottom + 14 + window.scrollY
      let left = rect.left + rect.width / 2 - coachWidth / 2 + window.scrollX
      let arrow: "top" | "bottom" = "top"
      // 防止溢出底部
      if (top + coachHeight > window.scrollY + window.innerHeight) {
        top = rect.top - coachHeight - 14 + window.scrollY
        arrow = "bottom"
      }
      // 防止溢出右侧
      if (left + coachWidth > window.scrollX + window.innerWidth - 8) {
        left = window.scrollX + window.innerWidth - coachWidth - 8
      }
      if (left < 8) left = 8 + window.scrollX
      setPos({ top, left, arrow })
    }

    findAndPosition()
    window.addEventListener("resize", findAndPosition)
    window.addEventListener("scroll", findAndPosition, true)

    // 自动下一步
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    advanceTimerRef.current = setTimeout(() => {
      advance()
    }, AUTO_NEXT_MS)

    return () => {
      window.removeEventListener("resize", findAndPosition)
      window.removeEventListener("scroll", findAndPosition, true)
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIdx])

  const advance = () => {
    if (stepIdx + 1 < steps.length) {
      setStepIdx((i) => i + 1)
    } else {
      dismiss()
    }
  }

  const dismiss = () => {
    setActive(false)
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + pageKey, new Date().toISOString())
      } catch {
        // ignore
      }
    }
  }

  // ESC 关闭
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  if (!active || !pos || steps.length === 0) return null

  const step = steps[stepIdx]
  const isLast = stepIdx === steps.length - 1

  return (
    <>
      {/* 高亮圆环 (仅视觉, 不阻挡点击) */}
      {targetRef.current && (
        <div
          className="fixed pointer-events-none z-40 rounded-lg ring-2 ring-blue-500 ring-offset-2 ring-offset-white animate-pulse"
          style={{
            top: targetRef.current.getBoundingClientRect().top - 4 + window.scrollY,
            left: targetRef.current.getBoundingClientRect().left - 4 + window.scrollX,
            width: targetRef.current.getBoundingClientRect().width + 8,
            height: targetRef.current.getBoundingClientRect().height + 8,
          }}
          aria-hidden
        />
      )}

      {/* 气泡 */}
      <div
        ref={containerRef}
        data-testid={`first-run-coach-${pageKey}`}
        className="fixed z-50 w-[280px] rounded-lg bg-slate-900 text-white shadow-2xl border border-slate-700 p-3"
        style={{ top: pos.top, left: pos.left }}
        role="dialog"
        aria-live="polite"
      >
        {/* 箭头 */}
        <div
          className={cn(
            "absolute h-3 w-3 rotate-45 bg-slate-900 border-slate-700",
            pos.arrow === "top"
              ? "-top-1.5 left-1/2 -translate-x-1/2 border-l border-t"
              : "-bottom-1.5 left-1/2 -translate-x-1/2 border-r border-b",
          )}
          aria-hidden
        />

        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-[10px] uppercase tracking-wider text-blue-300 font-medium">
            引导 {stepIdx + 1}/{steps.length}
          </span>
          <button
            type="button"
            onClick={dismiss}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="关闭引导"
            data-testid={`first-run-coach-close-${pageKey}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs leading-relaxed mb-2">{step.message}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {isLast ? "5s 后自动关闭" : "5s 后下一步"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={advance}
            className="h-6 px-2 text-[11px] text-blue-300 hover:text-white hover:bg-slate-800"
            data-testid={`first-run-coach-next-${pageKey}`}
          >
            {isLast ? "知道了" : "下一步 →"}
          </Button>
        </div>
      </div>
    </>
  )
}
