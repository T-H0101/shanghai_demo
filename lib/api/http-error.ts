/**
 * 面向用户的 API 错误文案
 * - 已知场景：固定中文
 * - 业务无法归类：「未知错误」
 * - 系统未预期异常：「未知异常」（与 api-result 一致）
 */

/** 会话失效时的统一提示（API requireSession → 401） */
export const SESSION_EXPIRED_MESSAGE = "登录已过期，请重新登录"

/** 业务侧无法归类时的兜底 */
export const UNKNOWN_ERROR_MESSAGE = "未知错误"

/** 系统级未预期运行时异常（对用户） */
export const UNKNOWN_EXCEPTION_MESSAGE = "未知异常"

export const FORBIDDEN_MESSAGE = "没有权限执行此操作"
export const BAD_REQUEST_MESSAGE = "请求无效，请检查后重试"
export const NOT_FOUND_MESSAGE = "未找到相关数据"
export const CONFLICT_MESSAGE = "数据冲突，请刷新后重试"
export const LOCKED_MESSAGE = "账户已被临时锁定，请稍后再试"
export const RATE_LIMIT_MESSAGE = "操作过于频繁，请稍后再试"
export const SERVICE_UNAVAILABLE_MESSAGE = "服务暂时不可用，请稍后重试"
export const NETWORK_MESSAGE = "网络异常，请检查网络后重试"

/** 已确认可直接展示给用户的中文文案（白名单） */
const FRIENDLY_MESSAGES = new Set<string>([
  SESSION_EXPIRED_MESSAGE,
  FORBIDDEN_MESSAGE,
  BAD_REQUEST_MESSAGE,
  NOT_FOUND_MESSAGE,
  CONFLICT_MESSAGE,
  LOCKED_MESSAGE,
  RATE_LIMIT_MESSAGE,
  SERVICE_UNAVAILABLE_MESSAGE,
  NETWORK_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
  UNKNOWN_EXCEPTION_MESSAGE,
  "请先登录",
  "请先登录总控后再进入站点",
  "用户名或密码错误",
  "认证服务暂不可用",
  "账户已被临时锁定，请稍后再试",
  "企业身份源尚未配置。ADFS Client ID/Secret 申请通过后再试，本地账号仍可登录。",
  "缺少目标站点，无法跳转",
  "请先登录后再跳转站点",
  "无法签发站点跳转",
  "站点侧或密钥未配置，无法跳转",
  "选中具体站点后再进入站点系统；「全部站点」与「区域」不可跳转",
])

function extractRawMessage(err: unknown): string {
  if (err == null) return ""
  if (typeof err === "string") return err.trim()
  if (err instanceof Error) return (err.message ?? "").trim()
  if (typeof err === "object") {
    const o = err as Record<string, unknown>
    for (const key of ["message", "error", "msg"]) {
      const v = o[key]
      if (typeof v === "string" && v.trim()) return v.trim()
    }
  }
  return String(err).trim()
}

function mapAuthCode(raw: string): string | null {
  const upper = raw.toUpperCase()
  if (
    upper.includes("AUTH_UNAUTHENTICATED") ||
    upper === "UNAUTHENTICATED" ||
    upper.includes("UNAUTHORIZED")
  ) {
    return SESSION_EXPIRED_MESSAGE
  }
  if (
    upper.includes("AUTH_FORBIDDEN") ||
    upper.includes("AUTH_SITE_DENIED") ||
    upper.includes("FORBIDDEN")
  ) {
    return FORBIDDEN_MESSAGE
  }
  if (upper.includes("AUTH_LOCKED") || upper.includes("LOCKED")) {
    return LOCKED_MESSAGE
  }
  if (
    upper.includes("AUTH_INVALID_CREDENTIALS") ||
    upper.includes("INVALID_CREDENTIALS")
  ) {
    return "用户名或密码错误"
  }
  if (upper.includes("AUTH_BAD_REQUEST")) {
    return BAD_REQUEST_MESSAGE
  }
  return null
}

/** 将 HTTP 状态码转为面向用户的错误文案 */
export function httpStatusMessage(status: number): string {
  if (status === 400) return BAD_REQUEST_MESSAGE
  if (status === 401) return SESSION_EXPIRED_MESSAGE
  if (status === 403) return FORBIDDEN_MESSAGE
  if (status === 404) return NOT_FOUND_MESSAGE
  if (status === 409) return CONFLICT_MESSAGE
  if (status === 423) return LOCKED_MESSAGE
  if (status === 429) return RATE_LIMIT_MESSAGE
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return SERVICE_UNAVAILABLE_MESSAGE
  }
  return UNKNOWN_ERROR_MESSAGE
}

/**
 * 将任意错误转为面向用户的中文提示。
 * - 系统级英文/堆栈类 → 「未知异常」
 * - 其它未识别 → 「未知错误」
 */
export function formatApiErrorMessage(err: unknown): string {
  const raw = extractRawMessage(err)
  if (!raw) return UNKNOWN_ERROR_MESSAGE

  if (FRIENDLY_MESSAGES.has(raw)) return raw

  const byAuth = mapAuthCode(raw)
  if (byAuth) return byAuth

  const httpMatch = raw.match(/\bHTTP\s*(\d{3})\b/i)
  if (httpMatch) return httpStatusMessage(Number(httpMatch[1]))

  if (
    /failed to fetch|networkerror|network request failed|load failed|econnrefused|etimedout|enotfound/i.test(
      raw,
    )
  ) {
    return NETWORK_MESSAGE
  }

  // 系统级 / 运行时原文 → 未知异常
  if (
    /internal server error|unknown error|^unknown$|invalid request|sql|stack|exception|econnrefused|password|FATAL|TypeError|ReferenceError/i.test(
      raw,
    )
  ) {
    return UNKNOWN_EXCEPTION_MESSAGE
  }

  // 白名单：纯中文短句可展示
  if (/^[\u4e00-\u9fff]/.test(raw) && !/[A-Za-z]{4,}/.test(raw)) {
    if (raw.length <= 80) return raw
  }

  // 无中文的英文技术串 → 未知异常
  if (!/[\u4e00-\u9fff]/.test(raw)) return UNKNOWN_EXCEPTION_MESSAGE

  return UNKNOWN_ERROR_MESSAGE
}

export function isSessionExpiredError(err: unknown): boolean {
  const raw = extractRawMessage(err)
  if (
    raw === SESSION_EXPIRED_MESSAGE ||
    /\bHTTP\s*401\b/i.test(raw) ||
    raw.toUpperCase().includes("AUTH_UNAUTHENTICATED")
  ) {
    return true
  }
  return formatApiErrorMessage(err) === SESSION_EXPIRED_MESSAGE
}
