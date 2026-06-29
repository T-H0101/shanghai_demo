/**
 * Sprint UI-2026-06-F — 时间格式统一
 *
 * 设计目标:
 * - 所有页面显示时间统一用北京时间 (UTC+8)
 * - 统一格式: "2026-06-16 15:30:45" (秒级)
 * - 统一 locale: zh-CN, hour12: false
 * - 处理 null / 无效字符串 / 纯日期 / 时间戳 多种输入
 *
 * 用法:
 *   <TimeDisplay value="2026-05-29T07:47:07.860Z" />            // 标准
 *   <TimeDisplay value={ts} mode="datetime" />                  // 完整
 *   <TimeDisplay value={ts} mode="date" />                       // 仅日期
 *   <TimeDisplay value={ts} mode="time" />                       // 仅时间
 *   <TimeDisplay value={ts} mode="relative" />                   // 相对时间 (3 分钟前)
 *
 * 工具函数:
 *   formatBeijingTime(value) -> string (统一格式化)
 *   formatBeijingDate(value) -> string (yyyy-MM-dd)
 *   formatBeijingRelative(value) -> string (刚刚 / N 分钟前 / N 小时前)
 */

import { useEffect, useState } from "react"

const BEIJING_TZ = "Asia/Shanghai"

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
 * 把任意输入转成北京时间字符串
 * 默认格式: "2026-06-16 15:30:45" (ISO 风格, 中文标准)
 */
export function formatBeijingTime(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: BEIJING_TZ,
  },
): string {
  if (!value) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  // zh-CN uses "/" by default; replace with "-" for ISO-style (yyyy-MM-dd HH:mm:ss)
  return d.toLocaleString("zh-CN", options).replace(/\//g, "-")
}

/**
 * 仅日期 (yyyy-MM-dd, 北京时间)
 */
export function formatBeijingDate(value: string | Date | null | undefined): string {
  return formatBeijingTime(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: BEIJING_TZ,
  })
}

/**
 * 仅时间 (HH:mm:ss, 北京时间)
 */
export function formatBeijingTimeOnly(value: string | Date | null | undefined): string {
  return formatBeijingTime(value, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: BEIJING_TZ,
  })
}

/**
 * 相对时间 ("刚刚" / "3 分钟前" / "2 小时前" / "昨天" / "2026-06-15")
 */
export function formatBeijingRelative(value: string | Date | null | undefined): string {
  if (!value) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""

  const now = Date.now()
  const diff = now - d.getTime()
  const abs = Math.abs(diff)
  const future = diff < 0

  if (abs < 30 * 1000) return "刚刚"
  if (abs < 60 * 1000) return future ? "30 秒后" : "30 秒前"
  if (abs < 60 * 60 * 1000) {
    const m = Math.floor(abs / 60 / 1000)
    return future ? `${m} 分钟后` : `${m} 分钟前`
  }
  if (abs < 24 * 60 * 60 * 1000) {
    const h = Math.floor(abs / 60 / 60 / 1000)
    return future ? `${h} 小时后` : `${h} 小时前`
  }
  if (abs < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(abs / 24 / 60 / 60 / 1000)
    return future ? `${days} 天后` : `${days} 天前`
  }
  // 超过 7 天回退到日期
  return formatBeijingDate(d)
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
  // 相对时间需要刷新 (以保持 "N 分钟前" 准确)
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

  // Tooltip 显示完整 ISO 让用户可对照
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
