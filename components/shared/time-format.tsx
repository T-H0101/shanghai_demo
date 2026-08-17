/**
 * Sprint UI-2026-06-F — 时间格式统一（Client Component）
 *
 * 纯函数实现见 `@/lib/time/beijing`（API / Server 请直接引用该模块）。
 * 本文件再导出工具函数，并提供带 hooks 的 <TimeDisplay />。
 */

"use client"

import { useEffect, useState } from "react"
import {
  formatBeijingTime as formatBeijingTimeCore,
  formatBeijingDate as formatBeijingDateCore,
  formatBeijingTimeOnly as formatBeijingTimeOnlyCore,
  formatBeijingRelative as formatBeijingRelativeCore,
} from "@/lib/time/beijing"

/** 再导出纯函数，保持既有 `@/components/shared/time-format` import 兼容 */
export function formatBeijingTime(
  value: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  return options === undefined
    ? formatBeijingTimeCore(value)
    : formatBeijingTimeCore(value, options)
}

export function formatBeijingDate(value: string | Date | null | undefined): string {
  return formatBeijingDateCore(value)
}

export function formatBeijingTimeOnly(value: string | Date | null | undefined): string {
  return formatBeijingTimeOnlyCore(value)
}

export function formatBeijingRelative(value: string | Date | null | undefined): string {
  return formatBeijingRelativeCore(value)
}

interface TimeDisplayProps {
  /** 时间字符串 (ISO / Date.parse 可解析) 或 Date 对象 或 null/undefined */
  value: string | Date | null | undefined
  /** 显示模式 */
  mode?: "datetime" | "date" | "time" | "relative"
  /** 自定义 className */
  className?: string
  /** value 无效时的兜底显示 */
  fallback?: string
  /** testid */
  testid?: string
  /** 相对时间刷新间隔 (ms), 默认 30000 */
  refreshInterval?: number
}

/**
 * TimeDisplay 组件
 */
export function TimeDisplay({
  value,
  mode = "datetime",
  className,
  fallback = "—",
  testid,
  refreshInterval = 30_000,
}: TimeDisplayProps) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (mode !== "relative") return
    const t = setInterval(() => setTick((n) => n + 1), refreshInterval)
    return () => clearInterval(t)
  }, [mode, refreshInterval])

  if (!value) {
    return (
      <span className={className} data-testid={testid}>
        {fallback}
      </span>
    )
  }

  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) {
    return (
      <span className={className} data-testid={testid}>
        {fallback}
      </span>
    )
  }

  let display: string
  switch (mode) {
    case "date":
      display = formatBeijingDate(d)
      break
    case "time":
      display = formatBeijingTimeOnly(d)
      break
    case "relative":
      display = formatBeijingRelative(d)
      break
    case "datetime":
    default:
      display = formatBeijingTime(d)
      break
  }

  return (
    <span
      className={className}
      data-testid={testid}
      title={d.toISOString()}
    >
      {display}
    </span>
  )
}
