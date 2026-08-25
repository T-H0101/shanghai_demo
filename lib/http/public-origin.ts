/**
 * 浏览器可打开的对外 Origin。
 *
 * Next standalone 的 HOSTNAME 只表示 listen（常为 0.0.0.0），不能写进 Location。
 * 对外绝对 URL 只允许来自本模块，禁止直接用 req.nextUrl.origin。
 *
 * 优先级：PUBLIC_APP_URL → X-Forwarded-* / Host → 请求 URL（主机可用时）→ 本机回环。
 */

export type OriginRequest = {
  url?: string
  headers?: Headers | { get(name: string): string | null }
}

const LOOPBACK_ORIGIN = "http://127.0.0.1:3000"

function headerGet(headers: OriginRequest["headers"], name: string): string | null {
  return headers?.get(name) ?? null
}

function isUnusableHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "")
  return h === "0.0.0.0" || h === "::" || h === ""
}

function originFromCandidate(value: string, fallbackProtocol = "http"): string | null {
  const trimmed = value.trim().replace(/\/+$/, "")
  if (!trimmed) return null
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `${fallbackProtocol}://${trimmed}`
    const parsed = new URL(withScheme)
    if (isUnusableHostname(parsed.hostname)) return null
    return parsed.origin
  } catch {
    return null
  }
}

function configuredPublicOrigin(): string | null {
  const raw =
    process.env.PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || ""
  return originFromCandidate(raw)
}

function forwardedOrigin(req?: OriginRequest): string | null {
  const protoRaw = headerGet(req?.headers, "x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase()
  const proto =
    protoRaw === "https" || protoRaw === "http"
      ? protoRaw
      : req?.url?.startsWith("https:")
        ? "https"
        : "http"
  const host =
    headerGet(req?.headers, "x-forwarded-host")?.split(",")[0]?.trim() ||
    headerGet(req?.headers, "host")?.trim() ||
    ""
  return originFromCandidate(host, proto)
}

function originFromRequestUrl(url?: string): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (isUnusableHostname(parsed.hostname)) return null
    return parsed.origin
  } catch {
    return null
  }
}

export function resolvePublicOrigin(req?: OriginRequest): string {
  return (
    configuredPublicOrigin() ||
    forwardedOrigin(req) ||
    originFromRequestUrl(req?.url) ||
    LOOPBACK_ORIGIN
  )
}

/** 基于对外 Origin 拼绝对 URL（path 可带 query）。 */
export function publicAbsoluteUrl(path: string, req?: OriginRequest): string {
  return new URL(path, `${resolvePublicOrigin(req)}/`).toString()
}
