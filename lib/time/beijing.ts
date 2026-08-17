/**
 * 北京时间格式化（纯函数，可被 Server Component / API Route 安全引用）
 */

export const BEIJING_TZ = "Asia/Shanghai"

/**
 * 把任意输入转成北京时间字符串
 * 默认格式: "2026-06-16 15:30:45"
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

export function formatBeijingDate(value: string | Date | null | undefined): string {
  return formatBeijingTime(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: BEIJING_TZ,
  })
}

export function formatBeijingTimeOnly(value: string | Date | null | undefined): string {
  return formatBeijingTime(value, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: BEIJING_TZ,
  })
}

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
  return formatBeijingDate(d)
}
