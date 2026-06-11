/**
 * 导出 sanitize — 防止 secret/password/database_url 进入文件 (R.13 §硬约束)
 *
 * 两层保护:
 *  1. 字段名黑名单 — 命中即剔除 (无论值是什么)
 *  2. 值内容黑名单 — 命中 secret pattern 即替换为 "[REDACTED]"
 *
 * 调用方 (route handler) 只负责真实 SELECT, sanitize 在框架内强制.
 * 即使 SELECT * 不小心带出 password 字段, 也无法到达文件正文.
 */

/** 字段名黑名单 (大小写不敏感, 含子串匹配) */
const FIELD_BLACKLIST = [
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "apikey",
  "private_key",
  "privatekey",
  "auth_token",
  "session_id",
  "credential",
  "database_url",
  "db_url",
  "connection_string",
  "conn_str",
]

/** 值内容黑名单 (regex, 命中即 [REDACTED]) */
const VALUE_PATTERNS = [
  // postgres/mysql 连接串 (含密码)
  /postgres(?:ql)?:\/\/[^@\s]+:[^@\s]+@/i,
  /mysql:\/\/[^@\s]+:[^@\s]+@/i,
  // mongodb 连接串
  /mongodb(?:\+srv)?:\/\/[^@\s]+:[^@\s]+@/i,
  // generic API key (Bearer xxx, sk-xxx, etc.)
  /\bBearer\s+[A-Za-z0-9._-]{20,}/i,
  /\bsk-[A-Za-z0-9]{20,}/,
  /\bxox[a-z]-[A-Za-z0-9-]{20,}/,
]

export function isFieldBlacklisted(name: string): boolean {
  const lower = name.toLowerCase()
  return FIELD_BLACKLIST.some((pat) => lower.includes(pat))
}

export function sanitizeValue(value: unknown): unknown {
  if (value == null) return value
  if (typeof value !== "string") return value
  for (const pat of VALUE_PATTERNS) {
    if (pat.test(value)) return "[REDACTED]"
  }
  return value
}

/**
 * sanitize: 1) 剔除黑名单字段名, 2) 替换黑名单值, 3) 保留列顺序
 *
 * 注意: columns 列表也会被过滤, 调用方收到的可能比传入少几列.
 */
export function sanitizeRows<Row extends Record<string, unknown>>(
  rows: Row[],
  columns: Array<keyof Row & string>
): Row[] {
  const safeCols = columns.filter((c) => !isFieldBlacklisted(c))
  return rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const c of safeCols) {
      out[c] = sanitizeValue(row[c])
    }
    return out as Row
  })
}

/** 暴露给 audit / e2e — 让 columns 也能 sanitize */
export function sanitizeColumns<Row>(columns: Array<keyof Row & string>): Array<keyof Row & string> {
  return columns.filter((c) => !isFieldBlacklisted(c))
}
