/** 会话失效时的统一提示（API requireSession → 401） */
export const SESSION_EXPIRED_MESSAGE = "登录已过期，请重新登录"

/** 将 HTTP 状态码转为面向用户的错误文案 */
export function httpStatusMessage(status: number): string {
  if (status === 401) return SESSION_EXPIRED_MESSAGE
  return `HTTP ${status}`
}

/** 识别已抛出的 HTTP 401 / 会话类错误，统一成过期提示 */
export function formatApiErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (
    msg === SESSION_EXPIRED_MESSAGE ||
    /\bHTTP\s*401\b/i.test(msg) ||
    msg.includes("AUTH_UNAUTHENTICATED")
  ) {
    return SESSION_EXPIRED_MESSAGE
  }
  return msg
}

export function isSessionExpiredError(err: unknown): boolean {
  return formatApiErrorMessage(err) === SESSION_EXPIRED_MESSAGE
}
