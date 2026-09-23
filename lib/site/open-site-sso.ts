/**
 * 总控 → 站点 SSO 跳转（浏览器侧）
 * 与设备「去站点管理」、卷「去站点管理」同一契约：
 * GET /api/sites/{siteCode}/sso?redirect=...
 */

import { formatApiErrorMessage, httpStatusMessage } from "@/lib/api/http-error"

export type SiteSsoJumpOptions = {
  /** 站点落地相对路径，如 /task-list、/device-management */
  redirect?: string
  /** 是否立即 window.open；默认 true */
  open?: boolean
}

/**
 * 签发站点跳转 URL；失败抛 Error（文案经 formatApiErrorMessage 后可给 toast）。
 */
export async function fetchSiteSsoJumpUrl(
  siteCode: string,
  redirect?: string,
): Promise<string> {
  const code = siteCode.trim()
  if (!code || code === "—") {
    throw new Error("缺少目标站点，无法跳转")
  }
  const qs = new URLSearchParams()
  if (redirect?.trim()) qs.set("redirect", redirect.trim())
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  const res = await fetch(`/api/sites/${encodeURIComponent(code)}/sso${suffix}`, {
    cache: "no-store",
    credentials: "include",
  })
  const json = await res.json().catch(() => ({}))
  if (res.status === 401) {
    throw new Error("请先登录后再跳转站点")
  }
  if (!res.ok) {
    const fromApi =
      (typeof json.message === "string" && json.message) ||
      (typeof json.error === "string" && json.error) ||
      ""
    throw new Error(formatApiErrorMessage(fromApi || httpStatusMessage(res.status)))
  }
  if (json.status !== "ready" || !json.jumpUrl) {
    const fromApi =
      (typeof json.message === "string" && json.message) ||
      (typeof json.blocker === "string" && json.blocker) ||
      ""
    throw new Error(formatApiErrorMessage(fromApi || "无法签发站点跳转"))
  }
  return String(json.jumpUrl)
}

/** 签发并可选打开新窗口；返回 jumpUrl */
export async function openSiteSsoJump(
  siteCode: string,
  opts?: SiteSsoJumpOptions,
): Promise<string> {
  const jumpUrl = await fetchSiteSsoJumpUrl(siteCode, opts?.redirect)
  if (opts?.open !== false) {
    window.open(jumpUrl, "_blank", "noopener,noreferrer")
  }
  return jumpUrl
}
