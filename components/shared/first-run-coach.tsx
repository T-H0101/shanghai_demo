"use client"

/**
 * Sprint UI-2026-06-D — 首访引导 (v2 增强版)
 *
 * 用法:
 *   <FirstRunCoach
 *     pageKey="dashboard"
 *     steps={[
 *       { selector: '[data-testid="x"]', message: "提示文案" },
 *     ]}
 *   />
 *
 * v2 改进:
 * - 自动滚动到目标元素 (避免屏幕外看不到)
 * - 8s 自动下一步 (用户友好, 可手动暂停)
 * - "暂停引导" 按钮 + ESC 关闭
 * - 进度点 (dots) 显示当前步骤
 * - "上一步" 按钮可回退
 * - 气泡位置智能: 优先下方, 屏幕底部则改上方
 *
 * 行为:
 * - 首次进入页面 1.5s 后开始显示第 1 步
 * - 用户可点 ✕ / "上一步" / "下一步" / 等 8s 自动跳
 * - 全部走完后 / 用户按 ESC / 点 ✕ → 写入 localStorage
 * - 下次访问该页面不再出现
 */

import { useEffect, useState, useRef, useCallback } from "react"
import { X, Pause, Play, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CoachStep {
  selector: string
  message: string
}

interface FirstRunCoachProps {
  pageKey: string
  steps: CoachStep[]
}

const STORAGE_PREFIX = "unified.firstRun."
const SHOW_DELAY_MS = 1500
const AUTO_NEXT_MS = 8000

export function FirstRunCoach({ pageKey, steps }: FirstRunCoachProps) {
  const [active, setActive] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; arrow: "top" | "bottom" } | null>(null)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0) // 0-100, for progress bar
  const targetRef = useRef<HTMLElement | null>(null)
  const advanceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 决定是否启用 + 启动延迟
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
    }
  }, [pageKey])

  const dismiss = useCallback(() => {
    setActive(false)
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + pageKey, new Date().toISOString())
      } catch {
        // ignore
      }
    }
  }, [pageKey])

  const goTo = useCallback(
    (idx: number) => {
      if (idx >= steps.length) {
        dismiss()
        return
      }
      setStepIdx(idx)
      setProgress(0)
    },
    [steps.length, dismiss],
  )

  const next = useCallback(() => {
    goTo(stepIdx + 1)
  }, [stepIdx, goTo])

  const prev = useCallback(() => {
    if (stepIdx > 0) goTo(stepIdx - 1)
  }, [stepIdx, goTo])

  // 自动进度 + 自动下一步
  useEffect(() => {
    if (!active || paused) return
    setProgress(0)
    const start = Date.now()
    advanceTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min(100, (elapsed / AUTO_NEXT_MS) * 100)
      setProgress(pct)
      if (elapsed >= AUTO_NEXT_MS) {
        next()
      }
    }, 100)
    return () => {
      if (advanceTimerRef.current) clearInterval(advanceTimerRef.current)
    }
  }, [active, paused, stepIdx, next])

  // 定位 + 滚动到目标
  useEffect(() => {
    if (!active) return
    const step = steps[stepIdx]
    if (!step) return

    let cancelled = false
    const findAndPosition = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null
      if (!el) {
        const t = setTimeout(findAndPosition, 800)
        return () => clearTimeout(t)
      }
      if (cancelled) return
      targetRef.current = el

      // 滚动到目标 (确保用户能看到)
      el.scrollIntoView({ behavior: "smooth", block: "center" })

      // 等滚动完成后定位 (300ms)
      setTimeout(() => {
        if (cancelled || !el) return
        const rect = el.getBoundingClientRect()
        const coachWidth = 320
        const coachHeight = 130
        let top = rect.bottom + 16 + window.scrollY
        let left = rect.left + rect.width / 2 - coachWidth / 2 + window.scrollX
        let arrow: "top" | "bottom" = "top"
        // 防止溢出底部
        if (top + coachHeight > window.scrollY + window.innerHeight - 8) {
          top = rect.top - coachHeight - 16 + window.scrollY
          arrow = "bottom"
        }
        // 防止溢出右侧
        if (left + coachWidth > window.scrollX + window.innerWidth - 8) {
          left = window.scrollX + window.innerWidth - coachWidth - 8
        }
        if (left < 8) left = 8 + window.scrollX
        setPos({ top, left, arrow })
      }, 320)
    }

    findAndPosition()
    window.addEventListener("resize", findAndPosition)
    window.addEventListener("scroll", findAndPosition, true)

    return () => {
      cancelled = true
      window.removeEventListener("resize", findAndPosition)
      window.removeEventListener("scroll", findAndPosition, true)
    }
  }, [active, stepIdx, steps])

  // ESC 关闭
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss()
      if (e.key === "ArrowRight") next()
      if (e.key === "ArrowLeft") prev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active, dismiss, next, prev])

  if (!active || !pos || steps.length === 0) return null

  const step = steps[stepIdx]
  const isLast = stepIdx === steps.length - 1
  const isFirst = stepIdx === 0

  return (
    <>
      {/* 高亮圆环 (仅视觉, 不阻挡点击) */}
      {targetRef.current && (
        <div
          className="fixed pointer-events-none z-40 rounded-lg ring-4 ring-blue-500 ring-offset-2 ring-offset-white"
          style={{
            top: targetRef.current.getBoundingClientRect().top - 6 + window.scrollY,
            left: targetRef.current.getBoundingClientRect().left - 6 + window.scrollX,
            width: targetRef.current.getBoundingClientRect().width + 12,
            height: targetRef.current.getBoundingClientRect().height + 12,
          }}
          aria-hidden
        />
      )}

      {/* 气泡 */}
      <div
        data-testid={`first-run-coach-${pageKey}`}
        className="fixed z-50 w-[320px] rounded-lg bg-slate-900 text-white shadow-2xl border border-slate-700 overflow-hidden"
        style={{ top: pos.top, left: pos.left }}
        role="dialog"
        aria-live="polite"
      >
        {/* 顶部进度条 */}
        <div className="h-1 bg-slate-800 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-blue-400 transition-all duration-100"
            style={{
              width: paused ? `${((stepIdx + 1) / steps.length) * 100}%` : `${progress}%`,
              transition: paused ? "width 200ms" : undefined,
            }}
          />
        </div>

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

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-blue-300 font-semibold">
                引导
              </span>
              {/* 进度点 */}
              <div className="flex gap-1" data-testid={`first-run-coach-progress-${pageKey}`}>
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      i < stepIdx ? "bg-blue-400" : i === stepIdx ? "bg-blue-300" : "bg-slate-600",
                    )}
                    aria-hidden
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="text-slate-400 hover:text-white transition-colors p-1 cursor-pointer"
                aria-label={paused ? "继续引导" : "暂停引导"}
                data-testid={`first-run-coach-pause-${pageKey}`}
              >
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="text-slate-400 hover:text-white transition-colors p-1 cursor-pointer"
                aria-label="关闭引导"
                data-testid={`first-run-coach-close-${pageKey}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <p className="text-[13px] leading-relaxed mb-3">{step.message}</p>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400">
              {paused ? "已暂停" : `第 ${stepIdx + 1}/${steps.length} 步 · 8s 后自动下一步`}
            </span>
            <div className="flex gap-1">
              {!isFirst && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prev}
                  className="h-7 px-2 text-[11px] text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                  data-testid={`first-run-coach-prev-${pageKey}`}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
              )}
              <Button
                size="sm"
                onClick={next}
                className="h-7 px-3 text-[11px] bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                data-testid={`first-run-coach-next-${pageKey}`}
              >
                {isLast ? "完成" : "下一步"}
                {!isLast && <ChevronRight className="h-3 w-3 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
